import type { TenantConfig } from "./types";

/**
 * Merge de la config de la tienda PRINCIPAL sobre `defaultConfig`.
 *
 * Módulo PURO a propósito: sin `server-only`, sin `next/headers`, sin `fetch`. El
 * adaptador que hace la request vive en `active-tenant.ts`. La separación es lo que
 * hace testeable la parte riesgosa — y la parte riesgosa acá no es el fetch, son las
 * dos trampas de abajo.
 */

/**
 * Merge que IGNORA las claves con valor `undefined`.
 *
 * TRAMPA 1: `{ ...base, ...override }` con un `undefined` explícito lo ESCRIBE, o
 * sea pisa el default con nada. Y el backend emite las claves opcionales como
 * presentes-con-undefined: `buildTenantConfig` hace
 * `secondary: theme.secondary_color || undefined`. Con un spread normal, publicar la
 * fila principal le borraría al sitio los colores que la fila no define.
 */
export const mergeDefined = <T extends Record<string, unknown>>(
  base: T,
  override?: Partial<T> | null,
): T => {
  if (!override) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
};

/**
 * Aplica el payload de la fila principal encima de `defaultConfig`.
 *
 * TRAMPA 2 — `id` se fuerza al de `defaultConfig` ('storefront'), NUNCA al de la
 * fila. `tenant.id` no es decorativo: es una CLAVE DE IDENTIDAD con datos escritos
 * contra ella. Los customers guardan `metadata.tenant_ids: [tenant.id]`
 * (`app/api/store/auth/route.ts:358`) y el login RECHAZA cuando el tenant actual no
 * está en ese array (`:343` → `TENANT_MISMATCH_ERROR`). Si acá saliera `demo_main`,
 * TODO cliente existente del sitio principal quedaría afuera de su cuenta.
 *
 * Hoy esas rutas usan `getTenant()` (el resolver, que no es tenant-aware), así que
 * no ven esta función. Pero migrarlas a `getActiveTenant()` parece el "fix" obvio, y
 * sería el incidente. Este forzado es lo que lo vuelve inocuo.
 */
export const mergeMainTenant = (
  base: TenantConfig,
  payload: TenantConfig,
): TenantConfig => ({
  ...base,
  ...payload,
  id: base.id,
  // `medusa` NO viene completo del backend: `TenantConfigPayload.medusa` no tiene
  // `publishableKey` ni `customerGroupId`, que son valores globales de build.
  medusa: mergeDefined(base.medusa, payload.medusa),
  theme: {
    ...base.theme,
    ...payload.theme,
    colors: mergeDefined(base.theme.colors, payload.theme?.colors),
  },
  // `assets` es shallow POR CLAVE, igual que el merge de las demás tiendas: una
  // clave presente en el payload gana entera. Por eso el backend deja AUSENTES las
  // claves que la fila principal no define (ver `buildMainStoreBrandAssets`).
  assets: {
    ...base.assets,
    ...(payload.assets ?? {}),
    // EXCEPCIÓN: `footer` se mergea POR SUBCLAVE.
    //
    // El backoffice edita UNA sola subclave (`footer.description`), así que el
    // payload de la principal llega como `{ description }` a secas. Con el shallow
    // por clave eso le BORRARÍA al sitio el resto del footer de `defaultConfig`, y
    // el componente caería en sus propios fallbacks — que incluyen un teléfono
    // INVENTADO ('+54 11 1234-5678') y 'Buenos Aires, Argentina'. O sea: editar la
    // descripción publicaría un teléfono falso en el footer de producción.
    //
    // La excepción es segura acá y SÓLO acá: en este camino `base` es
    // `defaultConfig`, que es la config de la propia tienda principal. En el merge
    // de las demás tiendas (`getTenantBySlug`) el base también es `defaultConfig`,
    // pero ahí es el de OTRO sitio: mergear por subclave les filtraría
    // `hola@mercatto.com` y los legales de Mercatto al footer de un cliente. Por eso
    // ese camino queda shallow.
    ...(payload.assets?.footer
      ? { footer: { ...base.assets.footer, ...payload.assets.footer } }
      : {}),
  },
  // `TenantMetadata.name` es requerido, así que no se puede arrancar de `{}`: si el
  // base no trae metadata, gana la del payload tal cual.
  metadata: base.metadata ? mergeDefined(base.metadata, payload.metadata) : payload.metadata,
});
