import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { settingsNamespaces } from './index.ts';

/**
 * `manifest-drift.test.ts` cruza DOS listas escritas a mano: el `environment[]`
 * del manifest y los descriptores. Las dos pueden estar de acuerdo y las dos
 * pueden estar mal, porque ninguna se compara nunca contra el CÓDIGO.
 *
 * El agujero es concreto y está en su propio filtro:
 * `manifests.filter((m) => environment.length > 0)`. Una extensión con
 * `environment: []` no se compara con nada, así que pasa en verde lea las env
 * que lea. El caso real es `recommendation-engine`: manifest con
 * `environment: []`, 21 variables leídas en producción, test verde. El
 * instalador de `apps/platform` arma el formulario con el `environment[]` de
 * los manifests, así que esas 21 nunca se le piden al cliente y el deploy
 * arranca con los defaults del código, en silencio.
 *
 * Este test cierra ese lado: parte del CÓDIGO que cada extensión posee según
 * `resolve-ownership.js` y exige que toda env que lea esté declarada.
 *
 * ─── Por qué el patrón es `(process\.)?env[.\[]` y no `process\.env\.X` ─────
 *
 * El grep obvio se pierde dos formas de lectura que el repo usa EN PRODUCCIÓN:
 *
 *   1. Record inyectado. `subscribers/correo-order.ts:42` y
 *      `workflows/correo-generate-tickets.ts:349` reciben el entorno como
 *      parámetro para poder testearlo:
 *
 *          export const isCorreoAutoFulfillEnabled = (
 *            env: Record<string, string | undefined> = process.env,
 *          ): boolean => env.CORREO_ARGENTINO_AUTO_FULFILL?.trim() === 'true';
 *
 *      El texto `process.env.CORREO_ARGENTINO_AUTO_FULFILL` no aparece nunca.
 *      Lo que aparece es `env.CORREO_ARGENTINO_AUTO_FULFILL`, y por eso el
 *      `process\.` del patrón es OPCIONAL.
 *
 *   2. Acceso dinámico por corchete. `modules/typesense/site-collection.ts:57`
 *      hace `process.env[envVar]` con `envVar` tipado como unión de literales,
 *      y `modules/arca/config.ts:35` hace `process.env[base64Var]` con el
 *      nombre llegando por parámetro desde
 *      `readPem('ARCA_CERTIFICATE_BASE64', 'ARCA_PRIVATE_KEY_BASE64', …)`.
 *      Ahí no hay ningún `env.ALGO` que grepear: el nombre de la variable es
 *      un string literal en otra línea. Por eso, cuando un archivo tiene un
 *      acceso por corchete NO literal, se cosechan además todos sus literales
 *      UPPER_SNAKE entrecomillados. Es deliberadamente sobre-inclusivo: en
 *      esta clase de archivo, un falso positivo cuesta una línea de allowlist
 *      y un falso negativo cuesta un certificado de AFIP invisible.
 *
 * Las dos variables que motivan (2) son `ARCA_CERTIFICATE_BASE64` y
 * `ARCA_PRIVATE_KEY_BASE64` — un X.509 y su clave privada.
 *
 * ─── Cómo se apaga esta lista ────────────────────────────────────────────────
 *
 * `PENDING_UNDECLARED_ENV` es el estado real de la migración y SÓLO PUEDE
 * ACHICARSE: un par (extensión, variable) que no esté ahí hace fallar el test,
 * y una entrada que ya no corresponde también. Mismo mecanismo que el
 * `MIN_MANIFESTS_WITH_ENV` y el `PENDING_NAMESPACES` de `manifest-drift.test.ts`.
 * Vaciarla es terminar la migración.
 */

// ─── Ratchet ─────────────────────────────────────────────────────────────────

/**
 * Env vars que una extensión LEE y no declara. SÓLO ACHICAR.
 *
 * Para sacar una entrada: agregá la variable al `environment[]` del manifest
 * (`pnpm site:components:extract` la propaga desde `component-metadata.js`) o,
 * mejor, dale un descriptor en `descriptors/<extension>.ts` para que se pueda
 * configurar desde el admin.
 */
