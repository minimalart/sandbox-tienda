import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { allDescriptors, settingsNamespaces } from './index.ts';

/**
 * Los descriptores y el `environment[]` de cada manifest son DOS listas de las
 * mismas variables, mantenidas a mano en lugares distintos. Sin este test la
 * deriva es silenciosa en los dos sentidos:
 *
 *   - Variable en el manifest sin descriptor → nunca aparece en el admin, y
 *     nadie se entera porque la extensión sigue leyendo `process.env` y
 *     "funciona".
 *   - Descriptor sin variable en el manifest → el instalador de `apps/platform`
 *     no le pide esa env al cliente, y el fallback a entorno queda vacío.
 *
 * MIGRACIÓN EN CURSO: los namespaces que todavía no tienen descriptores viven en
 * `PENDING_NAMESPACES`. La lista sólo puede ACHICARSE — un namespace que no está
 * ahí y tampoco tiene descriptores hace fallar el test, así que una extensión
 * nueva con env vars no puede colarse sin pasar por acá. Esa lista es el estado
 * real de la migración, y vaciarla es terminarla.
 */

/**
 * Namespaces con `environment[]` que todavía no migraron. SÓLO ACHICAR.
 *
 * **Está vacía: las 13 extensiones que declaran variables ya tienen descriptor.**
 * Dejarla en el código y no borrarla es a propósito — es la red que atrapa a la
 * próxima extensión que declare `environment[]` sin descriptor. Con la lista
 * borrada, ese caso fallaría igual pero sin decir dónde agregarse.
 *
 * OJO: esta lista mide sólo las que DECLARAN. La cobertura real —extensiones que
 * leen env sin declararla— la mide `env-coverage.test.ts`, que es el test que hay
 * que mirar para saber cuánto falta de verdad.
 */
const PENDING_NAMESPACES = new Set<string>([]);

/** Sube hasta el directorio que tiene `pnpm-workspace.yaml`, o `null`. */
function findMonorepoRoot(from: string): string | null {
  let current = from;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}

const ROOT = findMonorepoRoot(import.meta.dirname);
const EXTENSIONS_DIR = ROOT ? join(ROOT, 'packages', 'extensions') : null;
const PLUGINS_DIR = ROOT ? join(ROOT, 'packages', 'plugins') : null;
const IS_MONOREPO =
  !!EXTENSIONS_DIR &&
  existsSync(EXTENSIONS_DIR) &&
  !!PLUGINS_DIR &&
  existsSync(PLUGINS_DIR);

/**
 * Piso de manifests comparados. Sin esto, un cambio de layout que hiciera que
 * `readManifests()` devuelva `[]` dejaría el test en verde por vacío — que es
 * exactamente la trampa que documenta `src/api/route-collisions.test.ts`.
 */
const MIN_MANIFESTS_WITH_ENV = 13;

type Manifest = { id: string; settings_namespace: string; environment?: string[] };

function readManifests(): Manifest[] {
  return readdirSync(EXTENSIONS_DIR!)
    .map((id) => join(EXTENSIONS_DIR!, id, 'mercatto-component.json'))
    .filter(existsSync)
    .map((path) => JSON.parse(readFileSync(path, 'utf8')) as Manifest);
}

function pluginNamespaces(): Set<string> {
  const namespaces = new Set<string>();
  for (const directory of readdirSync(PLUGINS_DIR!)) {
    const path = join(PLUGINS_DIR!, directory, 'mercatto-plugin.json');
    if (!existsSync(path)) continue;
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as {
      settings_namespace?: string;
      extractedFrom?: string[];
    };
    if (manifest.settings_namespace) namespaces.add(manifest.settings_namespace);
    for (const source of manifest.extractedFrom ?? []) {
      const id = source.split('/').filter(Boolean).at(-1);
      if (id) namespaces.add(`extension:${id}`);
    }
  }
  return namespaces;
}

// ─── Invariantes puros: corren siempre, también en un proyecto generado ──────

