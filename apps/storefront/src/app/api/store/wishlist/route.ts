import { sdk } from "@lib/config";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

async function getAuthToken() {
  const cookieStore = await cookies();
  return cookieStore.get("_medusa_jwt")?.value;
}

async function fetchNormalizedWishlist(headers: { authorization: string }) {
  const rawResult = await sdk.client.fetch<Record<string, unknown>>(
    "/store/customers/me/wishlist",
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );

  const rawWishlist = (rawResult as Record<string, unknown>).wishlist as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;
  const wishlistObj = Array.isArray(rawWishlist) ? rawWishlist[0] : rawWishlist;

  if (!wishlistObj) {
    return [];
  }

  const rawItems = Array.isArray(wishlistObj.items) ? wishlistObj.items : [];

  return rawItems.map((item: Record<string, unknown>) => ({
    id: (item.id as string) ?? "",
    wishlist_id: (item.wishlist_id ?? item.wishlistId ?? "") as string,
    product_id: (item.product_id ?? item.productId ?? "") as string,
    product_variant_id: (item.product_variant_id ?? item.productVariantId ?? "") as string,
    quantity: (item.quantity as number) ?? 1,
    created_at: (item.created_at ?? item.createdAt ?? "") as string,
    updated_at: (item.updated_at ?? item.updatedAt ?? "") as string,
  })) satisfies WishlistItemResponse[];
}

export async function GET() {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    const headers = { authorization: `Bearer ${token}` };

      try {
        const rawResult = await sdk.client.fetch<Record<string, unknown>>(
          "/store/customers/me/wishlist",
        {
          method: "GET",
          headers,
          cache: "no-store",
        }
      );

      const rawWishlist = (rawResult as Record<string, unknown>).wishlist as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | null;

      const wishlistObj = Array.isArray(rawWishlist) ? rawWishlist[0] : rawWishlist;

      if (!wishlistObj) {
        return NextResponse.json({ success: true, wishlist: { id: null, items: [] } });
      }

      const rawItems = Array.isArray(wishlistObj.items) ? wishlistObj.items : [];
      const normalizedItems: WishlistItemResponse[] = rawItems.map(
        (item: Record<string, unknown>) => ({
          id: (item.id as string) ?? "",
          wishlist_id: (item.wishlist_id ?? item.wishlistId ?? "") as string,
          product_id: (item.product_id ?? item.productId ?? "") as string,
          product_variant_id: (item.product_variant_id ?? item.productVariantId ?? "") as string,
          quantity: (item.quantity as number) ?? 1,
          created_at: (item.created_at ?? item.createdAt ?? "") as string,
          updated_at: (item.updated_at ?? item.updatedAt ?? "") as string,
        })
      );

      return NextResponse.json({
        success: true,
        wishlist: {
          id: wishlistObj.id,
          items: normalizedItems,
          created_at: wishlistObj.created_at ?? wishlistObj.createdAt,
          updated_at: wishlistObj.updated_at ?? wishlistObj.updatedAt,
        },
      });
    } catch (error: unknown) {
      // Sesión vencida/ inválida (`_medusa_jwt` viejo): el backend devuelve 401.
      // No es un error real en el page-load → devolvemos wishlist vacía y evitamos
      // el 400 ruidoso en consola. El usuario re-loguea y vuelve a tener su lista.
      const status = (error as { status?: number })?.status;
      const message =
        error instanceof Error ? error.message : "Error al obtener wishlist";
      if (status === 401 || /unauthorized|401/i.test(message)) {
        return NextResponse.json({ success: true, wishlist: { id: null, items: [] } });
      }
      return NextResponse.json(
        { success: false, message },
        { status: 400 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json(
        { success: false, message: "No autenticado" },
        { status: 401 }
      );
    }

    const headers = { authorization: `Bearer ${token}` };

    if (action === "add") {
      const { productId, productVariantId } = body;

      if (!productId || !productVariantId) {
        return NextResponse.json(
          { success: false, message: "productId y productVariantId son requeridos" },
          { status: 400 }
        );
      }

      try {
        const result = await sdk.client.fetch<Record<string, unknown>>(
          "/store/customers/me/wishlist/items",
          {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: { productId, productVariantId, quantity: 1 },
          }
        );

        const rawItems = Array.isArray(result.items) ? result.items : [];
        const matchingItem = rawItems.find(
          (item: Record<string, unknown>) =>
            (item.productId === productId || item.product_id === productId) &&
            (item.productVariantId === productVariantId || item.product_variant_id === productVariantId)
        ) as Record<string, unknown> | undefined;

        if (matchingItem) {
          const normalizedItem: WishlistItemResponse = {
            id: (matchingItem.id as string) ?? "",
            wishlist_id: (matchingItem.wishlist_id ?? matchingItem.wishlistId ?? "") as string,
            product_id: (matchingItem.product_id ?? matchingItem.productId ?? "") as string,
            product_variant_id: (matchingItem.product_variant_id ?? matchingItem.productVariantId ?? "") as string,
            quantity: (matchingItem.quantity as number) ?? 1,
            created_at: (matchingItem.created_at ?? matchingItem.createdAt ?? "") as string,
            updated_at: (matchingItem.updated_at ?? matchingItem.updatedAt ?? "") as string,
          };
          return NextResponse.json({ success: true, item: normalizedItem });
        }

        const wishlistItems = await fetchNormalizedWishlist(headers);
        const confirmedItem = wishlistItems.find(
          (item) =>
            item.product_id === productId &&
            item.product_variant_id === productVariantId
        );

        if (confirmedItem) {
          return NextResponse.json({ success: true, item: confirmedItem });
        }

        return NextResponse.json(
          {
            success: false,
            message: "No se pudo confirmar el producto en favoritos",
          },
          { status: 409 }
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Error al agregar a wishlist";
        return NextResponse.json(
          { success: false, message },
          { status: 400 }
        );
      }
    }

    if (action === "remove") {
      const { productId, productVariantId } = body;

      if (!productId || !productVariantId) {
        return NextResponse.json(
          { success: false, message: "productId y productVariantId son requeridos" },
          { status: 400 }
        );
      }

      try {
        await sdk.client.fetch(
          `/store/customers/me/wishlist/items?productId=${productId}&productVariantId=${productVariantId}`,
          {
            method: "DELETE",
            headers,
          }
        );
        return NextResponse.json({ success: true });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Error al eliminar de wishlist";
        return NextResponse.json(
          { success: false, message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, message: "Acción inválida" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Error del servidor" },
      { status: 500 }
    );
  }
}

type WishlistItemResponse = {
  id: string;
  wishlist_id: string;
  product_id: string;
  product_variant_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
};

type WishlistResponse = {
  id: string;
  items: WishlistItemResponse[];
  created_at: string;
  updated_at: string;
};
