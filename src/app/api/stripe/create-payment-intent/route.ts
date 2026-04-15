import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY. Add it to .env.local before using checkout." },
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
    } = await request.json();

    let amount = Math.round(Number(price) * 100);

    if (stripePriceId && String(stripePriceId).startsWith("price_")) {
      const syncedPrice = await stripe.prices.retrieve(String(stripePriceId));

      if (typeof syncedPrice.unit_amount !== "number" || syncedPrice.currency !== "usd") {
        return NextResponse.json({ error: "Stripe price is not valid for checkout." }, { status: 400 });
      }

      amount = syncedPrice.unit_amount;
    }

    if (!amount || amount < 50) {
      return NextResponse.json({ error: "Invalid product price." }, { status: 400 });
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
        productName: String(productName),
        category: String(category),
        fullName: String(fullName),
        email: String(email),
        priceUsd: String(price),
        stripeProductId: String(stripeProductId || ""),
        stripePriceId: String(stripePriceId || ""),
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
