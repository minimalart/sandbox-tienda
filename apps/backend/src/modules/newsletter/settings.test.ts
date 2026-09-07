import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseListId } from './settings.ts';

/**
 * El ID de lista llega por dos caminos con tipos distintos: la fila de
 * `site_setting` lo guarda en jsonb (number) y el entorno pasa por
 * `coerceFromEnv`. Un `"2"` que se cuele hace que Brevo responda 400 con un
 * mensaje que no menciona el tipo, así que el bug se lee como "la lista no
 * existe" y manda a revisar la lista equivocada.
 */
test('acepta el número tal cual', () => {
  assert.equal(parseListId(2), 2);
});

test('convierte el string del entorno', () => {
  assert.equal(parseListId('2'), 2);
  assert.equal(parseListId('  2  '), 2);
});

test('rechaza lo que no puede ser una lista', () => {
  for (const value of [null, undefined, '', '   ', 'dos', 0, -1, {}, []]) {
    assert.equal(parseListId(value), null, `${JSON.stringify(value)} no es un ID de lista`);
  }
});

/**
 * Brevo numera las listas con enteros. Un `2.5` que pase como truthy mandaría
 * `listIds: [2.5]` y el 400 volvería a leerse como "la lista no existe".
 */
test('rechaza un decimal en vez de truncarlo', () => {
  assert.equal(parseListId(2.5), null);
});
