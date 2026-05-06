import nodemailer from "nodemailer";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import type { SessionUploadSubmission } from "@/lib/session-upload";
import { formatFileSize } from "@/lib/session-upload";

const DEFAULT_ORDER_NOTIFICATION_TO = "kalebmay18@gmail.com";

function getSmtpPort() {
  const parsed = Number(process.env.SMTP_PORT || "465");
  return Number.isFinite(parsed) ? parsed : 465;
}

function isSmtpSecure() {
  const value = (process.env.SMTP_SECURE || "true").toLowerCase();
  return value !== "false";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAmount(amountInCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
}

function formatTimestamp(createdAt: number) {
  return new Date(createdAt * 1000).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatUploadTimestamp() {
  return new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getDashboardPaymentUrl(paymentIntentId: string) {
  const testPrefix = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "" : "test/";
  return `https://dashboard.stripe.com/${testPrefix}payments/${paymentIntentId}`;
}

function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: getSmtpPort(),
    secure: isSmtpSecure(),
    auth: {
      user,
      pass,
    },
  });
}

export function isOrderNotificationConfigured() {
  return Boolean(getMailTransporter());
}

export async function sendOrderNotificationEmail(paymentIntent: Stripe.PaymentIntent) {
  const transporter = getMailTransporter();

  if (!transporter) {
    throw new Error("Missing SMTP configuration. Add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.");
  }

  const metadata = paymentIntent.metadata || {};
  const recipient = process.env.ORDER_NOTIFICATION_TO || DEFAULT_ORDER_NOTIFICATION_TO;
  const customerName = metadata.fullName || "Unknown customer";
  const customerEmail = metadata.email || paymentIntent.receipt_email || "No customer email provided";
  const productName = metadata.productName || "Unnamed product";
  const category = metadata.category || "product";
  const amount = formatAmount(paymentIntent.amount_received || paymentIntent.amount, paymentIntent.currency || "usd");
  const orderedAt = formatTimestamp(paymentIntent.created);
  const dashboardUrl = getDashboardPaymentUrl(paymentIntent.id);
  const stripeProductId = metadata.stripeProductId || "Not synced";
  const stripePriceId = metadata.stripePriceId || "Not synced";
  const deliveryFileUrl = metadata.deliveryFileUrl || "";
  const deliveryFileName = metadata.deliveryFileName || "Full beat delivery file";
  const from = process.env.ORDER_NOTIFICATION_FROM || process.env.SMTP_USER || recipient;

  const text = [
    "A new paid KDUB order is ready to be fulfilled.",
    "",
    `Product: ${productName}`,
    `Category: ${category}`,
    `Amount: ${amount}`,
    `Customer: ${customerName}`,
    `Customer Email: ${customerEmail}`,
    `Ordered At: ${orderedAt}`,
    `Payment Intent: ${paymentIntent.id}`,
    `Stripe Product ID: ${stripeProductId}`,
    `Stripe Price ID: ${stripePriceId}`,
    deliveryFileUrl ? `Delivery File: ${deliveryFileName}\n${deliveryFileUrl}` : "Delivery File: Not attached",
    `Stripe Dashboard: ${dashboardUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#07111a;">
      <h2 style="margin:0 0 16px;">New KDUB Order</h2>
      <p style="margin:0 0 16px;">A paid order is ready to be fulfilled.</p>
      <table style="border-collapse:collapse;width:100%;max-width:640px;">
        <tbody>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Product</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(productName)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Category</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(category)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Amount</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(amount)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Customer</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(customerName)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Customer Email</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(customerEmail)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Ordered At</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(orderedAt)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Payment Intent</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(paymentIntent.id)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Stripe Product ID</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(stripeProductId)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Stripe Price ID</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(stripePriceId)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Delivery File</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${
            deliveryFileUrl
              ? `<a href="${deliveryFileUrl}" target="_blank" rel="noreferrer">${escapeHtml(deliveryFileName)}</a>`
              : "Not attached"
          }</td></tr>
        </tbody>
      </table>
      <p style="margin:16px 0 0;">
        <a href="${dashboardUrl}" target="_blank" rel="noreferrer">Open this payment in Stripe</a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    to: recipient,
    from,
    replyTo: customerEmail.includes("@") ? customerEmail : undefined,
    subject: `New KDUB ${category} order: ${productName}`,
    text,
    html,
  });
}

async function sendCustomerBeatDeliveryEmail(paymentIntent: Stripe.PaymentIntent) {
  const transporter = getMailTransporter();

  if (!transporter) {
    throw new Error("Missing SMTP configuration. Add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.");
  }

  const metadata = paymentIntent.metadata || {};
  const customerEmail = metadata.email || paymentIntent.receipt_email || "";
  const productName = metadata.productName || "your beat";
  const deliveryFileUrl = metadata.deliveryFileUrl || "";
  const deliveryFileName = metadata.deliveryFileName || "Full beat download";
  const from = process.env.ORDER_NOTIFICATION_FROM || process.env.SMTP_USER || DEFAULT_ORDER_NOTIFICATION_TO;

  if (metadata.category !== "beat" || !customerEmail.includes("@") || !deliveryFileUrl) {
    return;
  }

  const text = [
    `Thanks for purchasing ${productName}.`,
    "",
    "Your beat download is ready:",
    `${deliveryFileName}: ${deliveryFileUrl}`,
    "",
    "Keep this email for your records.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#07111a;">
      <h2 style="margin:0 0 16px;">Your KDUB Beat Is Ready</h2>
      <p style="margin:0 0 16px;">Thanks for purchasing ${escapeHtml(productName)}.</p>
      <p style="margin:0 0 18px;">
        <a href="${deliveryFileUrl}" target="_blank" rel="noreferrer" style="display:inline-block;padding:12px 16px;background:#07111a;color:#ffffff;text-decoration:none;border-radius:8px;">
          Download ${escapeHtml(deliveryFileName)}
        </a>
      </p>
      <p style="margin:0;">Keep this email for your records.</p>
    </div>
  `;

  await transporter.sendMail({
    to: customerEmail,
    from,
    subject: `Your KDUB beat download: ${productName}`,
    text,
    html,
  });
}

export async function notifyOrderFulfillment(paymentIntentId: string, clientSecret?: string) {
  if (!stripe) {
    throw new Error("Missing STRIPE_SECRET_KEY. Add it before using order notifications.");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (clientSecret && (!paymentIntent.client_secret || paymentIntent.client_secret !== clientSecret)) {
    throw new Error("Payment confirmation does not match this order.");
  }

  if (paymentIntent.status !== "succeeded") {
    throw new Error("Payment has not completed successfully yet.");
  }

  if (paymentIntent.metadata?.orderNotificationSent === "true") {
    return {
      alreadyNotified: true,
      paymentIntent,
    };
  }

  await sendOrderNotificationEmail(paymentIntent);
  await sendCustomerBeatDeliveryEmail(paymentIntent);

  const updatedPaymentIntent = await stripe.paymentIntents.update(paymentIntent.id, {
    metadata: {
      ...paymentIntent.metadata,
      orderNotificationSent: "true",
      orderNotificationSentAt: new Date().toISOString(),
    },
  });

  return {
    alreadyNotified: false,
    paymentIntent: updatedPaymentIntent,
  };
}

export async function sendSessionUploadNotification(submission: SessionUploadSubmission) {
  const transporter = getMailTransporter();

  if (!transporter) {
    throw new Error("Missing SMTP configuration. Add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.");
  }

  const recipient = process.env.ORDER_NOTIFICATION_TO || DEFAULT_ORDER_NOTIFICATION_TO;
  const from = process.env.ORDER_NOTIFICATION_FROM || process.env.SMTP_USER || recipient;
  const uploadedAt = formatUploadTimestamp();
  const serviceTier = submission.serviceTier || "Custom studio upload";
  const paymentReference = submission.paymentReference || "Not provided";

  const fileLines = submission.files.map((file) => {
    const size = formatFileSize(file.size);
    return `- ${file.name} (${size})\n  ${file.downloadUrl}`;
  });

  const text = [
    "A new client session upload is ready for review.",
    "",
    `Artist: ${submission.artistName}`,
    `Email: ${submission.email}`,
    `Project: ${submission.projectTitle}`,
    `Service Tier: ${serviceTier}`,
    `Payment Reference: ${paymentReference}`,
    `BPM: ${submission.bpm || "Not provided"}`,
    `Key: ${submission.keySignature || "Not provided"}`,
    `Uploaded At: ${uploadedAt}`,
    submission.notes ? `Notes: ${submission.notes}` : "Notes: None provided",
    "",
    "Files:",
    ...fileLines,
  ].join("\n");

  const fileRows = submission.files
    .map((file) => {
      return `
        <tr>
          <td style="padding:10px 12px;border:1px solid #d7e6f5;">${escapeHtml(file.name)}</td>
          <td style="padding:10px 12px;border:1px solid #d7e6f5;">${escapeHtml(formatFileSize(file.size))}</td>
          <td style="padding:10px 12px;border:1px solid #d7e6f5;">
            <a href="${file.downloadUrl}" target="_blank" rel="noreferrer">Download file</a>
          </td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#07111a;">
      <h2 style="margin:0 0 16px;">New KDUB Session Upload</h2>
      <p style="margin:0 0 16px;">A client uploaded files for a mix or master session.</p>
      <table style="border-collapse:collapse;width:100%;max-width:680px;margin-bottom:16px;">
        <tbody>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Artist</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(submission.artistName)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Email</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(submission.email)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Project</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(submission.projectTitle)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Service Tier</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(serviceTier)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Payment Reference</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(paymentReference)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>BPM</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(submission.bpm || "Not provided")}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Key</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(submission.keySignature || "Not provided")}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Uploaded At</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(uploadedAt)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #d7e6f5;"><strong>Notes</strong></td><td style="padding:8px 12px;border:1px solid #d7e6f5;">${escapeHtml(submission.notes || "No notes provided.")}</td></tr>
        </tbody>
      </table>
      <table style="border-collapse:collapse;width:100%;max-width:680px;">
        <thead>
          <tr>
            <th style="padding:10px 12px;border:1px solid #d7e6f5;text-align:left;background:#eff7ff;">File</th>
            <th style="padding:10px 12px;border:1px solid #d7e6f5;text-align:left;background:#eff7ff;">Size</th>
            <th style="padding:10px 12px;border:1px solid #d7e6f5;text-align:left;background:#eff7ff;">Link</th>
          </tr>
        </thead>
        <tbody>${fileRows}</tbody>
      </table>
    </div>
  `;

  await transporter.sendMail({
    to: recipient,
    from,
    replyTo: submission.email,
    subject: `New KDUB session upload: ${submission.projectTitle}`,
    text,
    html,
  });
}
