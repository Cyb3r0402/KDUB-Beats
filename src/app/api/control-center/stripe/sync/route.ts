import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { loadPublishedStoreContent, savePublishedStoreContent } from "@/lib/control-center-content-store";
import { normalizeProductDraft } from "@/lib/store-product-utils";
import type { StoreProduct } from "@/types/store";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured. Add STRIPE_SECRET_KEY to your environment variables." },
      { status: 500 }
    );
  }

  const { products: incomingProducts } = (await request.json()) as { products: StoreProduct[] };

  if (!Array.isArray(incomingProducts)) {
    return NextResponse.json({ error: "Invalid request body. Expected an array of products." }, { status: 400 });
  }

  const updatedProducts: StoreProduct[] = [];
  const failedProducts: { name: string; error: string }[] = [];
  let syncedCount = 0;
  let skippedCount = 0;

  for (const product of incomingProducts) {
    const normalizedProduct = normalizeProductDraft(product); // Ensure product is normalized
    const { id, name, description, price, category, stripeProductId, stripePriceId } = normalizedProduct;

    // Skip products that don't have a name or a valid price for Stripe
    if (!name || price < 0.5) { // Stripe's minimum charge amount is 0.50 USD
      skippedCount++;
      updatedProducts.push(normalizedProduct); // Keep skipped products in the list
      continue;
    }

    try {
      let currentStripeProductId = stripeProductId;
      let currentStripePriceId = stripePriceId;

      // 1. Ensure Stripe Product exists
      if (!currentStripeProductId) {
        const stripeProduct = await stripe.products.create({
          name: name,
          description: description || undefined,
          metadata: {
            productId: id,
            category: category,
          },
        });
        currentStripeProductId = stripeProduct.id;
      } else {
        // Update existing Stripe Product if name or description changed
        const existingStripeProduct = await stripe.products.retrieve(currentStripeProductId);
        if (existingStripeProduct.name !== name || existingStripeProduct.description !== description) {
          await stripe.products.update(currentStripeProductId, {
            name: name,
            description: description || undefined,
          });
        }
      }

      // 2. Ensure Stripe Price exists and matches the current product price
      let priceNeedsUpdate = false;
      if (currentStripePriceId) {
        try {
          const existingStripePrice = await stripe.prices.retrieve(currentStripePriceId);
          // Stripe stores amount in cents
          if (existingStripePrice.unit_amount !== Math.round(price * 100) || existingStripePrice.currency !== "usd") {
            // Deactivate old price if it doesn't match the current product price
            await stripe.prices.update(currentStripePriceId, { active: false });
            priceNeedsUpdate = true;
          } else {
            // Price matches, ensure it's active
            if (!existingStripePrice.active) {
              await stripe.prices.update(currentStripePriceId, { active: true });
            }
          }
        } catch (priceError) {
          // If price ID is invalid or not found, create a new one
          if (priceError instanceof Stripe.errors.StripeError && priceError.code === "resource_missing") {
            priceNeedsUpdate = true;
          } else {
            throw priceError; // Re-throw other Stripe errors
          }
        }
      } else {
        priceNeedsUpdate = true;
      }

      if (priceNeedsUpdate) {
        const stripePrice = await stripe.prices.create({
          unit_amount: Math.round(price * 100), // amount in cents
          currency: "usd",
          product: currentStripeProductId,
          active: true,
          metadata: { productId: id, productName: name, category: category },
        });
        currentStripePriceId = stripePrice.id;
      }

      updatedProducts.push({ ...normalizedProduct, stripeProductId: currentStripeProductId, stripePriceId: currentStripePriceId });
      syncedCount++;

    } catch (error) {
      console.error(`Failed to sync product ${name} (${id}) to Stripe:`, error);
      failedProducts.push({ name: name, error: error instanceof Error ? error.message : "Unknown error" });
      updatedProducts.push(normalizedProduct); // Keep failed products in the list
    }
  }

  // Save the updated products back to Vercel Blob
  const currentContent = await loadPublishedStoreContent();
  const newContent = {
    ...currentContent,
    products: updatedProducts,
  };
  await savePublishedStoreContent(newContent);

  return NextResponse.json({
    products: updatedProducts,
    syncedCount,
    skippedCount,
    failedCount: failedProducts.length,
    failedProducts,
  });
}