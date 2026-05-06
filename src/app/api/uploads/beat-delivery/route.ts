import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
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

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Missing BLOB_READ_WRITE_TOKEN. Add it before uploading beat delivery files." },
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
