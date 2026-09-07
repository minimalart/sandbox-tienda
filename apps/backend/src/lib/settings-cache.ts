/**
 * Memo en proceso para los jsonb de `site_setting`, por `(namespace, tienda)`.
 *
 * Sin esto, cada lectura de configuración cuesta un round trip a Postgres en el
 * camino caliente. Con esto cuesta ~0 ms y el desfase máximo es el TTL.
 *
 * Es el mismo patrón que `modules/recommendations/serve/cache.ts:22-70`, movido
 * acá para que lo puedan compartir el módulo `app-settings` y los providers que
 * leen por knex crudo (Correo, Andreani, Kapso) sin depender del módulo.
 *
 * Es deliberadamente in-process y NO `Modules.CACHE`: ese módulo ni siquiera
 * está registrado cuando falta `REDIS_URL` (`medusa-config.ts:204-214`), así que
 * usarlo obligaría a dos caminos distintos para dev y para prod. Acá el camino
 * es uno solo.
 *
 * Tampoco se invalida por event bus: el bus de Redis es una COLA de trabajo
 * (`event-bus-redis.js:225` hace `queue.addBulk`), así que un evento lo consume
 * UNA réplica al azar — invalidaría una de N y parecería flakiness. Con varias
 * réplicas, el desfase máximo es el TTL; quien edita ve su cambio al instante
 * porque la ruta de admin llama `invalidateNamespace()` en su propio proceso.
 * Si algún día se mide que el TTL molesta, la salida es Postgres LISTEN/NOTIFY,
 * que sí es fan-out real y anda con o sin Redis.
 *
 * REGLA DURA: acá se cachean FILAS, nunca secretos descifrados. El descifrado
 * pasa en cada lectura.
 */

export const SETTINGS_CACHE_TTL_MS = Math.max(
  1000,
  Number(process.env.APP_SETTINGS_TTL_MS) || 30_000,
);

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

/** Reloj inyectable para poder testear la expiración sin esperar. */
let now = (): number => Date.now();

/** Sólo para tests. */
export const __setClock = (clock: () => number): void => {
  now = clock;
};

/**
 * Devuelve el valor cacheado o lo calcula.
 *
 * Guarda la PROMESA, no el valor resuelto: si llegan 20 requests simultáneos con
 * la cache fría, todos esperan la misma lectura en lugar de disparar 20
 * (stampede). Si la promesa rechaza se borra la entrada, para no cachear un
 * error — un Postgres que parpadea no debe dejar la config rota por 30 s.
 */
export async function memoNamespace<T>(namespace: string, loader: () => Promise<T>): Promise<T> {
  const cached = store.get(namespace);
  if (cached && cached.expiresAt > now()) {
    return cached.value as T;
  }

  const promise = loader().catch((error) => {
    store.delete(namespace);
    throw error;
  });
  store.set(namespace, { value: promise, expiresAt: now() + SETTINGS_CACHE_TTL_MS });
  return promise as Promise<T>;
}

/**
 * Separador entre el namespace y el scope de tienda en la clave de cache.
 *
 * La entrada de un namespace ya no es una sola: hay una por `(namespace, tienda)`
 * más la global. Se cachean por separado a propósito — con una sola entrada, la
 * primera request de la tienda A dejaba cacheado su jsonb y la tienda B leía el
 * de A durante todo el TTL.
 */
export const SCOPE_SEPARATOR = '::';

/**
 * La llaman las rutas de admin después de escribir, antes de responder.
 *
 * Borra el namespace Y TODOS SUS SCOPES. Un guardado puede tocar la fila de la
 * tienda y la global a la vez (los descriptores `scope: 'instance'` van siempre a
 * la global), y la global la leen todas las tiendas como fallback: invalidar sólo
 * el scope escrito dejaría a las demás con el valor viejo sin ninguna señal.
 */
export const invalidateNamespace = (namespace: string): void => {
  store.delete(namespace);
  const prefix = `${namespace}${SCOPE_SEPARATOR}`;
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
};

export const invalidateAllNamespaces = (): void => {
  store.clear();
};
