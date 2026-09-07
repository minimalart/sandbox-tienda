import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * La franja de contexto de tienda de las cards tiene que existir UNA sola vez.
 *
 * No es una regla de estilo: ya pasó. `settings/extension-settings` tenía su propia
 * barra de tienda porque necesitaba otro recuadro, y el resultado fueron dos controles
 * casi idénticos que habían empezado a divergir —la nota de la prop `variant` de
 * `site-scope-bar.tsx` lo documenta—. El modo de falla no es feo, es MENTIROSO: la
 * copia que no recibió el arreglo de `staleSelection` sigue mostrando el selector con
 * una tienda muerta y todas las filas apagadas sin explicación.
 *
 * Este test no lo puede atrapar el compilador: copiar el JSX a otro archivo tipa
 * perfecto. Por eso se chequea la FUENTE.
 *
 * `SiteScopeBar` queda fuera del cruce a propósito: es la barra de las pantallas de
 * LISTA, responde otra pregunta y su segundo badge no tiene análogo acá. No es una
 * copia, es otro control.
 */

const ADMIN_DIR = join(import.meta.dirname, '..', '..');

/** Único dueño legítimo del render de la franja. */
const OWNER = join(ADMIN_DIR, 'components', 'common', 'card-site-context.tsx');

/**
 * Sin esto, un `<CardSiteContext scope="site" …>` citado en un JSDoc cuenta como uso
 * real. Los comentarios de este repo son densos y citan código constantemente, así que
 * TODO escáner de fuente tiene que limpiarlos antes (misma lección que
 * `site-scope.test.ts`, `env-coverage.test.ts` y `provider-credentials.test.ts`).
 */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

const sourceFiles = (): { path: string; src: string }[] => {
  const out: { path: string; src: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) continue;
      out.push({ path: full, src: stripComments(readFileSync(full, 'utf8')) });
    }
  };
  walk(ADMIN_DIR);
  return out;
};

test('la franja de contexto de card se renderiza en un solo archivo', () => {
  // El label visible de la franja. Si aparece en otro archivo, alguien la copió en vez
  // de montar `<CardSiteContext />`.
  const forks = sourceFiles()
    .filter(({ path }) => path !== OWNER)
    .filter(({ src }) => />\s*Configurando\s*</.test(src))
    .map(({ path }) => relative(ADMIN_DIR, path))
    .sort();

  assert.deepEqual(
    forks,
    [],
    `Estos archivos vuelven a dibujar la franja de contexto de tienda en vez de montar ` +
      `<CardSiteContext scope=… dirty=… />:\n  ${forks.join('\n  ')}\n` +
      `Dos copias divergen, y la que se queda vieja miente sobre contra qué tienda se resuelven los ajustes.`,
  );
});

test('SettingsSiteContext es un envoltorio: deriva el scope y delega el render', () => {
  const src = stripComments(
    readFileSync(join(ADMIN_DIR, 'components', 'app-settings', 'settings-site-context.tsx'), 'utf8'),
  );

  // La parte que justifica que este envoltorio exista: el scope sale del DATO, no de un
  // registro por pantalla que hay que acordarse de actualizar.
  assert.match(
    src,
    /d\.scope === 'site'/,
    `SettingsSiteContext dejó de derivar el scope de los descriptores. Si el scope pasa a ` +
      `declararse a mano, una extensión nueva nace con la franja equivocada y nadie se entera.`,
  );

  assert.match(
    src,
    /<CardSiteContext\b/,
    'SettingsSiteContext tiene que delegar el render en <CardSiteContext />.',
  );

  // Un envoltorio que importa la librería de UI ya no es un envoltorio: volvió a
  // dibujar algo por su cuenta, que es justamente el fork que este archivo evita.
  assert.doesNotMatch(
    src,
    /from '@medusajs\/(ui|icons)'/,
    `SettingsSiteContext volvió a importar componentes de UI. Todo el render de la franja ` +
      `vive en components/common/card-site-context.tsx.`,
  );
});
