import { listShippingOptions } from "@lib/repositories/checkout.repository";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cartId = url.searchParams.get("cart_id");

    console.log("[Shipping Options] Fetching for cart_id:", cartId);

    const result = await listShippingOptions(cartId || undefined);
    
    console.log("[Shipping Options] Result:", {
      success: result.success,
      count: result.shipping_options?.length || 0,
      error: result.error,
    });

    if (!result.success) {
      return NextResponse.json(
        { message: result.error, shipping_options: [] },
        { status: 400 }
      );
    }

    return NextResponse.json({
      shipping_options: result.shipping_options,
      shipping_coverage: result.shipping_coverage,
    });
  } catch (error) {
    console.error("[API] Failed to fetch shipping options:", error);
    return NextResponse.json(
      { message: "Unable to fetch shipping options", shipping_options: [] },
      { status: 500 }
    );
  }
}

