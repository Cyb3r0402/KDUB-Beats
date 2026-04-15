import Stripe from "stripe";

export type StripeMode = "test" | "live" | "unconfigured";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-12-15.clover",
    })
  : null;

export function isStripeConfigured() {
  return Boolean(stripeSecretKey && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

export function getStripeMode(): StripeMode {
  if (!stripeSecretKey) {
    return "unconfigured";
  }

  if (stripeSecretKey.startsWith("sk_live_")) {
    return "live";
  }

  return "test";
}

export function getStripeDashboardUrl() {
  return getStripeMode() === "live"
    ? "https://dashboard.stripe.com/"
    : "https://dashboard.stripe.com/test/";
}
