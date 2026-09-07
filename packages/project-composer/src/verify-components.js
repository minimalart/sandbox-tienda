// Chequeo de consistencia de las extensiones empaquetadas, independiente del
// checkout.
//
// `validate-components.js` compara el sha256 de `managed_files` contra los bytes
// crudos del working tree. El repo no tiene `.gitattributes` y usa
// core.autocrlf, así que los mismos bytes hashean distinto en Windows (CRLF) y
// en Linux (LF): ese validador sólo da verde en un checkout con los mismos fines
// de línea con los que se extrajo, y por eso no puede ser un check de CI.
//
// Acá se normalizan los fines de línea antes de comparar, así que el resultado
// es el mismo en cualquier checkout. Además agrega los dos chequeos que no hacía
// nadie:
//
//   [payload]  el snapshot de `payload/` quedó atrás del archivo canónico del
//              working tree. Es el que importa de verdad: el payload es lo que
//              el generador copia al proyecto nuevo, así que un payload viejo
//              significa que el proyecto generado arranca con código viejo.
//   [package]  `package.json` de la extensión desincronizado del manifest.
//
// Y los tres que cierran el agujero por el que el manifest commiteado y el
// `extract` se separaron sin que nadie lo viera (los dos estados son
// internamente consistentes, así que ningún chequeo de los de arriba los
// distingue):
//
//   [ownership]    `files[]` dejó de ser lo que `extract` produciría. Pasa en los
//                  dos sentidos: alguien borró una raíz de
//                  `component-definitions.js` y el manifest quedó con archivos
//                  que el extract ya no le da (el próximo que regenere se los
//                  saca, y `apps/platform` deja de instalarlos), o agregó código
//                  que el extract adopta y el manifest todavía no lista.
//   [migrations]   hay una migración en el payload que no está en `migrations[]`
//                  porque se agregó sin re-correr el extract.
//   [order]        `managed_files` no está en el orden en que el extract lo
//                  escribe. Es inocuo para instalar (los consumidores lo leen
//                  como mapa) pero rompe la idempotencia: el próximo que corra
//                  el extract se lleva un diff que no pidió. Pasa cuando se
//                  agrega una entrada a mano —el camino recomendado para no
//                  regenerar las 40 extensiones— y se apendea al final del grupo
//                  en vez de en su posición ordenada.
//   [integrations] `integrations` quedó atrás de `extension-integrations.js`.
//                  `apps/platform` mergea ESTE campo en `extension-middlewares.ts`
//                  al instalar, así que si está viejo el proyecto del cliente se
//                  queda sin registrar middlewares que sí necesita.
//
// Uso:
//   node packages/project-composer/src/verify-components.js            (todas)
//   node packages/project-composer/src/verify-components.js erp blog   (filtra)
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { catalog } = require('../../project-catalog/src');
const { resolveOwnership } = require('./resolve-ownership');
const {
  adminHookDefinitions, adminTranslationDefinitions, middlewareDefinitions,
} = require('./extension-integrations');

const root = path.resolve(__dirname, '../../..');
const toPosix = (value) => value.split(path.sep).join('/');
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

// Un archivo de texto del working tree está en una de las dos formas según el
// checkout. Se acepta el sha registrado si coincide con cualquiera de las dos
// (más los bytes crudos, para los binarios que no hay que normalizar).
const asLf = (buffer) => Buffer.from(buffer.toString('binary').replace(/\r\n/g, '\n'), 'binary');
const asCrlf = (buffer) => Buffer.from(buffer.toString('binary').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'binary');
const hashMatches = (buffer, expected) =>
  sha256(buffer) === expected || sha256(asLf(buffer)) === expected || sha256(asCrlf(buffer)) === expected;
const sameContent = (left, right) => asLf(left).equals(asLf(right));

const visitFiles = (directory, base = directory, result = []) => {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) visitFiles(absolute, base, result);
    else result.push(toPosix(path.relative(base, absolute)));
  }
  return result;
};

