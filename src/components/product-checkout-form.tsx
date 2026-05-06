"use client";

import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type {
  StripeCardCvcElementChangeEvent,
  StripeCardExpiryElementChangeEvent,
  StripeCardNumberElementChangeEvent,
} from "@stripe/stripe-js";
import { useState, type FormEvent } from "react";
import type { StoreProduct } from "@/types/store";

interface CheckoutSuccessPayload {
  fullName: string;
  email: string;
  paymentIntentId?: string;
}

interface ProductCheckoutFormProps {
  product: StoreProduct;
  onSuccess: (payload: CheckoutSuccessPayload) => void;
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
  const [cardNumberComplete, setCardNumberComplete] = useState(false);
  const [cardExpiryComplete, setCardExpiryComplete] = useState(false);
  const [cardCvcComplete, setCardCvcComplete] = useState(false);
  const cardReady = cardNumberComplete && cardExpiryComplete && cardCvcComplete;
  const cardElementOptions = {
    style: {
      base: {
        color: "#eef5ff",
        fontSize: "16px",
        fontFamily: "Avenir Next, Segoe UI, sans-serif",
        lineHeight: "24px",
        "::placeholder": {
          color: "#8ca0b8",
        },
      },
      invalid: {
        color: "#ff9aa4",
      },
    },
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!stripe || !elements) {
      setErrorMessage("Stripe is still loading. Please try again in a moment.");
      return;
    }

    if (!cardReady) {
      setErrorMessage("Enter the full card number, expiration date, and CVC before confirming payment.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get("fullName") || "");
    const email = String(formData.get("email") || "");
    const postalCode = String(formData.get("postalCode") || "");

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
          deliveryFileUrl: product.deliveryFileUrl,
          deliveryFileName: product.deliveryFileName,
          soldOut: product.soldOut,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.clientSecret) {
        throw new Error(result.error || "Unable to start checkout.");
      }

      const cardElement = elements.getElement(CardNumberElement);

      if (!cardElement) {
        throw new Error("Card field failed to load.");
      }

      const paymentResult = await stripe.confirmCardPayment(result.clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: fullName,
            email,
            address: {
              postal_code: postalCode,
            },
          },
        },
      });

      if (paymentResult.error) {
        throw new Error(paymentResult.error.message || "Payment failed.");
      }

      if (paymentResult.paymentIntent?.status === "succeeded") {
        if (paymentResult.paymentIntent.id) {
          const notificationResponse = await fetch("/api/stripe/notify-order", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              paymentIntentId: paymentResult.paymentIntent.id,
              clientSecret: result.clientSecret,
            }),
          });

          if (!notificationResponse.ok) {
            const notificationResult = await notificationResponse.json().catch(() => null);
            console.error("Order notification email failed.", notificationResult);
          }
        }

        onSuccess({
          fullName,
          email,
          paymentIntentId: paymentResult.paymentIntent?.id || undefined,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setErrorMessage(message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <>
      {errorMessage ? (
        <div className="checkout-error-modal-backdrop" role="presentation">
          <div
            className="checkout-error-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="checkout-error-title"
            aria-describedby="checkout-error-description"
          >
            <p className="eyebrow">Payment Declined</p>
            <h3 id="checkout-error-title">The card could not be charged.</h3>
            <p id="checkout-error-description">{errorMessage}</p>
            <button
              type="button"
              className="button button-primary full-width"
              onClick={() => setErrorMessage("")}
            >
              Try Another Card
            </button>
          </div>
        </div>
      ) : null}

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
          Card Number
          <div className="card-element-shell">
            <CardNumberElement
              options={cardElementOptions}
              onChange={(event: StripeCardNumberElementChangeEvent) => {
                setCardNumberComplete(event.complete);
                if (event.error?.message) {
                  setErrorMessage(event.error.message);
                }
              }}
            />
          </div>
        </label>
        <div className="card-details-grid">
          <label>
            Expiration
            <div className="card-element-shell">
              <CardExpiryElement
                options={cardElementOptions}
                onChange={(event: StripeCardExpiryElementChangeEvent) => {
                  setCardExpiryComplete(event.complete);
                  if (event.error?.message) {
                    setErrorMessage(event.error.message);
                  }
                }}
              />
            </div>
          </label>
          <label>
            CVC
            <div className="card-element-shell">
              <CardCvcElement
                options={cardElementOptions}
                onChange={(event: StripeCardCvcElementChangeEvent) => {
                  setCardCvcComplete(event.complete);
                  if (event.error?.message) {
                    setErrorMessage(event.error.message);
                  }
                }}
              />
            </div>
          </label>
          <label>
            ZIP Code
            <input type="text" name="postalCode" inputMode="numeric" autoComplete="postal-code" placeholder="12345" required />
          </label>
        </div>
        {errorMessage ? <p className="checkout-message checkout-error">{errorMessage}</p> : null}
        <div className="checkout-actions">
          {onCancel ? (
            <button type="button" className="button button-secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
          <button type="submit" className="button button-primary" disabled={processing || !cardReady}>
            {processing ? "Processing..." : submitLabel || `Pay $${product.price}`}
          </button>
        </div>
      </form>
    </>
  );
}
