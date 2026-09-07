import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

const DEFAULTS = {
  multi_branch_enabled: false,
  require_branch_coverage: false,
  // `true`: el default de la barra del selector de zona es "se muestra". Ver
  // `lib/data/store-settings.ts`.
  branch_gate_prompt_enabled: true,
  barcode_scanner_enabled: false,
};

// Toggles change rarely; cache 60s server-side (CDN absorbs browser hits).
//
// Este TTL compartido es CORRECTO y no filtra entre tiendas: el handler resuelve de
// STORE_CONFIG_MODULE y no acepta slug ni sales_channel_id. `multi_branch_enabled`,
// `cookie_banner_enabled`, `email_branding`, `ai_config`… son de la INSTANCIA, no de
// un sitio, así que no hay dimensión de tenant que pueda mezclarse. Contrastar con
// `api/store/active-promotions`, que sí dependía del canal y por eso perdió su
// `revalidate`. Lo hace cumplir `lib/site-config/cache-directives.test.ts`, donde
// esta ruta está en la allowlist con este mismo motivo escrito.
export const revalidate = 60;

/**
 * GET /api/store/store-config — server-side proxy to the backend public
 * settings (GET /store/store-config). Returns the storefront toggles
 * { multi_branch_enabled, require_branch_coverage, barcode_scanner_enabled }.
 * Safe defaults on error.
 */
export async function GET(): Promise<Response> {
  try {
    const res = await fetch(`${BACKEND_URL}/store/store-config`, {
      headers: PUBLISHABLE_KEY ? { "x-publishable-api-key": PUBLISHABLE_KEY } : {},
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json(DEFAULTS);
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.warn("[STORE-CONFIG] Error fetching store settings:", error);
    return NextResponse.json(DEFAULTS);
  }
}
