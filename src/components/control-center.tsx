"use client";

import { upload } from "@vercel/blob/client";
import Image from "next/image";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SampleAudioPlayer from "@/components/sample-audio-player";
import { formatFileSize, MULTIPART_UPLOAD_THRESHOLD_BYTES } from "@/lib/session-upload";
import type { StripeMode } from "@/lib/stripe";
import {
  getStoredContentWithSource,
  resetStoredContent,
  saveStoredContent,
  type StoredContentSource,
} from "@/lib/control-center-storage";
import { defaultStoreProducts, defaultStoreSettings } from "@/lib/store-data";
import {
  getArtworkFileIssue,
  getProductReadinessIssues,
  getReadyBeatProducts,
  getReadyServiceProducts,
  isProductReadyForStorefront,
  MAX_PROTECTED_SAMPLE_SECONDS,
  normalizeProductDraft,
} from "@/lib/store-product-utils";
import type {
  SessionUploadSystemStatus,
  StoredSessionSubmission,
} from "@/lib/session-submissions";
import type {
  ProductCategory,
  StoreProduct,
  StoreSettings,
  StoreSiteElement,
  StoreSiteElementPlacement,
} from "@/types/store";

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getBeatNameFromFileName(fileName: string) {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const ARTWORK_FRAME_WIDTH = 1920;
const ARTWORK_FRAME_HEIGHT = 1080;
const MAX_PREPARED_ARTWORK_BYTES = 4 * 1024 * 1024;

function createNewProduct(category: ProductCategory): StoreProduct {
  const timestamp = Date.now().toString(36);

  return {
    id: `${category}-${timestamp}`,
    slug: `${category}-${timestamp}`,
    name: category === "beat" ? "New Beat" : "New Service",
    category,
    genre: category === "beat" ? "Beat" : "",
    description:
      category === "beat"
        ? "Protected preview available. Purchase includes the full beat delivery."
        : "",
    price: category === "beat" ? 29.99 : 0,
    artwork: "",
    audioPreview: "",
    previewDuration: undefined,
    deliveryFileUrl: "",
    deliveryFileName: "",
    deliveryFileSize: undefined,
    deliveryFileReady: false,
    soldOut: false,
    deliverables:
      category === "beat"
        ? ["Full beat file delivered after purchase", "Non-exclusive beat license"]
        : [],
    badge: "",
  };
}

function getBeatDeliveryFileIssue(file: File) {
  const fileType = (file.type || "").toLowerCase();
  const fileName = file.name.toLowerCase();
  const isSupportedDeliveryFile =
    fileType.startsWith("audio/") ||
    fileType === "application/zip" ||
    fileType === "application/x-zip-compressed" ||
    /\.(zip|wav|wave|aif|aiff|flac|mp3|m4a|aac|ogg)$/i.test(fileName);

  if (isSupportedDeliveryFile) {
    return "";
  }

  return "Delivery uploads must be ZIP or audio files such as WAV, AIFF, FLAC, MP3, M4A, AAC, or OGG.";
}

function getBeatDeliveryPathname(product: StoreProduct, fileName: string) {
  const safeProduct = createSlug(product.name || product.slug || product.id) || "beat";
  const safeFile = fileName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `beat-delivery/${safeProduct}/${Date.now()}-${safeFile || "full-beat"}`;
}

function getSafeUploadFileName(fileName: string, fallbackName: string) {
  const safeFile = fileName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safeFile || fallbackName;
}

function getStoreMediaPathname(
  product: StoreProduct,
  fileName: string,
  kind: "artwork" | "previews"
) {
  const safeProduct = createSlug(product.name || product.slug || product.id) || "store-item";
  const safeFile = getSafeUploadFileName(fileName, kind === "artwork" ? "artwork" : "preview.wav");

  return `store-media/${kind}/${safeProduct}/${Date.now()}-${safeFile}`;
}

function getContentTypeExtension(contentType: string, fallbackFileName = "") {
  const extensionMatch = fallbackFileName.toLowerCase().match(/\.[a-z0-9]+$/);

  if (extensionMatch) {
    return extensionMatch[0].replace(".", "");
  }

  switch (contentType.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3";
    case "audio/mp4":
    case "audio/x-m4a":
      return "m4a";
    case "audio/aac":
      return "aac";
    case "audio/ogg":
      return "ogg";
    default:
      return "wav";
  }
}

function getStoreMediaContentType(fileName: string, fallbackType = "") {
  const fileType = fallbackType.toLowerCase();
  const lowerFileName = fileName.toLowerCase();

  if (fileType.startsWith("image/") || fileType.startsWith("audio/")) {
    return fileType;
  }

  if (/\.(png)$/i.test(lowerFileName)) {
    return "image/png";
  }

  if (/\.(jpe?g)$/i.test(lowerFileName)) {
    return "image/jpeg";
  }

  if (/\.(webp)$/i.test(lowerFileName)) {
    return "image/webp";
  }

  if (/\.(gif)$/i.test(lowerFileName)) {
    return "image/gif";
  }

  if (/\.(avif)$/i.test(lowerFileName)) {
    return "image/avif";
  }

  if (/\.(mp3)$/i.test(lowerFileName)) {
    return "audio/mpeg";
  }

  if (/\.(m4a)$/i.test(lowerFileName)) {
    return "audio/mp4";
  }

  if (/\.(aac)$/i.test(lowerFileName)) {
    return "audio/aac";
  }

  if (/\.(ogg)$/i.test(lowerFileName)) {
    return "audio/ogg";
  }

  return "audio/wav";
}

function getArtworkUploadFileName(fileName: string) {
  const safeFile = getSafeUploadFileName(fileName.replace(/\.[a-z0-9]+$/i, ""), "artwork");
  return `${safeFile}-fitted.jpg`;
}

function loadArtworkImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = document.createElement("img");

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This artwork could not be read. Try a PNG, JPG, WEBP, GIF, or AVIF image."));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("This browser could not prepare the artwork image."));
      },
      "image/jpeg",
      quality
    );
  });
}

