import { NextResponse } from "next/server";
import { loadPublishedStoreContent } from "@/lib/control-center-content-store";
import { getPublicStoreContent } from "@/lib/store-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const content = await loadPublishedStoreContent();
  const publicContent = getPublicStoreContent(content);
  const response = NextResponse.json(
    publicContent.products.filter((product) => product.category === "beat")
  );

  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
