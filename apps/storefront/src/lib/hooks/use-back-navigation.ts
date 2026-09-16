"use client";

import { useSiteHref } from "@lib/site-config/context";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * "Volver" de la PDP en mobile.
 *
 * `router.back()` solo, no alcanza: si el cliente entró directo a un producto
 * (link compartido, buscador, QR) no hay historial dentro del sitio y el botón
 * no hacía nada. En ese caso lo llevamos al catálogo, respetando el prefijo de
 * la demo activa (`/demo/{slug}/store`).
 */
export const useBackNavigation = (fallbackHref = "/store") => {
  const router = useRouter();
  const siteHref = useSiteHref();

  return useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(siteHref(fallbackHref));
  }, [router, siteHref, fallbackHref]);
};
