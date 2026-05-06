import { defaultStoreProducts, defaultStoreSettings, getDefaultSiteElements } from "@/lib/store-data";
import { normalizeProductDraft } from "@/lib/store-product-utils";
import type {
  ProductCategory,
  StoreProduct,
  StoreSettings,
  StoreSiteElement,
  StoreSiteElementPlacement,
} from "@/types/store";

export interface StoreContent {
  products: StoreProduct[];
  settings: StoreSettings;
  updatedAt?: string;
}

const LEGACY_CONTACT_EMAIL = "bookings@kdubbeats.com";
const LEGACY_STATIC_DEMO_BEAT_IDS = new Set(["beat-midnight-current", "beat-blue-voltage"]);
const LEGACY_STATIC_DEMO_PATH_PREFIXES = ["/audio/previews/", "/images/BeatCoverArt/"] as const;

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isLegacyDemoBeat(product: StoreProduct) {
  if (product.category !== "beat") {
    return false;
  }

  return (
    LEGACY_STATIC_DEMO_BEAT_IDS.has(product.id) ||
    LEGACY_STATIC_DEMO_PATH_PREFIXES.some(
      (prefix) =>
        product.audioPreview?.startsWith(prefix) ||
        product.artwork?.startsWith(prefix)
    )
  );
}

function coerceProduct(product: StoreProduct, index: number): StoreProduct {
  const category: ProductCategory = product.category === "beat" ? "beat" : "service";
  const id = cleanText(product.id) || `${category}-${index + 1}`;
  const name = cleanText(product.name);
  const slug = cleanText(product.slug) || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || id;

  return {
    id,
    slug,
    name,
    category,
    genre: cleanText(product.genre),
    description: cleanText(product.description),
    price: Number.isFinite(Number(product.price)) ? Number(product.price) : 0,
    artwork: cleanText(product.artwork),
    audioPreview: cleanText(product.audioPreview),
    previewDuration:
      typeof product.previewDuration === "number" && Number.isFinite(product.previewDuration)
        ? product.previewDuration
        : undefined,
    deliveryFileUrl: cleanText(product.deliveryFileUrl),
    deliveryFileName: cleanText(product.deliveryFileName),
    deliveryFileSize:
      typeof product.deliveryFileSize === "number" && Number.isFinite(product.deliveryFileSize)
        ? product.deliveryFileSize
        : undefined,
    deliveryFileReady: product.deliveryFileReady === true || Boolean(cleanText(product.deliveryFileUrl)),
    soldOut: product.soldOut === true,
    deliverables: Array.isArray(product.deliverables) ? product.deliverables.map(cleanText).filter(Boolean) : [],
    badge: cleanText(product.badge),
    stripeProductId: cleanText(product.stripeProductId),
    stripePriceId: cleanText(product.stripePriceId),
  };
}

export function normalizeStoreProducts(products: StoreProduct[] | undefined) {
  const sourceProducts = Array.isArray(products) && products.length ? products : defaultStoreProducts;

  return sourceProducts
    .map(coerceProduct)
    .map(normalizeProductDraft)
    .filter((product) => !isLegacyDemoBeat(product));
}

function normalizeSiteElements(elements: StoreSiteElement[] | undefined) {
  const defaultElements = getDefaultSiteElements();
  const sourceElements = Array.isArray(elements) && elements.length ? elements : defaultElements;

  return sourceElements
    .map((element, index) => {
      const fallback = defaultElements[index];
      const placement: StoreSiteElementPlacement =
        element.placement === "homepage-workflow" ? "homepage-workflow" : "homepage-feature";

      return {
        id: cleanText(element.id) || fallback?.id || `site-element-${index + 1}`,
        placement,
        label: cleanText(element.label) || fallback?.label || "Site Element",
        eyebrow: cleanText(element.eyebrow) || fallback?.eyebrow || "",
        title: cleanText(element.title) || fallback?.title || "Untitled Element",
        description: cleanText(element.description) || fallback?.description || "",
        visible: element.visible !== false,
      };
    })
    .filter((element) => element.title || element.description);
}

export function normalizeStoreSettings(settings: StoreSettings | undefined): StoreSettings {
  const sourceSettings = settings || defaultStoreSettings;
  const contactEmail =
    sourceSettings.contactEmail === LEGACY_CONTACT_EMAIL
      ? defaultStoreSettings.contactEmail
      : sourceSettings.contactEmail;

  return {
    ...defaultStoreSettings,
    ...sourceSettings,
    brandName: cleanText(sourceSettings.brandName) || defaultStoreSettings.brandName,
    heroTitle: cleanText(sourceSettings.heroTitle) || defaultStoreSettings.heroTitle,
    heroDescription: cleanText(sourceSettings.heroDescription) || defaultStoreSettings.heroDescription,
    storeTitle: cleanText(sourceSettings.storeTitle) || defaultStoreSettings.storeTitle,
    storeDescription: cleanText(sourceSettings.storeDescription) || defaultStoreSettings.storeDescription,
    contactEmail: cleanText(contactEmail) || defaultStoreSettings.contactEmail,
    instagramUrl: cleanText(sourceSettings.instagramUrl) || defaultStoreSettings.instagramUrl,
    siteElements: normalizeSiteElements(sourceSettings.siteElements),
  };
}

export function normalizeStoreContent(content: Partial<StoreContent> | undefined): StoreContent {
  const updatedAt = cleanText(content?.updatedAt);

  return {
    products: normalizeStoreProducts(content?.products),
    settings: normalizeStoreSettings(content?.settings),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

export function getDefaultStoreContent(): StoreContent {
  return normalizeStoreContent({
    products: defaultStoreProducts,
    settings: defaultStoreSettings,
  });
}

export function getPublicStoreContent(content: StoreContent): StoreContent {
  return {
    ...content,
    products: content.products.map(({ deliveryFileUrl: _deliveryFileUrl, ...product }) => ({
      ...product,
      deliveryFileUrl: "",
      deliveryFileReady: product.deliveryFileReady === true || Boolean(_deliveryFileUrl),
    })),
  };
}