const PENDING_UNDECLARED_ENV: Record<string, string[]> = {
  // EXCEPCIÓN PERMANENTE, no deuda. `S3_PUBLIC_URL` la declara y la gestiona
  // `media-library`, que es la dueña del bucket; email-templates sólo la LEE para
  // armar los `<img src>` de los mails. Migrarla acá también chocaría contra el
  // test que prohíbe la misma env editable en dos namespaces, y con razón: dos
  // cards editando el mismo bucket es peor que una sola.
  //
  // **Es la única que queda.** Arrancó con 22 extensiones y 125 pares: cada una
  // que sale de acá es una extensión que dejó de leer `process.env` a escondidas.
  // La lista sólo puede ACHICARSE, y ya no tiene de dónde.
  'email-templates': ['S3_PUBLIC_URL'],
};

/**
 * Env que el CORE provee a TODO proyecto, lea las extensiones que lea.
 *
 * No es una lista de conveniencia: es exactamente el bloque `envs:` del App Spec
 * que `project-composer/src/index.js` le genera a cada proyecto, menos las que
 * son de una extensión concreta (`TYPESENSE_*`, `S3_*`). Que `typesense` lea
 * `NODE_ENV` o que `ai-assistant` lea `JWT_SECRET` no es una env invisible: el
 * instalador YA las pide. Meterlas en `PENDING_UNDECLARED_ENV` sería ensuciar la
 * lista con entradas que no se van a poder sacar nunca.
 *
 * El test `CORE_ENV sigue siendo el baseline del App Spec` impide que esta lista
 * se use como escape hatch: si una clave deja de estar en el App Spec, falla.
 */
const CORE_ENV = new Set([
  'NODE_ENV',
  'DATABASE_URL',
  'DATABASE_SSL',
  'REDIS_URL',
  'WORKFLOW_ENGINE_REDIS',
  'JWT_SECRET',
  'COOKIE_SECRET',
  'STORE_CORS',
  'ADMIN_CORS',
  'AUTH_CORS',
  'BACKEND_URL',
  'STOREFRONT_URL',
]);

// ─── Scanner ─────────────────────────────────────────────────────────────────

