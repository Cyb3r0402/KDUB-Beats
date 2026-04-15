import { NextResponse } from "next/server";
import { defaultStoreProducts } from "@/lib/store-data";

export async function GET() {
  return NextResponse.json(defaultStoreProducts.filter((product) => product.category === "beat"));
}
