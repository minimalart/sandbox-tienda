import {
  clearGuestWishlistCookie,
  dedupeWishlistItems,
  isWishlistAuthenticated,
  makeWishlistKey,
  readGuestWishlistCookie,
  writeGuestWishlistCookie,
} from "@lib/util/wishlist";
import { create } from "zustand";

type WishlistItem = {
  id: string;
  product_id: string;
  product_variant_id: string;
  quantity: number;
};

type WishlistState = {
  items: WishlistItem[];
  isLoaded: boolean;
  isFetching: boolean;
  pendingToggles: Set<string>;
  debounceTimers: Map<string, NodeJS.Timeout>;
};

type WishlistActions = {
  fetchWishlist: () => Promise<void>;
  toggleItem: (productId: string, variantId: string) => void;
  isInWishlist: (productId: string, variantId: string) => boolean;
  isToggling: (productId: string, variantId: string) => boolean;
  syncGuestWishlist: () => Promise<boolean>;
  reset: () => void;
};

type WishlistStore = WishlistState & WishlistActions;

type GuestWishlistItem = {
  product_id: string;
  product_variant_id: string;
  quantity: number;
};

const DEBOUNCE_MS = 500;
const SYNC_RETRY_DELAY_MS = 250;
const SYNC_RETRY_ATTEMPTS = 3;

let guestWishlistSyncPromise: Promise<boolean> | null = null;

function toGuestWishlistItem(item: WishlistItem): GuestWishlistItem {
  return {
    product_id: item.product_id,
    product_variant_id: item.product_variant_id,
    quantity: item.quantity,
  };
}

function fromGuestWishlistItem(item: GuestWishlistItem): WishlistItem {
  return {
    id: `guest_${makeWishlistKey(item.product_id, item.product_variant_id)}`,
    product_id: item.product_id,
    product_variant_id: item.product_variant_id,
    quantity: item.quantity ?? 1,
  };
}

function mergeWishlistItems(
  baseItems: WishlistItem[],
  fallbackItems: WishlistItem[],
): WishlistItem[] {
  const mergedItems = new Map<string, WishlistItem>();

  baseItems.forEach((item) => {
    mergedItems.set(
      makeWishlistKey(item.product_id, item.product_variant_id),
      item,
    );
  });

  fallbackItems.forEach((item) => {
    const itemKey = makeWishlistKey(item.product_id, item.product_variant_id);
    if (!mergedItems.has(itemKey)) {
      mergedItems.set(itemKey, item);
    }
  });

  return Array.from(mergedItems.values());
}

function hasAllGuestItemsPersisted(
  remoteItems: WishlistItem[],
  guestItems: GuestWishlistItem[],
): boolean {
  const remoteKeys = new Set(
    remoteItems.map((item) =>
      makeWishlistKey(item.product_id, item.product_variant_id),
    ),
  );

  return guestItems.every((item) =>
    remoteKeys.has(makeWishlistKey(item.product_id, item.product_variant_id)),
  );
}

const wishlistApi = {
  async get(): Promise<{
    success: boolean;
    wishlist?: { items: WishlistItem[] };
    message?: string;
  }> {
    const response = await fetch("/api/store/wishlist", {
      method: "GET",
      cache: "no-store",
    });
    return response.json();
  },

  async add(
    productId: string,
    productVariantId: string,
  ): Promise<{ success: boolean; item?: WishlistItem; message?: string }> {
    const response = await fetch("/api/store/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", productId, productVariantId }),
    });
    return response.json();
  },

  async remove(
    productId: string,
    productVariantId: string,
  ): Promise<{ success: boolean; message?: string }> {
    const response = await fetch("/api/store/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", productId, productVariantId }),
    });
    return response.json();
  },
};

async function waitForWishlistSync(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, SYNC_RETRY_DELAY_MS);
  });
}

