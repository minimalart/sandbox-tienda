"use client";

import type { HttpTypes } from "@medusajs/types";
import { StarIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import React from "react";
import { useLoyaltyContext } from "../../context/loyalty-context";

// Reuses the same cart promo-code apply path as DiscountCode. `promo_codes`
// replaces the whole manual list, so we always send existing + the new code.
async function applyCartPromoCodes(codes: string[]): Promise<{ success: boolean; message?: string; cart?: any }> {
  const res = await fetch("/api/store/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "applyPromotion", codes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    return { success: false, message: data?.message || `Error aplicando la recompensa (status ${res.status})`, cart: data?.cart };
  }
  return { success: true, cart: data?.cart };
}

type Grant = {
  id: string;
  status: string;
  benefit_type?: string | null;
  benefit_ref?: string | null;
  reward?: { name?: string } | null;
};

type Props = {
  cart: HttpTypes.StoreCart;
  onCartUpdate?: (cart?: HttpTypes.StoreCart | null) => Promise<HttpTypes.StoreCart | null>;
};

// "Tus recompensas": lists the customer's AVAILABLE coupon grants and applies
// the selected one to the cart in one click. It doesn't compute discounts — the
// coupon (created at redeem time) carries the value; store-credit grants are
// applied via the "Usar saldo" toggle instead, so they're only hinted here.
const LoyaltyRewardsCheckout: React.FC<Props> = ({ cart, onCartUpdate }) => {
  const [grants, setGrants] = React.useState<Grant[]>([]);
  const [applying, setApplying] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");
  const { useCartStore } = useLoyaltyContext();
  type CartStoreState = { setCart: (c: unknown) => void };
  type SetCart = CartStoreState["setCart"];
  const setStoreCart = useCartStore
    ? ((useCartStore as unknown as (selector: (state: CartStoreState) => SetCart) => SetCart)(
        (s) => s.setCart,
      ) as SetCart)
    : undefined;
  const router = useRouter();

  React.useEffect(() => {
    fetch("/api/store/loyalty/grants")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setGrants(d.grants ?? []);
      })
      .catch(() => {});
  }, []);

  const promotions = ((cart as any).promotions ?? []) as HttpTypes.StorePromotion[];
  const appliedCodes = new Set(promotions.filter((p) => p?.code).map((p) => p.code));
  const couponGrants = grants.filter(
    (g) =>
      g.status === "available" &&
      g.benefit_type === "promotion" &&
      g.benefit_ref &&
      !appliedCodes.has(g.benefit_ref),
  );

  const hasStoreCredit = grants.some((g) => g.status === "available" && g.benefit_type === "store_credit");

  if (couponGrants.length === 0 && !hasStoreCredit) return null;

  const apply = async (code: string) => {
    setApplying(code);
    setError("");
    const existing = promotions.filter((p) => p?.code && !p.is_automatic).map((p) => p.code!);
    const res = await applyCartPromoCodes([...existing, code]);
    if (!res.success) {
      setError(res.message || "No se pudo aplicar la recompensa");
    } else {
      if (res.cart && setStoreCart) setStoreCart(res.cart);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cart-updated"));
      if (onCartUpdate) await onCartUpdate(res.cart ?? null);
      else router.refresh();
    }
    setApplying(null);
  };

  return (
    <div className="mt-4 border-t border-gray-200 pt-4" data-testid="loyalty-rewards-checkout">
      <div className="mb-3 flex items-center gap-1.5">
        <StarIcon className="h-4 w-4 text-amber-500" />
        <h4 className="font-semibold text-gray-900 text-sm">Tus recompensas</h4>
      </div>

      {couponGrants.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {couponGrants.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-semibold text-gray-900 text-sm">
                  {g.reward?.name ?? "Recompensa"}
                </span>
                <span className="text-xs text-gray-500">Cupón {g.benefit_ref}</span>
              </div>
              <button
                type="button"
                onClick={() => apply(g.benefit_ref as string)}
                disabled={applying === g.benefit_ref}
                className="shrink-0 rounded-lg bg-[var(--primary-color)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {applying === g.benefit_ref ? "Aplicando…" : "Aplicar"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-500">
          Tenés saldo de recompensa disponible: aplicalo con “Usar saldo” arriba.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
};

export default LoyaltyRewardsCheckout;
