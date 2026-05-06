import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import {
  CONTROL_CENTER_COOKIE_NAME,
  isAuthorizedControlCenterSession,
} from "@/lib/control-center-auth";

export const runtime = "nodejs";

const MAX_STORE_MEDIA_BYTES = 50 * 1024 * 1024;
const STORE_MEDIA_ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
] as const;

interface StoreMediaClientPayload {
  originalName?: string;
  contentType?: string;
}

function parseClientPayload(clientPayload: string | null): StoreMediaClientPayload {
  if (!clientPayload) {
    return {};
  }

  try {
    const parsed = JSON.parse(clientPayload) as StoreMediaClientPayload;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getStoreMediaContentType(fileName: string, fallbackType = "") {
  const cleanedType = fallbackType.trim().toLowerCase();

  if (STORE_MEDIA_ALLOWED_CONTENT_TYPES.includes(cleanedType as (typeof STORE_MEDIA_ALLOWED_CONTENT_TYPES)[number])) {
    return cleanedType;
  }

  if (/\.(png)$/i.test(fileName)) {
    return "image/png";
  }

  if (/\.(jpe?g)$/i.test(fileName)) {
    return "image/jpeg";
  }

  if (/\.(webp)$/i.test(fileName)) {
    return "image/webp";
  }

  if (/\.(gif)$/i.test(fileName)) {
    return "image/gif";
  }

  if (/\.(avif)$/i.test(fileName)) {
    return "image/avif";
  }

  if (/\.(wav|wave)$/i.test(fileName)) {
    return "audio/wav";
  }

  if (/\.(mp3)$/i.test(fileName)) {
    return "audio/mpeg";
  }

  if (/\.(m4a)$/i.test(fileName)) {
    return "audio/mp4";
  }

  if (/\.(aac)$/i.test(fileName)) {
    return "audio/aac";
  }

  if (/\.(ogg)$/i.test(fileName)) {
    return "audio/ogg";
  }

  return "";
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Missing BLOB_READ_WRITE_TOKEN. Add it before uploading public store media." },
      { status: 500 }
    );
  }

  const token = request.headers.get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${CONTROL_CENTER_COOKIE_NAME}=`))
    ?.split("=")[1];

  if (!isAuthorizedControlCenterSession(token)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith("store-media/")) {
          throw new Error("Store media must be uploaded through the control center.");
        }

        const payload = parseClientPayload(clientPayload);
        const contentType = getStoreMediaContentType(
          payload.originalName || pathname,
          payload.contentType || ""
        );

        if (!contentType) {
          throw new Error("Store media must be image files or protected audio preview files.");
        }

        return {
          allowedContentTypes: [...STORE_MEDIA_ALLOWED_CONTENT_TYPES],
          maximumSizeInBytes: MAX_STORE_MEDIA_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
          validUntil: Date.now() + 20 * 60 * 1000,
          tokenPayload: JSON.stringify({
            originalName: payload.originalName || pathname,
          }),
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload store media.";
    const status = message.startsWith("Store media") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
