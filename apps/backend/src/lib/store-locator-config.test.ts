import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  storeLocatorRegionsSchema,
  storeLocatorTypesSchema,
  parseStoreLocatorRegions,
} from './store-locator-config';
import { LEGACY_BRANCH_TYPES, resolveBranchTypes, slugifyBranchType } from './branch-types';
import {
  contentConfigToForm,
  formToContentConfig,
} from '../admin/routes/sites/components/content-config-form';

const zone = {
  id: 'region-a',
  label: 'Región A',
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [10, 20],
        [14, 20],
        [14, 24],
        [10, 24],
        [10, 20],
      ],
    ],
  },
};

const preset = { id: 'ar-b', label: 'Buenos Aires', preset: 'ar-b' };

test('un sitio sin configurar arranca con los tres tipos de siempre', () => {
  const result = formToContentConfig(contentConfigToForm({}), 'main');
  assert.deepEqual(result.sucursales?.regions, []);
  // El formulario los siembra y el primer guardado los deja explícitos: ese es
  // el backfill de los sitios viejos, hecho por la vía normal.
  assert.deepEqual(result.sucursales?.types, LEGACY_BRANCH_TYPES);
  // `categories` es la clave vieja: se lee al hidratar, no se vuelve a escribir.
  assert.equal(result.sucursales?.categories, undefined);
});

test('la lista vacía de tipos es una elección y sobrevive al round-trip', () => {
  const result = formToContentConfig(
    contentConfigToForm({ sucursales: { types: [] } }),
    'main'
  );
  assert.deepEqual(result.sucursales?.types, []);
});

test('resolveBranchTypes distingue ausente, vacío y configurado', () => {
  assert.deepEqual(resolveBranchTypes(undefined), LEGACY_BRANCH_TYPES);
  assert.deepEqual(resolveBranchTypes({}), LEGACY_BRANCH_TYPES);
  assert.deepEqual(resolveBranchTypes({ types: [] }), []);

  const custom = [{ id: 'deposito', label: 'Depósito', pickup: false }];
  assert.deepEqual(resolveBranchTypes({ types: custom }), custom);

  // La clave vieja se convierte heredando pickup y color del tipo homónimo.
  assert.deepEqual(
    resolveBranchTypes({
      categories: [{ type: 'distribution_center', label: 'Centro logístico' }],
    }),
    [{ id: 'distribution_center', label: 'Centro logístico', pickup: false, color: 'slate' }]
  );
});

test('las zonas y los tipos configurados sobreviven al round-trip del formulario', () => {
  const source = {
    sucursales: {
      regions: [zone, preset],
      types: [
        { id: 'salon', label: 'Salón', pickup: true, color: 'primary' as const },
        { id: 'deposito', label: 'Depósito', pickup: false, color: 'slate' as const },
      ],
      showLocationFilters: false,
    },
  };
  const result = formToContentConfig(contentConfigToForm(source), 'main');
  assert.deepEqual(result.sucursales?.regions, [zone, preset]);
  assert.deepEqual(result.sucursales?.types, source.sucursales.types);
  assert.equal(result.sucursales?.showLocationFilters, false);
});

test('las zonas aceptan preset o geometría, y rechazan lo demás', () => {
  assert.equal(storeLocatorRegionsSchema.safeParse([zone]).success, true);
  assert.equal(storeLocatorRegionsSchema.safeParse([preset]).success, true);
  assert.equal(
    storeLocatorRegionsSchema.safeParse([{ ...preset, active: false }]).success,
    true
  );
  // Ids repetidos: el filtro del storefront los usa como clave.
  assert.equal(storeLocatorRegionsSchema.safeParse([zone, zone]).success, false);
  // Un preset que no está en el catálogo se guardaría y después no resolvería
  // a ninguna geometría: la zona quedaría en la lista sin filtrar nada.
  assert.equal(
    storeLocatorRegionsSchema.safeParse([{ id: 'x', label: 'X', preset: 'ar-zz' }]).success,
    false
  );
  // Ni preset ni geometry.
  assert.equal(storeLocatorRegionsSchema.safeParse([{ id: 'x', label: 'X' }]).success, false);

  for (const coordinates of [
    [],
    [
      [
        [0, 0],
        [1, 1],
        [2, 2],
        [0, 0],
      ],
    ],
    [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    ],
    [
      [
        [200, 0],
        [1, 0],
        [1, 1],
        [200, 0],
      ],
    ],
  ]) {
    assert.equal(
      storeLocatorRegionsSchema.safeParse([{ ...zone, geometry: { type: 'Polygon', coordinates } }])
        .success,
      false
    );
  }
  assert.throws(() => parseStoreLocatorRegions('{oops'), /Revisá las zonas/);
});

test('los tipos validan id, label, color y unicidad', () => {
  assert.equal(
    storeLocatorTypesSchema.safeParse([{ id: 'salon', label: 'Salón', pickup: true }]).success,
    true
  );
  // El id es un slug: lo referencia `store_location.store_type`.
  assert.equal(
    storeLocatorTypesSchema.safeParse([{ id: 'Salón!', label: 'Salón', pickup: true }]).success,
    false
  );
  assert.equal(
    storeLocatorTypesSchema.safeParse([{ id: 'salon', label: '', pickup: true }]).success,
    false
  );
  assert.equal(
    storeLocatorTypesSchema.safeParse([{ id: 'salon', label: 'S', pickup: true, color: 'fucsia' }])
      .success,
    false
  );
  assert.equal(
    storeLocatorTypesSchema.safeParse([
      { id: 'salon', label: 'A', pickup: true },
      { id: 'salon', label: 'B', pickup: true },
    ]).success,
    false
  );
});

test('slugifyBranchType saca acentos y no repite ids', () => {
  assert.equal(slugifyBranchType('Centro de distribución'), 'centro_de_distribucion');
  assert.equal(slugifyBranchType('Salón', ['salon']), 'salon_2');
  // Un label que no deja ningún caracter usable igual tiene que dar un id válido.
  assert.equal(slugifyBranchType('¿?'), 'tipo');
});
