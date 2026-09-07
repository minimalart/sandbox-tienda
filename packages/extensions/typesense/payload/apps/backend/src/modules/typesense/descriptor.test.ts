import { test } from 'node:test';
import assert from 'node:assert/strict';
import descriptors from '../app-settings/descriptors/typesense.ts';

/**
 * Los dos mapas de colecciones por tienda, congelados.
 *
 * `manifest-drift.test.ts` ya cubre los invariantes genéricos del namespace, pero no
 * puede saber nada del `refine`, que es una función y es justo la pieza que decide si
 * un mapa mal cargado entra a la base o se rechaza en la card.
 *
 * Vale explicar por qué estos dos merecen un test propio y las otras nueve variables
 * de Typesense no: son el ÚNICO mecanismo multitienda de la extensión, estuvieron
 * invisibles para toda la auditoría por el acceso dinámico de `site-collection.ts`, y
 * su modo de falla es silencioso — un mapa que el parser descarta no rompe nada, sólo
 * hace que la tienda siga usando la colección general sin un mensaje de error. Es el
 * peor tipo de bug: el que se ve como "la búsqueda de la tienda B trae otra cosa".
 */

const byKey = new Map(descriptors.settings.map((d) => [d.key, d]));

const MAP_KEYS = ['TYPESENSE_SITE_COLLECTIONS', 'TYPESENSE_SITE_ANALYTICS_COLLECTIONS'];

test('los dos mapas existen, son json de instancia y no traen default', () => {
  for (const key of MAP_KEYS) {
    const descriptor = byKey.get(key);
    assert.ok(descriptor, `${key}: falta el descriptor`);
    assert.equal(descriptor!.type, 'json', `${key}: tiene que ser json`);
    assert.equal(descriptor!.tier, 'runtime', `${key}: se lee en cada uso, no en el boot`);
    // `instance` y no `site`: el mapa VA DE tiendas A colecciones. Un mapa por tienda
    // sería circular, y encima el fail-closed dejaría a las secundarias sin ninguno.
    assert.equal(descriptor!.scope, 'instance', `${key}: scope`);
    // "No hay mapa" y "mapa vacío" tienen que ser el mismo estado. Un `{}` por default
    // sólo lograría que la card muestre un valor heredado que no significa nada.
    assert.equal(descriptor!.default, undefined, `${key}: no debería tener default`);
    assert.ok(descriptor!.refine, `${key}: sin refine, un mapa roto entra sin chistar`);
  }
});

test('el refine acepta un mapa vacío y uno bien formado', () => {
  for (const key of MAP_KEYS) {
    const refine = byKey.get(key)!.refine!;
    assert.equal(refine({}), null, `${key}: el mapa vacío es el estado por defecto`);
    assert.equal(refine({ demo_norte: 'products_norte', demo_sur: 'products-sur_2' }), null, key);
  }
});

test('el refine rechaza lo que el parser descartaría en silencio', () => {
  const refine = byKey.get('TYPESENSE_SITE_COLLECTIONS')!.refine!;

  // Cada uno de estos casos hoy pasa por `parseSiteCollections` sin una sola queja y
  // deja la tienda en la colección general. Ese es exactamente el motivo del refine:
  // ser tolerante con lo que ya está en el entorno y estricto con lo que un humano
  // acaba de tipear en la card.
  assert.ok(refine({ demo_norte: 123 }), 'un valor no-string');
  assert.ok(refine({ demo_norte: '' }), 'un nombre de colección vacío');
  assert.ok(refine({ demo_norte: '   ' }), 'sólo espacios');
  assert.ok(refine({ '': 'products_norte' }), 'una clave vacía no es el id de nadie');
  assert.ok(refine({ demo_norte: 'products norte' }), 'un espacio no es válido en Typesense');
  assert.ok(refine({ demo_norte: 'products/norte' }), 'una barra tampoco');

  // Y las formas que no son un objeto-mapa.
  assert.ok(refine(null), 'null');
  assert.ok(refine('products_norte'), 'un string suelto');
  assert.ok(refine(['products_norte']), 'un array: para JS es object, y sin el guard sus índices pasarían por ids de tienda');
});

test('DEFAULT_CURRENCY_CODE es envOnly y su razón dice que no la edita nadie', () => {
  // No es un olvido: es configuración regional de la INSTALACIÓN. La leen tres
  // extensiones y ninguna la posee, así que la razón tiene que decirlo — si no,
  // la próxima migración la agarra y le da una card.
  const entry = (descriptors.envOnly ?? []).find((e) => e.key === 'DEFAULT_CURRENCY_CODE');
  assert.ok(entry, 'falta DEFAULT_CURRENCY_CODE en envOnly');
  assert.ok(
    !byKey.has('DEFAULT_CURRENCY_CODE'),
    'no puede estar además como descriptor editable',
  );
  assert.ok(entry!.reason.length > 60, 'la razón tiene que explicar por qué, no sólo qué');
});
