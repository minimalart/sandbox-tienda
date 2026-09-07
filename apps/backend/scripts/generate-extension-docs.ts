import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extensionHelp } from '../src/admin/help';
import { renderExtensionDoc } from '../src/admin/help/render';
import { EXTENSION_DOCS_DIR } from './extension-docs-path';

/**
 * Genera `docs/extensions/<slug>.md` a partir de `src/admin/help/*.ts`.
 *
 *   cd apps/backend && npm run docs:extensions
 *
 * El markdown es un ARTEFACTO: el contenido vive en TypeScript porque el drawer
 * del admin lo importa como datos, y la doc se deriva de ahí. El porqué de esa
 * dirección (y no la inversa, con el `?raw` de Vite) está en
 * `src/admin/help/types.ts`.
 *
 * `docs-sync.test.ts` falla si lo que hay en disco no es lo que este script
 * generaría. O sea: este script no es un paso opcional de mantenimiento, es la
 * única forma de que el test pase.
 */

const written = new Set<string>();

mkdirSync(EXTENSION_DOCS_DIR, { recursive: true });

for (const [slug, help] of Object.entries(extensionHelp)) {
  const file = `${slug}.md`;
  writeFileSync(join(EXTENSION_DOCS_DIR, file), renderExtensionDoc(help), 'utf8');
  written.add(file);
}

/**
 * Barrer los huérfanos. Sin esto, sacar una extensión del índice deja su `.md`
 * en el árbol para siempre: documentación de algo que ya no existe, que es peor
 * que no tener documentación porque se lee igual de convincente.
 */
const orphans = readdirSync(EXTENSION_DOCS_DIR)
  .filter((file) => file.endsWith('.md'))
  .filter((file) => !written.has(file));

for (const orphan of orphans) rmSync(join(EXTENSION_DOCS_DIR, orphan));

console.log(
  `docs/extensions: ${written.size} generado(s)` +
    (orphans.length ? `, ${orphans.length} huérfano(s) borrado(s): ${orphans.join(', ')}` : ''),
);
