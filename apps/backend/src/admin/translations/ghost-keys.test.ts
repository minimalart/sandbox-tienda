import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CLAVES DE TRADUCCIÓN QUE SE INVOCAN Y NO EXISTEN.
 *
 * Cuando `t('FOO')` no encuentra `FOO`, i18next no rompe: hace fallback al NOMBRE
 * de la clave y lo pinta tal cual. El operador ve "POSTER_HELP" abajo de un campo,
 * en mayúsculas y con guiones bajos, como si fuera texto. No hay excepción, no hay
 * warning, no hay pantalla en blanco — la ayuda simplemente se vuelve ruido.
 *
 * Se descubrió una (`ROOT_TERM_HELP_TEXT_DETAILED`, en el drawer de sinónimos de
 * Typesense) mientras se migraba la ayuda al drawer, y al medir aparecieron
 * dieciséis. O sea: no era un olvido, es una clase de bug que el compilador no ve
 * porque `t()` toma un `string`.
 *
 * Este test no las arregla —cada una necesita su copy en los dos idiomas, y eso es
 * una decisión de producto— pero **impide que el número suba**.
 *
 * De esas dieciséis se definieron trece (videos, banners, andreani y
 * email-templates). Las TRES que quedan no son copy faltante sino invocaciones
 * viejas: la clave correcta ya existe con otro nombre y el arreglo va del lado
 * del componente, no de `translations/`.
 *   - `EDITOR_ADVANCED` → usar `EDITOR_SAMPLE_DATA_ADVANCED`
 *     (`routes/email-templates/[id]/page.tsx`).
 *   - `OF_TEXT` → usar `OF_TEXT_PAGE`
 *     (`routes/typesense/components/Search/ResultsPanel.tsx`).
 *   - `SYNONYMS_FIELD_PLACEHOLDER_ALT` → usar `SYNONYMS_FIELD_PLACEHOLDER`
 *     (`routes/typesense/components/Synonyms/SynonymFormDrawer.tsx`).
 * Definirlas acá duplicaría el texto con otro nombre y dejaría dos claves vivas
 * para el mismo string. Se arreglan cambiando la llamada a `t()`.
 *
 * ─── Por qué la unión global y no por namespace ──────────────────────────────
 *
 * Se juntan TODAS las claves definidas en `translations/**` sin separar por
 * namespace. Es deliberado y sesga hacia el FALSO NEGATIVO: una clave definida en
 * `blog` e invocada desde `videos` no se marca, aunque en runtime falle igual.
 *
 * La alternativa —resolver el namespace de cada `useTranslation()` y cruzarlo con
 * el archivo correcto— detectaría más, pero un ratchet que produce falsos
 * positivos se desactiva a la semana. Con este sesgo, **todo lo que marca está
 * roto de verdad**, y por eso el número puede bajarse con confianza.
 */

/**
 * Medido, no estimado. Bajarlo es el trabajo; subirlo necesita una razón escrita.
 * Para arreglar una: definir la clave en el archivo de `translations/` del
 * namespace que la usa, en los DOS idiomas.
 */
const MAX_GHOST_KEYS = 0;

const ADMIN_DIR = join(import.meta.dirname, '..');

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
};

const files = walk(ADMIN_DIR);
const isTranslationFile = (path: string) => path.includes(`${join('admin', 'translations')}`);

/** Claves DEFINIDAS, de todos los namespaces juntos. Ver la nota de arriba. */
const defined = new Set<string>();
for (const file of files.filter(isTranslationFile)) {
  for (const match of readFileSync(file, 'utf8').matchAll(/^\s*([A-Z][A-Z0-9_]{2,}):/gm)) {
    defined.add(match[1]);
  }
}

/** Claves INVOCADAS con `t('...')` desde componentes. */
const ghosts = new Map<string, Set<string>>();
for (const file of files.filter((f) => !isTranslationFile(f))) {
  for (const match of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([A-Z][A-Z0-9_]{2,})'/g)) {
    const key = match[1];
    if (defined.has(key)) continue;
    if (!ghosts.has(key)) ghosts.set(key, new Set());
    ghosts.get(key)!.add(file.slice(ADMIN_DIR.length + 1));
  }
}

const detail = [...ghosts]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, where]) => `  ${key} → ${[...where].join(', ')}`)
  .join('\n');

test('la deuda de claves de traducción fantasma no sube', () => {
  assert.ok(
    ghosts.size <= MAX_GHOST_KEYS,
    `Hay ${ghosts.size} claves invocadas con t() que no están definidas, y el tope es ` +
      `${MAX_GHOST_KEYS}.\n\n${detail}\n\n` +
      `i18next no rompe con esto: pinta el NOMBRE de la clave como si fuera texto. ` +
      `El operador lee "POSTER_HELP" abajo del campo.\n` +
      `Arreglo: definir la clave en el archivo de translations/ del namespace que la usa, ` +
      `en los dos idiomas.`,
  );
});

/**
 * Igual que el techo de `site-transport.test.ts`: exige igualdad para que arreglar
 * una obligue a bajar el número. Con `<=` a secas, arreglar las dieciséis dejaría
 * lugar para dieciséis nuevas y el ratchet pasa a ser decoración.
 */
test('el techo de claves fantasma está ajustado a la realidad', () => {
  assert.equal(
    ghosts.size,
    MAX_GHOST_KEYS,
    `El tope dice ${MAX_GHOST_KEYS} pero hay ${ghosts.size}.\n\n${detail}\n\n` +
      `Si arreglaste alguna —gracias—, bajá \`MAX_GHOST_KEYS\` a ${ghosts.size}.`,
  );
});
