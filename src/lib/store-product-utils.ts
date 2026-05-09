import type { StoreProduct } from "@/types/store";

export const MAX_PROTECTED_SAMPLE_SECONDS = 20;
export const MIN_CHECKOUT_PRICE = 0.5;

const ACCEPTED_PREVIEW_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
]);

const ACCEPTED_ARTWORK_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const ACCEPTED_PREVIEW_EXTENSION_PATTERN = /\.(mp3|m4a|aac|ogg)$/i;
const ACCEPTED_ARTWORK_EXTENSION_PATTERN = /\.(png|jpe?g|webp|gif|avif)$/i;

function cleanValue(value: string | undefined) {
  return (value || "").trim();
}

export function getNormalizedDeliverables(deliverables: string[]) {
  return deliverables.map((item) => item.trim()).filter(Boolean);
}

export function normalizeProductDraft(product: StoreProduct): StoreProduct {
  const isUploadedBeat = product.category === "beat" && cleanValue(product.audioPreview);
  const deliverables = getNormalizedDeliverables(product.deliverables);

  return {
    ...product,
    name: cleanValue(product.name),
    slug: cleanValue(product.slug),
    genre: cleanValue(product.genre) || (isUploadedBeat ? "Beat" : ""),
    description:
      cleanValue(product.description) ||
      (isUploadedBeat ? "Protected preview available. Purchase includes the full beat delivery." : ""),
    badge: cleanValue(product.badge),
    artwork: cleanValue(product.artwork),
    audioPreview: cleanValue(product.audioPreview),
    deliveryFileUrl: cleanValue(product.deliveryFileUrl),
    deliveryFileName: cleanValue(product.deliveryFileName),
    deliveryFileSize:
      typeof product.deliveryFileSize === "number" && Number.isFinite(product.deliveryFileSize)
        ? product.deliveryFileSize
        : undefined,
    deliveryFileReady: product.deliveryFileReady === true || Boolean(cleanValue(product.deliveryFileUrl)),
    soldOut: product.soldOut === true,
    price:
      isUploadedBeat && (!Number.isFinite(product.price) || Number(product.price) < MIN_CHECKOUT_PRICE)
        ? 29.99
        : Number.isFinite(product.price)
          ? Number(product.price)
          : 0,
    deliverables:
      isUploadedBeat && !deliverables.length
        ? ["Full beat file delivered after purchase", "Non-exclusive beat license"]
        : deliverables,
  };
}

export function getArtworkFileIssue(file: File) {
  const fileType = cleanValue(file.type).toLowerCase();
  const fileName = cleanValue(file.name).toLowerCase();

  if (ACCEPTED_ARTWORK_MIME_TYPES.has(fileType) || ACCEPTED_ARTWORK_EXTENSION_PATTERN.test(fileName)) {
    return "";
  }

  return "Artwork upload must be an image file such as PNG, JPG, WEBP, GIF, or AVIF.";
}

export function getPreviewSampleFileIssue(file: File) {
  const fileType = cleanValue(file.type).toLowerCase();
  const fileName = cleanValue(file.name).toLowerCase();

  if (
    ACCEPTED_PREVIEW_MIME_TYPES.has(fileType) ||
    ACCEPTED_PREVIEW_EXTENSION_PATTERN.test(fileName)
  ) {
    return "";
  }

  return "Preview uploads must be MP3, M4A, AAC, or OGG samples. WAV and full-session files are blocked.";
}

export function getProductReadinessIssues(product: StoreProduct) {
  const normalizedProduct = normalizeProductDraft(product);
  const issues: string[] = [];

  if (!normalizedProduct.name) {
    issues.push("Add a product name.");
  }

  if (!normalizedProduct.description) {
    issues.push("Add a short description.");
  }

  if (normalizedProduct.price < MIN_CHECKOUT_PRICE) {
    issues.push("Set a price of at least $0.50.");
  }

  if (!normalizedProduct.deliverables.length) {
    issues.push("Add at least one deliverable.");
  }

  if (normalizedProduct.category === "beat") {
    if (!normalizedProduct.genre) {
      issues.push("Add a genre or vibe label.");
    }

    if (!normalizedProduct.audioPreview) {
      issues.push("Upload a protected sample.");
    }

    if (!normalizedProduct.deliveryFileUrl && !normalizedProduct.deliveryFileReady) {
      issues.push("Upload the full beat delivery file.");
    }

    if (!normalizedProduct.previewDuration || !Number.isFinite(normalizedProduct.previewDuration)) {
      issues.push("Upload a readable preview sample.");
    } else if (normalizedProduct.previewDuration > MAX_PROTECTED_SAMPLE_SECONDS) {
      issues.push(`Keep the preview at ${MAX_PROTECTED_SAMPLE_SECONDS} seconds or less.`);
    }
  }

  return issues;
}

export function isProductReadyForStorefront(product: StoreProduct) {
  return getProductReadinessIssues(product).length === 0;
}

export function getReadyBeatProducts(products: StoreProduct[]) {
  return products
    .map(normalizeProductDraft)
    .filter(
      (product) => product.category === "beat" && isProductReadyForStorefront(product)
    );
}

export function getReadyServiceProducts(products: StoreProduct[]) {
  return products
    .map(normalizeProductDraft)
    .filter(
      (product) => product.category === "service" && isProductReadyForStorefront(product)
    );
}
