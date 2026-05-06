import { NextRequest, NextResponse } from "next/server";
import {
  CONTROL_CENTER_COOKIE_NAME,
  isAuthorizedControlCenterSession,
} from "@/lib/control-center-auth";
import {
  loadPublishedStoreContentWithSource,
  savePublishedStoreContent,
} from "@/lib/control-center-content-store";
import { getPublicStoreContent, normalizeStoreContent } from "@/lib/store-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const publishedContent = await loadPublishedStoreContentWithSource();
    const token = request.cookies.get(CONTROL_CENTER_COOKIE_NAME)?.value;
    const content = isAuthorizedControlCenterSession(token)
      ? publishedContent.content
      : getPublicStoreContent(publishedContent.content);

    return jsonNoStore({
      ...content,
      source: publishedContent.source,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load published site content.";
    return jsonNoStore({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get(CONTROL_CENTER_COOKIE_NAME)?.value;

  if (!isAuthorizedControlCenterSession(token)) {
    return jsonNoStore({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const content = normalizeStoreContent(payload);
    const savedContent = await savePublishedStoreContent(content);

    return jsonNoStore({
      ...savedContent,
      source: "blob",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to publish control-center content.";
    return jsonNoStore({ error: message }, { status: 500 });
  }
}
