import { create } from "zustand";

// ── Carrito propio del catálogo PDF ──────────────────────────────────────────
// El visor del catálogo NO usa el carrito de Medusa: arma su propio pedido en
// memoria y lo envía por WhatsApp (portado de poc-ipaper). Es efímero (se
// pierde al recargar), acorde a la experiencia de una sola pantalla del visor.

export type CatalogCartItem = {
  /** Clave estable del ítem: variant_id si existe, si no product_id. */
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  price: number | null;
  currency: string | null;
  image: string | null;
  quantity: number;
};

type CatalogCartState = {
  items: CatalogCartItem[];
  addItem: (item: Omit<CatalogCartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (key: string, quantity: number) => void;
  /** Delta relativo (lee la cantidad viva del store): inmune al clickeo rápido
   *  donde la `quantity` del render queda vieja entre dos clicks. */
  changeQuantity: (key: string, delta: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  getTotal: () => number;
  getItemCount: () => number;
};

export const useCatalogCartStore = create<CatalogCartState>()((set, get) => ({
  items: [],

  addItem: (item, quantity = 1) => {
    set((state) => {
      const existing = state.items.find((i) => i.key === item.key);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.key === item.key ? { ...i, quantity: i.quantity + quantity } : i
          ),
        };
      }
      return { items: [...state.items, { ...item, quantity }] };
    });
  },

  updateQuantity: (key, quantity) => {
    set((state) => {
      if (quantity <= 0) {
        return { items: state.items.filter((i) => i.key !== key) };
      }
      return {
        items: state.items.map((i) =>
          i.key === key ? { ...i, quantity } : i
        ),
      };
    });
  },

  changeQuantity: (key, delta) => {
    set((state) => {
      const target = state.items.find((i) => i.key === key);
      if (!target) return state;
      const nextQty = target.quantity + delta;
      if (nextQty <= 0) {
        return { items: state.items.filter((i) => i.key !== key) };
      }
      return {
        items: state.items.map((i) =>
          i.key === key ? { ...i, quantity: nextQty } : i
        ),
      };
    });
  },

  removeItem: (key) => {
    set((state) => ({ items: state.items.filter((i) => i.key !== key) }));
  },

  clear: () => set({ items: [] }),

  getTotal: () =>
    get().items.reduce((acc, i) => acc + (i.price ?? 0) * i.quantity, 0),

  getItemCount: () => get().items.reduce((acc, i) => acc + i.quantity, 0),
}));
