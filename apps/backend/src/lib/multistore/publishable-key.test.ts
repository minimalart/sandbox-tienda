import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  channelsFromPublishableKey,
  siteFromPublishableKey,
  siteIdFromPublishableKey,
} from './publishable-key';

/**
 * El eje del storefront, probado sin base de datos.
 *
 * Lo que estos tests custodian NO es que la función devuelva una tienda: es de DÓNDE
 * la saca. El repo ya tuvo seis copias a mano del bloque `publishable_key_context`, y
 * cada copia es una oportunidad de que alguien lo reemplace por `req.query
 * .sales_channel_id` —que se llama parecido, está a mano y lo escribe el cliente—.
 */

const NORTE = {
  id: 'demo_norte',
  slug: 'norte',
  name: 'Norte',
  is_main: false,
  sales_channel_id: 'sc_norte',
  b2b_sales_channel_id: 'sc_norte_b2b',
  region_id: null,
  stock_location_id: null,
};

const SUR = { ...NORTE, id: 'demo_sur', slug: 'sur', name: 'Sur', sales_channel_id: 'sc_sur', b2b_sales_channel_id: null };

/**
 * Un registro de tiendas de mentira. `listDemoStores` implementa sólo los filtros que
 * `resolveSite` usa: por id, por slug y el `$or` de los dos canales.
 */
function fakeReq(
  channelIds: string[] | undefined,
  rows = [NORTE, SUR],
): { req: any; queries: number } {
  const state = { queries: 0 };
  const service = {
    listDemoStores: async (filters: any = {}, config: any = {}) => {
      state.queries += 1;
      let found = rows;
      if (filters.id) found = found.filter((r) => r.id === filters.id);
      if (filters.slug) found = found.filter((r) => r.slug === filters.slug);
      if (filters.is_main) found = found.filter((r) => r.is_main);
      if (filters.$or) {
        const wanted = filters.$or
          .map((clause: any) => clause.sales_channel_id ?? clause.b2b_sales_channel_id)
          .filter(Boolean);
        found = found.filter(
          (r) => wanted.includes(r.sales_channel_id) || wanted.includes(r.b2b_sales_channel_id),
        );
      }
      return config.take ? found.slice(0, config.take) : found;
    },
  };
  const req = {
    scope: { resolve: () => service },
    ...(channelIds ? { publishable_key_context: { sales_channel_ids: channelIds } } : {}),
  };
  return { req, get queries() { return state.queries; } } as any;
}

test('la tienda sale de la publishable key', async () => {
  const { req } = fakeReq(['sc_norte']);
  const resolution = await siteFromPublishableKey(req);
  assert.equal(resolution.status, 'site');
  assert.equal((resolution as any).site.id, 'demo_norte');
});

test('encuentra la tienda por su canal MAYORISTA', async () => {
  // `SiteRef.channel_ids` son los dos canales, y `resolveSite` matchea ambas columnas.
  // Una key emitida para el storefront B2B tiene que resolver la MISMA tienda; si no,
  // el sitio mayorista de una tienda opera con la config de otra.
  const { req } = fakeReq(['sc_norte_b2b']);
  const resolution = await siteFromPublishableKey(req);
  assert.equal((resolution as any).site.id, 'demo_norte');
});

test('sin publishable key no inventa tienda: NO cae a la principal', async () => {
  /**
   * Es la decisión de `allowMainFallback: false`, y es el punto entero del helper.
   *
   * Con el fallback prendido, una key sin canal —o con un canal que no es de ninguna
   * tienda— resolvería a la PRINCIPAL y filtraría por ella: el visitante de una demo
   * mal configurada vería el contenido de la principal creyendo que es el de la demo.
   * Sin fallback el resultado es `allSites`, que no filtra: se ve lo que ya se veía.
   */
  const { req } = fakeReq(undefined);
  const resolution = await siteFromPublishableKey(req);
  assert.equal(resolution.status, 'allSites');
});

