"use client";

import Link from "next/link";
import { Elements } from "@stripe/react-stripe-js";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCheckoutForm from "@/components/product-checkout-form";
import { useControlCenterContent } from "@/hooks/use-control-center-content";
import { getReadyServiceProducts } from "@/lib/store-product-utils";
import { stripePromise } from "@/lib/stripe-client";

export default function ServiceTierCheckout() {
  const searchParams = useSearchParams();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [configError, setConfigError] = useState("");
  const { products, settings } = useControlCenterContent();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      setConfigError(
        "Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY in .env.local to enable live checkout."
      );
    }
  }, []);

  const services = useMemo(
    () => getReadyServiceProducts(products),
    [products]
  );
  const selectedSlug = searchParams.get("tier");

  useEffect(() => {
    if (!services.length) {
      setSelectedServiceId(null);
      return;
    }

    const requestedService = services.find((service) => service.slug === selectedSlug);

    setSelectedServiceId((current) => {
      if (current && services.some((service) => service.id === current)) {
        return current;
      }

      return requestedService?.id || services[0].id;
    });
  }, [services, selectedSlug]);

  const selectedService =
    services.find((service) => service.id === selectedServiceId) || services[0] || null;

  return (
    <Elements stripe={stripePromise}>
      <main className="page-shell services-page">
        <header className="services-hero panel" data-parallax="0.03">
          <div data-reveal="left" data-parallax="0.025">
            <p className="eyebrow">Mixing & Mastering Checkout</p>
            <h1 className="hero-title">Choose the tier that fits your record, then checkout securely.</h1>
            <p className="hero-text">
              Built for artists who want clean translation, vocal clarity, and a finish that feels
              ready to release. Pick your tier, pay securely, and send your files after checkout.
            </p>
            <div className="hero-actions">
              <Link href="/beatsforsale" className="button button-secondary">
                Back To Beat Store
              </Link>
              <a href={`mailto:${settings.contactEmail}`} className="button button-primary">
                Ask About Custom Work
              </a>
            </div>
          </div>
          <div className="service-hero-stack" data-reveal="right">
            <div className="service-highlight-strip">
              <span>Tiered Pricing</span>
              <span>Stripe Checkout</span>
              <span>Artist Follow-Up</span>
            </div>
            <div className="service-hero-note" data-parallax="0.06">
              <p className="eyebrow">What Happens Next</p>
              <h3>Checkout holds your slot.</h3>
              <p>
                After payment, you’ll follow up by email with stems, references, and any notes for
                the session.
              </p>
            </div>
          </div>
        </header>

        {configError ? (
          <p className="config-banner" data-reveal="fade">
            {configError}
          </p>
        ) : null}
        {successMessage ? (
          <p className="success-banner" data-reveal="fade">
            {successMessage}
          </p>
        ) : null}

        {!services.length ? (
          <article className="panel store-empty-state section-block" data-reveal="fade">
            <p className="eyebrow">No Service Tiers Live Yet</p>
            <h3>Upload and price your mixing and mastering tiers from the private admin page first.</h3>
            <p>
              Once your service packages are in the control center, this checkout page will update
              automatically with the latest options.
            </p>
          </article>
        ) : (
          <>
            <section className="section-block services-layout">
              <div className="service-tier-grid">
                {services.map((service) => {
                  const isSelected = selectedService?.id === service.id;

                  return (
                    <article
                      key={service.id}
                      className={`panel service-tier-card${isSelected ? " is-selected" : ""}`}
                      data-reveal="zoom"
                      data-parallax="0.02"
                    >
                      {service.badge ? <span className="product-badge">{service.badge}</span> : null}
                      <div className="service-tier-card-body">
                        <div className="product-topline">
                          <span>Studio Tier</span>
                          <strong>${service.price}</strong>
                        </div>
                        <h3>{service.name}</h3>
                        <p>{service.description}</p>
                        <ul className="deliverable-list">
                          {service.deliverables.map((deliverable) => (
                            <li key={deliverable}>{deliverable}</li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          className={isSelected ? "button button-primary full-width" : "button button-secondary full-width"}
                          onClick={() => setSelectedServiceId(service.id)}
                        >
                          {isSelected ? "Selected Tier" : "Choose This Tier"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {selectedService ? (
                <aside className="panel service-checkout-panel" data-reveal="fade" data-parallax="0.02">
                  <div className="service-checkout-copy">
                    <p className="eyebrow">Secure Checkout</p>
                    <h2>{selectedService.name}</h2>
                    <p>{selectedService.description}</p>
                  </div>

                  <div className="service-summary-shell">
                    <div className="service-summary-row">
                      <span>Total</span>
                      <strong>${selectedService.price}</strong>
                    </div>
                    <div className="service-summary-row">
                      <span>Stripe Status</span>
                      <strong>{selectedService.stripePriceId ? "Synced" : "Catalog Price"}</strong>
                    </div>
                  </div>

                  <ul className="deliverable-list service-panel-list">
                    {selectedService.deliverables.map((deliverable) => (
                      <li key={deliverable}>{deliverable}</li>
                    ))}
                  </ul>

                  <p className="service-checkout-note">
                    Checkout covers the selected tier. You’ll send stems, reference tracks, and any
                    notes after payment so the session can start cleanly.
                  </p>

                  <ProductCheckoutForm
                    product={selectedService}
                    submitLabel={`Checkout ${selectedService.name} • $${selectedService.price}`}
                    onSuccess={() => {
                      setSuccessMessage(
                        `${selectedService.name} was purchased successfully. Check Stripe for the payment, then follow up with the client for files and notes.`
                      );
                    }}
                  />
                </aside>
              ) : null}
            </section>

            <section className="section-block service-process-grid">
              <article className="panel" data-reveal="left" data-parallax="0.02">
                <span className="step-index">01</span>
                <h3>Pick Your Tier</h3>
                <p>
                  Choose the level of mix or mix/master support that matches the release and your
                  deadline.
                </p>
              </article>
              <article className="panel" data-reveal="fade" data-parallax="0.02">
                <span className="step-index">02</span>
                <h3>Checkout Securely</h3>
                <p>Pay through Stripe and lock in the selected service tier from the page.</p>
              </article>
              <article className="panel" data-reveal="right" data-parallax="0.02">
                <span className="step-index">03</span>
                <h3>Send The Session</h3>
                <p>
                  Email stems, rough mix notes, and references so the project can move straight into
                  the session workflow.
                </p>
              </article>
            </section>
          </>
        )}
      </main>
    </Elements>
  );
}
