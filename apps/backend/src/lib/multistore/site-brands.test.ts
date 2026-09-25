import { test } from 'node:test';
import assert from 'node:assert/strict';

import { listSiteBrands, toSiteBrandColors } from './resolve-site';
import { SITE_REGISTRY_MODULE } from './module-key';

/**
 * La paleta que el manifest publica para los formularios del admin. Un color mal
 * cargado en el theme (sin `#`, con 3 dígitos, un nombre CSS) no puede llegar como
 * swatch: el `<input type="color">` sólo acepta `#rrggbb` y el operador vería un
 * cuadro que no guarda lo que muestra.
 */

test('toSiteBrandColors: sólo hex de 6 dígitos, normalizados', () => {
  assert.deepEqual(
    toSiteBrandColors({ primary_color: ' #1D4ED8 ', secondary_color: 'red', accent_color: '#abc' }),
    { primary_color: '#1d4ed8', secondary_color: null, accent_color: null },
  );
  assert.deepEqual(toSiteBrandColors(null), { primary_color: null, secondary_color: null, accent_color: null });
});

const containerWith = (service: unknown) => ({
  resolve: (key: string) => {
    if (key !== SITE_REGISTRY_MODULE || !service) throw new Error(`no ${key}`);
    return service;
  },
}) as never;

test('listSiteBrands: por id de tienda, y vacío sin módulo o sin tabla', async () => {
  const rows = [
    { id: 'demo_a', theme: { primary_color: '#e11d48' } },
    { id: 'demo_b', theme: null },
  ];
  assert.deepEqual(await listSiteBrands(containerWith({ listDemoStores: async () => rows })), {
    demo_a: { primary_color: '#e11d48', secondary_color: null, accent_color: null },
    demo_b: { primary_color: null, secondary_color: null, accent_color: null },
  });

  assert.deepEqual(await listSiteBrands(containerWith(null)), {});
  const missing = Object.assign(new Error('nope'), { code: '42P01' });
  assert.deepEqual(
    await listSiteBrands(containerWith({ listDemoStores: async () => { throw missing; } })),
    {},
  );
});
