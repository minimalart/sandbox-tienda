import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { EXTENSION_VERSIONS } from './extension-versions.ts';

/**
 * `extension-versions.ts` dice de sí mismo "una sola fuente de verdad: este
 * archivo". No lo es, y ese es el punto de este test.
 *
 * Hay DOS registros de versión que se mantienen a mano por separado:
 *
 *   - `packages/project-catalog/src/catalog.json` — lo que el instalador ofrece.
 *     De acá salen, generados, el `mercatto-component.json` y el `package.json` de
 *     cada extensión (`extract-components.js:81,92` copian `extension.version`).
 *   - `extension-versions.ts` — lo que el badge `<ExtensionVersion />` le muestra al
 *     operador en el backoffice.
 *
 * Cuando divergen, el operador ve una versión que no es la que tiene instalada. Y
 * divergen en silencio: no hay build que se rompa, porque son dos archivos que no
 * se conocen. Es el mismo patrón que `manifest-drift.test.ts` cierra para las env
 * vars — dos listas escritas a mano que nadie cruza.
 *
 * Este test NO exige que los dos conjuntos de ids sean iguales. No lo son y por
 * ahora está bien: el admin usa `demo-stores` y `delivery-routes`, que el catálogo
 * renombró a `multistore` y `delivery`. Renombrar las claves del admin toca muchas
 * páginas y `ExtensionKey` es un tipo cerrado, así que es un cambio aparte. Lo que
 * sí se exige es que **donde los dos nombran la misma extensión, digan lo mismo**.
 */

function findRepoRoot(from: string): string | null {
  let current = from;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

const ROOT = findRepoRoot(import.meta.dirname);
const CATALOG = ROOT ? join(ROOT, 'packages', 'project-catalog', 'src', 'catalog.json') : null;

type CatalogExtension = { id: string; version: string };

const catalogExtensions = (): CatalogExtension[] =>
  (JSON.parse(readFileSync(CATALOG!, 'utf8')).extensions ?? []) as CatalogExtension[];

/**
 * Desincronizaciones toleradas. SÓLO PUEDE ACHICARSE.
 *
 * Los desvíos que todavía no pueden resolverse se documentan acá. La lista queda
 * vacía cuando el catálogo y el badge están sincronizados.
 */
const PENDING_VERSION_DRIFT = new Set<string>([]);

test('el badge del admin y el catálogo dicen la misma versión', (t) => {
  if (!CATALOG || !existsSync(CATALOG)) {
    t.skip('proyecto generado: no existe packages/project-catalog/');
    return;
  }

  const shared = catalogExtensions().filter((e) => e.id in EXTENSION_VERSIONS);

  // store-importer se integró en multistore: el conjunto compartido baja de 19 a 18.
  // Piso: sin esto, renombrar el archivo del catálogo o cambiar la forma del JSON
  // dejaría el test en verde por vacío, que es la trampa que ya documentan
  // `manifest-drift.test.ts` y `route-collisions.test.ts`.
  assert.ok(
    shared.length >= 18,
    `sólo ${shared.length} extensiones en común entre el catálogo y el badge; ` +
      'se esperaban >= 18. Si de verdad bajaron, actualizá este piso a mano.',
  );

  const problems = shared
    .filter((e) => EXTENSION_VERSIONS[e.id as keyof typeof EXTENSION_VERSIONS] !== e.version)
    .filter((e) => !PENDING_VERSION_DRIFT.has(e.id))
    .map(
      (e) =>
        `${e.id}: el badge dice v${
          EXTENSION_VERSIONS[e.id as keyof typeof EXTENSION_VERSIONS]
        } y el catálogo v${e.version}. Subí las dos en el mismo commit, o agregá el ` +
        'id a PENDING_VERSION_DRIFT con el motivo.',
    );

  assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}\n`);
});

test('PENDING_VERSION_DRIFT no tiene entradas muertas', (t) => {
  if (!CATALOG || !existsSync(CATALOG)) {
    t.skip('proyecto generado');
    return;
  }
  // Una entrada que ya se sincronizó tiene que salir, o la lista deja de medir la
  // deuda real y se vuelve decorativa.
  const byId = new Map(catalogExtensions().map((e) => [e.id, e.version]));
  for (const id of PENDING_VERSION_DRIFT) {
    const badge = EXTENSION_VERSIONS[id as keyof typeof EXTENSION_VERSIONS];
    assert.ok(badge, `${id}: ya no está en extension-versions.ts, sacalo de la lista`);
    assert.notEqual(
      badge,
      byId.get(id),
      `${id}: el badge y el catálogo ya coinciden, sacalo de PENDING_VERSION_DRIFT`,
    );
  }
});

test('toda clave del badge es una versión semver', () => {
  // Barato y atrapa el dedazo clásico: `1.2` o `v1.2.0` rompen la comparación de
  // arriba sin decir por qué.
  for (const [id, version] of Object.entries(EXTENSION_VERSIONS)) {
    assert.match(version, /^\d+\.\d+\.\d+$/, `${id}: "${version}" no es semver`);
  }
});
