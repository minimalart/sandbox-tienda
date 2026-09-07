import { test } from 'node:test';
import assert from 'node:assert/strict';

import { __resetSnapshot, replaceSnapshot } from '../app-settings/snapshot';
import { collectionForSite, parseSiteCollections } from './site-collection';

test('sin mapa, TODA tienda resuelve a la colección global', () => {
  // Es la propiedad que hace que esto se pueda mergear sin decidir nada: mientras el
  // equipo no cree colecciones separadas, el comportamiento es el de antes.
  delete process.env.TYPESENSE_SITE_COLLECTIONS;
  assert.equal(collectionForSite('products', 'demo_norte'), 'products');
  assert.equal(collectionForSite('products', null), 'products');
});

test('con mapa, cada tienda va a la suya y las demás al global', () => {
  process.env.TYPESENSE_SITE_COLLECTIONS = JSON.stringify({ demo_norte: 'products_norte' });
  assert.equal(collectionForSite('products', 'demo_norte'), 'products_norte');
  assert.equal(collectionForSite('products', 'demo_sur'), 'products');
  delete process.env.TYPESENSE_SITE_COLLECTIONS;
});

test('el parámetro explícito gana sobre la tienda', () => {
  // El admin ya aceptaba `?collection=`; sacárselo rompería a quien administra varias
  // colecciones a mano.
  process.env.TYPESENSE_SITE_COLLECTIONS = JSON.stringify({ demo_norte: 'products_norte' });
  assert.equal(collectionForSite('products', 'demo_norte', 'otra'), 'otra');
  delete process.env.TYPESENSE_SITE_COLLECTIONS;
});

test('un mapa malformado se comporta como vacío, no rompe', () => {
  // Está en el camino de cada pantalla de búsqueda: un JSON mal pegado en una env no
  // puede dejar al operador sin colección.
  assert.equal(parseSiteCollections('{no es json').size, 0);
  assert.equal(parseSiteCollections(undefined).size, 0);
  // Una entrada sin nombre de colección se descarta en vez de resolver a "".
  assert.equal(parseSiteCollections(JSON.stringify({ demo_norte: '' })).size, 0);
});

test('parseSiteCollections acepta el OBJETO ya parseado, no sólo el string', () => {
  // Es lo que cambió al migrar a `app-settings`: del `.env` llega un string, pero de
  // `site_setting` —y de `coerceFromEnv` para un descriptor `type: 'json'`— llega el
  // objeto. Si sólo aceptara strings, guardar el mapa desde la card lo dejaría
  // silenciosamente vacío y toda tienda volvería a la colección global.
  const fromObject = parseSiteCollections({ demo_norte: 'products_norte' });
  assert.equal(fromObject.get('demo_norte'), 'products_norte');

  // Y las mismas reglas de descarte que para el string.
  assert.equal(parseSiteCollections({ demo_norte: 123 }).size, 0);
  assert.equal(parseSiteCollections({ demo_norte: '   ' }).size, 0);
  assert.equal(parseSiteCollections(null).size, 0);
  // Un array es un `object` para JS: sin el guard, `Object.entries` daría índices
  // como si fueran ids de tienda.
  assert.equal(parseSiteCollections(['products_norte']).size, 0);
});

test('la fila de site_setting le gana a la env var', () => {
  // El punto entero de la migración: hasta ahora estos dos mapas SÓLO se podían
  // cambiar editando el `.env` y redeployando. Este test es lo que prueba que la
  // card los gobierna de verdad.
  process.env.TYPESENSE_SITE_COLLECTIONS = JSON.stringify({ demo_norte: 'del_env' });
  replaceSnapshot([
    {
      namespace: 'extension:typesense',
      key: 'TYPESENSE_SITE_COLLECTIONS',
      value: { demo_norte: 'de_la_base' },
      ciphertext: null,
      is_secret: false,
    },
  ] as never);

  assert.equal(collectionForSite('products', 'demo_norte'), 'de_la_base');

  // Y sin fila, se vuelve al env: el fallback sigue vivo, no hay seed.
  __resetSnapshot();
  assert.equal(collectionForSite('products', 'demo_norte'), 'del_env');
  delete process.env.TYPESENSE_SITE_COLLECTIONS;
});

test('la analítica usa SU PROPIO mapa, no el de catálogo', () => {
  // Viven en colecciones distintas (`popular_queries` vs `products`), así que reusar un
  // solo mapa apuntaría la analítica de una tienda a su colección de productos — y la
  // consulta devolvería vacío sin ningún error.
  process.env.TYPESENSE_SITE_COLLECTIONS = JSON.stringify({ demo_norte: 'products_norte' });
  process.env.TYPESENSE_SITE_ANALYTICS_COLLECTIONS = JSON.stringify({ demo_norte: 'queries_norte' });

  assert.equal(collectionForSite('products', 'demo_norte'), 'products_norte');
  assert.equal(
    collectionForSite('popular_queries', 'demo_norte', undefined, 'TYPESENSE_SITE_ANALYTICS_COLLECTIONS'),
    'queries_norte',
  );

  // Y con sólo el de catálogo configurado, la analítica sigue en la global.
  delete process.env.TYPESENSE_SITE_ANALYTICS_COLLECTIONS;
  assert.equal(
    collectionForSite('popular_queries', 'demo_norte', undefined, 'TYPESENSE_SITE_ANALYTICS_COLLECTIONS'),
    'popular_queries',
  );
  delete process.env.TYPESENSE_SITE_COLLECTIONS;
});
