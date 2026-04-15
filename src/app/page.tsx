"use client";

import Link from "next/link";
import { useControlCenterContent } from "@/hooks/use-control-center-content";

export default function HomePage() {
  const { settings } = useControlCenterContent();

  return (
    <main className="page-shell">
      <header className="topbar" data-reveal="fade" data-parallax="0.02">
        <div className="brand-lockup">
          <img src="/branding/logo.png" alt={`${settings.brandName} logo`} className="brand-mark" />
          <div>
            <p className="eyebrow">{settings.brandName}</p>
            <h1 className="brand-title">{settings.heroTitle}</h1>
          </div>
        </div>

        <nav className="topnav">
          <Link href="/mixing-mastering">Mixing & Mastering</Link>
          <a href="#workflow">Workflow</a>
          <a href="#contact">Contact</a>
          <Link href="/beatsforsale" className="nav-cta">
            Open Beat Store
          </Link>
        </nav>
      </header>

      <section className="hero-grid">
        <div className="hero-copy panel" data-reveal="left" data-parallax="0.04">
          <p className="eyebrow">Built For Independent Artists</p>
          <h2 className="hero-title">Sleek production, clean mixes, and masters that feel ready to drop.</h2>
          <p className="hero-text">{settings.heroDescription}</p>
          <div className="hero-actions">
            <Link href="/beatsforsale" className="button button-primary">
              Shop Beats
            </Link>
            <Link href="/mixing-mastering" className="button button-secondary">
              View Mix & Master Tiers
            </Link>
          </div>
          <div className="stat-row">
            <article>
              <strong>Stripe Ready</strong>
              <span>Beat sales and studio tier checkout in one system</span>
            </article>
            <article>
              <strong>Tiered Services</strong>
              <span>Mixing and mastering packages built for different release levels</span>
            </article>
            <article>
              <strong>Music First</strong>
              <span>Beats, clean finishing, and strong artist presentation in one place</span>
            </article>
          </div>
        </div>

        <div className="hero-visual panel" data-reveal="right" data-parallax="0.03">
          <div className="hero-logo-card" data-parallax="0.12">
            <span className="hero-wave hero-wave-top" aria-hidden="true"></span>
            <span className="hero-wave hero-wave-bottom" aria-hidden="true"></span>
            <img src="/branding/logo.png" alt={`${settings.brandName} metallic K logo`} className="hero-logo" />
            <div className="logo-chip-row" aria-hidden="true">
              <span>Metallic K Energy</span>
              <span>Electric Blue Pulse</span>
            </div>
          </div>
          <div className="studio-stack" data-parallax="0.05">
            <span className="eyebrow">Studio Stack</span>
            <ul>
              <li>FL Studio for beat design, drums, and melodies</li>
              <li>Logic Pro for arrangement, mixing, and final polish</li>
              <li>Built for premium artist presentation across every screen size</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="logo-flow panel section-block-tight" data-reveal="fade" data-parallax="0.04">
        <div className="logo-flow-mark" data-parallax="0.08">
          <img src="/branding/logo.png" alt="" aria-hidden="true" />
        </div>
        <div className="logo-flow-copy">
          <p className="eyebrow">Brand Flow</p>
          <h2>The logo now drives the whole look with chrome edges, blue current, and motion cues.</h2>
        </div>
        <div className="logo-flow-track" aria-hidden="true">
          <span>Waveform Lighting</span>
          <span>Chrome Contrast</span>
          <span>Beat Energy</span>
          <span>Studio Motion</span>
          <span>Electric Blue Highlights</span>
        </div>
      </section>

      <section id="services" className="section-block">
        <div className="section-copy" data-reveal="fade">
          <p className="eyebrow">What You’re Selling</p>
          <h2>One brand, three clean ways for artists to buy in.</h2>
          <p>
            The site is built to feel premium from the first scroll to the final checkout, whether
            an artist needs a beat, a mix, or a full release finish.
          </p>
        </div>
        <div className="feature-grid">
          <article className="panel feature-card" data-reveal="left" data-parallax="0.025">
            <span className="feature-tag">Beat Store</span>
            <h3>Beat Licensing</h3>
            <p>Sell beats with protected preview playback, branded cover art, and direct payment flow.</p>
          </article>
          <article className="panel feature-card" data-reveal="fade" data-parallax="0.025">
            <span className="feature-tag">Tier Checkout</span>
            <h3>Mixing & Mastering</h3>
            <p>Guide artists into sleek tier selection with a dedicated checkout page for studio work.</p>
          </article>
          <article className="panel feature-card" data-reveal="right" data-parallax="0.025">
            <span className="feature-tag">Artist Brand</span>
            <h3>Professional Presence</h3>
            <p>Build trust with sharp visuals, premium wording, and a smoother buying experience.</p>
          </article>
        </div>
      </section>

      <section id="workflow" className="section-block workflow-grid">
        <article className="panel" data-reveal="left" data-parallax="0.02">
          <span className="step-index">01</span>
          <h3>Choose The Right Offer</h3>
          <p>Artists preview beats or compare mixing and mastering tiers based on where the song is headed.</p>
        </article>
        <article className="panel" data-reveal="fade" data-parallax="0.02">
          <span className="step-index">02</span>
          <h3>Checkout Cleanly</h3>
          <p>Stripe handles the payment flow so the site feels polished and trustworthy from the jump.</p>
        </article>
        <article className="panel" data-reveal="right" data-parallax="0.02">
          <span className="step-index">03</span>
          <h3>Finish The Record</h3>
          <p>Follow up with files, references, and next steps so the song moves fast from payment to delivery.</p>
        </article>
      </section>

      <section id="contact" className="section-block contact-banner panel" data-reveal="fade" data-parallax="0.03">
        <div>
          <p className="eyebrow">Need Custom Work?</p>
          <h2>For exclusives, larger rollouts, and custom sessions, keep the conversation direct.</h2>
          <p>
            When an artist needs something outside the public tiers, your contact section still
            keeps the process personal and flexible.
          </p>
        </div>
        <div className="contact-links">
          <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
          <a href={settings.instagramUrl} target="_blank" rel="noreferrer">
            Instagram Profile
          </a>
        </div>
      </section>
    </main>
  );
}
