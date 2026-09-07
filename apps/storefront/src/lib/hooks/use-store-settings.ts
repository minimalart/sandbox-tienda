"use client";

import { useEffect, useState } from "react";

/**
 * Client-side reader for the store toggles (multi-branch, etc.). Mirrors
 * use-minimum-purchase: goes through the Next proxy (`/api/store/store-config`,
 * same origin), module-cached so all consumers share one request per page.
 */
export type StoreSettings = {
  multi_branch_enabled: boolean;
  require_branch_coverage: boolean;
  barcode_scanner_enabled: boolean;
};

const DEFAULTS: StoreSettings = {
  multi_branch_enabled: false,
  require_branch_coverage: false,
  barcode_scanner_enabled: false,
};

let cached: StoreSettings | undefined;
let inflight: Promise<StoreSettings> | null = null;

async function fetchStoreSettings(): Promise<StoreSettings> {
  try {
    const res = await fetch("/api/store/store-config");
    if (!res.ok) return DEFAULTS;
    const data = (await res.json()) as Partial<StoreSettings>;
    return {
      multi_branch_enabled: !!data?.multi_branch_enabled,
      require_branch_coverage: !!data?.require_branch_coverage,
      barcode_scanner_enabled: !!data?.barcode_scanner_enabled,
    };
  } catch {
    return DEFAULTS;
  }
}

export function useStoreSettings(): StoreSettings {
  const [settings, setSettings] = useState<StoreSettings>(cached ?? DEFAULTS);

  useEffect(() => {
    if (cached !== undefined) {
      setSettings(cached);
      return;
    }
    if (!inflight) {
      inflight = fetchStoreSettings().then((value) => {
        cached = value;
        return value;
      });
    }
    let active = true;
    inflight.then((value) => {
      if (active) setSettings(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return settings;
}
