import { NextRequest, NextResponse } from "next/server";
import { loadPublishedStoreContent } from "@/lib/control-center-content-store";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY. Add it to your environment variables before using checkout." },
      { status: 500 }
    );
  }

  try {
    const {
      productId,
      productName,
      category,
      price,
      fullName,
      email,
      stripeProductId,
      stripePriceId,
      deliveryFileUrl,
      deliveryFileName,
      soldOut,
    } = await request.json();

    const publishedContent = await loadPublishedStoreContent().catch(() => null);
    const catalogProduct = publishedContent?.products.find((product) => product.id === String(productId)) || null;
    const checkoutPrice = catalogProduct?.price ?? price;
    const checkoutStripeProductId = catalogProduct?.stripeProductId || stripeProductId;
    const checkoutStripePriceId = catalogProduct?.stripePriceId || stripePriceId;
    const checkoutDeliveryFileUrl = catalogProduct?.deliveryFileUrl || deliveryFileUrl;
    const checkoutDeliveryFileName = catalogProduct?.deliveryFileName || deliveryFileName;
    const checkoutSoldOut = catalogProduct?.soldOut ?? soldOut;

    let amount = Math.round(Number(checkoutPrice) * 100);

    if (checkoutStripePriceId && String(checkoutStripePriceId).startsWith("price_")) {
      const syncedPrice = await stripe.prices.retrieve(String(checkoutStripePriceId));

      if (typeof syncedPrice.unit_amount !== "number" || syncedPrice.currency !== "usd") {
        return NextResponse.json({ error: "Stripe price is not valid for checkout." }, { status: 400 });
      }

      amount = syncedPrice.unit_amount;
    }

    if (!amount || amount < 50) {
      return NextResponse.json({ error: "Invalid product price." }, { status: 400 });
    }

    if (checkoutSoldOut === true) {
      return NextResponse.json({ error: "This beat is sold and no longer available." }, { status: 400 });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: email,
      metadata: {
        productId: String(productId),
        productName: String(catalogProduct?.name || productName),
        category: String(catalogProduct?.category || category),
        fullName: String(fullName),
        email: String(email),
        priceUsd: String(checkoutPrice),
        stripeProductId: String(checkoutStripeProductId || ""),
        stripePriceId: String(checkoutStripePriceId || ""),
        deliveryFileUrl: String(checkoutDeliveryFileUrl || "").slice(0, 500),
        deliveryFileName: String(checkoutDeliveryFileName || "").slice(0, 500),
        orderNotificationSent: "false",
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payment intent.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
