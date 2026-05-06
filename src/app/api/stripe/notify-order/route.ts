import { NextRequest, NextResponse } from "next/server";
import { notifyOrderFulfillment } from "@/lib/order-notifications";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY. Add it to your environment variables before using checkout." },
      { status: 500 }
    );
  }

  try {
    const { paymentIntentId, clientSecret } = await request.json();

    if (!paymentIntentId || !clientSecret) {
      return NextResponse.json({ error: "Missing payment intent confirmation details." }, { status: 400 });
    }

    const result = await notifyOrderFulfillment(String(paymentIntentId), String(clientSecret));

    return NextResponse.json({ ok: true, alreadyNotified: result.alreadyNotified });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send the order notification email.";
    const status =
      message === "Payment confirmation does not match this order." ||
      message === "Payment has not completed successfully yet."
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
