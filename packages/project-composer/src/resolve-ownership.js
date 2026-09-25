// Resolución de ownership: el mapa canónico de `component-definitions.js` más los
// archivos de integración del backend que se descubren por análisis de imports.
//
// Vivía inline en `extract-components.js` y MUTABA el módulo de definiciones, así
// que sólo se podía saber qué archivos posee una extensión regenerando los 40
// payloads. Por eso la deriva entre el manifest commiteado y lo que el extract
// produce era invisible: ningún validador podía calcular lo segundo sin escribir.
//
// Acá es una función pura, así que `verify-components.js` la usa para chequear que
// `files[]` del manifest siga siendo lo que el extract produciría.
const fs = require('node:fs');
const path = require('node:path');
const definitions = require('./component-definitions');

const root = path.resolve(__dirname, '../../..');
const toPosix = (value) => value.split(path.sep).join('/');

const visitFiles = (directory) => {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...visitFiles(absolute));
    else result.push(absolute);
  }
  return result;
};

const isInside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const sourceExtensions = ['', '.ts', '.tsx', '.js', '.jsx'];
const resolveLocalImport = (file, specifier) => {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(file), specifier);
  for (const suffix of sourceExtensions) {
    const candidate = `${base}${suffix}`;
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const suffix of sourceExtensions.slice(1)) {
    const candidate = path.join(base, `index${suffix}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return base;
};

/**
 * Workflows, subscribers, jobs, links y adaptadores de API son parte de la
 * extensión que posee el módulo que importan. Se descubren para que instalar una
 * extensión después restaure el comportamiento completo y no sólo su carpeta de
 * modelo/servicio.
 *
 * OJO: sólo mira `apps/backend/src`. Los paths de `apps/storefront` NO se
 * auto-descubren nunca — van a mano en `component-definitions.js`.
 *
 * @param {{ extensions: Array<{ id: string, dependencies?: string[] }> }} catalog
 * @returns {Record<string, string[]>} copia del mapa de ownership, con los
 *   archivos descubiertos agregados al final de cada extensión.
 */
function resolveOwnership(catalog) {
  const resolved = Object.fromEntries(Object.entries(definitions).map(([id, roots]) => [id, [...roots]]));
  const ownedRoots = [];
  for (const [id, roots] of Object.entries(resolved)) {
    for (const relative of roots) ownedRoots.push({ id, absolute: path.join(root, relative) });
  }
  const backend = path.join(root, 'apps', 'backend', 'src');
  const candidates = visitFiles(backend).filter((file) =>
    /\.(?:ts|tsx|js|jsx)$/.test(file) &&
    (/[\\/](?:api|jobs|links|scripts|subscribers|workflows)[\\/]/.test(file) || /[\\/]admin[\\/]/.test(file)) &&
    // Agregadores GENERADOS del core (`extract-components.js` los reescribe):
    // importan de todas las extensiones a propósito y no son de ninguna.
    !/[\\/]api[\\/]extension-middlewares\.ts$/.test(file) &&
    !/[\\/]api[\\/]middlewares\.ts$/.test(file) &&
    !/[\\/]api[\\/]admin[\\/]middlewares\.ts$/.test(file) &&
    !/[\\/]admin[\\/]hooks[\\/]api[\\/]index\.ts$/.test(file) &&
    !/[\\/]admin[\\/]i18n[\\/]index\.ts$/.test(file)
  );
  const catalogById = new Map(catalog.extensions.map((extension) => [extension.id, extension]));
  const dependenciesOf = (id, seen = new Set()) => {
    for (const dependency of catalogById.get(id)?.dependencies || []) {
      if (seen.has(dependency)) continue;
      seen.add(dependency);
      dependenciesOf(dependency, seen);
    }
    return seen;
  };
  // Los descartes se juntan y se avisan DESPUÉS del punto fijo: el mismo archivo
  // se re-evalúa en cada vuelta del `while`, así que avisar adentro lo repetiría.
  const dropped = new Map();
  let changed = true;
  while (changed) {
    changed = false;
    for (const file of candidates) {
      if (ownedRoots.some((entry) => isInside(entry.absolute, file))) continue;
      const source = fs.readFileSync(file, 'utf8');
      const owners = new Set();
      const importPattern = /(?:from\s+|import\s*)['"]([^'"]+)['"]/g;
      for (const match of source.matchAll(importPattern)) {
        const resolvedImport = resolveLocalImport(file, match[1]);
        if (!resolvedImport) continue;
        for (const entry of ownedRoots) if (isInside(entry.absolute, resolvedImport)) owners.add(entry.id);
      }
      if (!owners.size) continue;
      const compatible = [...owners].filter((candidate) => {
        const dependencies = dependenciesOf(candidate);
        return [...owners].every((owner) => owner === candidate || dependencies.has(owner));
      });
      if (compatible.length !== 1) {
        dropped.set(toPosix(path.relative(root, file)), [...owners].sort());
        continue;
      }
      const owner = compatible[0];
      const relative = toPosix(path.relative(root, file));
      resolved[owner].push(relative);
      ownedRoots.push({ id: owner, absolute: file });
      changed = true;
    }
  }
  // Un archivo que importa módulos de dos extensiones sin dependencia declarada
  // entre ellas NO se atribuye a ninguna: desaparece del payload y la extensión
  // se instala sin esa funcionalidad. Sin este aviso el único síntoma es
  // `verify-components` en rojo, que no dice por qué.
  for (const [file, owners] of dropped) {
    if (Object.values(resolved).some((files) => files.includes(file))) continue;
    console.warn(
      `[ownership] ${file} no se atribuye a ninguna extensión: importa de ${owners.join(' y ')}, ` +
        'y ninguna declara a la otra como dependencia. Queda FUERA del payload. ' +
        'Salidas: declarar la dependencia real en el catálogo, duplicar el helper, ' +
        'o listar el path a mano en component-definitions.js.'
    );
  }
  return resolved;
}

module.exports = { resolveOwnership };
