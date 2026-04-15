"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SampleAudioPlayer from "@/components/sample-audio-player";
import type { StripeMode } from "@/lib/stripe";
import {
  getStoredProducts,
  getStoredSettings,
  resetStoredContent,
  saveStoredProducts,
  saveStoredSettings,
} from "@/lib/control-center-storage";
import { defaultStoreProducts, defaultStoreSettings } from "@/lib/store-data";
import type { ProductCategory, StoreProduct, StoreSettings } from "@/types/store";

const MAX_SAMPLE_SECONDS = 20.25;

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createNewProduct(category: ProductCategory): StoreProduct {
  const timestamp = Date.now().toString(36);

  return {
    id: `${category}-${timestamp}`,
    slug: `${category}-${timestamp}`,
    name: category === "beat" ? "New Beat" : "New Service",
    category,
    genre: category === "beat" ? "Genre" : "",
    description: "",
    price: 0,
    artwork: "",
    audioPreview: "",
    previewDuration: undefined,
    deliverables: [""],
    badge: "",
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function getAudioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = document.createElement("audio");

    audio.preload = "metadata";
    audio.src = objectUrl;

    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      URL.revokeObjectURL(objectUrl);

      if (!Number.isFinite(duration)) {
        reject(new Error("Could not read audio length."));
        return;
      }

      resolve(duration);
    };

    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Audio file could not be read."));
    };
  });
}

function formatDuration(seconds: number | undefined) {
  if (!seconds || !Number.isFinite(seconds)) {
    return "Not set";
  }

  return `${seconds.toFixed(1)}s`;
}

function getProtectedSampleIssue(products: StoreProduct[]) {
  const invalidPreview = products.find((product) => {
    if (product.category !== "beat" || !product.audioPreview) {
      return false;
    }

    const isUploadedSample = product.audioPreview.startsWith("data:");

    if (product.previewDuration && product.previewDuration > MAX_SAMPLE_SECONDS) {
      return true;
    }

    return isUploadedSample && (!product.previewDuration || product.previewDuration > MAX_SAMPLE_SECONDS);
  });

  if (!invalidPreview) {
    return "";
  }

  return `${invalidPreview.name || "A beat"} needs a fresh sample upload. Only 20-second previews can be saved in the control center.`;
}

interface ControlCenterProps {
  stripeStatus: {
    configured: boolean;
    mode: StripeMode;
    dashboardUrl: string;
  };
}

function getStripeModeLabel(mode: StripeMode) {
  if (mode === "live") {
    return "Live Mode";
  }

  if (mode === "test") {
    return "Test Mode";
  }

  return "Not Configured";
}

