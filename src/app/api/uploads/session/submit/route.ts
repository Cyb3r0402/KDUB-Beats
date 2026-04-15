import { NextRequest, NextResponse } from "next/server";
import { sendSessionUploadNotification } from "@/lib/order-notifications";
import type { SessionUploadSubmission } from "@/lib/session-upload";
import { MAX_SESSION_UPLOAD_FILES } from "@/lib/session-upload";

export const runtime = "nodejs";

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function getCleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SessionUploadSubmission;

    if (!hasText(body.artistName) || !hasText(body.email) || !hasText(body.projectTitle)) {
      return NextResponse.json(
        { error: "Artist name, email, and project title are required before sending files." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.files) || !body.files.length) {
      return NextResponse.json({ error: "Add at least one file before submitting the session." }, { status: 400 });
    }

    if (body.files.length > MAX_SESSION_UPLOAD_FILES) {
      return NextResponse.json(
        { error: `Upload up to ${MAX_SESSION_UPLOAD_FILES} files at a time.` },
        { status: 400 }
      );
    }

    const normalizedFiles = body.files.filter((file) => {
      return (
        hasText(file.name) &&
        hasText(file.pathname) &&
        hasText(file.url) &&
        hasText(file.downloadUrl) &&
        typeof file.size === "number" &&
        Number.isFinite(file.size)
      );
    });

    if (!normalizedFiles.length) {
      return NextResponse.json({ error: "Uploaded file data is missing. Try the upload again." }, { status: 400 });
    }

    await sendSessionUploadNotification({
      artistName: getCleanText(body.artistName),
      email: getCleanText(body.email),
      projectTitle: getCleanText(body.projectTitle),
      serviceTier: getCleanText(body.serviceTier),
      bpm: getCleanText(body.bpm),
      keySignature: getCleanText(body.keySignature),
      notes: getCleanText(body.notes),
      paymentReference: getCleanText(body.paymentReference),
      files: normalizedFiles,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish the session upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
