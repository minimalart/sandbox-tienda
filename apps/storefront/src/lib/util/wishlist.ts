export type StoredWishlistItem = {
  product_id: string;
  product_variant_id: string;
  quantity: number;
};

export const GUEST_WISHLIST_COOKIE = "_wishlist_guest";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function makeWishlistKey(
  productId: string,
  variantId: string,
): string {
  return `${productId}:${variantId}`;
}

export function isWishlistAuthenticated(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie.includes("_medusa_jwt=");
}

export function dedupeWishlistItems(
  items: StoredWishlistItem[],
): StoredWishlistItem[] {
  const uniqueItems = new Map<string, StoredWishlistItem>();

  items.forEach((item) => {
    if (!item.product_id || !item.product_variant_id) {
      return;
    }

    uniqueItems.set(
      makeWishlistKey(item.product_id, item.product_variant_id),
      {
        product_id: item.product_id,
        product_variant_id: item.product_variant_id,
        quantity: item.quantity ?? 1,
      },
    );
  });

  return Array.from(uniqueItems.values());
}

export function readGuestWishlistCookie(): StoredWishlistItem[] {
  if (typeof document === "undefined") {
    return [];
  }

  const cookieValue = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${GUEST_WISHLIST_COOKIE}=`))
    ?.split("=")[1];

  if (!cookieValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(decodeURIComponent(cookieValue));
    return Array.isArray(parsedValue)
      ? dedupeWishlistItems(parsedValue as StoredWishlistItem[])
      : [];
  } catch {
    return [];
  }
}

export function writeGuestWishlistCookie(items: StoredWishlistItem[]): void {
  if (typeof document === "undefined") {
    return;
  }

  const normalizedItems = dedupeWishlistItems(items);

  if (normalizedItems.length === 0) {
    clearGuestWishlistCookie();
    return;
  }

  document.cookie = `${GUEST_WISHLIST_COOKIE}=${encodeURIComponent(
    JSON.stringify(normalizedItems),
  )}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
}

export function clearGuestWishlistCookie(): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${GUEST_WISHLIST_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