test('cada descriptor tiene key UPPER_SNAKE, label, group y namespace consistente', () => {
  for (const ns of settingsNamespaces) {
    for (const d of ns.settings) {
      assert.match(d.key, /^[A-Z][A-Z0-9_]*$/, `key inválida: ${d.key}`);
      assert.equal(d.namespace, ns.namespace, `${d.key}: namespace desalineado`);
      assert.ok(d.label.trim().length > 0, `${d.key}: sin label`);
      assert.ok(d.group.trim().length > 0, `${d.key}: sin group`);
      // Privacy provider configuration is stored per site and deliberately has no env fallback.
      const databaseOnly = new Set([
        'extension:multistore/SITES_HUB_PUCK', // Editorial Puck document; no environment fallback.
        'extension:consent-management/CONFIG', 'extension:ga4/STOREFRONT_CONFIG',
        'extension:clarity/CONFIG', 'extension:clarity/EXPORT_TOKEN', 'extension:google-merchant/CONFIG',
      ]);
      assert.ok(d.env.length > 0 || databaseOnly.has(`${d.namespace}/${d.key}`), `${d.key}: sin env var de la que heredar`);
      if (d.type === 'enum') assert.ok(d.options?.length, `${d.key}: enum sin options`);
      if (d.type === 'number' && d.min !== undefined && d.max !== undefined) {
        assert.ok(d.min <= d.max, `${d.key}: min > max`);
      }
    }
  }
});

test('todo descriptor declara un scope válido', () => {
  // `scope` decide contra qué tabla resuelve y, sobre todo, si le aplica el
  // fail-closed de la decisión 3. Un `site` puesto de más deja a las tiendas
  // secundarias sin valor y el síntoma es "no anda en la tienda B", sin error.
  for (const ns of settingsNamespaces) {
    assert.ok(
      ns.defaultScope === 'site' || ns.defaultScope === 'instance',
      `${ns.namespace}: defaultScope inválido`,
    );
    for (const d of ns.settings) {
      assert.ok(d.scope === 'site' || d.scope === 'instance', `${d.key}: scope inválido`);
    }
  }
});

test('un secreto no puede tener default: quedaría en claro en el código', () => {
  for (const d of allDescriptors) {
    if (d.type === 'secret') assert.equal(d.default, undefined, `${d.key}: secret con default`);
  }
});

test('el default de un descriptor pasa su propia validación', () => {
  // Un default inválido es una bomba de tiempo: anda hasta que alguien abre la
  // card, la guarda sin tocar nada y se come un 400 inexplicable.
  for (const d of allDescriptors) {
    if (d.default === undefined) continue;
    if (d.type === 'enum') {
      const allowed = (d.options ?? []).map((o) => o.value);
      assert.ok(allowed.includes(d.default as string), `${d.key}: default fuera de options`);
    }
    if (d.type === 'number' && typeof d.default === 'number') {
      if (d.min !== undefined) assert.ok(d.default >= d.min, `${d.key}: default < min`);
      if (d.max !== undefined) assert.ok(d.default <= d.max, `${d.key}: default > max`);
    }
    if ((d.type === 'string' || d.type === 'text') && d.pattern && typeof d.default === 'string') {
      assert.match(d.default, new RegExp(d.pattern), `${d.key}: default no matchea pattern`);
    }
  }
});

test('no hay namespace+key duplicados', () => {
  const seen = new Set<string>();
  for (const d of allDescriptors) {
    const id = `${d.namespace}/${d.key}`;
    assert.ok(!seen.has(id), `descriptor duplicado: ${id}`);
    seen.add(id);
  }
});

test('un namespace no declara la misma env var en dos descriptores', () => {
  for (const ns of settingsNamespaces) {
    const seen = new Map<string, string>();
    for (const d of ns.settings) {
      for (const envVar of d.env) {
        const previous = seen.get(envVar);
        assert.equal(previous, undefined, `${ns.namespace}: ${envVar} lo declaran ${previous} y ${d.key}`);
        seen.set(envVar, d.key);
      }
    }
  }
});

// ─── Cruce contra los manifests: sólo en el monorepo ─────────────────────────