test('un canal que no es de ninguna tienda tampoco cae a la principal', async () => {
  // Un sales channel creado a mano no pertenece a nadie. Adoptarlo para la principal
  // sería inventar el eje, que es exactamente lo que este seam no hace.
  const { req } = fakeReq(['sc_huerfano']);
  const resolution = await siteFromPublishableKey(req);
  assert.equal(resolution.status, 'allSites');
});

test('con UNA tienda y la key que la identifica, el status es `site` — no `singleSite`', async () => {
  /**
   * Matiz que NO es obvio y que hay que tener presente al leer el resto del seam:
   * `resolveSite` devuelve `site` en cuanto una pista MATCHEA, antes de contar cuántas
   * tiendas hay. `singleSite` es el caso de "no matcheó nada y resulta que hay una
   * sola", no el de "hay una sola".
   *
   * Consecuencia: un proyecto con la tabla poblada con UNA fila y su publishable key
   * bien emitida SÍ filtra por esa tienda. Es correcto —y es lo que hace que agregar la
   * segunda no cambie nada— porque todos los descriptores que se filtran del lado store
   * tienen `empty: 'all'`: las filas globales, que son todas las anteriores a la
   * columna, se siguen viendo.
   */
  const { req } = fakeReq(['sc_norte'], [NORTE]);
  const resolution = await siteFromPublishableKey(req);
  assert.equal(resolution.status, 'site');
});

test('con UNA tienda y una key que no la identifica: singleSite, o sea NO filtrar', async () => {
  // Éste sí es el fail-open del mono-tienda: con una sola tienda no hay nada que
  // aislar, y filtrar igual escondería filas cuyo canal se creó a mano.
  const { req } = fakeReq(['sc_huerfano'], [NORTE]);
  const resolution = await siteFromPublishableKey(req);
  assert.equal(resolution.status, 'singleSite');
});

test('memoiza por request: dos llamadas, una sola resolución', async () => {
  // Se memoiza la PROMESA y no el valor. Con el valor, dos helpers concurrentes en el
  // mismo handler —que es el caso normal: settings + listado— dispararían dos lookups.
  const fake = fakeReq(['sc_norte']);
  const [a, b] = await Promise.all([
    siteFromPublishableKey(fake.req),
    siteFromPublishableKey(fake.req),
  ]);
  assert.equal(a, b, 'la segunda llamada tiene que devolver la MISMA promesa resuelta');
  assert.equal(fake.queries, 1, `resolvió ${fake.queries} veces en vez de una`);
});

test('siteIdFromPublishableKey: `null` significa LA FILA GLOBAL, no "sin filtrar"', async () => {
  /**
   * Mismo criterio que `siteIdOfChannel`, y no es cosmético: este valor va a
   * `getSettings(siteId)` / `readSetting(key, siteId)`, donde `null` es la fila global.
   *
   * `singleSite` cae en `null` a propósito: con una sola tienda la global no es "la de
   * otra", es la única que hay. Devolver su id la mandaría a buscar una fila propia
   * que nadie creó, y toda instalación mono-tienda pasaría a depender del fallback.
   */
  assert.equal(await siteIdFromPublishableKey(fakeReq(['sc_norte']).req), 'demo_norte');
  // `singleSite` (una tienda, key que no la identifica) y `allSites` caen en `null`.
  assert.equal(await siteIdFromPublishableKey(fakeReq(['sc_huerfano'], [NORTE]).req), null);
  assert.equal(await siteIdFromPublishableKey(fakeReq(undefined).req), null);
});

test('channelsFromPublishableKey no lee NADA del query', () => {
  // El guard contra la confusión que causa la deuda de `store-routes.ts`: hay nueve
  // rutas que sacan el canal de `req.query.sales_channel_id`, que se llama igual y lo
  // escribe el cliente. Si alguien "unifica" los dos, la key deja de ser el eje.
  const req = {
    query: { sales_channel_id: 'sc_de_otra_tienda' },
    publishable_key_context: { sales_channel_ids: ['sc_norte'] },
  } as any;
  assert.deepEqual(channelsFromPublishableKey(req), ['sc_norte']);

  const sinKey = { query: { sales_channel_id: 'sc_de_otra_tienda' } } as any;
  assert.deepEqual(channelsFromPublishableKey(sinKey), []);
});
