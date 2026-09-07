"use client";

import { useEffect, useRef } from "react";
import {
  type UtmParams,
  getUtmParams,
  hasUtmData,
  parseUtmFromSearch,
  UTM_COOKIE_NAME,
  UTM_COOKIE_MAX_AGE,
  serializeUtm,
} from "@lib/util/utm";

/**
 * Hook that provides UTM parameters captured on landing.
 * Also handles client-side fallback: if proxy didn't set the cookie
 * (e.g., client-side navigation with UTM params), it captures them here.
 */
export function useUtm(): { getUtm: () => UtmParams } {
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    captured.current = true;

    const existing = getUtmParams();
    if (hasUtmData(existing)) return;

    const parsed = parseUtmFromSearch(window.location.search);
    if (!parsed) return;

    parsed.landing_page = window.location.pathname;
    parsed.referrer = document.referrer || undefined;

    document.cookie = `${UTM_COOKIE_NAME}=${serializeUtm(parsed)}; path=/; max-age=${UTM_COOKIE_MAX_AGE}; samesite=lax`;
  }, []);

  const getUtm = (): UtmParams => {
    return getUtmParams();
  };

  return { getUtm };
}
