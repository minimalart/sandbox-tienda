import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getActiveDemoSlug, getTenantBySlug } from "./active-tenant";

/**
 * Página de contraseña (site gate) — resolución server-side.
 *
 * Cuando un sitio tiene el gate activo, `app/[countryCode]/layout.tsx` no
 * renderiza las páginas: muestra la pantalla de contraseña. Un "scope" identifica
 * al sitio: `store` para la tienda principal, `demo:{slug}` para cada demo.
 *
 * La palabra NUNCA llega al storefront. Del config público sólo se lee
 * `{ enabled, length }` (cuántas casillas dibujar); acertarla se verifica contra
 * el backend, que devuelve un token que se guarda en la cookie `_site_gate`
 * (httpOnly) y se revalida en cada request. Por eso el gate no se saltea
 * seteando la cookie a mano.
 */

export const SITE_GATE_COOKIE = "_site_gate";

/** 24 h: quien acierta la palabra no la vuelve a tipear en el día. */
export const SITE_GATE_MAX_AGE = 60 * 60 * 24;

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";

const backendHeaders = (): Record<string, string> => {
  const pk = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  return {
    Accept: "application/json",
    ...(pk ? { "x-publishable-api-key": pk } : {}),
  };
};

type GateConfig = { enabled: boolean; length: number };

const GATE_OFF: GateConfig = { enabled: false, length: 0 };

/**
 * Gate de la tienda principal. Fetch propio (y no getStoreSettings) para poder
 * cachearlo en el data cache de Next: así el chequeo no agrega una llamada por
 * request. Ante cualquier error devuelve el gate apagado — misma política de
 * defaults seguros que el resto de la config pública.
 */
const getStoreGateConfig = cache(async (): Promise<GateConfig> => {
  try {
    const res = await fetch(`${BACKEND_URL}/store/store-config`, {
      headers: backendHeaders(),
      // Tag SCOPEADO. Era el literal global `"site-gate"`, compartido por el gate
      // del sitio principal Y el de todas las tiendas: un `revalidateTag` sobre uno
      // invalidaba el de todos. (Hoy NADIE lo revalida — cero `revalidateTag`
      // en el repo — así que scopearlo es ergonomía para cuando alguien lo haga, no
      // un fix de un bug vivo. El patrón a imitar es `site-` en
      // `active-tenant.ts`.)
      next: { revalidate: 60, tags: ["site-gate:store"] },
    });
    if (!res.ok) return GATE_OFF;
    const data = (await res.json()) as { password_gate?: Partial<GateConfig> };
    return {
      enabled: Boolean(data?.password_gate?.enabled),
      length: Number(data?.password_gate?.length) || 0,
    };
  } catch {
    return GATE_OFF;
  }
});

/** ¿El token de la cookie sigue siendo válido para este sitio? */
const verifyGateToken = cache(
  async (scope: string, token: string): Promise<boolean> => {
    try {
      const url = new URL(`${BACKEND_URL}/store/store-config/site-gate`);
      url.searchParams.set("scope", scope);
      url.searchParams.set("token", token);
      const res = await fetch(url.toString(), {
        headers: backendHeaders(),
        next: { revalidate: 3600, tags: [`site-gate:${scope}`] },
      });
      if (!res.ok) return true; // Backend con problemas: no encerramos a nadie.
      const data = (await res.json()) as { ok?: boolean };
      return Boolean(data?.ok);
    } catch {
      return true;
    }
  },
);

export type SiteGateState = {
  /** true = hay que mostrar la pantalla de contraseña en vez del sitio. */
  locked: boolean;
  /** `store` | `demo:{slug}` */
  scope: string;
  /** Cuántas casillas dibuja el formulario. */
  length: number;
};

/**
 * Estado del gate para el request actual. `cookies()` se lee SÓLO cuando el gate
 * está activo, para no volver dinámica una request que no lo necesita.
 */
export const getSiteGateState = cache(async (): Promise<SiteGateState> => {
  const slug = await getActiveDemoSlug();
  const scope = slug ? `site:${slug}` : "store";

  const config = slug
    ? ((await getTenantBySlug(slug))?.medusa.passwordGate ?? GATE_OFF)
    : await getStoreGateConfig();

  if (!config.enabled || config.length <= 0) {
    return { locked: false, scope, length: 0 };
  }

  let token: string | undefined;
  try {
    token = (await cookies()).get(SITE_GATE_COOKIE)?.value;
  } catch {
    token = undefined;
  }

  if (!token) return { locked: true, scope, length: config.length };

  /**
   * DOBLE VERIFICACIÓN del scope, y el orden importa.
   *
   * El scope es ENTRADA DEL HMAC (`buildGateToken` hashea `${scope}:${password}`), así
   * que todo token que ya está en el browser de alguien fue calculado con el prefijo
   * viejo `demo:`. Verificar sólo con `site:` dejaría afuera a cada visitante que ya
   * había acertado la contraseña, hasta que la vuelva a tipear.
   *
   * Se prueba el nuevo primero para que borrar el legacy no cambie nada. Las cookies
   * `_site_gate` duran 24 h, así que este fallback se puede borrar UN DÍA después de
   * que el deploy esté en producción — no un release.
   */
  let valid = await verifyGateToken(scope, token);
  if (!valid && slug) {
    valid = await verifyGateToken(`demo:${slug}`, token);
  }
  return { locked: !valid, scope, length: config.length };
});
