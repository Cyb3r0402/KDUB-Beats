import { defaultStoreProducts, defaultStoreSettings, getDefaultSiteElements } from "@/lib/store-data";
import { normalizeProductDraft } from "@/lib/store-product-utils";
import type {
  StoreProduct,
  StoreSettings,
  StoreSiteElement,
  StoreSiteElementPlacement,
} from "@/types/store";

const DB_NAME = "kdub-control-center";
const STORE_NAME = "content";
const PRODUCTS_KEY = "products";
const SETTINGS_KEY = "settings";
const UPDATE_EVENT = "controlcenter:update";
const LEGACY_CONTACT_EMAIL = "bookings@kdubbeats.com";
const LEGACY_STATIC_DEMO_BEAT_IDS = new Set(["beat-midnight-current", "beat-blue-voltage"]);
const LEGACY_STATIC_DEMO_PATH_PREFIXES = ["/audio/previews/", "/images/BeatCoverArt/"] as const;

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

function hasIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open IndexedDB."));
  });
}

async function readValue<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();

    return await new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error || new Error("Unable to read stored content."));
      transaction.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

async function writeValue<T>(key: string, value: T): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Unable to save content."));
    transaction.oncomplete = () => db.close();
  });
}

function normalizeProducts(products: StoreProduct[]) {
  return products
    .map(normalizeProductDraft)
    .filter((product) => !isLegacyDemoBeat(product));
}

function cleanText(value: string | undefined) {
  return (value || "").trim();
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

function normalizeSettings(settings: StoreSettings): StoreSettings {
  return {
    ...defaultStoreSettings,
    ...settings,
    brandName: cleanText(settings.brandName) || defaultStoreSettings.brandName,
    heroTitle: cleanText(settings.heroTitle) || defaultStoreSettings.heroTitle,
    heroDescription: cleanText(settings.heroDescription) || defaultStoreSettings.heroDescription,
    storeTitle: cleanText(settings.storeTitle) || defaultStoreSettings.storeTitle,
    storeDescription: cleanText(settings.storeDescription) || defaultStoreSettings.storeDescription,
    contactEmail: cleanText(settings.contactEmail) || defaultStoreSettings.contactEmail,
    instagramUrl: cleanText(settings.instagramUrl) || defaultStoreSettings.instagramUrl,
    siteElements: normalizeSiteElements(settings.siteElements),
  };
}

export async function getStoredProducts(): Promise<StoreProduct[]> {
  const products = await readValue<StoreProduct[]>(PRODUCTS_KEY);
  return products ? normalizeProducts(products) : normalizeProducts(defaultStoreProducts);
}

export async function saveStoredProducts(products: StoreProduct[]): Promise<void> {
  await writeValue(PRODUCTS_KEY, normalizeProducts(products));
  notifyControlCenterUpdate();
}

export async function getStoredSettings(): Promise<StoreSettings> {
  const settings = await readValue<StoreSettings>(SETTINGS_KEY);

  if (!settings) {
    return normalizeSettings(defaultStoreSettings);
  }

  if (settings.contactEmail === LEGACY_CONTACT_EMAIL) {
    const migratedSettings = {
      ...settings,
      contactEmail: defaultStoreSettings.contactEmail,
    };

    const normalizedSettings = normalizeSettings(migratedSettings);
    await writeValue(SETTINGS_KEY, normalizedSettings).catch(() => undefined);
    return normalizedSettings;
  }

  return normalizeSettings(settings);
}

export async function saveStoredSettings(settings: StoreSettings): Promise<void> {
  await writeValue(SETTINGS_KEY, normalizeSettings(settings));
  notifyControlCenterUpdate();
}

export async function resetStoredContent(): Promise<void> {
  await Promise.all([
    writeValue(PRODUCTS_KEY, normalizeProducts(defaultStoreProducts)),
    writeValue(SETTINGS_KEY, normalizeSettings(defaultStoreSettings)),
  ]);
  notifyControlCenterUpdate();
}

export function notifyControlCenterUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UPDATE_EVENT));
  }
}

export function subscribeToControlCenterUpdates(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(UPDATE_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(UPDATE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
