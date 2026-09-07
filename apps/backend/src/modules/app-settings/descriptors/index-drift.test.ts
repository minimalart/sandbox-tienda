import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { settingsNamespaces } from './index.ts';

/**
 * `index.ts` es el ÚNICO punto de ensamblaje de los descriptores, y se mantiene a
 * mano: un import y una entrada en el array por extensión.
 *
 * Un archivo de descriptor que existe en disco pero no está en ese array no rompe
 * nada. Compila, los tests de forma no lo miran —recorren `settingsNamespaces`, y
 * él no está ahí—, el manifest de su extensión puede declarar sus variables sin
 * problema. Simplemente NO EXISTE para la aplicación: la API no lo devuelve, el
 * buscador central no lo lista, la card no renderiza. Se escribió el archivo, se
 * escribieron los tests, todo verde, y la extensión sigue leyendo `process.env`.
 *
 * Es el modo de falla natural de una migración hecha por partes que se juntan al
 * final: cada parte entrega su archivo y el olvido está justo en la costura.
 */

/** Los `.ts` de esta carpeta que son descriptores, no infraestructura ni tests. */
function descriptorFiles(): string[] {
  return readdirSync(import.meta.dirname)
    .filter(
      (f) =>
        f.endsWith('.ts') &&
        !f.endsWith('.test.ts') &&
        f !== 'index.ts' &&
        f !== 'types.ts',
    )
    .map((f) => f.replace(/\.ts$/, ''))
    .sort();
}

/**
 * `extension:correo-argentino` → `correo-argentino`. Los descriptores viven en un
 * archivo con el nombre de su extensión, así que la convención permite cruzar disco
 * contra índice sin leer el contenido de cada archivo.
 */
const slugOf = (namespace: string): string => namespace.replace(/^extension:/, '');

test('todo archivo de descriptor está registrado en index.ts', () => {
  const registered = new Set(settingsNamespaces.map((n) => slugOf(n.namespace)));
  const orphans = descriptorFiles().filter((f) => !registered.has(f));

  assert.deepEqual(
    orphans,
    [],
    `estos descriptores existen en disco y NO están en index.ts, así que la ` +
      `aplicación no los ve: ${orphans.join(', ')}. Agregá el import y la entrada ` +
      'en el array de settingsNamespaces.',
  );
});

test('todo namespace del índice tiene su archivo', () => {
  // El sentido inverso: un import que sobrevive a que borren el archivo no compila,
  // pero un namespace declarado inline en `index.ts` —sin archivo propio— sí, y
  // rompe la convención que hace posible el test de arriba.
  const files = new Set(descriptorFiles());
  const missing = settingsNamespaces
    .map((n) => slugOf(n.namespace))
    .filter((slug) => !files.has(slug));

  assert.deepEqual(
    missing,
    [],
    `estos namespaces están en index.ts sin un archivo con su nombre: ` +
      `${missing.join(', ')}. La convención es un archivo por extensión, con el ` +
      'nombre del slug del namespace.',
  );
});

test('el orden del array es alfabético', () => {
  // No es cosmética: `index.ts` lo regenera el composer a partir de las extensiones
  // seleccionadas. Un orden estable hace que dos proyectos con el mismo set de
  // extensiones produzcan el mismo archivo, y que el diff de agregar una sea una
  // línea y no todo el bloque.
  const actual = settingsNamespaces.map((n) => n.namespace);
  assert.deepEqual(actual, [...actual].sort(), 'ordená settingsNamespaces alfabéticamente');
});
