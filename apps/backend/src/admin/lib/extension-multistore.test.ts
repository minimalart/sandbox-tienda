import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EXTENSION_MULTISTORE, MULTISTORE_CAPABILITIES } from './extension-multistore';

/**
 * `EXTENSION_MULTISTORE` es un ESPEJO del campo `multistore` del catálogo. Existe
 * porque el bundle del admin no puede importar fuera de `src/admin/`, y el precio de
 * esa copia es que puede driftear en silencio: alguien migra una extensión, actualiza
 * el catálogo, y el badge sigue mostrando el estado viejo — o peor, sigue mostrando
 * una capacidad que se revirtió.
 *
 * Este test es lo que convierte ese drift en rojo. El espejo del backend
 * (`src/lib/platform/catalog.json`) ya lo vigila `project-catalog/src/validate.js`;
 * acá se cruza el del admin contra el canónico.
 */

const ADMIN_LIB = import.meta.dirname;
const CATALOG = join(ADMIN_LIB, '..', '..', '..', '..', '..', 'packages', 'project-catalog', 'src', 'catalog.json');
const MIRROR = join(ADMIN_LIB, '..', '..', 'lib', 'platform', 'catalog.json');

type CatalogExtension = { id: string; multistore?: string[] };

function readCatalog(): CatalogExtension[] | null {
  // En un proyecto generado no existe `packages/project-catalog`: se usa el espejo.
  const source = existsSync(CATALOG) ? CATALOG : MIRROR;
  if (!existsSync(source)) return null;
  return (JSON.parse(readFileSync(source, 'utf8')) as { extensions?: CatalogExtension[] }).extensions ?? [];
}

test('el espejo del admin coincide con el campo multistore del catálogo', () => {
  const extensions = readCatalog();
  if (!extensions) return;

  const fromCatalog = new Map(
    extensions
      .filter((entry) => Array.isArray(entry.multistore) && entry.multistore.length > 0)
      .map((entry) => [entry.id, [...entry.multistore!].sort()]),
  );

  const fromAdmin = new Map(
    Object.entries(EXTENSION_MULTISTORE).map(([id, capabilities]) => [id, [...capabilities].sort()]),
  );

  for (const [id, capabilities] of fromCatalog) {
    assert.deepEqual(
      fromAdmin.get(id),
      capabilities,
      `El catálogo declara multistore ${JSON.stringify(capabilities)} para "${id}" pero ` +
        `EXTENSION_MULTISTORE dice ${JSON.stringify(fromAdmin.get(id) ?? null)}. Actualizá ` +
        `apps/backend/src/admin/lib/extension-multistore.ts: el badge del backoffice lee de ahí.`
    );
  }

  for (const id of fromAdmin.keys()) {
    assert.ok(
      fromCatalog.has(id),
      `EXTENSION_MULTISTORE declara "${id}" como multitienda pero el catálogo no. Un tag sin ` +
        `respaldo en el catálogo hace que alguien asuma un aislamiento que no existe.`
    );
  }
});

test('las capacidades declaradas son válidas y sin duplicados', () => {
  for (const [id, capabilities] of Object.entries(EXTENSION_MULTISTORE)) {
    assert.ok(capabilities.length > 0, `"${id}" declara una lista vacía: omití la entrada en su lugar.`);
    assert.equal(
      new Set(capabilities).size,
      capabilities.length,
      `"${id}" repite una capacidad.`
    );
    for (const capability of capabilities) {
      assert.ok(
        (MULTISTORE_CAPABILITIES as readonly string[]).includes(capability),
        `"${id}" declara la capacidad desconocida "${capability}".`
      );
    }
  }
});
