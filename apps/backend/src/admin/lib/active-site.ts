/**
 * La tienda activa del backoffice.
 *
 * Es un módulo singleton con `useSyncExternalStore`, NO un React Context, y eso no
 * es preferencia: **no hay dónde montar un provider**. El admin de Medusa no expone
 * ninguna zona de layout ni de navegación (las 164 zonas de widget son todas de
 * páginas de entidad), no hay un layout compartido propio, y el único `createContext`
 * del repo es local a Typesense. Un Context obligaría a que las 115 `page.tsx` lo
 * monten Y a que cada hook quede por debajo — imposible de garantizar.
 *
 * Al ser un `.ts` puro también es testeable con el runner del repo, que sólo corre
 * `src/**\/*.test.ts` (sin jsdom, sin React Testing Library).
 *
 * ─────────────────────────────────────────────────────────────────────────────────
 * CAMBIAR DE TIENDA RECARGA LA PÁGINA. No lo "optimices" a un `queryClient.clear()`.
 *
 * El site viaja por HEADER, no por query param (ver `lib/multistore/request.ts` en el
 * backend para el porqué), así que NO entra en las query keys de react-query. Y la
 * mitad de los hooks del admin usan keys constantes sin params: `['banners']`,
 * `['media-library']`, `['erp','sync-logs']`. Cambiar de tienda no invalida ninguna.
 *
 * El bug que evita el reload no es visual: un formulario precargado con datos de la
 * tienda A y guardado estando en la B **escribe en la tienda equivocada**.
 * `queryClient.clear()` no alcanza —no cancela lo que está en vuelo, y no limpia el
 * estado local de 115 pantallas: paginación, drawers, drafts a medio llenar—, así
 * que el fallback sin reload obliga a poner `key={siteId}` en todas ellas igual.
 * La recarga es más barata y más segura.
 * ─────────────────────────────────────────────────────────────────────────────────
 */

export const ACTIVE_SITE_STORAGE_KEY = 'ms:active-site';

/** Fijar la tienda por URL pinnea SOLO esa pestaña y hace el link compartible. */
export const ACTIVE_SITE_QUERY_PARAM = 'site';

/** Debe coincidir con `SITE_ID_HEADER` del backend. Lo vigila un test. */
export const SITE_ID_HEADER = 'x-site-id';

type SiteSnapshot = { id: string; slug: string; name: string };

let pinnedFromUrl: string | null | undefined;
const listeners = new Set<() => void>();

const safeStorage = (): Storage | null => {
  try {
    // Modo privado o iframe sin permisos: acceder ya puede tirar.
    return typeof globalThis !== 'undefined' ? (globalThis as { localStorage?: Storage }).localStorage ?? null : null;
  } catch {
    return null;
  }
};

/**
 * El `?site=` se lee UNA sola vez, al iniciar el módulo, y no en cada navegación:
 * el admin es una SPA y el param se pierde al navegar. Que la tienda quede pinneada
 * a la pestaña después de eso es intencional — hay que documentarlo en el tooltip.
 */
function readPinnedFromUrl(): string | null {
  if (pinnedFromUrl !== undefined) return pinnedFromUrl;
  try {
    const search = (globalThis as { location?: { search?: string } }).location?.search;
    const value = search ? new URLSearchParams(search).get(ACTIVE_SITE_QUERY_PARAM) : null;
    pinnedFromUrl = value && value.trim() ? value.trim() : null;
  } catch {
    pinnedFromUrl = null;
  }
  return pinnedFromUrl;
}

