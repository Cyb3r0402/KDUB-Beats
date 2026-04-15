export const MAX_SESSION_UPLOAD_FILES = 12;
export const MAX_SESSION_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
export const MULTIPART_UPLOAD_THRESHOLD_BYTES = 20 * 1024 * 1024;

const SESSION_UPLOAD_ALLOWED_EXTENSIONS = [
  ".zip",
  ".wav",
  ".wave",
  ".aif",
  ".aiff",
  ".flac",
  ".mp3",
  ".m4a",
  ".aac",
  ".ogg",
] as const;

export const SESSION_UPLOAD_ACCEPT = SESSION_UPLOAD_ALLOWED_EXTENSIONS.join(",");

export const SESSION_UPLOAD_ALLOWED_CONTENT_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/aiff",
  "audio/x-aiff",
  "audio/flac",
  "audio/x-flac",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
] as const;

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".zip": "application/zip",
  ".wav": "audio/wav",
  ".wave": "audio/wave",
  ".aif": "audio/aiff",
  ".aiff": "audio/aiff",
  ".flac": "audio/flac",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
};

export interface UploadedSessionFile {
  name: string;
  size: number;
  contentType: string;
  pathname: string;
  url: string;
  downloadUrl: string;
}

export interface SessionUploadSubmission {
  artistName: string;
  email: string;
  projectTitle: string;
  serviceTier?: string;
  bpm?: string;
  keySignature?: string;
  notes?: string;
  paymentReference?: string;
  files: UploadedSessionFile[];
}

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);
  return match?.[0] || "";
}

function getSafeFileName(fileName: string) {
  const extension = getFileExtension(fileName);
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
  const safeBase = sanitizeSegment(baseName) || "session-file";
  const safeExtension = sanitizeSegment(extension.replace(".", ""));
  return safeExtension ? `${safeBase}.${safeExtension}` : safeBase;
}

export function getSessionUploadContentType(fileName: string, fallbackType = "") {
  const cleanedType = fallbackType.trim().toLowerCase();

  if (SESSION_UPLOAD_ALLOWED_CONTENT_TYPES.includes(cleanedType as (typeof SESSION_UPLOAD_ALLOWED_CONTENT_TYPES)[number])) {
    return cleanedType;
  }

  return CONTENT_TYPE_BY_EXTENSION[getFileExtension(fileName)] || "";
}

export function isAllowedSessionUpload(fileName: string, contentType = "") {
  return Boolean(getSessionUploadContentType(fileName, contentType));
}

export function getSessionUploadIssue(file: File) {
  if (!isAllowedSessionUpload(file.name, file.type)) {
    return "Uploads must be ZIP folders or audio files such as WAV, AIFF, FLAC, MP3, M4A, AAC, or OGG.";
  }

  if (file.size > MAX_SESSION_UPLOAD_BYTES) {
    return `Each upload must stay under ${formatFileSize(MAX_SESSION_UPLOAD_BYTES)}. Zip large sessions before uploading.`;
  }

  return "";
}

export function buildSessionUploadPathname(projectTitle: string, fileName: string) {
  const dateSegment = new Date().toISOString().slice(0, 10);
  const projectSegment = sanitizeSegment(projectTitle) || "untitled-session";
  return `session-uploads/${dateSegment}/${projectSegment}/${getSafeFileName(fileName)}`;
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  const formatted = value >= 10 || power === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[power]}`;
}
