import {
  getDefaultStoreContent,
  normalizeStoreContent,
  type StoreContent,
} from "@/lib/store-content";
import type { StoreProduct, StoreSettings } from "@/types/store";

const DB_NAME = "kdub-control-center";
const STORE_NAME = "content";
const PRODUCTS_KEY = "products";
const SETTINGS_KEY = "settings";
const UPDATE_EVENT = "controlcenter:update";
const CONTENT_API_PATH = "/api/control-center/content";

interface PublishedStoreContentResponse extends Partial<StoreContent> {
  source?: "blob" | "defaults";
}

export type StoredContentSource = "published" | "local" | "defaults";

export interface StoredContentLoadResult {
  content: StoreContent;
  source: StoredContentSource;
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

async function getLocalStoreContent(): Promise<StoreContent | null> {
  const [products, settings] = await Promise.all([
    readValue<StoreProduct[]>(PRODUCTS_KEY),
    readValue<StoreSettings>(SETTINGS_KEY),
  ]);

  if (!products && !settings) {
    return null;
  }

  return normalizeStoreContent({
    products: products || undefined,
    settings: settings || undefined,
  });
}

async function saveLocalStoreContent(content: StoreContent) {
  await Promise.all([
    writeValue(PRODUCTS_KEY, content.products),
    writeValue(SETTINGS_KEY, content.settings),
  ]);
}

async function fetchPublishedStoreContent() {
  try {
    const response = await fetch(CONTENT_API_PATH, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as PublishedStoreContentResponse;

    return {
      content: normalizeStoreContent(result),
      source: result.source || "defaults",
    };
  } catch {
    return null;
  }
}

async function publishStoreContent(content: StoreContent) {
  const response = await fetch(CONTENT_API_PATH, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(content),
  });

  const result = (await response.json().catch(() => null)) as
    | (PublishedStoreContentResponse & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(result?.error || "Unable to publish changes to the public site.");
  }

  return normalizeStoreContent(result || content);
}

export async function getPublishedContent(): Promise<StoreContent> {
  const publishedContent = await fetchPublishedStoreContent();
  return publishedContent?.content || getDefaultStoreContent();
}

export async function getStoredContentWithSource(): Promise<StoredContentLoadResult> {
  const [publishedContent, localContent] = await Promise.all([
    fetchPublishedStoreContent(),
    getLocalStoreContent(),
  ]);

  if (publishedContent?.source === "blob") {
    // Only overwrite local content if local content doesn't exist yet.
    // This prevents deleting drafts when the app reloads.
    if (!localContent) {
      await saveLocalStoreContent(publishedContent.content).catch(() => undefined);
    }
    
    return {
      content: publishedContent.content,
      source: "published",
    };
  }

  if (localContent) {
    return {
      content: localContent,
      source: "local",
    };
  }

  return {
    content: publishedContent?.content || getDefaultStoreContent(),
    source: "defaults",
  };
}

export async function getStoredContent(): Promise<StoreContent> {
  const result = await getStoredContentWithSource();
  return result.content;
}

export async function saveStoredContent(
  products: StoreProduct[],
  settings: StoreSettings
): Promise<StoreContent> {
  const content = normalizeStoreContent({ products, settings });
  let publishedContent: StoreContent | null = null;
  let publishError: unknown = null;

  try {
    publishedContent = await publishStoreContent(content);
  } catch (error) {
    publishError = error;
  }

  const contentToKeep = publishedContent || content;
  await saveLocalStoreContent(contentToKeep);
  notifyControlCenterUpdate();

  if (publishError) {
    throw new Error(`Saved in this browser, but the public site was not updated: ${getErrorMessage(publishError)}`);
  }

  return contentToKeep;
}

export async function getStoredProducts(): Promise<StoreProduct[]> {
  const content = await getStoredContent();
  return content.products;
}

export async function saveStoredProducts(products: StoreProduct[]): Promise<void> {
  const content = await getStoredContent();
  await saveStoredContent(products, content.settings);
}

export async function getStoredSettings(): Promise<StoreSettings> {
  const content = await getStoredContent();
  return content.settings;
}

export async function saveStoredSettings(settings: StoreSettings): Promise<void> {
  const content = await getStoredContent();
  await saveStoredContent(content.products, settings);
}

export async function resetStoredContent(): Promise<void> {
  const defaultContent = getDefaultStoreContent();
  await saveStoredContent(defaultContent.products, defaultContent.settings);
}

export function notifyControlCenterUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(UPDATE_EVENT));

    try {
      window.localStorage.setItem(UPDATE_EVENT, Date.now().toString());
    } catch {
      // Cross-tab refresh is best-effort; same-tab updates use the event above.
    }
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
