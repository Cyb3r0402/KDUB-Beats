import { get, put } from "@vercel/blob";
import {
  PRIVATE_BLOB_READ_WRITE_TOKEN_ENV_NAMES,
  getPrivateBlobReadWriteToken,
  hasPrivateBlobReadWriteToken,
} from "@/lib/blob-token";
import {
  getDefaultStoreContent,
  normalizeStoreContent,
  type StoreContent,
} from "@/lib/store-content";

const CONTENT_PATH = "control-center/content.json";
type PublishedContentSource = "blob" | "defaults";

interface LoadedPublishedStoreContent {
  content: StoreContent;
  source: PublishedContentSource;
}

export function hasPublishedContentStore() {
  return hasPrivateBlobReadWriteToken();
}

async function streamToText(stream: ReadableStream<Uint8Array>) {
  return new Response(stream).text();
}

export async function loadPublishedStoreContentWithSource(): Promise<LoadedPublishedStoreContent> {
  if (!hasPublishedContentStore()) {
    return {
      content: getDefaultStoreContent(),
      source: "defaults",
    };
  }

  const blob = await get(CONTENT_PATH, {
    access: "private",
    useCache: false,
    token: getPrivateBlobReadWriteToken(),
  });

  if (!blob || blob.statusCode !== 200 || !blob.stream) {
    return {
      content: getDefaultStoreContent(),
      source: "defaults",
    };
  }

  const text = await streamToText(blob.stream);
  const parsed = JSON.parse(text) as Partial<StoreContent>;

  return {
    content: normalizeStoreContent(parsed),
    source: "blob",
  };
}

export async function loadPublishedStoreContent(): Promise<StoreContent> {
  const result = await loadPublishedStoreContentWithSource();
  return result.content;
}

export async function savePublishedStoreContent(content: Partial<StoreContent>) {
  if (!hasPublishedContentStore()) {
    throw new Error(`Missing ${PRIVATE_BLOB_READ_WRITE_TOKEN_ENV_NAMES}. Keep this connected to a Private Blob store for the control-center catalog metadata.`);
  }

  const normalizedContent = normalizeStoreContent({
    ...content,
    updatedAt: new Date().toISOString(),
  });

  await put(CONTENT_PATH, JSON.stringify(normalizedContent, null, 2), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    token: getPrivateBlobReadWriteToken(),
  });

  return normalizedContent;
}