/** `process.env.FOO` y `env.FOO` (record inyectado). */
const DIRECT = /(?:process\.)?env\.([A-Z][A-Z0-9_]{2,})/g;
/** `process.env['FOO']` / `env["FOO"]`. */
const BRACKET_LITERAL = /(?:process\.)?env\[\s*['"]([A-Z][A-Z0-9_]{2,})['"]/g;
/** `const { FOO, BAR } = process.env`. */
const DESTRUCTURED = /\{([^}]*)\}\s*=\s*process\.env/g;
/** `process.env[algo]` con `algo` NO literal: el nombre está en otra línea. */
const BRACKET_DYNAMIC = /(?:process\.)?env\[\s*(?!['"])/;
/** Candidatos a nombre de env en un archivo con acceso dinámico. */
const UPPER_SNAKE_LITERAL = /['"]([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)['"]/g;

/**
 * Sin esto, un `env[]` o un `` `PROCESS_ENV_X` `` dentro de un JSDoc contaban
 * como lectura. Los comentarios de este repo son largos y citan nombres de
 * variables todo el tiempo: sin limpiarlos, la mitad de la allowlist serían
 * menciones en prosa y la lista dejaría de significar algo.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

/** Nombres de env que este archivo lee. Ver el docblock por qué el patrón es así. */
function scanEnvReads(source: string): Set<string> {
  const clean = stripComments(source);
  const found = new Set<string>();

  for (const match of clean.matchAll(DIRECT)) found.add(match[1]!);
  for (const match of clean.matchAll(BRACKET_LITERAL)) found.add(match[1]!);
  for (const match of clean.matchAll(DESTRUCTURED)) {
    for (const part of match[1]!.split(',')) {
      const name = part.split(/[:=]/)[0]!.trim();
      if (/^[A-Z][A-Z0-9_]{2,}$/.test(name)) found.add(name);
    }
  }
  if (BRACKET_DYNAMIC.test(clean)) {
    for (const match of clean.matchAll(UPPER_SNAKE_LITERAL)) found.add(match[1]!);
  }
  return found;
}

// ─── Layout ──────────────────────────────────────────────────────────────────

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
const COMPOSER_DIR = ROOT ? join(ROOT, 'packages', 'project-composer', 'src') : null;
const IS_MONOREPO =
  !!EXTENSIONS_DIR &&
  existsSync(EXTENSIONS_DIR) &&
  !!PLUGINS_DIR &&
  existsSync(PLUGINS_DIR) &&
  !!COMPOSER_DIR &&
  existsSync(COMPOSER_DIR);

/**
 * Pisos contra el verde por vacío. Si `resolveOwnership()` cambia de forma o
 * `walkSources()` deja de encontrar archivos, el resultado natural es "ninguna
 * extensión lee ninguna env" — o sea, todo en verde. Es la misma trampa que
 * documenta `src/api/route-collisions.test.ts`.
 */
const MIN_EXTENSIONS_SCANNED = 35;
const MIN_FILES_SCANNED = 1500;

const SOURCE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const isTestFile = (file: string) =>
  /\.(?:test|spec)\.[tj]sx?$/.test(file) || file.includes('/__tests__/');

function walkSources(target: string, out: string[] = []): string[] {
  if (!existsSync(target)) return out;
  if (statSync(target).isFile()) {
    if (SOURCE.test(target) && !isTestFile(target)) out.push(target);
    return out;
  }
  for (const entry of readdirSync(target)) {
    if (entry === 'node_modules' || entry === '.git') continue;
    walkSources(join(target, entry), out);
  }
  return out;
}

type Manifest = { id: string; settings_namespace: string; environment?: string[] };

type Scan = {
  /** Por extensión: env leídas y no declaradas, ya sin las de core. */
  undeclared: Map<string, string[]>;
  extensions: number;
  files: number;
};

/** Memoizado: dos tests lo piden y cada corrida abre ~1900 archivos. */
let scanCache: Scan | null = null;
function scanExtensions(): Scan {
  if (scanCache) return scanCache;
  scanCache = computeScan();
  return scanCache;
}

function computeScan(): Scan {
  const require_ = createRequire(import.meta.url);
  const { resolveOwnership } = require_(join(COMPOSER_DIR!, 'resolve-ownership.js')) as {
    resolveOwnership: (catalog: unknown) => Record<string, string[]>;
  };
  const catalog = require_(join(ROOT!, 'packages', 'project-catalog', 'src', 'catalog.json'));
  const owned = resolveOwnership(catalog);

  const manifests = new Map<string, Manifest>();
  for (const id of readdirSync(EXTENSIONS_DIR!)) {
    const file = join(EXTENSIONS_DIR!, id, 'mercatto-component.json');
    if (existsSync(file)) manifests.set(id, JSON.parse(readFileSync(file, 'utf8')) as Manifest);
  }
  const pluginSources = new Map<string, string>();
  for (const directory of readdirSync(PLUGINS_DIR!)) {
    const file = join(PLUGINS_DIR!, directory, 'mercatto-plugin.json');
    if (!existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as Manifest;
    if (!manifest.id || !manifest.settings_namespace) continue;
    manifests.set(manifest.id, manifest);
    pluginSources.set(manifest.id, join(PLUGINS_DIR!, directory, 'src'));
  }
  const byNamespace = new Map(settingsNamespaces.map((n) => [n.namespace, n]));

  const undeclared = new Map<string, string[]>();
  let extensions = 0;
  let files = 0;

  for (const [id, paths] of Object.entries(owned)) {
    // Sólo backend: el inventario de env invisibles que motiva este test es el
    // del backend, y el storefront tiene su propio contrato (`NEXT_PUBLIC_*`).
    const pluginSource = pluginSources.get(id);
    const sources = pluginSource
      ? walkSources(pluginSource)
      : paths
          .filter((p) => p.startsWith('apps/backend/'))
          .flatMap((p) => walkSources(join(ROOT!, p)));
    if (!sources.length) continue;
    extensions++;
    files += sources.length;

    const read = new Set<string>();
    for (const file of sources) {
      for (const name of scanEnvReads(readFileSync(file, 'utf8'))) read.add(name);
    }

    const manifest = manifests.get(id);
    // Se unen las TRES fuentes y no sólo el manifest: durante la migración un
    // descriptor puede aterrizar antes de que se regeneren los manifests, y
    // marcar eso como deriva sería ruido puro.
    const namespace = manifest ? byNamespace.get(manifest.settings_namespace) : undefined;
    const declared = new Set([
      ...(manifest?.environment ?? []),
      ...(namespace?.settings ?? []).flatMap((s) => s.env),
      ...(namespace?.envOnly ?? []).map((e) => e.key),
    ]);

    const missing = [...read].filter((name) => !declared.has(name) && !CORE_ENV.has(name)).sort();
    if (missing.length) undeclared.set(id, missing);
  }

  return { undeclared, extensions, files };
}

// ─── El scanner es código: se testea solo ────────────────────────────────────

test('el patrón de grep atrapa el record inyectado (caso correo-order.ts:42)', () => {
  // Verbatim de `subscribers/correo-order.ts`. Inline y no leyendo el archivo a
  // propósito: si el archivo se refactorea, este test tiene que seguir
  // custodiando el PATRÓN, que es lo frágil.
  const source = `
    export const isCorreoAutoFulfillEnabled = (
      env: Record<string, string | undefined> = process.env,
    ): boolean => env.CORREO_ARGENTINO_AUTO_FULFILL?.trim().toLowerCase() === 'true';
  `;
  assert.ok(
    scanEnvReads(source).has('CORREO_ARGENTINO_AUTO_FULFILL'),
    'El `process.` del patrón tiene que ser OPCIONAL: acá la env llega como parámetro.'
  );
  assert.ok(
    !/process\.env\.CORREO_ARGENTINO_AUTO_FULFILL/.test(source),
    'Si este assert falla es que el fixture dejó de representar el caso: el grep ' +
      'obvio `process\\.env\\.X` lo encontraría y no habría nada que demostrar.'
  );
});

test('el patrón de grep atrapa el acceso dinámico (caso arca/config.ts:35)', () => {
  // Verbatim reducido de `modules/arca/config.ts`. El nombre de la variable NO
  // está pegado al `env[`: viaja como argumento desde otra línea.
  const source = `
    function readPem(base64Var: string, pathVar: string): string {
      const inline = process.env[base64Var]?.trim();
      if (inline) return inline;
      return String(process.env[pathVar]);
    }
    readPem('ARCA_CERTIFICATE_BASE64', 'ARCA_CERTIFICATE_PATH');
  `;
  const found = scanEnvReads(source);
  for (const name of ['ARCA_CERTIFICATE_BASE64', 'ARCA_CERTIFICATE_PATH']) {
    assert.ok(found.has(name), `${name}: el acceso por corchete dinámico se perdió.`);
  }
});

test('el patrón atrapa corchete literal y desestructuración', () => {
  const found = scanEnvReads(`
    const a = process.env['TYPESENSE_SITE_COLLECTIONS'];
    const { STOREFRONT_URL, DEFAULT_CURRENCY_CODE } = process.env;
  `);
  assert.ok(found.has('TYPESENSE_SITE_COLLECTIONS'));
  assert.ok(found.has('STOREFRONT_URL'));
  assert.ok(found.has('DEFAULT_CURRENCY_CODE'));
});

test('los comentarios no cuentan como lectura de env', () => {
  // Sin esto la allowlist se llena de menciones en prosa. Caso real:
  // `typesense/site-collection.ts` cita `MERCADOPAGO_ACCOUNTS` en su JSDoc y,
  // como el archivo TIENE acceso dinámico, se cosechaba como si la leyera.
  const found = scanEnvReads(`
    /** Mismo patrón que \`MERCADOPAGO_ACCOUNTS\`, ver process.env.OTRA_COSA. */
    // const legacy = process.env.YA_NO_SE_USA;
    const real = process.env[name];
    const names = ['TYPESENSE_SITE_COLLECTIONS'];
  `);
  assert.ok(found.has('TYPESENSE_SITE_COLLECTIONS'));
  assert.ok(!found.has('MERCADOPAGO_ACCOUNTS'), 'literal en backticks dentro de un JSDoc');
  assert.ok(!found.has('OTRA_COSA'), 'mención en prosa dentro de un bloque');
  assert.ok(!found.has('YA_NO_SE_USA'), 'código comentado');
});

// ─── Cruce contra el código: sólo en el monorepo ─────────────────────────────

test('ninguna extensión lee una env que no declara', (t) => {
  if (!IS_MONOREPO) {
    t.skip('proyecto generado: no existen packages/extensions/ ni packages/project-composer/');
    return;
  }

  const scan = scanExtensions();
  assert.ok(
    scan.extensions >= MIN_EXTENSIONS_SCANNED,
    `sólo ${scan.extensions} extensiones con código de backend; se esperaban >= ` +
      `${MIN_EXTENSIONS_SCANNED}. Si de verdad bajaron, actualizá MIN_EXTENSIONS_SCANNED a mano.`
  );
  assert.ok(
    scan.files >= MIN_FILES_SCANNED,
    `sólo ${scan.files} archivos escaneados; se esperaban >= ${MIN_FILES_SCANNED}. ` +
      'Un scanner que no encuentra archivos deja este test en verde por vacío.'
  );

  const problems: string[] = [];
  for (const [id, missing] of scan.undeclared) {
    const allowed = new Set(PENDING_UNDECLARED_ENV[id] ?? []);
    const news = missing.filter((name) => !allowed.has(name));
    if (news.length) {
      problems.push(
        `${id}: lee ${news.join(', ')} y no está ni en su environment[] ni en sus ` +
          'descriptores. Declarala (o dale un descriptor); PENDING_UNDECLARED_ENV sólo achica.'
      );
    }
  }
  assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}\n`);
});

test('PENDING_UNDECLARED_ENV no tiene entradas muertas', (t) => {
  if (!IS_MONOREPO) {
    t.skip('proyecto generado');
    return;
  }
  // El ratchet sólo sirve si la lista refleja el trabajo que FALTA. Una entrada
  // que ya se declaró tiene que salir en el mismo commit que la declara; si no,
  // el conteo miente y la lista deja de ser una medida de progreso.
  const scan = scanExtensions();
  const problems: string[] = [];

  for (const [id, allowed] of Object.entries(PENDING_UNDECLARED_ENV)) {
    const missing = new Set(scan.undeclared.get(id) ?? []);
    const dead = allowed.filter((name) => !missing.has(name));
    if (dead.length) {
      problems.push(
        `${id}: ${dead.join(', ')} ya no aparece como env sin declarar. ` +
          'Sacá esas entradas de PENDING_UNDECLARED_ENV.'
      );
    }
  }
  assert.deepEqual(problems, [], `\n  - ${problems.join('\n  - ')}\n`);
});

test('CORE_ENV sigue siendo el baseline del App Spec', (t) => {
  if (!IS_MONOREPO) {
    t.skip('proyecto generado');
    return;
  }
  // Sin este cruce, CORE_ENV sería un escape hatch: cualquiera podría silenciar
  // una env invisible metiéndola acá. Atada al App Spec, agregar una entrada
  // obliga a que el instalador de verdad la pida.
  const composer = readFileSync(join(COMPOSER_DIR!, 'index.js'), 'utf8');
  for (const name of CORE_ENV) {
    assert.ok(
      composer.includes(`key: ${name},`),
      `${name} está en CORE_ENV pero el App Spec de project-composer/src/index.js no la ` +
        'declara. O la agregás al App Spec, o sale de CORE_ENV y pasa a PENDING_UNDECLARED_ENV.'
    );
  }
});

test('PENDING_UNDECLARED_ENV no lista extensiones ni claves inventadas', (t) => {
  if (!IS_MONOREPO) {
    t.skip('proyecto generado');
    return;
  }
  const require_ = createRequire(import.meta.url);
  const definitions = require_(join(COMPOSER_DIR!, 'component-definitions.js')) as Record<
    string,
    string[]
  >;
  for (const [id, names] of Object.entries(PENDING_UNDECLARED_ENV)) {
    assert.ok(definitions[id], `${id}: no existe en component-definitions.js`);
    for (const name of names) {
      assert.match(name, /^[A-Z][A-Z0-9_]*$/, `${id}: "${name}" no parece un nombre de env var`);
    }
    assert.deepEqual(
      names,
      [...names].sort(),
      `${id}: la lista tiene que estar ordenada — los diffs de una lista de 100+ ` +
        'entradas son ilegibles si el orden es libre.'
    );
  }
});
