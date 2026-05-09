import { put } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { BLOB_READ_WRITE_TOKEN_ENV_NAMES, getBlobReadWriteToken, hasBlobReadWriteToken } from "@/lib/blob-token";
import {
  CONTROL_CENTER_COOKIE_NAME,
  isAuthorizedControlCenterSession,
} from "@/lib/control-center-auth";
import {
  MAX_SESSION_UPLOAD_BYTES,
  SESSION_UPLOAD_ALLOWED_CONTENT_TYPES,
  getSessionUploadContentType,
} from "@/lib/session-upload";

export const runtime = "nodejs";

interface UploadClientPayload {
  originalName?: string;
  contentType?: string;
}

interface BeatDeliveryUploadResponse {
  url: string;
  downloadUrl: string;
  pathname: string;
  contentType: string;
}

function parseClientPayload(clientPayload: string | null): UploadClientPayload {
  if (!clientPayload) {
    return {};
  }

  try {
    const parsed = JSON.parse(clientPayload) as UploadClientPayload;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getControlCenterToken(request: Request) {
  return request.headers.get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${CONTROL_CENTER_COOKIE_NAME}=`))
    ?.split("=")[1];
}

function getUploadFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to upload the full beat.";

  if (/access|private|public/i.test(message)) {
    return "Blob upload failed because this token/store does not accept public delivery uploads. Use a Public Vercel Blob store token for beat delivery links, then redeploy.";
  }

  if (/token|unauthorized|forbidden|401|403/i.test(message)) {
    return `Blob upload authorization failed. Check ${BLOB_READ_WRITE_TOKEN_ENV_NAMES} in Vercel Production, then redeploy.`;
  }

  return message;
}

async function handleDirectBeatDeliveryUpload(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const pathname = String(formData.get("pathname") || "");
  const originalName = String(formData.get("originalName") || pathname);
  const requestedContentType = String(formData.get("contentType") || "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a full beat file before uploading." }, { status: 400 });
  }

  if (!pathname.startsWith("beat-delivery/")) {
    return NextResponse.json(
      { error: "Beat delivery files must be uploaded through the control center." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SESSION_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `The full beat must be ${Math.floor(MAX_SESSION_UPLOAD_BYTES / 1024 / 1024 / 1024)} GB or smaller.` },
      { status: 400 }
    );
  }

  const contentType = getSessionUploadContentType(originalName, requestedContentType || file.type);

  if (!contentType) {
    return NextResponse.json(
      { error: "Only audio files such as WAV, AIFF, FLAC, MP3, M4A, AAC, and OGG are allowed." },
      { status: 400 }
    );
  }

  try {
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType,
      token: getBlobReadWriteToken(),
    });

    const response: BeatDeliveryUploadResponse = {
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      contentType: blob.contentType || contentType,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: getUploadFailureMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasBlobReadWriteToken()) {
    return NextResponse.json(
      { error: `Missing ${BLOB_READ_WRITE_TOKEN_ENV_NAMES}. Add it before uploading beat delivery files.` },
      { status: 500 }
    );
  }

  const token = getControlCenterToken(request);

  if (!isAuthorizedControlCenterSession(token)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    return handleDirectBeatDeliveryUpload(request);
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      token: getBlobReadWriteToken(),
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith("beat-delivery/")) {
          throw new Error("Beat delivery files must be uploaded through the control center.");
        }

        const payload = parseClientPayload(clientPayload);
        const contentType = getSessionUploadContentType(
          payload.originalName || pathname,
          payload.contentType || ""
        );

        if (!contentType) {
          throw new Error(
            "Only ZIP folders or audio files such as WAV, AIFF, FLAC, MP3, M4A, AAC, and OGG are allowed."
          );
        }

        return {
          allowedContentTypes: [...SESSION_UPLOAD_ALLOWED_CONTENT_TYPES],
          maximumSizeInBytes: MAX_SESSION_UPLOAD_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 20 * 60 * 1000,
          tokenPayload: JSON.stringify({
            originalName: payload.originalName || pathname,
          }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start the delivery upload.";
    const status = message.startsWith("Only ") || message.startsWith("Beat delivery") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