/** Id de la tienda activa, o `null` si no hay ninguna elegida. */
export function getActiveSiteId(): string | null {
  const pinned = readPinnedFromUrl();
  if (pinned) return pinned;
  try {
    return safeStorage()?.getItem(ACTIVE_SITE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Snapshot para pintar el nombre antes de que resuelva el listado (evita el flash "…"). */
export function getActiveSiteSnapshot(): SiteSnapshot | null {
  try {
    const raw = safeStorage()?.getItem(`${ACTIVE_SITE_STORAGE_KEY}:snapshot`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SiteSnapshot;
    return parsed?.id === getActiveSiteId() ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * El header que llevan todas las llamadas del admin.
 *
 * Devuelve `{}` —no `{'x-site-id': 'null'}`— cuando no hay tienda: mandar el string
 * "null" haría que el backend lo tratara como una tienda inexistente y respondiera
 * 400 en todas las rutas migradas.
 */
export function siteHeader(): Record<string, string> {
  const id = getActiveSiteId();
  return id ? { [SITE_ID_HEADER]: id } : {};
}

/**
 * Mete la tienda activa en una query key de react-query.
 *
 * El `x-site-id` viaja por HEADER y react-query no lo ve, así que una key constante
 * como `['blog-settings']` sirve el cache de la tienda A estando parado en la B. Con
 * la recarga de página eso no se notaba —el cache moría con el documento—, pero es
 * la condición 1 de `SetActiveSiteOptions`: sin esto, ninguna pantalla puede cambiar
 * de tienda en caliente.
 *
 * Va acá y no en `query-key-factory.ts` porque eso es el factory vendorizado de
 * Medusa y esto es del modelo de tiendas. Y es una función y no una convención
 * escrita en un doc porque la tercera copia a mano ya se habría escrito distinto:
 * `siteScopedKey` y el sufijo que produce los vigila `soft-site-change.test.ts`.
 *
 * `null` es un valor LEGÍTIMO y distinto de cualquier id: es la capa de instancia.
 * Se serializa explícito para que no colapse con `undefined` dentro de la key.
 */
export const siteScopedKey = <T extends readonly unknown[]>(key: T, siteId: string | null) =>
  [...key, { site: siteId ?? 'instance' }] as const;

export type SetActiveSiteOptions = {
  /**
   * `false` = cambio SIN recargar: se persiste, se avisa a los suscriptores y la
   * pantalla se re-renderiza sola.
   *
   * Es OPT-IN por pantalla y no el default, porque la recarga no está por
   * comodidad (ver la nota del encabezado). Una pantalla sólo puede pedir esto si
   * cumple las tres condiciones, y las tres son verificables:
   *
   *  1. **Sus queries llevan el `siteId` en la query key.** El site viaja por
   *     header, así que no entra solo: sin esto react-query devuelve el cache de
   *     la tienda anterior y la pantalla muestra datos de otra.
   *  2. **Sus llamadas mandan el header POR LLAMADA.** `lib/client.ts` resuelve
   *     `globalHeaders` UNA vez al iniciar el módulo; sin recarga ese header
   *     queda viejo para siempre. Una pantalla soft tiene que pasar
   *     `x-site-id` en cada request.
   *  3. **Su estado local se reinicia.** Un formulario precargado con la tienda A
   *     y guardado desde la B escribe en la equivocada. Se resuelve remontando
   *     con `key={siteId}`.
   *
   * Hoy lo usan DOS pantallas, y cada una lo pide por su lado:
   * `settings/extension-settings` con su propio `<SiteSelector>` (necesita la
   * opción "configuración de la instancia", que la barra no ofrece) y
   * `settings/site-credentials` pasándole `reloadOnChange={false}` a
   * `<SiteScopeBar>`. Esa prop es opt-in y su default es `true`: las otras ~10
   * pantallas que montan la barra siguen recargando, que es lo correcto mientras
   * sus hooks usen claves constantes como `['banners']`.
   */
  reload?: boolean;
};

/** Persiste la tienda y RECARGA. Ver la nota de arriba sobre por qué recarga. */
export function setActiveSite(
  site: SiteSnapshot | string | null,
  options: SetActiveSiteOptions = {},
): void {
  const id = typeof site === 'string' ? site : site?.id ?? null;
  // An explicit selection replaces a tab's OAuth/deep-link pin too. Otherwise
  // reloading ?site=A after selecting B silently keeps operating on A.
  if (readPinnedFromUrl()) {
    pinnedFromUrl = id;
    try {
      const current = globalThis as unknown as { location: Location; history: History };
      const url = new URL(current.location.href);
      if (id) url.searchParams.set(ACTIVE_SITE_QUERY_PARAM, id);
      else url.searchParams.delete(ACTIVE_SITE_QUERY_PARAM);
      current.history.replaceState(current.history.state, '', url);
    } catch {
      /* Non-browser test environments may not expose history. */
    }
  }
  try {
    const storage = safeStorage();
    if (storage && id) {
      storage.setItem(ACTIVE_SITE_STORAGE_KEY, id);
      if (typeof site === 'object' && site) {
        storage.setItem(`${ACTIVE_SITE_STORAGE_KEY}:snapshot`, JSON.stringify(site));
      }
    } else if (storage) {
      storage.removeItem(ACTIVE_SITE_STORAGE_KEY);
      storage.removeItem(`${ACTIVE_SITE_STORAGE_KEY}:snapshot`);
    }
  } catch {
    // Sin storage la elección no sobrevive al refresh, pero la recarga igual aplica
    // el default y el admin queda usable.
  }

  if (options.reload === false) {
    // Cambio en caliente: la pantalla que lo pidió se re-renderiza por
    // `useSyncExternalStore` y sus queries refetchean porque el `siteId` está en
    // la key. Nadie recarga.
    for (const listener of [...listeners]) listener();
    return;
  }

  try {
    (globalThis as { location?: { reload?: () => void } }).location?.reload?.();
  } catch {
    /* fuera del browser (tests): no hay nada que recargar */
  }
}

/** Suscripción para `useSyncExternalStore`. Otra pestaña que cambie de tienda avisa. */
export function subscribeActiveSite(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === ACTIVE_SITE_STORAGE_KEY) onChange();
  };
  const target = globalThis as { addEventListener?: Function; removeEventListener?: Function };
  target.addEventListener?.('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    target.removeEventListener?.('storage', onStorage);
  };
}

/** Sólo para tests: resetea el cache del `?site=`. */
export function __resetPinnedForTests(): void {
  pinnedFromUrl = undefined;
}
