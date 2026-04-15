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

  const stripeProduct =
    product.stripeProductId && product.stripeProductId.startsWith("prod_")
      ? await stripe.products.update(product.stripeProductId, {
          name: product.name,
          description: product.description,
          metadata,
          active: true,
        })
      : await stripe.products.create({
          name: product.name,
          description: product.description,
          metadata,
          active: true,
        });

  let stripePriceId = product.stripePriceId;

  if (stripePriceId?.startsWith("price_")) {
    const existingPrice = await stripe.prices.retrieve(stripePriceId);

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

    const syncedProducts = await Promise.all(products.map(syncProduct));

    return NextResponse.json({
      products: syncedProducts,
      syncedCount: syncedProducts.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
