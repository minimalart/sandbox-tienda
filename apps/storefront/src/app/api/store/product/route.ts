import {
  getChannelProductByHandle,
  getChannelProductById,
} from "@lib/data/channel-products";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const id = searchParams.get("id");
  const handle = searchParams.get("handle");
  const countryCode = searchParams.get("countryCode") || "ar";
  const salesChannelId = searchParams.get("salesChannelId") || undefined;

  if (!id && !handle) {
    return NextResponse.json(
      { success: false, message: "id or handle is required" },
      { status: 400 }
    );
  }

  try {
    const product = id
      ? await getChannelProductById(id, countryCode, true, salesChannelId)
      : await getChannelProductByHandle(
          handle as string,
          countryCode,
          true,
          salesChannelId
        );

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("[API] Failed to fetch product:", error);
    return NextResponse.json(
      { success: false, message: "Unable to fetch product" },
      { status: 500 }
    );
  }
}
