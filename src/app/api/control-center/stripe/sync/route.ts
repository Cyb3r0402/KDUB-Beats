import { NextRequest, NextResponse } from "next/server";
import {
  CONTROL_CENTER_COOKIE_NAME,
  isAuthorizedControlCenterSession,
} from "@/lib/control-center-auth";
import { stripe } from "@/lib/stripe";
import type { StoreProduct } from "@/types/store";

function normalizeMetadataValue(value: string | undefined) {
  return (value || "").slice(0, 500);
}

function isMissingStripeResource(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "resource_missing"
  );
}

async function syncProduct(product: StoreProduct) {
  if (!stripe) {
    throw new Error("Missing Stripe keys. Add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY first.");
  }

  const amount = Math.round(Number(product.price) * 100);

  if (!product.name.trim()) {
    throw new Error("Every product needs a name before it can sync to Stripe.");
  }

  if (!amount || amount < 50) {
    throw new Error(`${product.name} needs a price of at least $0.50 before it can sync to Stripe.`);
  }

  const metadata = {
    internalProductId: normalizeMetadataValue(product.id),
    slug: normalizeMetadataValue(product.slug),
    category: normalizeMetadataValue(product.category),
    badge: normalizeMetadataValue(product.badge),
    genre: normalizeMetadataValue(product.genre),
  };

  let stripeProduct = null;

  if (product.stripeProductId && product.stripeProductId.startsWith("prod_")) {
    try {
      stripeProduct = await stripe.products.update(product.stripeProductId, {
        name: product.name,
        description: product.description,
        metadata,
        active: true,
      });
    } catch (error) {
      if (!isMissingStripeResource(error)) {
        throw error;
      }
    }
  }

  if (!stripeProduct) {
    stripeProduct = await stripe.products.create({
      name: product.name,
      description: product.description,
      metadata,
      active: true,
    });
  }

  let stripePriceId = product.stripePriceId;

  if (stripePriceId?.startsWith("price_")) {
    let existingPrice = null;

    try {
      existingPrice = await stripe.prices.retrieve(stripePriceId);
    } catch (error) {
      if (!isMissingStripeResource(error)) {
        throw error;
      }
    }

    if (existingPrice) {
      if (
        existingPrice.active &&
        existingPrice.currency === "usd" &&
        existingPrice.unit_amount === amount
      ) {
        return {
          ...product,
          stripeProductId: stripeProduct.id,
          stripePriceId: existingPrice.id,
        };
      }

      if (existingPrice.active) {
        await stripe.prices.update(existingPrice.id, {
          active: false,
        });
      }
    }
  }

  const nextPrice = await stripe.prices.create({
    product: stripeProduct.id,
    unit_amount: amount,
    currency: "usd",
    metadata,
  });

  return {
    ...product,
    stripeProductId: stripeProduct.id,
    stripePriceId: nextPrice.id,
  };
}

function canAttemptStripeSync(product: StoreProduct) {
  const amount = Math.round(Number(product.price) * 100);

  return Boolean(product.name.trim() && amount >= 50);
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(CONTROL_CENTER_COOKIE_NAME)?.value;

  if (!isAuthorizedControlCenterSession(token)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const products = Array.isArray(payload.products) ? (payload.products as StoreProduct[]) : [];

    if (!products.length) {
      return NextResponse.json({ error: "No products were provided for Stripe sync." }, { status: 400 });
    }

    const skippedProducts = products.filter((product) => !canAttemptStripeSync(product));
    const syncableProducts = products.filter(canAttemptStripeSync);

    if (!syncableProducts.length) {
      return NextResponse.json(
        { error: "No products had both a name and a price of at least $0.50." },
        { status: 400 }
      );
    }

    const syncResults = await Promise.allSettled(syncableProducts.map(syncProduct));
    const syncedProducts = syncResults.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    );
    const failedProducts = syncResults
      .map((result, index) => {
        if (result.status === "fulfilled") {
          return null;
        }

        const product = syncableProducts[index];
        return {
          id: product.id,
          name: product.name,
          error: result.reason instanceof Error ? result.reason.message : "Stripe sync failed.",
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      products: syncedProducts,
      syncedCount: syncedProducts.length,
      skippedCount: skippedProducts.length,
      failedCount: failedProducts.length,
      skippedProducts: skippedProducts.map((product) => ({
        id: product.id,
        name: product.name,
        reason: "Add a product name and set a price of at least $0.50.",
      })),
      failedProducts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