async function confirmRemoteWishlistItems(
  guestItems: GuestWishlistItem[],
): Promise<{ success: boolean; items: WishlistItem[] }> {
  let latestItems: WishlistItem[] = [];

  for (let attempt = 0; attempt < SYNC_RETRY_ATTEMPTS; attempt += 1) {
    const result = await wishlistApi.get();

    if (result.success && result.wishlist) {
      latestItems = result.wishlist.items || [];

      if (hasAllGuestItemsPersisted(latestItems, guestItems)) {
        return { success: true, items: latestItems };
      }
    }

    if (attempt < SYNC_RETRY_ATTEMPTS - 1) {
      await waitForWishlistSync();
    }
  }

  return { success: false, items: latestItems };
}

export const useWishlistStore = create<WishlistStore>((set, get) => ({
  items: [],
  isLoaded: false,
  isFetching: false,
  pendingToggles: new Set<string>(),
  debounceTimers: new Map<string, NodeJS.Timeout>(),

  fetchWishlist: async () => {
    const { isLoaded, isFetching } = get();
    if (isLoaded || isFetching) {
      return;
    }

    const guestItems = readGuestWishlistCookie().map(fromGuestWishlistItem);

    if (!isWishlistAuthenticated()) {
      set({
        items: guestItems,
        isLoaded: true,
        isFetching: false,
      });
      return;
    }

    set({ isFetching: true });

    try {
      const result = await wishlistApi.get();
      const remoteItems =
        result.success && result.wishlist ? result.wishlist.items || [] : [];
      const mergedItems = mergeWishlistItems(remoteItems, guestItems);

      if (result.success && result.wishlist) {
        set({
          items: mergedItems,
          isLoaded: true,
          isFetching: false,
        });
      } else {
        set({ items: mergedItems, isLoaded: true, isFetching: false });
      }

      if (guestItems.length > 0) {
        void get().syncGuestWishlist();
      }
    } catch {
      set({ items: guestItems, isLoaded: true, isFetching: false });
    }
  },

  toggleItem: (productId: string, variantId: string) => {
    const itemKey = makeWishlistKey(productId, variantId);
    const { items, debounceTimers, pendingToggles } = get();
    const isCurrentlyInWishlist = items.some(
      (item) =>
        item.product_id === productId && item.product_variant_id === variantId,
    );

    if (!isWishlistAuthenticated()) {
      const nextItems = isCurrentlyInWishlist
        ? items.filter(
            (item) =>
              !(
                item.product_id === productId &&
                item.product_variant_id === variantId
              ),
          )
        : [
            ...items,
            {
              id: `guest_${itemKey}`,
              product_id: productId,
              product_variant_id: variantId,
              quantity: 1,
            },
          ];

      writeGuestWishlistCookie(nextItems.map(toGuestWishlistItem));
      set({
        items: nextItems,
        isLoaded: true,
      });
      return;
    }

    const existingTimer = debounceTimers.get(itemKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const nextPendingToggles = new Set(pendingToggles);
    nextPendingToggles.add(itemKey);

    if (isCurrentlyInWishlist) {
      set({
        items: items.filter(
          (item) =>
            !(
              item.product_id === productId &&
              item.product_variant_id === variantId
            ),
        ),
        pendingToggles: nextPendingToggles,
      });
    } else {
      set({
        items: [
          ...items,
          {
            id: `optimistic_${itemKey}`,
            product_id: productId,
            product_variant_id: variantId,
            quantity: 1,
          },
        ],
        pendingToggles: nextPendingToggles,
      });
    }

    const persistAsGuest = () => {
      const currentItems = get().items;
      writeGuestWishlistCookie(currentItems.map(toGuestWishlistItem));
    };

    const timer = setTimeout(async () => {
      try {
        if (isCurrentlyInWishlist) {
          const result = await wishlistApi.remove(productId, variantId);
          if (!result.success) {
            // API failed — keep the optimistic state and persist as guest so
            // the wishlist still works (handles dev/expired-token scenarios).
            persistAsGuest();
          }
        } else {
          const result = await wishlistApi.add(productId, variantId);
          if (!result.success) {
            // API failed — keep the optimistic state and persist as guest.
            persistAsGuest();
          } else if (result.item) {
            const currentItems = get().items;
            set({
              items: currentItems.map((item) =>
                item.product_id === productId &&
                item.product_variant_id === variantId
                  ? result.item!
                  : item,
              ),
            });
          }
        }
      } catch {
        // Network/unknown error — keep the optimistic state and persist as guest.
        persistAsGuest();
      } finally {
        const nextPending = new Set(get().pendingToggles);
        nextPending.delete(itemKey);

        const nextTimers = new Map(get().debounceTimers);
        nextTimers.delete(itemKey);

        set({
          pendingToggles: nextPending,
          debounceTimers: nextTimers,
        });
      }
    }, DEBOUNCE_MS);

    const nextTimers = new Map(debounceTimers);
    nextTimers.set(itemKey, timer);
    set({ debounceTimers: nextTimers });
  },

  isInWishlist: (productId: string, variantId: string) => {
    return get().items.some(
      (item) =>
        item.product_id === productId &&
        item.product_variant_id === variantId,
    );
  },

  isToggling: (productId: string, variantId: string) => {
    return get().pendingToggles.has(makeWishlistKey(productId, variantId));
  },

  syncGuestWishlist: async () => {
    if (guestWishlistSyncPromise) {
      return guestWishlistSyncPromise;
    }

    if (!isWishlistAuthenticated()) {
      return false;
    }

    guestWishlistSyncPromise = (async () => {
      const guestItems = dedupeWishlistItems(readGuestWishlistCookie());

      if (guestItems.length === 0) {
        get().reset();
        await get().fetchWishlist();
        return true;
      }

      set({ isFetching: true });

      try {
        const remoteResult = await wishlistApi.get();
        const remoteItems =
          remoteResult.success && remoteResult.wishlist
            ? remoteResult.wishlist.items || []
            : [];
        const remoteKeys = new Set(
          remoteItems.map((item) =>
            makeWishlistKey(item.product_id, item.product_variant_id),
          ),
        );
        const pendingGuestItems = guestItems.filter(
          (item) =>
            !remoteKeys.has(
              makeWishlistKey(item.product_id, item.product_variant_id),
            ),
        );

        for (const item of pendingGuestItems) {
          const result = await wishlistApi.add(
            item.product_id,
            item.product_variant_id,
          );

          if (!result.success) {
            set({
              items: mergeWishlistItems(
                remoteItems,
                guestItems.map(fromGuestWishlistItem),
              ),
              isLoaded: true,
              isFetching: false,
            });
            return false;
          }
        }

        const confirmation = pendingGuestItems.length
          ? await confirmRemoteWishlistItems(guestItems)
          : {
              success: hasAllGuestItemsPersisted(remoteItems, guestItems),
              items: remoteItems,
            };
        const mergedItems = mergeWishlistItems(
          confirmation.items,
          guestItems.map(fromGuestWishlistItem),
        );

        if (confirmation.success) {
          clearGuestWishlistCookie();
        }

        set({
          items: mergedItems,
          isLoaded: true,
          isFetching: false,
          pendingToggles: new Set<string>(),
          debounceTimers: new Map<string, NodeJS.Timeout>(),
        });

        return confirmation.success;
      } catch {
        set({
          items: mergeWishlistItems(
            get().items,
            guestItems.map(fromGuestWishlistItem),
          ),
          isLoaded: true,
          isFetching: false,
        });
        return false;
      }
    })();

    try {
      return await guestWishlistSyncPromise;
    } finally {
      guestWishlistSyncPromise = null;
    }
  },

  reset: () => {
    const { debounceTimers } = get();
    debounceTimers.forEach((timer) => clearTimeout(timer));
    set({
      items: [],
      isLoaded: false,
      isFetching: false,
      pendingToggles: new Set<string>(),
      debounceTimers: new Map<string, NodeJS.Timeout>(),
    });
  },
}));
