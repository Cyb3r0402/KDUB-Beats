import { get, list, put } from "@vercel/blob";
import { BLOB_READ_WRITE_TOKEN_ENV_NAMES, getBlobReadWriteToken, hasBlobReadWriteToken } from "@/lib/blob-token";
import { isOrderNotificationConfigured } from "@/lib/order-notifications";
import type { SessionUploadSubmission, UploadedSessionFile } from "@/lib/session-upload";

const SESSION_SUBMISSIONS_PREFIX = "session-submissions/";
const DEFAULT_SESSION_SUBMISSION_LIMIT = 12;
const MAX_SESSION_SUBMISSION_SCAN = 200;

export interface StoredSessionSubmission extends SessionUploadSubmission {
  id: string;
  receivedAt: string;
  inboxPathname: string;
}

export interface SessionUploadSystemStatus {
  blobConfigured: boolean;
  emailConfigured: boolean;
  inboxConfigured: boolean;
}

function sanitizeSegment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFile(file: UploadedSessionFile): UploadedSessionFile {
  return {
    name: cleanText(file.name),
    size: typeof file.size === "number" && Number.isFinite(file.size) ? file.size : 0,
    contentType: cleanText(file.contentType),
    pathname: cleanText(file.pathname),
    url: cleanText(file.url),
    downloadUrl: cleanText(file.downloadUrl),
  };
}

function normalizeStoredSubmission(
  value: Partial<StoredSessionSubmission>,
  fallbackPathname: string
): StoredSessionSubmission | null {
  const files = Array.isArray(value.files)
    ? value.files
        .map((file) => normalizeFile(file as UploadedSessionFile))
        .filter((file) => file.name && file.pathname && file.url && file.downloadUrl && file.size > 0)
    : [];

  const id = cleanText(value.id);
  const artistName = cleanText(value.artistName);
  const email = cleanText(value.email);
  const projectTitle = cleanText(value.projectTitle);
  const receivedAt = cleanText(value.receivedAt);

  if (!id || !artistName || !email || !projectTitle || !receivedAt || !files.length) {
    return null;
  }

  return {
    id,
    artistName,
    email,
    projectTitle,
    serviceTier: cleanText(value.serviceTier),
    bpm: cleanText(value.bpm),
    keySignature: cleanText(value.keySignature),
    notes: cleanText(value.notes),
    paymentReference: cleanText(value.paymentReference),
    files,
    receivedAt,
    inboxPathname: cleanText(value.inboxPathname) || fallbackPathname,
  };
}

function buildSubmissionPathname(projectTitle: string, id: string) {
  const dateSegment = new Date().toISOString().slice(0, 10);
  const projectSegment = sanitizeSegment(projectTitle) || "untitled-session";
  return `${SESSION_SUBMISSIONS_PREFIX}${dateSegment}/${id}-${projectSegment}.json`;
}

async function readStoredSubmission(pathname: string) {
  const result = await get(pathname, {
    access: "private",
    useCache: false,
    token: getBlobReadWriteToken(),
  });

  if (!result?.stream) {
    return null;
  }

  const payload = await new Response(result.stream).text();
  return normalizeStoredSubmission(JSON.parse(payload) as Partial<StoredSessionSubmission>, pathname);
}

export function getSessionUploadSystemStatus(): SessionUploadSystemStatus {
  const blobConfigured = hasBlobReadWriteToken();

  return {
    blobConfigured,
    emailConfigured: isOrderNotificationConfigured(),
    inboxConfigured: blobConfigured,
  };
}

export async function saveSessionSubmission(submission: SessionUploadSubmission) {
  if (!hasBlobReadWriteToken()) {
    throw new Error(`Missing ${BLOB_READ_WRITE_TOKEN_ENV_NAMES}. Add it before receiving client session uploads.`);
  }

  const id = `${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  const inboxPathname = buildSubmissionPathname(submission.projectTitle, id);
  const record: StoredSessionSubmission = {
    id,
    artistName: cleanText(submission.artistName),
    email: cleanText(submission.email),
    projectTitle: cleanText(submission.projectTitle),
    serviceTier: cleanText(submission.serviceTier),
    bpm: cleanText(submission.bpm),
    keySignature: cleanText(submission.keySignature),
    notes: cleanText(submission.notes),
    paymentReference: cleanText(submission.paymentReference),
    files: submission.files.map(normalizeFile),
    receivedAt: new Date().toISOString(),
    inboxPathname,
  };

  await put(inboxPathname, JSON.stringify(record, null, 2), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
    token: getBlobReadWriteToken(),
  });

  return record;
}

export async function listRecentSessionSubmissions(limit = DEFAULT_SESSION_SUBMISSION_LIMIT) {
  if (!hasBlobReadWriteToken()) {
    return [];
  }

  const { blobs } = await list({
    prefix: SESSION_SUBMISSIONS_PREFIX,
    limit: MAX_SESSION_SUBMISSION_SCAN,
    token: getBlobReadWriteToken(),
  });

  const recentBlobs = [...blobs]
    .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime())
    .slice(0, Math.max(1, limit));

  const submissions = await Promise.all(
    recentBlobs.map(async (blob) => {
      try {
        return await readStoredSubmission(blob.pathname);
      } catch {
        return null;
      }
    })
  );

  return submissions.filter((submission): submission is StoredSessionSubmission => Boolean(submission));
}