async function createFittedArtworkUpload(file: File) {
  const image = await loadArtworkImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("This browser could not prepare the artwork image.");
  }

  canvas.width = ARTWORK_FRAME_WIDTH;
  canvas.height = ARTWORK_FRAME_HEIGHT;

  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;

  if (!imageWidth || !imageHeight) {
    throw new Error("This artwork image has unreadable dimensions.");
  }

  context.fillStyle = "#03070d";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const imageRatio = imageWidth / imageHeight;
  const frameRatio = canvas.width / canvas.height;
  const coverWidth = imageRatio > frameRatio ? canvas.height * imageRatio : canvas.width;
  const coverHeight = imageRatio > frameRatio ? canvas.height : canvas.width / imageRatio;
  const coverX = (canvas.width - coverWidth) / 2;
  const coverY = (canvas.height - coverHeight) / 2;

  context.save();
  context.filter = "blur(36px) brightness(0.5) saturate(1.12)";
  context.drawImage(image, coverX, coverY, coverWidth, coverHeight);
  context.restore();

  context.fillStyle = "rgba(3, 7, 13, 0.28)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const fitWidth = imageRatio > frameRatio ? canvas.width : canvas.height * imageRatio;
  const fitHeight = imageRatio > frameRatio ? canvas.width / imageRatio : canvas.height;
  const fitX = (canvas.width - fitWidth) / 2;
  const fitY = (canvas.height - fitHeight) / 2;

  context.drawImage(image, fitX, fitY, fitWidth, fitHeight);

  let quality = 0.9;
  let blob = await canvasToBlob(canvas, quality);

  while (blob.size > MAX_PREPARED_ARTWORK_BYTES && quality > 0.68) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }

  return {
    blob,
    fileName: getArtworkUploadFileName(file.name),
    contentType: "image/jpeg",
  };
}

async function uploadStoreMedia(
  product: StoreProduct,
  kind: "artwork" | "previews",
  body: File | Blob,
  fileName: string,
  contentType: string
) {
  const formData = new FormData();
  formData.append("file", body, fileName);
  formData.append("pathname", getStoreMediaPathname(product, fileName, kind));
  formData.append("originalName", fileName);
  formData.append("contentType", contentType);

  const response = await fetch("/api/uploads/store-media", {
    method: "POST",
    body: formData,
  });

  const result = (await response.json().catch(() => null)) as
    | { url?: string; error?: string }
    | null;

  if (!response.ok || !result?.url) {
    throw new Error(result?.error || "Store media upload failed.");
  }

  return result.url;
}

function createNewSiteElement(placement: StoreSiteElementPlacement): StoreSiteElement {
  const timestamp = Date.now().toString(36);
  const isWorkflow = placement === "homepage-workflow";

  return {
    id: `site-element-${timestamp}`,
    placement,
    label: isWorkflow ? "New Workflow Step" : "New Homepage Card",
    eyebrow: isWorkflow ? "Next" : "Site Card",
    title: isWorkflow ? "New Workflow Step" : "New Site Element",
    description: "",
    visible: true,
  };
}

function isDataUrl(value: string | undefined) {
  return Boolean(value?.startsWith("data:"));
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);

  if (!response.ok) {
    throw new Error("Could not prepare embedded media for publishing.");
  }

  return response.blob();
}

async function publishEmbeddedProductMedia(products: StoreProduct[]) {
  let convertedCount = 0;
  const publishedProducts: StoreProduct[] = [];

  for (const product of products) {
    let nextProduct = product;
    const safeProduct = createSlug(product.name || product.slug || product.id) || product.category;

    if (isDataUrl(product.artwork)) {
      const artworkBlob = await dataUrlToBlob(product.artwork || "");
      const contentType = artworkBlob.type || "image/png";
      const extension = getContentTypeExtension(contentType);
      const artworkUrl = await uploadStoreMedia(
        product,
        "artwork",
        artworkBlob,
        `${safeProduct}-artwork.${extension}`,
        contentType
      );

      nextProduct = {
        ...nextProduct,
        artwork: artworkUrl,
      };
      convertedCount += 1;
    }

    if (isDataUrl(product.audioPreview)) {
      const previewBlob = await dataUrlToBlob(product.audioPreview || "");
      const contentType = previewBlob.type || "audio/wav";
      const extension = getContentTypeExtension(contentType);
      const previewUrl = await uploadStoreMedia(
        nextProduct,
        "previews",
        previewBlob,
        `${safeProduct}-preview.${extension}`,
        contentType
      );

      nextProduct = {
        ...nextProduct,
        audioPreview: previewUrl,
      };
      convertedCount += 1;
    }

    publishedProducts.push(nextProduct);
  }

  return {
    products: publishedProducts,
    convertedCount,
  };
}

function getAudioContext() {
  const browserWindow = window as Window & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor = browserWindow.AudioContext || browserWindow.webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error("This browser cannot create beat previews. Try a current Chrome, Edge, or Safari browser.");
  }

  return new AudioContextConstructor();
}

function getBeatAudioUploadIssue(file: File) {
  const fileType = (file.type || "").toLowerCase();
  const fileName = file.name.toLowerCase();
  const isSupportedAudio =
    fileType.startsWith("audio/") || /\.(wav|wave|aif|aiff|flac|mp3|m4a|aac|ogg)$/i.test(fileName);

  if (isSupportedAudio) {
    return "";
  }

  return "Upload a beat audio file such as WAV, AIFF, FLAC, MP3, M4A, AAC, or OGG.";
}

function pickPreviewStartTime(audioBuffer: AudioBuffer, previewSeconds: number) {
  const duration = audioBuffer.duration;
  const previewLength = Math.min(previewSeconds, duration);

  if (duration <= previewLength) {
    return 0;
  }

  const sampleRate = audioBuffer.sampleRate;
  const channelData = Array.from({ length: audioBuffer.numberOfChannels }, (_, channel) =>
    audioBuffer.getChannelData(channel)
  );
  const edgePadding = Math.min(8, Math.max(0, (duration - previewLength) / 3));
  const scanStartFrame = Math.floor(edgePadding * sampleRate);
  const scanEndFrame = Math.max(
    scanStartFrame,
    Math.floor((duration - previewLength - edgePadding) * sampleRate)
  );
  const segmentFrames = Math.floor(previewLength * sampleRate);
  const stepFrames = Math.max(1, Math.floor(sampleRate * 0.5));
  let bestFrame = scanStartFrame;
  let bestScore = -Infinity;

  for (let frame = scanStartFrame; frame <= scanEndFrame; frame += stepFrames) {
    let sumSquares = 0;
    let peak = 0;
    const endFrame = Math.min(frame + segmentFrames, audioBuffer.length);

    for (const channel of channelData) {
      for (let sampleIndex = frame; sampleIndex < endFrame; sampleIndex += 128) {
        const sample = channel[sampleIndex] || 0;
        sumSquares += sample * sample;
        peak = Math.max(peak, Math.abs(sample));
      }
    }

    const sampleCount = Math.max(1, ((endFrame - frame) / 128) * channelData.length);
    const rms = Math.sqrt(sumSquares / sampleCount);
    const score = rms * 0.85 + peak * 0.15;

    if (score > bestScore) {
      bestScore = score;
      bestFrame = frame;
    }
  }

  return bestFrame / sampleRate;
}

