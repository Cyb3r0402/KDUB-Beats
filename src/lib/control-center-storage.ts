import { defaultStoreProducts, defaultStoreSettings } from "@/lib/store-data";
import type { StoreProduct, StoreSettings } from "@/types/store";

const DB_NAME = "kdub-control-center";
const STORE_NAME = "content";
const PRODUCTS_KEY = "products";
const SETTINGS_KEY = "settings";
const UPDATE_EVENT = "controlcenter:update";
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

function cloneProducts(products: StoreProduct[]) {
  return products.map((product) => ({
    ...product,
    deliverables: [...product.deliverables],
  }));
}

function normalizeProducts(products: StoreProduct[]) {
  return cloneProducts(products).filter((product) => !isLegacyDemoBeat(product));
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
  return settings ? { ...settings } : { ...defaultStoreSettings };
}

export async function saveStoredSettings(settings: StoreSettings): Promise<void> {
  await writeValue(SETTINGS_KEY, { ...settings });
  notifyControlCenterUpdate();
}

export async function resetStoredContent(): Promise<void> {
  await Promise.all([
    writeValue(PRODUCTS_KEY, normalizeProducts(defaultStoreProducts)),
    writeValue(SETTINGS_KEY, { ...defaultStoreSettings }),
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
