"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import ProductCheckoutForm from "@/components/product-checkout-form";
import { useControlCenterContent } from "@/hooks/use-control-center-content";
import { getReadyBeatProducts } from "@/lib/store-product-utils";
import SampleAudioPlayer from "@/components/sample-audio-player";
import { stripePromise } from "@/lib/stripe-client";

export default function Storefront() {
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const { products, settings } = useControlCenterContent();
  const configError = !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ? "Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY to your environment variables to enable live checkout."
    : "";

  const beats = useMemo(() => getReadyBeatProducts(products), [products]);

  return (
    <Elements stripe={stripePromise}>
      <main className="page-shell storefront-page">
        <header className="store-hero panel" data-parallax="0.03">
          <div data-reveal="left" data-parallax="0.025" suppressHydrationWarning>
            <p className="eyebrow">Beat Store</p>
            <h1 className="hero-title">{settings.storeTitle}</h1>
            <p className="hero-text">{settings.storeDescription}</p>
            <div className="hero-actions">
              <a href="#beat-store" className="button button-primary">
                Browse Beats
              </a>
            </div>
          </div>
          <div className="store-hero-visual" data-reveal="right" data-parallax="0.12" suppressHydrationWarning>
            <div className="store-hero-logo-shell" data-parallax="0.08">
              <span className="hero-wave hero-wave-top" aria-hidden="true"></span>
              <span className="hero-wave hero-wave-bottom" aria-hidden="true"></span>
              <Image
                src="/branding/logo.png"
                alt="KDUB Beats logo"
                className="store-hero-logo"
                width={220}
                height={220}
                priority
              />
            </div>
            <div className="logo-chip-row store-chip-row" aria-hidden="true">
              <span>Beat Licenses</span>
              <span>Mixing</span>
              <span>Mastering</span>
            </div>
          </div>
        </header>

        {configError ? (
          <p className="config-banner" data-reveal="fade" suppressHydrationWarning>
            {configError}
          </p>
        ) : null}
        {successMessage ? (
          <p className="success-banner" data-reveal="fade" suppressHydrationWarning>
            {successMessage}
          </p>
        ) : null}

        <section className="section-block" id="beat-store">
          <div className="section-copy" data-reveal="fade" suppressHydrationWarning>
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
                  <article className="panel store-card" key={product.id} data-reveal="zoom" data-parallax="0.018" suppressHydrationWarning>
                    {product.badge ? <span className="product-badge">{product.badge}</span> : null}
                    {product.soldOut ? <span className="product-badge product-badge-sold">Sold</span> : null}
                    {product.artwork ? (
                      <Image
                        src={product.artwork}
                        alt={`${product.name} artwork`}
                        className="product-artwork"
                        width={960}
                        height={960}
                        sizes="(max-width: 760px) calc(100vw - 56px), (max-width: 1080px) 45vw, 360px"
                        unoptimized
                      />
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
                      {product.soldOut ? (
                        <button className="button button-secondary full-width" disabled>
                          Sold
                        </button>
                      ) : isActive ? (
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
            <article className="panel store-empty-state" data-reveal="fade" suppressHydrationWarning>
              <p className="eyebrow">No Beats Live Yet</p>
              <h3>Beat previews only go live after they are uploaded.</h3>
              <p>
                This storefront will stay clean until new beats, artwork, and short protected
                preview samples are added from the admin upload flow.
              </p>
            </article>
          )}
        </section>

        <section className="section-block">
          <div className="panel service-cta-banner" data-reveal="fade" data-parallax="0.04" suppressHydrationWarning>
            <div>
              <p className="eyebrow">Need A Mix Too?</p>
              <h3>Mixing and mastering has a separate checkout page.</h3>
              <p>
                Beat buyers stay in this store. Artists who need a mix or master can open the
                dedicated service flow when they are ready.
              </p>
            </div>
            <Link href="/mixing-mastering" className="button button-secondary">
              Open Mixing & Mastering
            </Link>
          </div>
        </section>
      </main>
    </Elements>
  );
}
