import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { BLOB_READ_WRITE_TOKEN_ENV_NAMES, getBlobReadWriteToken, hasBlobReadWriteToken } from "@/lib/blob-token";
import {
  MAX_SESSION_UPLOAD_BYTES,
  SESSION_UPLOAD_ALLOWED_CONTENT_TYPES,
  getSessionUploadContentType,
} from "@/lib/session-upload";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

interface UploadClientPayload {
  originalName?: string;
  contentType?: string;
  paymentReference?: string;
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

async function verifyPaidPaymentReference(paymentReference: string | undefined) {
  if (!stripe) {
    throw new Error("Payment verification is not configured.");
  }

  if (!paymentReference?.startsWith("pi_")) {
    throw new Error("Payment must be confirmed before uploading files.");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentReference);

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Payment must be confirmed before uploading files.");
  }
}

export async function POST(request: Request) {
  if (!hasBlobReadWriteToken()) {
    return NextResponse.json(
      { error: `Missing ${BLOB_READ_WRITE_TOKEN_ENV_NAMES}. Add it before enabling client session uploads.` },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      token: getBlobReadWriteToken(),
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith("session-uploads/")) {
          throw new Error("Uploads must be sent through the session delivery portal.");
        }

        const payload = parseClientPayload(clientPayload);
        await verifyPaidPaymentReference(payload.paymentReference);
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
          access: "public",
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
    const message = error instanceof Error ? error.message : "Unable to start the upload.";
    const status = message.startsWith("Only ") || message.startsWith("Uploads must") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