function audioBufferToWavBlob(audioBuffer: AudioBuffer, startTime: number, duration: number) {
  const sampleRate = audioBuffer.sampleRate;
  const channelCount = Math.min(audioBuffer.numberOfChannels, 2);
  const startFrame = Math.floor(startTime * sampleRate);
  const frameCount = Math.min(Math.floor(duration * sampleRate), audioBuffer.length - startFrame);
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const fadeFrames = Math.min(Math.floor(sampleRate * 0.25), Math.floor(frameCount / 2));
  let offset = 0;

  function writeString(value: string) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
    offset += value.length;
  }

  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, channelCount, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true);
  offset += 2;
  writeString("data");
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const fadeIn = fadeFrames ? Math.min(1, frame / fadeFrames) : 1;
    const fadeOut = fadeFrames ? Math.min(1, (frameCount - frame - 1) / fadeFrames) : 1;
    const gain = Math.min(fadeIn, fadeOut);

    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = audioBuffer.getChannelData(channel)[startFrame + frame] || 0;
      const clamped = Math.max(-1, Math.min(1, sample * gain));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function createBeatPreviewBlob(file: File) {
  const audioContext = getAudioContext();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const previewDuration = Math.min(MAX_PROTECTED_SAMPLE_SECONDS, audioBuffer.duration);
    const previewStart = pickPreviewStartTime(audioBuffer, previewDuration);
    const previewBlob = audioBufferToWavBlob(audioBuffer, previewStart, previewDuration);

    return {
      blob: previewBlob,
      previewDuration,
      previewStart,
      sourceDuration: audioBuffer.duration,
    };
  } finally {
    await audioContext.close().catch(() => undefined);
  }
}

function formatDuration(seconds: number | undefined) {
  if (!seconds || !Number.isFinite(seconds)) {
    return "Not set";
  }

  return `${seconds.toFixed(1)}s`;
}

function formatSubmissionTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getCatalogStatusMessage(products: StoreProduct[]) {
  if (!products.length) {
    return "Start by adding a beat or service. Beats stay hidden until artwork, pricing, and a protected sample are all in place.";
  }

  const readyCount = products.filter(isProductReadyForStorefront).length;
  const draftCount = products.length - readyCount;

  if (!draftCount) {
    return `All ${readyCount} catalog item(s) are storefront-ready with the current rules.`;
  }

  return `${readyCount} item(s) are ready for the storefront. ${draftCount} draft item(s) stay hidden until their media and details are complete.`;
}

interface ControlCenterProps {
  stripeStatus: {
    configured: boolean;
    mode: StripeMode;
    dashboardUrl: string;
  };
}

type BeatUploadField = "artwork" | "beatAudio";
type PendingProductUploads = Partial<Record<BeatUploadField, File>>;
type ProductUploadMessages = Partial<Record<BeatUploadField, string>>;

function getStripeModeLabel(mode: StripeMode) {
  if (mode === "live") {
    return "Live Mode";
  }

  if (mode === "test") {
    return "Test Mode";
  }

  return "Not Configured";
}

function getContentSourceLabel(source: StoredContentSource) {
  if (source === "published") {
    return "Published";
  }

  if (source === "local") {
    return "Browser Draft";
  }

  return "Defaults";
}

function getContentSourceDescription(source: StoredContentSource) {
  if (source === "published") {
    return "This page is reading the same published catalog that visitors should see.";
  }

  if (source === "local") {
    return "You are seeing browser-only edits. Save all changes to publish them.";
  }

  return "No published catalog was found yet. Save all changes to create one.";
}

function getUploadFieldLabel(field: BeatUploadField) {
  if (field === "artwork") {
    return "artwork";
  }

  return "full beat upload";
}

function getUploadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Upload failed.";

  if (/client token|authorization|unauthorized|forbidden|401|403/i.test(message)) {
    return "Upload authorization failed. Make sure BLOB_READ_WRITE_TOKEN is set in Vercel Production, then redeploy and sign in again.";
  }

  if (/failed to fetch|network|fetch failed|cors/i.test(message)) {
    return "Upload was blocked before Vercel Blob accepted the file. If this happens in production, re-check the Production BLOB_READ_WRITE_TOKEN is connected to this Vercel project, redeploy, then try again.";
  }

  return message;
}

