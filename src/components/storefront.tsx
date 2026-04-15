"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import ProductCheckoutForm from "@/components/product-checkout-form";
import { useControlCenterContent } from "@/hooks/use-control-center-content";
import { getReadyBeatProducts, getReadyServiceProducts } from "@/lib/store-product-utils";
import SampleAudioPlayer from "@/components/sample-audio-player";
import { stripePromise } from "@/lib/stripe-client";

export default function Storefront() {
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
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

  const beats = useMemo(() => getReadyBeatProducts(products), [products]);
  const services = useMemo(() => getReadyServiceProducts(products), [products]);

  return (
    <Elements stripe={stripePromise}>
      <main className="page-shell storefront-page">
        <header className="store-hero panel" data-parallax="0.03">
          <div data-reveal="left" data-parallax="0.025">
            <p className="eyebrow">Beat Store</p>
            <h1 className="hero-title">{settings.storeTitle}</h1>
            <p className="hero-text">{settings.storeDescription}</p>
            <div className="hero-actions">
              <Link href="/mixing-mastering" className="button button-secondary">
                View Mix & Master Tiers
              </Link>
            </div>
          </div>
          <div className="store-hero-visual" data-reveal="right" data-parallax="0.12">
            <div className="store-hero-logo-shell" data-parallax="0.08">
              <span className="hero-wave hero-wave-top" aria-hidden="true"></span>
              <span className="hero-wave hero-wave-bottom" aria-hidden="true"></span>
              <img src="/branding/logo.png" alt="KDUB Beats logo" className="store-hero-logo" />
            </div>
            <div className="logo-chip-row store-chip-row" aria-hidden="true">
              <span>Beat Licenses</span>
              <span>Mixing</span>
              <span>Mastering</span>
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

        <section className="section-block">
          <div className="section-copy" data-reveal="fade">
            <p className="eyebrow">Beat Store</p>
            <h2>Preview beats with clean branding and secure checkout.</h2>
            <p>
              Every beat stays protected with short sample playback while the full purchase flow
              runs through Stripe.
            </p>
          </div>
          {beats.length ? (
            <div className="store-grid">
              {beats.map((product) => {
                const isActive = activeProductId === product.id;

                return (
                  <article className="panel store-card" key={product.id} data-reveal="zoom" data-parallax="0.018">
                    {product.badge ? <span className="product-badge">{product.badge}</span> : null}
                    {product.artwork ? (
                      <img src={product.artwork} alt={`${product.name} artwork`} className="product-artwork" />
                    ) : null}
                    <div className="store-card-body">
                      <div className="product-topline">
                        <span>{product.genre}</span>
                        <strong>${product.price}</strong>
                      </div>
                      <h3>{product.name}</h3>
                      <p>{product.description}</p>
                      {product.audioPreview ? (
                        <SampleAudioPlayer
                          src={product.audioPreview}
                          className="preview-player"
                          maxSeconds={20}
                          caption={`Only a short ${product.previewDuration ? Math.round(product.previewDuration) : 20}-second sample is available before purchase.`}
                        />
                      ) : null}
                      <ul className="deliverable-list">
                        {product.deliverables.map((deliverable) => (
                          <li key={deliverable}>{deliverable}</li>
                        ))}
                      </ul>
                      {isActive ? (
                        <ProductCheckoutForm
                          product={product}
                          onCancel={() => setActiveProductId(null)}
                          onSuccess={() => {
                            setActiveProductId(null);
                            setSuccessMessage(
                              `${product.name} was purchased successfully. Check your Stripe dashboard for the payment and follow up with delivery.`
                            );
                          }}
                        />
                      ) : (
                        <button className="button button-primary full-width" onClick={() => setActiveProductId(product.id)}>
                          Buy Now
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <article className="panel store-empty-state" data-reveal="fade">
              <p className="eyebrow">No Beats Live Yet</p>
              <h3>Beat previews only go live after they are uploaded in the private admin page.</h3>
              <p>
                This storefront will stay clean until new beats, artwork, and short protected
                preview samples are added from the admin upload flow.
              </p>
            </article>
          )}
        </section>

        <section className="section-block">
          <div className="section-copy" data-reveal="fade">
            <p className="eyebrow">Studio Services</p>
            <h2>Mixing and mastering now has its own sleek tiered checkout flow.</h2>
            <p>
              Artists can compare packages, choose the right tier, and pay from a dedicated service
              checkout page built around your studio offers.
            </p>
          </div>
          {services.length ? (
            <div className="service-tier-preview-grid">
              {services.map((product) => {
                return (
                  <article className="panel store-card service-store-card" key={product.id} data-reveal="zoom" data-parallax="0.018">
                    {product.badge ? <span className="product-badge">{product.badge}</span> : null}
                    <div className="store-card-body">
                      <div className="product-topline">
                        <span>Service Tier</span>
                        <strong>${product.price}</strong>
                      </div>
                      <h3>{product.name}</h3>
                      <p>{product.description}</p>
                      <ul className="deliverable-list">
                        {product.deliverables.map((deliverable) => (
                          <li key={deliverable}>{deliverable}</li>
                        ))}
                      </ul>
                      <Link href={`/mixing-mastering?tier=${product.slug}`} className="button button-primary full-width">
                        Choose This Tier
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <article className="panel store-empty-state" data-reveal="fade">
              <p className="eyebrow">No Service Tiers Live Yet</p>
              <h3>Upload your mixing and mastering packages in the private admin to activate this section.</h3>
              <p>
                As soon as your tier names, pricing, and deliverables are added there, this service
                preview area and the dedicated checkout page will update automatically.
              </p>
            </article>
          )}
          <div className="panel service-cta-banner" data-reveal="fade" data-parallax="0.04">
            <div>
              <p className="eyebrow">Dedicated Service Checkout</p>
              <h3>Let artists compare tiers before they pay.</h3>
              <p>
                The service page is focused on mix and master packages only, with cleaner wording,
                tier selection, and a checkout panel built for studio work.
              </p>
            </div>
            <Link href="/mixing-mastering" className="button button-primary">
              Open Service Checkout
            </Link>
          </div>
        </section>
      </main>
    </Elements>
  );
}
