import { NextRequest, NextResponse } from "next/server";
import { sendSessionUploadNotification } from "@/lib/order-notifications";
import { saveSessionSubmission } from "@/lib/session-submissions";
import type { SessionUploadSubmission } from "@/lib/session-upload";
import { MAX_SESSION_UPLOAD_FILES } from "@/lib/session-upload";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function getCleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function verifyPaidPaymentReference(paymentReference: string) {
  if (!stripe) {
    throw new Error("Payment verification is not configured.");
  }

  if (!paymentReference.startsWith("pi_")) {
    throw new Error("Payment must be confirmed before sending files.");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentReference);

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Payment must be confirmed before sending files.");
  }
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

    const paymentReference = getCleanText(body.paymentReference);

    if (!paymentReference) {
      return NextResponse.json(
        { error: "Payment must be confirmed before sending files." },
        { status: 402 }
      );
    }

    await verifyPaidPaymentReference(paymentReference);

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

    const submission: SessionUploadSubmission = {
      artistName: getCleanText(body.artistName),
      email: getCleanText(body.email),
      projectTitle: getCleanText(body.projectTitle),
      serviceTier: getCleanText(body.serviceTier),
      bpm: getCleanText(body.bpm),
      keySignature: getCleanText(body.keySignature),
      notes: getCleanText(body.notes),
      paymentReference,
      files: normalizedFiles,
    };

    let savedToInbox = false;
    let notificationSent = false;
    let inboxError = "";
    let notificationError = "";

    try {
      await saveSessionSubmission(submission);
      savedToInbox = true;
    } catch (error) {
      inboxError = error instanceof Error ? error.message : "Could not save the upload to the studio inbox.";
    }

    try {
      await sendSessionUploadNotification(submission);
      notificationSent = true;
    } catch (error) {
      notificationError = error instanceof Error ? error.message : "Could not send the upload notification email.";
    }

    if (!savedToInbox && !notificationSent) {
      throw new Error(notificationError || inboxError || "Unable to finish the session upload.");
    }

    const warning =
      savedToInbox && !notificationSent
        ? "Email alerts are not connected yet, but the upload is saved in the studio inbox."
        : !savedToInbox && notificationSent
          ? "The upload reached the studio by email, but it was not copied into the control-center inbox."
          : "";

    return NextResponse.json({
      ok: true,
      savedToInbox,
      notificationSent,
      warning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish the session upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
