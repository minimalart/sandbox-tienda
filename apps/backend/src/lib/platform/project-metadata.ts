/**
 * Metadata del PROYECTO contra la plataforma Mercatto: qué template y qué
 * extensiones tiene instalado este backend (`mercatto.lock.json`) y cuáles existen
 * para instalar (el catálogo).
 *
 * Vive en `lib/` —CORE— y no dentro de una extensión a propósito: es la única forma
 * que tiene un backend en producción de responder "qué tengo instalado", así que no
 * puede depender de que alguien haya elegido instalar la extensión que lo contenía.
 * `resolve-ownership.js` nunca auto-descubre `src/lib/`, así que esta carpeta
 * sobrevive al composer en todo proyecto generado.
 */
import fs from 'node:fs';
import path from 'node:path';

export type MercattoLock = {
  source?: { commit?: string };
  template?: { id: string; version: string };
  extensions?: Array<{ id: string; version: string; active?: boolean; status?: string }>;
};

function findProjectFile(name: string): string | null {
  let directory = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(directory, name);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

export function readProjectJson<T = Record<string, unknown>>(name: string): T | null {
  const file = findProjectFile(name);
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export const readMercattoLock = () => readProjectJson<MercattoLock>('mercatto.lock.json');

export type ProjectCatalog = {
  templates?: Array<Record<string, unknown> & { id: string; name: string; version: string; status: string }>;
  extensions?: Array<Record<string, unknown> & { id: string; name: string; version: string; status: string; required?: boolean }>;
};

// El catálogo canónico vive en packages/project-catalog (solo presente en el
// checkout del monorepo). Prod (DO) y los proyectos generados no lo incluyen:
// leen el espejo commiteado junto a este archivo (sync-backend-mirror.js).
export const readProjectCatalog = (): ProjectCatalog | null => {
  const fromWalk = readProjectJson<ProjectCatalog>('packages/project-catalog/src/catalog.json')
    ?? readProjectJson<ProjectCatalog>('src/lib/platform/catalog.json');
  if (fromWalk) return fromWalk;
  const sibling = path.join(__dirname, 'catalog.json');
  return fs.existsSync(sibling) ? (JSON.parse(fs.readFileSync(sibling, 'utf8')) as ProjectCatalog) : null;
};