const requested = process.argv.slice(2);
const sourceExtensions = catalog.extensions.filter((extension) => extension.type !== 'plugin');
const catalogById = new Map(catalog.extensions.map((extension) => [extension.id, extension]));
const known = new Set(sourceExtensions.map((extension) => extension.id));
const unknown = requested.filter((id) => !known.has(id));
if (unknown.length) {
  console.error(`Unknown extension id: ${unknown.join(', ')}`);
  process.exit(1);
}
const selected = requested.length
  ? sourceExtensions.filter((extension) => requested.includes(extension.id))
  : sourceExtensions;

const problems = [];
const report = (tag, id, message) => problems.push({ tag, id, message });
const owners = new Map();
// Lo que `extract-components.js` calcularía hoy. Se resuelve una sola vez: es un
// barrido de apps/backend/src.
const ownership = resolveOwnership(catalog);
const MIGRATION_PATTERN = /\/migrations\/Migration[^/]+\.(?:ts|js)$/;

for (const extension of selected) {
  const packageRoot = path.join(root, 'packages', 'extensions', extension.id);
  const manifestPath = path.join(packageRoot, 'mercatto-component.json');
  const packagePath = path.join(packageRoot, 'package.json');
  if (!fs.existsSync(manifestPath)) {
    report('manifest', extension.id, 'missing mercatto-component.json');
    continue;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.id !== extension.id) report('identity', extension.id, `manifest id is ${manifest.id}`);
  if (manifest.version !== extension.version) {
    report('identity', extension.id, `catalog ${extension.version} vs manifest ${manifest.version}`);
  }
  if (JSON.stringify(manifest.dependencies || []) !== JSON.stringify(extension.dependencies || [])) {
    report('identity', extension.id, 'catalog and manifest dependencies differ');
  }

  if (!fs.existsSync(packagePath)) {
    report('package', extension.id, 'missing package.json');
  } else {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const expectedName = `@repo/extension-${extension.id}`;
    if (pkg.name !== expectedName) report('package', extension.id, `name is ${pkg.name}, expected ${expectedName}`);
    if (pkg.version !== manifest.version) {
      report('package', extension.id, `package.json ${pkg.version} vs manifest ${manifest.version}`);
    }
    const expectedDependencies = (extension.dependencies || []).map((id) => {
      const dependency = catalogById.get(id);
      return dependency?.type === 'plugin' && dependency.packageName
        ? dependency.packageName
        : `@repo/extension-${id}`;
    }).sort();
    const actualDependencies = Object.keys(pkg.dependencies || {}).sort();
    if (JSON.stringify(actualDependencies) !== JSON.stringify(expectedDependencies)) {
      report('package', extension.id, 'package.json dependencies differ from catalog');
    }
  }

  // `extract` saltea las raíces que no existen en el working tree, así que la
  // comparación se hace contra las que sí existen.
  const expectedTargets = (ownership[extension.id] || [])
    .filter((relative) => fs.existsSync(path.join(root, relative)));
  const actualTargets = (manifest.files || []).map((mapping) => mapping.target);
  // Se compara como conjunto: lo que importa es qué archivos posee la extensión,
  // no en qué orden quedaron listados.
  const missingTargets = expectedTargets.filter((target) => !actualTargets.includes(target));
  const staleTargets = actualTargets.filter((target) => !expectedTargets.includes(target));
  for (const target of missingTargets) {
    report('ownership', extension.id, `extract owns ${target} but files[] does not list it`);
  }
  for (const target of staleTargets) {
    report('ownership', extension.id, `files[] lists ${target} but extract would drop it (missing root in component-definitions.js?)`);
  }

  const expectedIntegrations = {
    middlewares: middlewareDefinitions[extension.id] || [],
    admin_hooks: adminHookDefinitions[extension.id] || [],
    admin_translation: adminTranslationDefinitions[extension.id] || null,
  };
  if (JSON.stringify(manifest.integrations || null) !== JSON.stringify(expectedIntegrations)) {
    report('integrations', extension.id, 'integrations differ from extension-integrations.js');
  }

  for (const mapping of manifest.files || []) {
    const previous = owners.get(mapping.target);
    if (previous && previous !== extension.id) {
      report('owner', extension.id, `${mapping.target} also owned by ${previous}`);
    }
    owners.set(mapping.target, extension.id);
    if (!fs.existsSync(path.join(packageRoot, mapping.source))) {
      report('files', extension.id, `payload missing ${mapping.source}`);
    }
    if (!fs.existsSync(path.join(root, mapping.target))) {
      report('files', extension.id, `canonical source missing ${mapping.target}`);
    }
  }

  // Mismo comparador que `extract-components.js`.
  const manifestOrder = (manifest.managed_files || []).map((entry) => entry.path);
  const sortedOrder = [...manifestOrder].sort((left, right) => left.localeCompare(right));
  const firstOutOfOrder = manifestOrder.findIndex((entry, index) => entry !== sortedOrder[index]);
  if (firstOutOfOrder !== -1) {
    report('order', extension.id, `managed_files is not in extract order, first at index ${firstOutOfOrder}: ${manifestOrder[firstOutOfOrder]}`);
  }

  const payloadRoot = path.join(packageRoot, 'payload');
  const managed = new Set();
  for (const entry of manifest.managed_files || []) {
    managed.add(entry.path);
    const payloadFile = path.join(payloadRoot, entry.path);
    if (!fs.existsSync(payloadFile)) {
      report('files', extension.id, `payload missing payload/${entry.path}`);
      continue;
    }
    const payloadBytes = fs.readFileSync(payloadFile);
    if (!hashMatches(payloadBytes, entry.sha256)) {
      report('hash', extension.id, `stale sha256 ${entry.path}`);
    }
    // `managed_files[].path` es la ruta del archivo canónico relativa a la raíz
    // del repo: el payload es un espejo del working tree.
    const canonicalFile = path.join(root, entry.path);
    if (!fs.existsSync(canonicalFile)) {
      report('files', extension.id, `canonical source missing ${entry.path}`);
      continue;
    }
    if (!sameContent(payloadBytes, fs.readFileSync(canonicalFile))) {
      report('payload', extension.id, `payload is behind the canonical file ${entry.path}`);
    }
  }

  const payloadFiles = visitFiles(payloadRoot);
  for (const file of payloadFiles) {
    if (!managed.has(file)) report('files', extension.id, `payload file not in managed_files ${file}`);
  }

  const expectedMigrations = payloadFiles.filter((file) => MIGRATION_PATTERN.test(`/${file}`)).sort();
  const actualMigrations = [...(manifest.migrations || [])].sort();
  for (const file of expectedMigrations.filter((file) => !actualMigrations.includes(file))) {
    report('migrations', extension.id, `migration in payload but not in migrations[]: ${file}`);
  }
  for (const file of actualMigrations.filter((file) => !expectedMigrations.includes(file))) {
    report('migrations', extension.id, `migrations[] lists a file that is not in the payload: ${file}`);
  }
}

if (problems.length) {
  const order = ['manifest', 'identity', 'package', 'ownership', 'integrations', 'migrations', 'order', 'payload', 'hash', 'files', 'owner'];
  problems.sort((left, right) =>
    order.indexOf(left.tag) - order.indexOf(right.tag) ||
    left.id.localeCompare(right.id) ||
    left.message.localeCompare(right.message)
  );
  for (const problem of problems) console.error(`[${problem.tag}] ${problem.id}: ${problem.message}`);
  const byTag = order
    .map((tag) => [tag, problems.filter((problem) => problem.tag === tag).length])
    .filter(([, count]) => count)
    .map(([tag, count]) => `${tag}=${count}`)
    .join(' ');
  console.error(`\n${problems.length} problem(s) across ${new Set(problems.map((p) => p.id)).size} extension(s): ${byTag}`);
  process.exit(1);
}
console.log(`Verified ${selected.length} extension payload(s) against the working tree.`);
