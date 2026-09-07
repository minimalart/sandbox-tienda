import { sdk } from "@lib/config";
import { getActiveSalesChannelId } from "@lib/data/cookies";
import { getRegion } from "@lib/data/regions";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get("ids");
    const countryCode = searchParams.get("country_code") || "ar";

    if (!ids) {
      return NextResponse.json(
        { success: false, message: "ids parameter is required" },
        { status: 400 },
      );
    }

    const productIds = ids.split(",").filter(Boolean);

    if (productIds.length === 0) {
      return NextResponse.json({ success: true, products: [] });
    }

    const region = await getRegion(countryCode);
    // Usar el canal ACTIVO (cookie/sucursal), no el env estático: el publishable
    // key está vinculado a ese canal. Pasar NEXT_PUBLIC_SALES_CHANNEL_ID daba
    // 400 "Requested sales channel is not part of the publishable key" y el
    // drawer de favoritos quedaba vacío aunque hubiera items.
    const salesChannelId = await getActiveSalesChannelId();

    try {
      const { products } = await sdk.store.product.list({
        id: productIds,
        region_id: region?.id,
        sales_channel_id: salesChannelId,
        fields:
          "id,title,handle,thumbnail,description,subtitle,*variants.calculated_price,variants.id,variants.title",
      } as Parameters<typeof sdk.store.product.list>[0]);

      return NextResponse.json({ success: true, products });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Error al obtener productos";

      return NextResponse.json(
        { success: false, message },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, message: "Error del servidor" },
      { status: 500 },
    );
  }
}
