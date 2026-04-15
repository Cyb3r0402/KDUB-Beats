"use client";

import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useState, type FormEvent } from "react";
import type { StoreProduct } from "@/types/store";

interface ProductCheckoutFormProps {
  product: StoreProduct;
  onSuccess: () => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export default function ProductCheckoutForm({
  product,
  onSuccess,
  onCancel,
  submitLabel,
}: ProductCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage("Stripe is still loading. Please try again in a moment.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("fullName") || "");
    const email = String(formData.get("email") || "");

    setProcessing(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          category: product.category,
          price: product.price,
          fullName,
          email,
          stripeProductId: product.stripeProductId,
          stripePriceId: product.stripePriceId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.clientSecret) {
        throw new Error(result.error || "Unable to start checkout.");
      }

      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        throw new Error("Card field failed to load.");
      }

      const paymentResult = await stripe.confirmCardPayment(result.clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: fullName,
            email,
          },
        },
      });

      if (paymentResult.error) {
        throw new Error(paymentResult.error.message || "Payment failed.");
      }

      if (paymentResult.paymentIntent?.status === "succeeded") {
        onSuccess();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setErrorMessage(message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <form className="checkout-form" onSubmit={handleSubmit}>
      <label>
        Full Name
        <input type="text" name="fullName" placeholder="Artist or customer name" required />
      </label>
      <label>
        Email
        <input type="email" name="email" placeholder="Where project details should be sent" required />
      </label>
      <label>
        Card Details
        <div className="card-element-shell">
          <CardElement
            options={{
              style: {
                base: {
                  color: "#eef5ff",
                  fontSize: "16px",
                  fontFamily: "Avenir Next, Segoe UI, sans-serif",
                  "::placeholder": {
                    color: "#8ca0b8",
                  },
                },
              },
            }}
          />
        </div>
      </label>
      {errorMessage ? <p className="checkout-message checkout-error">{errorMessage}</p> : null}
      <div className="checkout-actions">
        {onCancel ? (
          <button type="button" className="button button-secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="button button-primary" disabled={processing}>
          {processing ? "Processing..." : submitLabel || `Pay $${product.price}`}
        </button>
      </div>
    </form>
  );
}
