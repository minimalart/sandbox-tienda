"use client";

import { useEffect, useState } from "react";

/**
 * Reads the CURRENTLY effective minimum purchase amount from the backend
 * (admin-managed via Store config → "Configuración adicional"). Returns the
 * amount in the store currency's normal unit, or `null` when none is active.
 *
 * The cart drawer and checkout feed this into `getCartCheckoutEligibility` so
 * the threshold reflects the admin setting instead of the build-time env var.
 *
 * Cached at module scope so the many cart/checkout renders share a single
 * request for the lifetime of the page.
 *
 * Goes through the Next proxy (`/api/store/minimum-purchase`) — same origin —
 * instead of hitting the backend directly from the browser. The direct fetch
 * was subject to CORS / backend-URL reachability and silently returned null, so
 * the cart fell back to "no minimum" and let any amount through.
 */
// `undefined` = not fetched yet, `null` = fetched, no active minimum.
let cachedAmount: number | null | undefined;
let inflight: Promise<number | null> | null = null;

async function fetchMinimumPurchase(): Promise<number | null> {
  try {
    const res = await fetch("/api/store/minimum-purchase");
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      minimum_purchase?: { amount?: number } | null;
    };
    const amount = data?.minimum_purchase?.amount;
    return typeof amount === "number" && amount > 0 ? amount : null;
  } catch {
    return null;
  }
}

export function useMinimumPurchaseAmount(): number | null {
  const [amount, setAmount] = useState<number | null>(cachedAmount ?? null);

  useEffect(() => {
    if (cachedAmount !== undefined) {
      setAmount(cachedAmount);
      return;
    }
    if (!inflight) {
      inflight = fetchMinimumPurchase().then((value) => {
        cachedAmount = value;
        return value;
      });
    }
    let active = true;
    inflight.then((value) => {
      if (active) {
        setAmount(value);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return amount;
}
