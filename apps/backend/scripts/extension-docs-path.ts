import { join } from 'node:path';

/**
 * Dónde viven los markdown generados de ayuda: `<repo>/docs/extensions/`.
 *
 * Vive en `scripts/` y NO en `src/admin/help/` a propósito. Todo lo que cuelga
 * de `src/admin/help/` lo importa el bundle del admin y por eso tiene que ser
 * data pura (ver la nota en `help/types.ts`); este módulo importa `node:path`,
 * así que ahí adentro sería la única pieza capaz de romper el build del admin.
 * Los dos que lo necesitan —el generador y el test de sincronía— corren en Node,
 * así que no pierden nada.
 */

/** `apps/backend/scripts` → `<repo>`. */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

export const EXTENSION_DOCS_DIR = join(REPO_ROOT, 'docs', 'extensions');