export default function ControlCenter({ stripeStatus }: ControlCenterProps) {
  const router = useRouter();
  const productsRef = useRef<StoreProduct[]>(defaultStoreProducts);
  const settingsRef = useRef<StoreSettings>(defaultStoreSettings);
  const activeUploadProductIdRef = useRef<string | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>(defaultStoreProducts);
  const [settings, setSettings] = useState<StoreSettings>(defaultStoreSettings);
  const [contentSource, setContentSource] = useState<StoredContentSource>("defaults");
  const [saving, setSaving] = useState(false);
  const [stripeSyncing, setStripeSyncing] = useState(false);
  const [activeUploadProductId, setActiveUploadProductId] = useState<string | null>(null);
  const [activeUploadLabel, setActiveUploadLabel] = useState("");
  const [activeUploadFileName, setActiveUploadFileName] = useState("");
  const [activeUploadProgress, setActiveUploadProgress] = useState<number | null>(null);
  const [pendingUploads, setPendingUploads] = useState<Record<string, PendingProductUploads>>({});
  const [uploadMessages, setUploadMessages] = useState<Record<string, ProductUploadMessages>>({});
  const [statusMessage, setStatusMessage] = useState(
    "Beats only go live from uploads made here. Upload the full beat and the control center saves only a protected 20-second preview."
  );
  const [sessionSubmissions, setSessionSubmissions] = useState<StoredSessionSubmission[]>([]);
  const [sessionInboxStatus, setSessionInboxStatus] = useState<SessionUploadSystemStatus | null>(null);
  const [sessionInboxLoading, setSessionInboxLoading] = useState(true);
  const [sessionInboxError, setSessionInboxError] = useState("");
  const beatCount = products.filter((product) => product.category === "beat").length;
  const readyBeatCount = getReadyBeatProducts(products).length;
  const readyServiceCount = getReadyServiceProducts(products).length;
  const draftProductCount = products.filter((product) => !isProductReadyForStorefront(product)).length;
  const stripeLinkedCount = products.filter((product) => Boolean(product.stripePriceId)).length;
  const protectedSampleCount = products.filter(
    (product) =>
      product.category === "beat" &&
      Boolean(product.audioPreview) &&
      typeof product.previewDuration === "number" &&
      product.previewDuration <= MAX_PROTECTED_SAMPLE_SECONDS
  ).length;
  const hasActiveUpload = Boolean(activeUploadProductId);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    async function loadContent() {
      const storedContent = await getStoredContentWithSource();

      productsRef.current = storedContent.content.products;
      settingsRef.current = storedContent.content.settings;
      setProducts(storedContent.content.products);
      setSettings(storedContent.content.settings);
      setContentSource(storedContent.source);
      setStatusMessage(
        storedContent.source === "local"
          ? `${getCatalogStatusMessage(storedContent.content.products)} These changes are only saved in this browser until Save All Changes publishes them.`
          : getCatalogStatusMessage(storedContent.content.products)
      );
    }

    loadContent().catch(() => {
      setStatusMessage("Could not load saved control-center content. Using defaults for now.");
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadSessionInbox() {
      setSessionInboxLoading(true);
      setSessionInboxError("");

      const response = await fetch("/api/control-center/session-submissions", {
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Could not load the studio inbox.");
      }

      if (!isMounted) {
        return;
      }

      setSessionSubmissions(Array.isArray(result?.submissions) ? result.submissions : []);
      setSessionInboxStatus(result?.systemStatus ?? null);
    }

    loadSessionInbox().catch((error) => {
      if (!isMounted) {
        return;
      }

      const message = error instanceof Error ? error.message : "Could not load the studio inbox.";
      setSessionInboxError(message);
    }).finally(() => {
      if (isMounted) {
        setSessionInboxLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  function updateProduct(index: number, patch: Partial<StoreProduct>) {
    setProducts((current) => {
      const nextProducts = current.map((product, productIndex) => {
        if (productIndex !== index) {
          return product;
        }

        const nextName = patch.name ?? product.name;

        return {
          ...product,
          ...patch,
          slug: createSlug(nextName || product.slug || product.id),
        };
      });

      productsRef.current = nextProducts;
      return nextProducts;
    });
  }

  async function updateProductAndSave(index: number, patch: Partial<StoreProduct>) {
    const nextProducts = productsRef.current.map((product, productIndex) => {
      if (productIndex !== index) {
        return product;
      }

      const nextName = patch.name ?? product.name;

      return {
        ...product,
        ...patch,
        slug: createSlug(nextName || product.slug || product.id),
      };
    });

    const mediaReadyContent = await publishEmbeddedProductMedia(nextProducts);
    const normalizedProducts = mediaReadyContent.products.map(normalizeProductDraft);

    productsRef.current = normalizedProducts;
    setProducts(normalizedProducts);
    const savedContent = await saveStoredContent(normalizedProducts, settingsRef.current);
    productsRef.current = savedContent.products;
    settingsRef.current = savedContent.settings;
    setProducts(savedContent.products);
    setSettings(savedContent.settings);
    setContentSource("published");
  }

  function updateDeliverables(index: number, value: string) {
    const deliverables = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    updateProduct(index, {
      deliverables,
    });
  }

  function updateSiteElement(index: number, patch: Partial<StoreSiteElement>) {
    setSettings((current) => {
      const siteElements = current.siteElements || [];

      const nextSettings = {
        ...current,
        siteElements: siteElements.map((element, elementIndex) =>
          elementIndex === index ? { ...element, ...patch } : element
        ),
      };

      settingsRef.current = nextSettings;
      return nextSettings;
    });
  }

  function removeSiteElement(index: number) {
    setSettings((current) => {
      const nextSettings = {
        ...current,
        siteElements: (current.siteElements || []).filter((_, elementIndex) => elementIndex !== index),
      };

      settingsRef.current = nextSettings;
      return nextSettings;
    });
    setStatusMessage("Site element removed. Save changes to update the public page.");
  }

  function addSiteElement(placement: StoreSiteElementPlacement) {
    setSettings((current) => {
      const nextSettings = {
        ...current,
        siteElements: [...(current.siteElements || []), createNewSiteElement(placement)],
      };

      settingsRef.current = nextSettings;
      return nextSettings;
    });
    setStatusMessage("New editable site element added. Fill it in, then save changes.");
  }

  function addProduct(category: ProductCategory) {
    setProducts((current) => {
      const nextProducts = [...current, createNewProduct(category)];
      productsRef.current = nextProducts;
      return nextProducts;
    });
    setStatusMessage(category === "beat" ? "New beat added. Upload artwork and the full beat file to publish it." : "New service added. Fill in the details, then save changes.");
  }

  function removeProduct(index: number) {
    setProducts((current) => {
      const nextProducts = current.filter((_, itemIndex) => itemIndex !== index);
      productsRef.current = nextProducts;
      return nextProducts;
    });
    setStatusMessage("Product removed. Save changes to update the public catalog.");
  }

  function setPendingProductUpload(productId: string, field: BeatUploadField, file: File | null) {
    setPendingUploads((current) => {
      const nextUploads = { ...current };
      const productUploads = { ...(nextUploads[productId] || {}) };

      if (file) {
        productUploads[field] = file;
      } else {
        delete productUploads[field];
      }

      if (Object.keys(productUploads).length) {
        nextUploads[productId] = productUploads;
      } else {
        delete nextUploads[productId];
      }

      return nextUploads;
    });
  }

  function setProductUploadMessage(productId: string, field: BeatUploadField, message: string) {
    setUploadMessages((current) => {
      const nextMessages = { ...current };
      const productMessages = { ...(nextMessages[productId] || {}) };

      if (message) {
        productMessages[field] = message;
      } else {
        delete productMessages[field];
      }

      if (Object.keys(productMessages).length) {
        nextMessages[productId] = productMessages;
      } else {
        delete nextMessages[productId];
      }

      return nextMessages;
    });
  }

  async function uploadProductFile(index: number, field: BeatUploadField, file: File | undefined) {
    if (!file) {
      setStatusMessage(`Choose a ${getUploadFieldLabel(field)} file first.`);
      return;
    }

    const product = productsRef.current[index];

    if (!product) {
      setStatusMessage("That product could not be found. Refresh the control center, then try again.");
      return;
    }

    if (activeUploadProductIdRef.current) {
      setStatusMessage("Finish the current upload before starting another one.");
      setProductUploadMessage(product.id, field, "Finish the current upload before starting another one.");
      return;
    }

    const uploadLabel = getUploadFieldLabel(field);
    let uploadSucceeded = false;

    activeUploadProductIdRef.current = product.id;
    setActiveUploadProductId(product.id);
    setActiveUploadLabel(uploadLabel);
    setActiveUploadFileName(file.name);
    setActiveUploadProgress(null);
    setProductUploadMessage(product.id, field, `Preparing ${file.name}...`);

    try {
      if (field === "artwork") {
        const artworkIssue = getArtworkFileIssue(file);

        if (artworkIssue) {
          setStatusMessage(artworkIssue);
          setProductUploadMessage(product.id, field, artworkIssue);
          return;
        }
      }

      if (field === "beatAudio") {
        const previewTypeIssue = getBeatAudioUploadIssue(file);

        if (previewTypeIssue) {
          setStatusMessage(previewTypeIssue);
          setProductUploadMessage(product.id, field, previewTypeIssue);
          return;
        }

        const deliveryIssue = getBeatDeliveryFileIssue(file);

        if (deliveryIssue) {
          setStatusMessage(deliveryIssue);
          setProductUploadMessage(product.id, field, deliveryIssue);
          return;
        }

        setStatusMessage("Creating a protected 20-second preview from the full beat...");
        setProductUploadMessage(product.id, field, "Creating a protected 20-second preview from the full beat...");
        const preview = await createBeatPreviewBlob(file);
        const currentProduct = productsRef.current[index] || product;
        const nextName =
          currentProduct.name && currentProduct.name !== "New Beat"
            ? currentProduct.name
            : getBeatNameFromFileName(file.name) || "New Beat";
        const mediaProduct = {
          ...currentProduct,
          name: nextName,
        };
        const previewFileName = `${createSlug(nextName) || "beat"}-preview.wav`;

        setStatusMessage("Uploading the protected preview to the public store media library...");
        setProductUploadMessage(product.id, field, "Uploading the protected preview to the public store media library...");
        const previewUrl = await uploadStoreMedia(
          mediaProduct,
          "previews",
          preview.blob,
          previewFileName,
          "audio/wav"
        );

        setStatusMessage("Uploading the full beat delivery file...");
        setProductUploadMessage(product.id, field, "Uploading the full beat delivery file...");
        const contentType = getStoreMediaContentType(file.name, file.type);
        const blob = await upload(getBeatDeliveryPathname(mediaProduct, file.name), file, {
          access: "public",
          contentType,
          handleUploadUrl: "/api/uploads/beat-delivery",
          multipart: file.size > MULTIPART_UPLOAD_THRESHOLD_BYTES,
          clientPayload: JSON.stringify({
            originalName: file.name,
            contentType,
          }),
          onUploadProgress: ({ percentage }) => {
            const roundedPercentage = Math.round(percentage);
            setActiveUploadProgress(roundedPercentage);
            setProductUploadMessage(product.id, field, `Uploading the full beat delivery file (${roundedPercentage}%)...`);
          },
        });

        await updateProductAndSave(index, {
          name: nextName,
          genre: currentProduct.genre && currentProduct.genre !== "Genre" ? currentProduct.genre : "Beat",
          description:
            currentProduct.description ||
            "Protected preview available. Purchase includes the full beat delivery.",
          price: currentProduct.price >= 0.5 ? currentProduct.price : 29.99,
          deliverables: currentProduct.deliverables.length
            ? currentProduct.deliverables
            : ["Full beat file delivered after purchase", "Non-exclusive beat license"],
          audioPreview: previewUrl,
          previewDuration: preview.previewDuration,
          deliveryFileUrl: blob.downloadUrl || blob.url,
          deliveryFileName: file.name,
          deliveryFileSize: file.size,
          deliveryFileReady: true,
        });
        setStatusMessage(
          preview.sourceDuration > MAX_PROTECTED_SAMPLE_SECONDS
            ? `Full beat uploaded once. A protected ${preview.previewDuration.toFixed(1)}-second sample was created from around ${formatDuration(
                preview.previewStart
              )}, and the full file was saved for delivery.`
            : `Full beat uploaded once. A protected sample was created at ${preview.previewDuration.toFixed(1)} seconds, and the full file was saved for delivery.`
        );
        uploadSucceeded = true;
        return;
      }

      const currentProduct = productsRef.current[index] || product;

      setStatusMessage("Fitting artwork into the storefront rectangle...");
      setProductUploadMessage(product.id, field, "Fitting artwork into the storefront rectangle...");
      const artworkUpload = await createFittedArtworkUpload(file);

      setStatusMessage("Uploading fitted artwork to the public store media library...");
      setProductUploadMessage(product.id, field, "Uploading fitted artwork to the public store media library...");
      const artworkUrl = await uploadStoreMedia(
        currentProduct,
        "artwork",
        artworkUpload.blob,
        artworkUpload.fileName,
        artworkUpload.contentType
      );

      await updateProductAndSave(index, { artwork: artworkUrl });
      setStatusMessage("Artwork fitted into a 16:9 rectangle and saved. Upload the full beat once to create the protected sample and delivery file.");
      uploadSucceeded = true;
    } catch (error) {
      const uploadMessage = getUploadErrorMessage(error);
      setStatusMessage(uploadMessage);
      setProductUploadMessage(product.id, field, uploadMessage);
    } finally {
      activeUploadProductIdRef.current = null;
      setActiveUploadProductId(null);
      setActiveUploadLabel("");
      setActiveUploadFileName("");
      setActiveUploadProgress(null);

      if (uploadSucceeded) {
        setPendingProductUpload(product.id, field, null);
        setProductUploadMessage(product.id, field, "");
      }
    }
  }

  function handleFileUpload(
    event: ChangeEvent<HTMLInputElement>,
    index: number,
    field: BeatUploadField
  ) {
    const file = event.target.files?.[0];
    const product = productsRef.current[index];

    if (!file || !product) {
      return;
    }

    setPendingProductUpload(product.id, field, file);
    setProductUploadMessage(product.id, field, `${file.name} selected. Starting the ${getUploadFieldLabel(field)} upload...`);
    setStatusMessage(`${file.name} selected. Starting the ${getUploadFieldLabel(field)} upload...`);
    void uploadProductFile(index, field, file);
  }

  async function handleSave() {
    setSaving(true);

    try {
      const mediaReadyContent = await publishEmbeddedProductMedia(productsRef.current);
      const normalizedProducts = mediaReadyContent.products.map(normalizeProductDraft);
      const readyCount = normalizedProducts.filter(isProductReadyForStorefront).length;
      const draftCount = normalizedProducts.length - readyCount;

      if (mediaReadyContent.convertedCount) {
        productsRef.current = normalizedProducts;
        setProducts(normalizedProducts);
        setStatusMessage(`Published ${mediaReadyContent.convertedCount} embedded media file(s) before saving the public catalog.`);
      }

      const savedContent = await saveStoredContent(normalizedProducts, settingsRef.current);
      productsRef.current = savedContent.products;
      settingsRef.current = savedContent.settings;
      setProducts(savedContent.products);
      setSettings(savedContent.settings);
      setContentSource("published");
      setStatusMessage(
        draftCount
          ? `Saved. ${readyCount} item(s) are ready for the storefront and ${draftCount} draft item(s) stay hidden until they are complete.`
          : `Saved. All ${readyCount} item(s) are storefront-ready.`
      );
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
      productsRef.current = defaultStoreProducts;
      settingsRef.current = defaultStoreSettings;
      setProducts(defaultStoreProducts);
      setSettings(defaultStoreSettings);
      setContentSource("published");
      setStatusMessage(getCatalogStatusMessage(defaultStoreProducts));
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
      const mediaReadyContent = await publishEmbeddedProductMedia(productsRef.current);
      const normalizedProducts = mediaReadyContent.products.map(normalizeProductDraft);
      const stripeSyncableProducts = normalizedProducts.filter(
        (product) => product.name && product.price >= 0.5
      );

      if (mediaReadyContent.convertedCount) {
        productsRef.current = normalizedProducts;
        setProducts(normalizedProducts);
        setStatusMessage(`Published ${mediaReadyContent.convertedCount} embedded media file(s) before syncing Stripe.`);
      }

      if (!stripeSyncableProducts.length) {
        setStatusMessage("Nothing can sync to Stripe yet. Add a product name and set a price of at least $0.50 first.");
        return;
      }

      const savedContent = await saveStoredContent(normalizedProducts, settingsRef.current);
      productsRef.current = savedContent.products;
      settingsRef.current = savedContent.settings;
      setProducts(savedContent.products);
      setSettings(savedContent.settings);
      setContentSource("published");

      const response = await fetch("/api/control-center/stripe/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          products: normalizedProducts,
        }),
      });

      const result = await response.json();

      if (!response.ok || !Array.isArray(result.products)) {
        throw new Error(result.error || "Stripe sync failed.");
      }

      const syncedProductMap = new Map<string, StoreProduct>(
        result.products.map((product: StoreProduct) => [
          product.id,
          normalizeProductDraft(product),
        ])
      );
      const mergedProducts = normalizedProducts.map(
        (product) => syncedProductMap.get(product.id) || product
      );

      productsRef.current = mergedProducts;
      setProducts(mergedProducts);
      const syncedContent = await saveStoredContent(mergedProducts, settingsRef.current);
      productsRef.current = syncedContent.products;
      settingsRef.current = syncedContent.settings;
      setProducts(syncedContent.products);
      setSettings(syncedContent.settings);
      setContentSource("published");
      const skippedCount = Number(result.skippedCount || 0);
      const failedCount = Number(result.failedCount || 0);
      const failedNames = Array.isArray(result.failedProducts)
        ? result.failedProducts
            .map((product: { name?: string; error?: string }) =>
              product.name && product.error ? `${product.name}: ${product.error}` : product.name || product.error
            )
            .filter(Boolean)
            .slice(0, 2)
            .join(" | ")
        : "";
      setStatusMessage(
        skippedCount || failedCount
          ? `Stripe synced ${result.syncedCount} product(s). ${skippedCount} item(s) need a valid name and price. ${failedCount} item(s) failed in Stripe.${failedNames ? ` ${failedNames}` : ""}`
          : `Stripe synced all ${result.syncedCount} product(s) with valid names and prices.`
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
            <span>Beat Samples</span>
            <span>Pricing</span>
            <span>Brand Copy</span>
          </div>
        </div>
      </header>

      <section className="section-block section-block-tight">
        <div className="control-overview" data-reveal="fade">
          <article className="panel control-overview-card">
            <span className="control-overview-label">Beat Drafts</span>
            <strong className="control-overview-value">{beatCount}</strong>
            <p>{readyBeatCount} beat{readyBeatCount === 1 ? "" : "s"} are fully ready for the public storefront.</p>
          </article>
          <article className="panel control-overview-card">
            <span className="control-overview-label">Protected Samples</span>
            <strong className="control-overview-value">{protectedSampleCount}</strong>
            <p>Beat previews already verified at {MAX_PROTECTED_SAMPLE_SECONDS} seconds or less.</p>
          </article>
          <article className="panel control-overview-card">
            <span className="control-overview-label">Live Services</span>
            <strong className="control-overview-value">{readyServiceCount}</strong>
            <p>Service tiers currently complete enough to appear in the public checkout flow.</p>
          </article>
          <article className="panel control-overview-card">
            <span className="control-overview-label">Hidden Drafts</span>
            <strong className="control-overview-value">{draftProductCount}</strong>
            <p>Items saved here but still hidden until their uploads and details are complete.</p>
          </article>
          <article className="panel control-overview-card">
            <span className="control-overview-label">Catalog Source</span>
            <strong className="control-overview-value">{getContentSourceLabel(contentSource)}</strong>
            <p>{getContentSourceDescription(contentSource)}</p>
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
              rel="noopener noreferrer"
            >
              Open Stripe Dashboard
            </a>
            <button
              className="button button-primary"
              type="button"
              onClick={handleStripeSync}
              disabled={!stripeStatus.configured || stripeSyncing || saving || hasActiveUpload || !products.length}
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
          <p className="eyebrow">Current Site Elements</p>
          <h2>Edit or remove the cards already showing on the homepage.</h2>
          <p>
            These are live content blocks from the public site. Hidden or removed elements stop
            rendering after you save.
          </p>
        </div>

        <div className="panel control-toolbar" data-reveal="fade">
          <div className="control-toolbar-copy">
            <p className="eyebrow">Dynamic Content</p>
            <h3>{settings.siteElements?.length || 0} editable homepage element(s).</h3>
            <p>Feature cards and workflow steps are now driven from this admin panel.</p>
          </div>
          <div className="control-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => addSiteElement("homepage-feature")}
            >
              Add Homepage Card
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => addSiteElement("homepage-workflow")}
            >
              Add Workflow Step
            </button>
          </div>
        </div>

        {settings.siteElements?.length ? (
          <div className="control-stack">
            {settings.siteElements.map((element, index) => (
              <article className="panel control-panel" key={element.id} data-reveal="zoom">
                <div className="control-card-topline">
                  <div className="control-title-stack">
                    <p className="eyebrow">
                      {element.placement === "homepage-workflow" ? "Homepage Workflow" : "Homepage Feature"}
                    </p>
                    <h3>{element.label || element.title || "Site Element"}</h3>
                    <span className={`control-status-badge${element.visible ? " is-ready" : " is-draft"}`}>
                      {element.visible ? "Visible" : "Hidden"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button button-secondary control-delete"
                    onClick={() => removeSiteElement(index)}
                  >
                    Remove
                  </button>
                </div>

                <div className="control-grid control-grid-product">
                  <label>
                    Element Type
                    <select
                      value={element.placement}
                      onChange={(event) =>
                        updateSiteElement(index, {
                          placement: event.target.value as StoreSiteElementPlacement,
                        })
                      }
                    >
                      <option value="homepage-feature">Homepage Feature Card</option>
                      <option value="homepage-workflow">Homepage Workflow Step</option>
                    </select>
                  </label>
                  <label>
                    Admin Label
                    <input
                      value={element.label}
                      onChange={(event) => updateSiteElement(index, { label: event.target.value })}
                    />
                  </label>
                  <label>
                    Small Label
                    <input
                      value={element.eyebrow}
                      onChange={(event) => updateSiteElement(index, { eyebrow: event.target.value })}
                    />
                  </label>
                  <label>
                    Visibility
                    <select
                      value={element.visible ? "visible" : "hidden"}
                      onChange={(event) => updateSiteElement(index, { visible: event.target.value === "visible" })}
                    >
                      <option value="visible">Visible On Site</option>
                      <option value="hidden">Hidden From Site</option>
                    </select>
                  </label>
                  <label className="control-full">
                    Title
                    <input
                      value={element.title}
                      onChange={(event) => updateSiteElement(index, { title: event.target.value })}
                    />
                  </label>
                  <label className="control-full">
                    Description
                    <textarea
                      rows={3}
                      value={element.description}
                      onChange={(event) => updateSiteElement(index, { description: event.target.value })}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <article className="panel store-empty-state" data-reveal="fade">
            <p className="eyebrow">No Site Elements</p>
            <h3>Add a homepage card or workflow step to rebuild this section.</h3>
            <p>Saved elements will render on the public homepage automatically.</p>
          </article>
        )}
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
              onClick={() => addProduct("beat")}
              disabled={saving || hasActiveUpload}
            >
              Add Beat
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => addProduct("service")}
              disabled={saving || hasActiveUpload}
            >
              Add Service
            </button>
            <button className="button button-secondary" type="button" onClick={handleReset} disabled={saving || hasActiveUpload}>
              Reset To Defaults
            </button>
            <button className="button button-primary" type="button" onClick={handleSave} disabled={saving || hasActiveUpload}>
              {saving ? "Saving..." : "Save All Changes"}
            </button>
          </div>
        </div>

        <p className="config-banner control-banner" data-reveal="fade" aria-live="polite">
          {statusMessage}
        </p>

        <div className="control-stack">
          {products.map((product, index) => {
            const normalizedProduct = normalizeProductDraft(product);
            const productIssues = getProductReadinessIssues(normalizedProduct);
            const isReady = productIssues.length === 0;
            const isUploadingProduct = activeUploadProductId === product.id;
            const pendingProductUploads = pendingUploads[product.id] || {};
            const pendingArtworkFile = pendingProductUploads.artwork;
            const pendingBeatFile = pendingProductUploads.beatAudio;
            const productUploadMessages = uploadMessages[product.id] || {};
            const artworkUploadMessage = productUploadMessages.artwork;
            const beatUploadMessage = productUploadMessages.beatAudio;

            return (
            <article className="panel control-panel" key={product.id} data-reveal="zoom">
              <div className="control-card-topline">
                <div className="control-title-stack">
                  <p className="eyebrow">{product.category === "beat" ? "Beat Item" : "Service Item"}</p>
                  <h3>{product.name || "Untitled Product"}</h3>
                  <span className={`control-status-badge${isReady ? " is-ready" : " is-draft"}`}>
                    {isReady ? "Storefront Ready" : "Hidden Draft"}
                  </span>
                </div>
                <button
                  type="button"
                  className="button button-secondary control-delete"
                  onClick={() => removeProduct(index)}
                  disabled={saving || isUploadingProduct}
                >
                  Remove
                </button>
              </div>

              <div className="control-product-layout">
                <div className="control-main-stack">
                  <section className="control-subpanel control-readiness-panel">
                    <p className="eyebrow">Store Readiness</p>
                    <div className="control-meta-inline">
                      <span>Visibility</span>
                      <strong>{isReady ? "Public storefront and checkout ready" : "Saved as hidden draft"}</strong>
                    </div>
                    {productIssues.length ? (
                      <ul className="control-issue-list">
                        {productIssues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="control-ready-note">
                        This item has the uploads and required details it needs to appear publicly.
                      </p>
                    )}
                  </section>

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
                            deliveryFileUrl: event.target.value === "service" ? "" : product.deliveryFileUrl,
                            deliveryFileName: event.target.value === "service" ? "" : product.deliveryFileName,
                            deliveryFileSize: event.target.value === "service" ? undefined : product.deliveryFileSize,
                            deliveryFileReady: event.target.value === "service" ? false : product.deliveryFileReady,
                            soldOut: event.target.value === "service" ? false : product.soldOut,
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
                        <span>Store Status</span>
                        <strong>{isReady ? "Live-ready" : "Hidden draft"}</strong>
                      </div>
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
                        <strong>{product.category === "beat" ? `${MAX_PROTECTED_SAMPLE_SECONDS} seconds max` : "Not used"}</strong>
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
                        <div className="control-media-grid">
                          <div className={`control-media-state${product.artwork ? " is-ready" : pendingArtworkFile ? " is-pending" : ""}`}>
                            <span>Artwork</span>
                            <strong>{product.artwork ? "Uploaded" : pendingArtworkFile ? "Selected" : "Missing"}</strong>
                          </div>
                          <div className={`control-media-state${product.audioPreview ? " is-ready" : pendingBeatFile ? " is-pending" : ""}`}>
                            <span>Protected Sample</span>
                            <strong>
                              {product.audioPreview
                                ? `${formatDuration(product.previewDuration)} loaded`
                                : pendingBeatFile
                                  ? "Selected"
                                  : "Missing"}
                            </strong>
                          </div>
                          <div className={`control-media-state${product.deliveryFileUrl ? " is-ready" : pendingBeatFile ? " is-pending" : ""}`}>
                            <span>Delivery File</span>
                            <strong>
                              {product.deliveryFileUrl
                                ? `${product.deliveryFileName || "Full beat"}${
                                    product.deliveryFileSize ? ` • ${formatFileSize(product.deliveryFileSize)}` : ""
                                  }`
                                : pendingBeatFile
                                  ? "Selected"
                                  : "Missing"}
                            </strong>
                          </div>
                          <div className={`control-media-state${product.soldOut ? " is-draft" : " is-ready"}`}>
                            <span>Availability</span>
                            <strong>{product.soldOut ? "Sold" : "Available"}</strong>
                          </div>
                        </div>
                        <label>
                          Artwork Upload
                          <input
                            key={`${product.id}-artwork-${product.artwork || "empty"}`}
                            type="file"
                            accept="image/*"
                            disabled={isUploadingProduct}
                            onChange={(event) => void handleFileUpload(event, index, "artwork")}
                          />
                        </label>
                        {pendingArtworkFile ? (
                          <div className="control-selected-upload">
                            <span>Selected artwork</span>
                            <strong>{pendingArtworkFile.name}</strong>
                            <button
                              type="button"
                              className="button button-secondary"
                              disabled={isUploadingProduct}
                              onClick={() => void uploadProductFile(index, "artwork", pendingArtworkFile)}
                            >
                              Upload Selected Artwork
                            </button>
                            {artworkUploadMessage ? <p>{artworkUploadMessage}</p> : null}
                          </div>
                        ) : null}
                        <label>
                          Full Beat Upload
                          <input
                            key={`${product.id}-beat-${product.audioPreview || product.deliveryFileUrl || "empty"}`}
                            type="file"
                            accept=".wav,.wave,.aif,.aiff,.flac,.mp3,.m4a,.aac,.ogg,audio/*"
                            disabled={isUploadingProduct}
                            onChange={(event) => void handleFileUpload(event, index, "beatAudio")}
                          />
                        </label>
                        {pendingBeatFile ? (
                          <div className="control-selected-upload">
                            <span>Selected full beat</span>
                            <strong>{pendingBeatFile.name}</strong>
                            <button
                              type="button"
                              className="button button-secondary"
                              disabled={isUploadingProduct}
                              onClick={() => void uploadProductFile(index, "beatAudio", pendingBeatFile)}
                            >
                              Upload Selected Beat
                            </button>
                            {beatUploadMessage ? <p>{beatUploadMessage}</p> : null}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className={product.soldOut ? "button button-secondary full-width" : "button button-primary full-width"}
                          disabled={isUploadingProduct}
                          onClick={() => {
                            void updateProductAndSave(index, { soldOut: !product.soldOut });
                            setStatusMessage(product.soldOut ? "Beat marked available." : "Beat marked sold.");
                          }}
                        >
                          {product.soldOut ? "Mark Available" : "Mark Sold"}
                        </button>
                        {isUploadingProduct ? (
                          <p className="control-upload-progress" aria-live="polite">
                            Uploading {activeUploadLabel}
                            {activeUploadFileName ? `: ${activeUploadFileName}` : ""}
                            {activeUploadProgress !== null ? ` (${activeUploadProgress}%)` : ""}. Keep this tab open until the status changes.
                          </p>
                        ) : null}
                        <p className="control-media-guidance">
                          Upload the full beat once. The control center automatically creates the protected{" "}
                          {MAX_PROTECTED_SAMPLE_SECONDS}-second preview and saves the original file for delivery.
                        </p>
                        <p className="control-security-note">
                          The public site receives the generated preview clip only. The full beat delivery
                          file is emailed to the customer after Stripe confirms payment.
                        </p>
                        <div className="control-meta-inline">
                          <span>Current sample length</span>
                          <strong>{formatDuration(product.previewDuration)}</strong>
                        </div>
                        {product.artwork ? (
                          <Image
                            src={product.artwork}
                            alt={`${product.name} artwork preview`}
                            className="control-preview-image"
                            width={960}
                            height={960}
                            sizes="(max-width: 760px) calc(100vw - 56px), (max-width: 1080px) 45vw, 520px"
                            unoptimized
                          />
                        ) : (
                          <div className="control-empty-state">
                            {pendingArtworkFile ? "Artwork selected. Upload still needs to finish." : "No artwork uploaded yet."}
                          </div>
                        )}
                        {product.audioPreview ? (
                          <SampleAudioPlayer
                            src={product.audioPreview}
                            className="preview-player"
                            maxSeconds={20}
                            caption="Playback is locked to a 20-second sample for storefront security."
                          />
                        ) : (
                          <div className="control-empty-state">
                            {pendingBeatFile ? "Beat selected. Upload still needs to finish before the sample appears." : "No sample uploaded yet."}
                          </div>
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
          )})}
        </div>
      </section>
    </main>
  );
}
