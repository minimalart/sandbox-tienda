import { getRecommendationsSettings } from '../settings';

/**
 * Memo en proceso para lo que el serve necesita en CADA request y cambia muy poco:
 * la configuración global, los placements, las estrategias y el mapa de versiones
 * activas.
 *
 * Sin esto, cada request de recomendaciones cuesta 3-4 lecturas de tablas de
 * configuración antes de empezar a trabajar. Con esto, la resolución del placement,
 * la cadena de fallbacks y la versión activa cuestan ~0 ms.
 *
 * Es deliberadamente in-process y NO `Modules.CACHE`: son pocos KB, se usan en el
 * camino caliente y no vale un round trip a Redis. El TTL corto (60 s) hace que un
 * cambio hecho en el backoffice se vea sin reiniciar; las mutaciones que necesitan
 * efecto inmediato llaman a `invalidate*` explícitamente (el swap de versiones lo
 * hace: si el mapa de versiones activas quedara viejo un minuto, el serve seguiría
 * leyendo relaciones de una versión ya reemplazada).
 *
 * Con varias réplicas cada una tiene su copia: el desfase máximo es el TTL, que es
 * aceptable para configuración pero NO para elegibilidad — por eso acá nunca se
 * cachea nada que dependa de stock, precio o carrito.
 */

/**
 * El TTL, resuelto EN CADA `memo()` y no una vez al importar el módulo.
 *
 * Antes era un `const` calculado desde `process.env` en scope de módulo: se
 * congelaba con el primer import y no había forma de tocarlo sin reiniciar. Ahora
 * sale de `app-settings`, así que cambiarlo desde el admin tiene que pegar sin
 * deploy — y para eso hay que leerlo cuando se usa. El costo es una lectura de un
 * `Map` en memoria por entrada guardada, no una query.
 *
 * OJO con la ventana de transición: las entradas que YA están cacheadas conservan
 * el `expiresAt` que se les calculó con el valor viejo. Bajar el TTL no acorta
 * retroactivamente lo que ya está adentro; el nuevo valor rige desde la próxima
 * escritura de cada clave.
 */
export const configCacheTtlMs = (): number => getRecommendationsSettings().configCacheTtlMs;

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
 * Guarda la PROMESA, no el valor resuelto: si llegan 20 requests simultáneos con la
 * cache fría, todos esperan la misma lectura en lugar de disparar 20 (stampede).
 * Si la promesa rechaza se borra la entrada, para no cachear un error.
 */
export async function memo<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const cached = store.get(key);
  if (cached && cached.expiresAt > now()) {
    return cached.value as T;
  }

  const promise = loader().catch((error) => {
    store.delete(key);
    throw error;
  });
  store.set(key, { value: promise, expiresAt: now() + configCacheTtlMs() });
  return promise as Promise<T>;
}

export const CACHE_KEYS = {
  config: 'config',
  placements: 'placements',
  strategies: 'strategies',
  activeVersions: 'active-versions',
} as const;

/**
 * Invalida el mapa de versiones activas. La llama el swap: es la única entrada
 * cuyo desfase produce datos incorrectos (relaciones de una versión reemplazada) y
 * no sólo configuración vieja.
 */
export const invalidateActiveVersions = (): void => {
  store.delete(CACHE_KEYS.activeVersions);
};

/** Invalida configuración, placements y estrategias. La llaman las rutas de admin. */
export const invalidateConfig = (): void => {
  store.delete(CACHE_KEYS.config);
  store.delete(CACHE_KEYS.placements);
  store.delete(CACHE_KEYS.strategies);
};

export const invalidateAll = (): void => {
  store.clear();
};