export default function ControlCenter({ stripeStatus }: ControlCenterProps) {
  const router = useRouter();
  const [products, setProducts] = useState<StoreProduct[]>(defaultStoreProducts);
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [saving, setSaving] = useState(false);
  const [stripeSyncing, setStripeSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Beats only go live from uploads made here. Use short preview snippets only, and anything longer than 20 seconds is rejected."
  );
  const beatCount = products.filter((product) => product.category === "beat").length;
  const serviceCount = products.filter((product) => product.category === "service").length;
  const stripeLinkedCount = products.filter((product) => Boolean(product.stripePriceId)).length;
  const protectedSampleCount = products.filter(
    (product) =>
      product.category === "beat" &&
      Boolean(product.audioPreview) &&
      typeof product.previewDuration === "number" &&
      product.previewDuration <= MAX_SAMPLE_SECONDS
  ).length;

  useEffect(() => {
    async function loadContent() {
      const [storedProducts, storedSettings] = await Promise.all([
        getStoredProducts(),
        getStoredSettings(),
      ]);

      setProducts(storedProducts);
      setSettings(storedSettings);

      const sampleIssue = getProtectedSampleIssue(storedProducts);

      if (sampleIssue) {
        setStatusMessage(sampleIssue);
      }
    }

    loadContent().catch(() => {
      setStatusMessage("Could not load saved control-center content. Using defaults for now.");
    });
  }, []);

  function updateProduct(index: number, patch: Partial<StoreProduct>) {
    setProducts((current) =>
      current.map((product, productIndex) => {
        if (productIndex !== index) {
          return product;
        }

        const nextName = patch.name ?? product.name;

        return {
          ...product,
          ...patch,
          slug: createSlug(nextName || product.slug || product.id),
        };
      })
    );
  }

  function updateDeliverables(index: number, value: string) {
    const deliverables = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    updateProduct(index, {
      deliverables: deliverables.length ? deliverables : [""],
    });
  }

  async function handleFileUpload(
    event: ChangeEvent<HTMLInputElement>,
    index: number,
    field: "artwork" | "audioPreview"
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      if (field === "audioPreview") {
        const duration = await getAudioDuration(file);

        if (duration > MAX_SAMPLE_SECONDS) {
          event.target.value = "";
          setStatusMessage(
            "Preview rejected. Upload a 20-second sample or shorter, not the full beat."
          );
          return;
        }

        const dataUrl = await fileToDataUrl(file);
        updateProduct(index, {
          audioPreview: dataUrl,
          previewDuration: duration,
        });
        setStatusMessage(
          `Preview sample loaded at ${duration.toFixed(1)} seconds. This fits the 20-second security limit.`
        );
        return;
      }

      const dataUrl = await fileToDataUrl(file);
      updateProduct(index, { artwork: dataUrl });
      setStatusMessage("Artwork loaded. Save changes to publish it.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setStatusMessage(message);
    }
  }

  async function handleSave() {
    setSaving(true);

    try {
      const sampleIssue = getProtectedSampleIssue(products);

      if (sampleIssue) {
        setStatusMessage(sampleIssue);
        return;
      }

      await Promise.all([saveStoredProducts(products), saveStoredSettings(settings)]);
      setStatusMessage("Control center changes saved. Refresh the storefront if it is already open in another tab.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed.";
      setStatusMessage(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);

    try {
      await resetStoredContent();
      setProducts(defaultStoreProducts);
      setSettings(defaultStoreSettings);
      setStatusMessage("Control center content was reset to the starter defaults.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reset failed.";
      setStatusMessage(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStripeSync() {
    setStripeSyncing(true);

    try {
      const sampleIssue = getProtectedSampleIssue(products);

      if (sampleIssue) {
        setStatusMessage(sampleIssue);
        return;
      }

      const response = await fetch("/api/control-center/stripe/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          products,
        }),
      });

      const result = await response.json();

      if (!response.ok || !Array.isArray(result.products)) {
        throw new Error(result.error || "Stripe sync failed.");
      }

      setProducts(result.products);
      await saveStoredProducts(result.products);
      setStatusMessage(
        `Stripe synced for ${result.syncedCount} products. Checkout now uses Stripe-linked pricing where available.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe sync failed.";
      setStatusMessage(message);
    } finally {
      setStripeSyncing(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/control-center/logout", {
      method: "POST",
    });

    router.push("/studio-session");
    router.refresh();
  }

  return (
    <main className="page-shell control-center-page">
      <header className="store-hero panel">
        <div data-reveal="left">
          <p className="eyebrow">Control Center</p>
          <h1 className="hero-title">Upload and manage your storefront in one place.</h1>
          <p className="hero-text">
            Organize your beat catalog, manage service offers, and publish beats only after their
            artwork and protected preview sample are uploaded here.
          </p>
        </div>
        <div className="store-hero-visual" data-reveal="right" data-parallax="0.1">
          <button type="button" className="button button-secondary control-logout" onClick={handleLogout}>
            Sign Out
          </button>
          <div className="store-hero-logo-shell">
            <img src="/branding/logo.png" alt="KDUB Beats logo" className="store-hero-logo" />
          </div>
          <div className="logo-chip-row store-chip-row" aria-hidden="true">
            <span>Beat Samples</span>
            <span>Pricing</span>
            <span>Brand Copy</span>
          </div>
        </div>
      </header>

      <section className="section-block section-block-tight">
        <div className="control-overview" data-reveal="fade">
          <article className="panel control-overview-card">
            <span className="control-overview-label">Beats Loaded</span>
            <strong className="control-overview-value">{beatCount}</strong>
            <p>Catalog items ready to preview and sell from the storefront.</p>
          </article>
          <article className="panel control-overview-card">
            <span className="control-overview-label">Service Offers</span>
            <strong className="control-overview-value">{serviceCount}</strong>
            <p>Mixing and mastering packages currently listed in the store.</p>
          </article>
          <article className="panel control-overview-card">
            <span className="control-overview-label">Protected Samples</span>
            <strong className="control-overview-value">{protectedSampleCount}</strong>
            <p>Beat previews already verified under the 20-second upload limit.</p>
          </article>
          <article className="panel control-overview-card">
            <span className="control-overview-label">Stripe Linked</span>
            <strong className="control-overview-value">{stripeLinkedCount}</strong>
            <p>Products already synced with Stripe-backed pricing IDs.</p>
          </article>
        </div>
      </section>

      <section className="section-block section-block-tight">
        <div className="panel control-stripe-panel" data-reveal="fade">
          <div className="control-stripe-copy">
            <p className="eyebrow">Stripe Control</p>
            <h3>
              {stripeStatus.configured
                ? `${getStripeModeLabel(stripeStatus.mode)} is linked to this admin page.`
                : "Stripe still needs to be configured before the admin can sync products."}
            </h3>
            <p>
              Syncing here creates or updates Stripe products and price IDs for your catalog, then
              checkout can use Stripe-backed pricing.
            </p>
          </div>
          <div className="control-stripe-meta">
            <div className="control-meta-list">
              <div>
                <span>Stripe Status</span>
                <strong>{stripeStatus.configured ? "Connected" : "Missing keys"}</strong>
              </div>
              <div>
                <span>Mode</span>
                <strong>{getStripeModeLabel(stripeStatus.mode)}</strong>
              </div>
              <div>
                <span>Catalog Sync</span>
                <strong>{stripeLinkedCount} linked products</strong>
              </div>
            </div>
          </div>
          <div className="control-stripe-actions">
            <a
              className="button button-secondary"
              href={stripeStatus.dashboardUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Stripe Dashboard
            </a>
            <button
              className="button button-primary"
              type="button"
              onClick={handleStripeSync}
              disabled={!stripeStatus.configured || stripeSyncing || saving || !products.length}
            >
              {stripeSyncing ? "Syncing Stripe..." : "Sync Catalog To Stripe"}
            </button>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-copy" data-reveal="fade">
          <p className="eyebrow">Site Settings</p>
          <h2>Core brand and contact details.</h2>
        </div>

        <div className="control-settings-layout">
          <section className="panel control-panel control-settings-panel" data-reveal="fade">
            <div>
              <p className="eyebrow">Brand Details</p>
              <h3>Identity and contact channels.</h3>
            </div>
            <div className="control-grid control-grid-two">
              <label>
                Brand Name
                <input
                  value={settings.brandName}
                  onChange={(event) => setSettings((current) => ({ ...current, brandName: event.target.value }))}
                />
              </label>
              <label>
                Contact Email
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(event) => setSettings((current) => ({ ...current, contactEmail: event.target.value }))}
                />
              </label>
              <label className="control-full">
                Instagram URL
                <input
                  value={settings.instagramUrl}
                  onChange={(event) => setSettings((current) => ({ ...current, instagramUrl: event.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="panel control-panel control-settings-panel" data-reveal="fade">
            <div>
              <p className="eyebrow">Homepage Copy</p>
              <h3>Headlines and messaging that shape the storefront.</h3>
            </div>
            <div className="control-grid control-grid-two">
              <label className="control-full">
                Homepage Headline
                <input
                  value={settings.heroTitle}
                  onChange={(event) => setSettings((current) => ({ ...current, heroTitle: event.target.value }))}
                />
              </label>
              <label className="control-full">
                Homepage Description
                <textarea
                  rows={4}
                  value={settings.heroDescription}
                  onChange={(event) => setSettings((current) => ({ ...current, heroDescription: event.target.value }))}
                />
              </label>
              <label className="control-full">
                Store Headline
                <input
                  value={settings.storeTitle}
                  onChange={(event) => setSettings((current) => ({ ...current, storeTitle: event.target.value }))}
                />
              </label>
              <label className="control-full">
                Store Description
                <textarea
                  rows={3}
                  value={settings.storeDescription}
                  onChange={(event) => setSettings((current) => ({ ...current, storeDescription: event.target.value }))}
                />
              </label>
            </div>
          </section>
        </div>
      </section>

      <section className="section-block">
        <div className="section-copy" data-reveal="fade">
          <p className="eyebrow">Catalog Editor</p>
          <h2>Manage beats and services with a cleaner layout.</h2>
          <p>
            Nothing is preloaded now. Beat cards appear on the storefront only after you create
            them here and upload the media yourself.
          </p>
        </div>

        <div className="panel control-toolbar" data-reveal="fade">
          <div className="control-toolbar-copy">
            <p className="eyebrow">Admin Actions</p>
            <h3>Update your live store from one dashboard.</h3>
            <p>
              Add new products, tighten preview security, and save your latest catalog changes in
              one place.
            </p>
          </div>
          <div className="control-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => setProducts((current) => [...current, createNewProduct("beat")])}
            >
              Add Beat
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setProducts((current) => [...current, createNewProduct("service")])}
            >
              Add Service
            </button>
            <button className="button button-secondary" type="button" onClick={handleReset} disabled={saving}>
              Reset To Defaults
            </button>
            <button className="button button-primary" type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save All Changes"}
            </button>
          </div>
        </div>

        <p className="config-banner control-banner" data-reveal="fade" aria-live="polite">
          {statusMessage}
        </p>

        <div className="control-stack">
          {products.map((product, index) => (
            <article className="panel control-panel" key={product.id} data-reveal="zoom">
              <div className="control-card-topline">
                <div>
                  <p className="eyebrow">{product.category === "beat" ? "Beat Item" : "Service Item"}</p>
                  <h3>{product.name || "Untitled Product"}</h3>
                </div>
                <button
                  type="button"
                  className="button button-secondary control-delete"
                  onClick={() => setProducts((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remove
                </button>
              </div>

              <div className="control-product-layout">
                <div className="control-main-stack">
                  <div className="control-grid control-grid-product">
                    <label>
                      Product Type
                      <select
                        value={product.category}
                        onChange={(event) =>
                          updateProduct(index, {
                            category: event.target.value as ProductCategory,
                            genre: event.target.value === "beat" ? product.genre || "Genre" : "",
                            artwork: event.target.value === "service" ? "" : product.artwork,
                            audioPreview: event.target.value === "service" ? "" : product.audioPreview,
                            previewDuration: event.target.value === "service" ? undefined : product.previewDuration,
                          })
                        }
                      >
                        <option value="beat">Beat</option>
                        <option value="service">Service</option>
                      </select>
                    </label>
                    <label>
                      Name
                      <input value={product.name} onChange={(event) => updateProduct(index, { name: event.target.value })} />
                    </label>
                    <label>
                      Price
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.price}
                        onChange={(event) => updateProduct(index, { price: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      Badge
                      <input value={product.badge || ""} onChange={(event) => updateProduct(index, { badge: event.target.value })} />
                    </label>
                    {product.category === "beat" ? (
                      <label>
                        Genre
                        <input value={product.genre || ""} onChange={(event) => updateProduct(index, { genre: event.target.value })} />
                      </label>
                    ) : (
                      <label>
                        Delivery Type
                        <input value="Service Package" readOnly className="control-readonly" />
                      </label>
                    )}
                    <label className="control-full">
                      Description
                      <textarea
                        rows={4}
                        value={product.description}
                        onChange={(event) => updateProduct(index, { description: event.target.value })}
                      />
                    </label>
                    <label className="control-full">
                      Deliverables
                      <textarea
                        rows={5}
                        value={product.deliverables.join("\n")}
                        onChange={(event) => updateDeliverables(index, event.target.value)}
                        placeholder="One deliverable per line"
                      />
                    </label>
                  </div>
                </div>

                <aside className="control-side-stack">
                  <section className="control-subpanel">
                    <p className="eyebrow">Store Snapshot</p>
                    <div className="control-meta-list">
                      <div>
                        <span>Slug</span>
                        <strong>{product.slug}</strong>
                      </div>
                      <div>
                        <span>Price</span>
                        <strong>${product.price.toFixed(2)}</strong>
                      </div>
                      <div>
                        <span>Preview Limit</span>
                        <strong>{product.category === "beat" ? "20 seconds max" : "Not used"}</strong>
                      </div>
                      <div>
                        <span>Stripe Link</span>
                        <strong>{product.stripePriceId ? "Synced" : "Not yet synced"}</strong>
                      </div>
                      {product.stripePriceId ? (
                        <div>
                          <span>Stripe Price ID</span>
                          <strong>{product.stripePriceId}</strong>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  {product.category === "beat" ? (
                    <section className="control-subpanel">
                      <p className="eyebrow">Beat Media</p>
                      <div className="control-media-stack">
                        <label>
                          Artwork Upload
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(event) => void handleFileUpload(event, index, "artwork")}
                          />
                        </label>
                        <label>
                          Sample Upload
                          <input
                            type="file"
                            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg"
                            onChange={(event) => void handleFileUpload(event, index, "audioPreview")}
                          />
                        </label>
                        <p className="control-security-note">
                          Upload preview snippets only. Any audio longer than 20 seconds is blocked.
                        </p>
                        <div className="control-meta-inline">
                          <span>Current sample length</span>
                          <strong>{formatDuration(product.previewDuration)}</strong>
                        </div>
                        {product.artwork ? (
                          <img src={product.artwork} alt={`${product.name} artwork preview`} className="control-preview-image" />
                        ) : (
                          <div className="control-empty-state">No artwork uploaded yet.</div>
                        )}
                        {product.audioPreview ? (
                          <SampleAudioPlayer
                            src={product.audioPreview}
                            className="preview-player"
                            maxSeconds={20}
                            caption="Playback is locked to a 20-second sample for storefront security."
                          />
                        ) : (
                          <div className="control-empty-state">No sample uploaded yet.</div>
                        )}
                      </div>
                    </section>
                  ) : (
                    <section className="control-subpanel">
                      <p className="eyebrow">Service Summary</p>
                      <div className="control-meta-list">
                        <div>
                          <span>Category</span>
                          <strong>Service Package</strong>
                        </div>
                        <div>
                          <span>Visual Media</span>
                          <strong>Uses brand styling only</strong>
                        </div>
                        <div>
                          <span>Delivery</span>
                          <strong>Manual follow-up after purchase</strong>
                        </div>
                      </div>
                    </section>
                  )}
                </aside>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