test('descriptores ↔ environment[] de cada manifest', (t) => {
  if (!IS_MONOREPO) {
    t.skip('proyecto generado: no existe packages/extensions/');
    return;
  }

  const manifests = readManifests();
  const withEnv = manifests.filter((m) => (m.environment ?? []).length > 0);
  assert.ok(
    withEnv.length >= MIN_MANIFESTS_WITH_ENV,
    `sólo ${withEnv.length} manifests con environment[]; se esperaban >= ${MIN_MANIFESTS_WITH_ENV}. ` +
      'Si de verdad bajaron, actualizá MIN_MANIFESTS_WITH_ENV a mano.',
  );

  const byNamespace = new Map(settingsNamespaces.map((n) => [n.namespace, n]));
  const problems: string[] = [];

  for (const manifest of withEnv) {
    const ns = byNamespace.get(manifest.settings_namespace);

    if (!ns) {
      if (!PENDING_NAMESPACES.has(manifest.settings_namespace)) {
        problems.push(
          `${manifest.id}: declara ${manifest.environment!.length} env vars y no tiene ` +
            `descriptors/${manifest.id}.ts. Creá el descriptor o agregá el namespace a ` +
            'PENDING_NAMESPACES con una razón.',
        );
      }
      continue;
    }

    if (PENDING_NAMESPACES.has(ns.namespace)) {
      problems.push(
        `${ns.namespace}: ya tiene descriptores, sacalo de PENDING_NAMESPACES.`,
      );
      continue;
    }

    const declared = new Set(manifest.environment!);
    const covered = new Set([
      ...ns.settings.flatMap((s) => s.env),
      ...(ns.envOnly ?? []).map((e) => e.key),
    ]);

    for (const v of declared) {
      if (!covered.has(v)) {
        problems.push(`${manifest.id}: ${v} está en environment[] pero no tiene descriptor ni envOnly`);
      }
    }
    for (const v of covered) {
      if (!declared.has(v)) {
        problems.push(`${manifest.id}: descriptor/envOnly ${v} no está en el environment[] del manifest`);
      }
    }
  }

  const namespacesInManifests = new Set([
    ...manifests.map((m) => m.settings_namespace),
    ...pluginNamespaces(),
  ]);
  for (const ns of settingsNamespaces) {
    if (!namespacesInManifests.has(ns.namespace)) {
      problems.push(`${ns.namespace}: hay descriptores pero ningún manifest declara ese settings_namespace`);
    }
  }

  assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}\n`);
});

test('PENDING_NAMESPACES no tiene entradas muertas', (t) => {
  if (!IS_MONOREPO) {
    t.skip('proyecto generado');
    return;
  }
  // Un namespace que ya no existe en ningún manifest, o que ya migró, tiene que
  // salir de la lista: si no, la lista deja de reflejar el trabajo que falta.
  const real = new Set(readManifests().map((m) => m.settings_namespace));
  const migrated = new Set(settingsNamespaces.map((n) => n.namespace));
  for (const pending of PENDING_NAMESPACES) {
    assert.ok(real.has(pending), `${pending} no existe en ningún manifest: sacalo de PENDING_NAMESPACES`);
    assert.ok(!migrated.has(pending), `${pending} ya tiene descriptores: sacalo de PENDING_NAMESPACES`);
  }
});

test('environment[] de los manifests coincide con component-metadata.js', async (t) => {
  if (!IS_MONOREPO) {
    t.skip('proyecto generado');
    return;
  }
  // `verify-components.js:154` chequea `integrations` pero NO `environment`, así
  // que hoy un manifest commiteado puede quedar atrás del generador sin que nada
  // avise. Esto tapa ese agujero.
  const metadata = (
    await import(
      pathToFileURL(join(ROOT!, 'packages', 'project-composer', 'src', 'component-metadata.js')).href
    )
  ).default as Record<string, { environment?: string[] }>;

  for (const manifest of readManifests()) {
    assert.deepEqual(
      manifest.environment ?? [],
      metadata[manifest.id]?.environment ?? [],
      `${manifest.id}: environment[] del manifest != component-metadata.js. Corré \`pnpm site:components:extract\`.`,
    );
  }
});
