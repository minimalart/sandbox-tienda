import { test } from 'node:test';
import assert from 'node:assert/strict';

import { productIdsForSite, siteProductFilter } from './product-scope';
import { SITE_ID_HEADER } from './request';

/**
 * Los productos son del core y su pertenencia vive en un link module, no en una columna
 * nuestra. Eso obliga a un camino distinto al de las seis formas físicas, y este archivo
 * fija las tres decisiones que lo hacen seguro.
 */

const NORTE = {
  id: 'demo_norte',
  slug: 'norte',
  name: 'Norte',
  is_main: false,
  channel_ids: ['sc_norte', 'sc_norte_b2b'],
  region_id: null,
  stock_location_id: null,
};

/** Request falsa con el hint ya colgado, para no depender del middleware. */
function fakeReq(options: {
  site?: typeof NORTE | null;
  links?: Array<{ product_id: string }>;
  pages?: Array<Array<{ product_id: string }>>;
}) {
  const calls: Array<Record<string, unknown>> = [];
  let page = 0;
  const req = {
    headers: { [SITE_ID_HEADER]: options.site ? options.site.id : undefined },
    scope: {
      resolve: () => ({
        graph: async (input: Record<string, unknown>) => {
          calls.push(input);
          if (options.pages) return { data: options.pages[page++] ?? [] };
          return { data: options.links ?? [] };
        },
      }),
    },
  } as never;

  // El resolver del seam memoiza la promesa en la request; se le inyecta directo.
  const carrier = req as unknown as Record<symbol, unknown>;
  carrier[Symbol.for('multistore.pending')] = Promise.resolve(
    options.site ? { status: 'site', site: options.site } : { status: 'allSites' },
  );
  return { req, calls };
}

test('sin tienda elegida devuelve null y no toca el link', async () => {
  // `null` y no `[]`: son cosas distintas y confundirlas es el bug. `[]` significa
  // "esta tienda no vende nada"; `null`, "no hay que filtrar".
  const { req, calls } = fakeReq({ site: null });
  assert.equal(await productIdsForSite(req), null);
  assert.equal(calls.length, 0, 'no debería consultar el link sin tienda');
});

test('filtra por LOS DOS canales de una tienda B2B', async () => {
  const { req, calls } = fakeReq({ site: NORTE, links: [{ product_id: 'prod_1' }] });
  await productIdsForSite(req);
  assert.deepEqual(
    (calls[0]!.filters as { sales_channel_id: string[] }).sales_channel_id,
    ['sc_norte', 'sc_norte_b2b'],
    'filtrar sólo por el retail deja afuera el catálogo mayorista',
  );
  // Por el link y no por `product`: `filters: { sales_channels }` no existe en Product.
  assert.equal(calls[0]!.entity, 'product_sales_channel');
});

test('deduplica: un producto en los dos canales aparece UNA vez', async () => {
  // Sin el Set, un producto compartido entre retail y mayorista entraría dos veces al
  // `IN (...)` y el `count` del listado quedaría inflado.
  const { req } = fakeReq({
    site: NORTE,
    links: [{ product_id: 'prod_1' }, { product_id: 'prod_1' }, { product_id: 'prod_2' }],
  });
  assert.deepEqual(await productIdsForSite(req), ['prod_1', 'prod_2']);
});

test('sigue paginando el link hasta que la página viene incompleta', async () => {
  // El link tiene una fila por (producto, canal): con dos canales son el doble de filas
  // que de productos, así que cortar en la primera página deja catálogo afuera.
  const full = Array.from({ length: 1000 }, (_, i) => ({ product_id: `prod_${i}` }));
  const { req, calls } = fakeReq({ site: NORTE, pages: [full, [{ product_id: 'prod_last' }]] });
  const ids = await productIdsForSite(req);
  assert.equal(calls.length, 2, 'una página completa obliga a pedir la siguiente');
  assert.ok(ids!.includes('prod_last'));
});

test('`siteProductFilter` con catálogo vacío devuelve { id: [] }, no {}', async () => {
  // La diferencia que rompe: `{}` se spreadea sin filtrar NADA, así que una tienda sin
  // productos vería todo el catálogo de la instancia.
  const { req } = fakeReq({ site: NORTE, links: [] });
  assert.deepEqual(await siteProductFilter(req), { id: [] });

  const sinTienda = fakeReq({ site: null });
  assert.deepEqual(await siteProductFilter(sinTienda.req), {});
});
