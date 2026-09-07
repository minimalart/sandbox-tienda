import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { EXTENSION_DOCS_DIR } from '../../../scripts/extension-docs-path';
import { extensionHelp } from './index';
import { renderExtensionDoc } from './render';

/**
 * La ayuda del drawer y `docs/extensions/*.md` tienen que ser el MISMO texto.
 *
 * El contenido vive en `src/admin/help/*.ts` y el markdown se genera con
 * `npm run docs:extensions`. Sin este test, "una sola fuente" dura hasta el
 * primer commit que edite el TS sin regenerar: a partir de ahí el drawer dice
 * una cosa, la doc dice otra, y el que se equivoca es siempre el que consultó la
 * que nadie mantenía. Este archivo convierte esa promesa en un invariante que
 * falla en CI, que es como el repo ya resuelve este tipo de cosas
 * (`migration-names.test.ts`, `admin-site-scope.test.ts`).
 *
 * Los tres tests cubren las tres formas de romperlo: editar el TS y no
 * regenerar, editar el `.md` a mano, y sacar una extensión del índice dejando su
 * doc huérfana.
 */

const slugs = Object.keys(extensionHelp);

const docFiles = () =>
  existsSync(EXTENSION_DOCS_DIR)
    ? readdirSync(EXTENSION_DOCS_DIR).filter((file) => file.endsWith('.md'))
    : [];

const normalizeEol = (value: string) => value.replace(/\r\n/g, '\n');

test('cada ayuda tiene su markdown generado', () => {
  for (const slug of slugs) {
    const path = join(EXTENSION_DOCS_DIR, `${slug}.md`);
    assert.ok(
      existsSync(path),
      `Falta docs/extensions/${slug}.md. Correr: cd apps/backend && npm run docs:extensions`,
    );
  }
});

test('el markdown en disco es exactamente el que generaría el script', () => {
  for (const slug of slugs) {
    const path = join(EXTENSION_DOCS_DIR, `${slug}.md`);
    if (!existsSync(path)) continue; // Ya lo reporta el test de arriba, con mejor mensaje.

    assert.equal(
      normalizeEol(readFileSync(path, 'utf8')),
      normalizeEol(renderExtensionDoc(extensionHelp[slug])),
      `docs/extensions/${slug}.md quedó desincronizado de src/admin/help/${slug}.ts.\n` +
        `Si editaste el TS: cd apps/backend && npm run docs:extensions.\n` +
        `Si editaste el .md a mano: no se edita a mano, el cambio va en el TS.`,
    );
  }
});

test('no hay markdown huérfano', () => {
  const orphans = docFiles().filter((file) => !slugs.includes(file.replace(/\.md$/, '')));

  assert.deepEqual(
    orphans,
    [],
    `docs/extensions tiene markdown sin ayuda que lo respalde: ${orphans.join(', ')}.\n` +
      `Documentar una extensión que ya no está en el índice es peor que no documentarla: ` +
      `se lee igual de convincente. Correr: cd apps/backend && npm run docs:extensions`,
  );
});

/**
 * Guarda de contenido. El `summary` es lo único que queda VISIBLE en la card una
 * vez adelgazada la `description`, así que el día que alguien pegue ahí los tres
 * párrafos que venía a sacar de la UI, volvemos al punto de partida sin que nada
 * avise.
 */
test('el summary es una sola oración', () => {
  for (const slug of slugs) {
    const { summary } = extensionHelp[slug];

    assert.ok(
      summary.length <= 140,
      `El summary de ${slug} tiene ${summary.length} caracteres (máximo 140). ` +
        `Es lo único que se ve en la card: lo que no entra, va a una sección.`,
    );
    assert.ok(
      !/[.!?]\s+\S/.test(summary.trim()),
      `El summary de ${slug} tiene más de una oración. La segunda va a una sección.`,
    );
  }
});
