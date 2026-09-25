import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

/**
 * `...options` ANTES de `onSuccess`, en TODA mutación de `admin/hooks/api`.
 *
 * `useMutation({ onSuccess: mio, ...options })` es un objeto literal: si el que llama
 * pasa su propio `onSuccess` —y casi toda card lo pasa, aunque sea para un toast— el
 * spread descarta el nuestro, y el `setQueryData` / `invalidateQueries` que refresca la
 * pantalla no corre nunca.
 *
 * Lo que lo hace caro de encontrar: la mutación devuelve 200, el toast sale y el dato
 * SÍ queda guardado. No se lee como un bug de UI, se lee como que el backend no
 * guardó. Y en las cards con estado local queda TAPADO, porque lo que se ve es lo que
 * el usuario escribió, no lo que volvió del server. Lo destapó el interruptor del bot
 * de WhatsApp (2026-09-22), la única card que deriva su estado puramente del server.
 *
 * Es una regla de ORDEN dentro de un literal: no hay tipo que la exprese, y montar
 * react-query con un renderer para vigilar una coma es mucha maquinaria. Se lee el
 * fuente, como ya hacen `provider-credentials.test.ts` y `admin-site-scope.test.ts`.
 */

const DIR = import.meta.dirname;

/**
 * El fuente con los comentarios reemplazados por espacios, conservando las posiciones.
 *
 * NO es una precaución teórica. El recuadro que documenta esta regla arriba de
 * `useCreateKapsoTemplate` **cita la forma incorrecta textualmente**, y ya rompió dos
 * herramientas distintas: la primera versión de este test y el script que aplicó el
 * arreglo. Cualquier cosa que lea este directorio como texto tiene que enmascarar
 * antes.
 */
function sinComentarios(src: string): string {
  const out = [...src];
  let modo: 'linea' | 'bloque' | "'" | '"' | '`' | null = null;
  for (let k = 0; k < src.length; k += 1) {
    const c = src[k]!;
    const nxt = src[k + 1] ?? '';
    if (modo === "'" || modo === '"' || modo === '`') {
      if (c === '\\') { k += 1; continue; }
      if (c === modo) modo = null;
    } else if (modo === 'linea') {
      if (c === '\n') modo = null;
      else out[k] = ' ';
    } else if (modo === 'bloque') {
      if (c === '*' && nxt === '/') { out[k] = ' '; out[k + 1] = ' '; modo = null; k += 1; }
      else if (c !== '\n') out[k] = ' ';
    } else if (c === '/' && nxt === '/') { modo = 'linea'; out[k] = ' '; out[k + 1] = ' '; k += 1; }
    else if (c === '/' && nxt === '*') { modo = 'bloque'; out[k] = ' '; out[k + 1] = ' '; k += 1; }
    else if (c === "'" || c === '"' || c === '`') modo = c;
  }
  return out.join('');
}

/** Cuerpos de cada `useMutation({ … })`, delimitados por balanceo real de llaves. */
function cuerposDeMutacion(src: string): string[] {
  const limpio = sinComentarios(src);
  const cuerpos: string[] = [];
  const NEEDLE = 'useMutation({';
  for (let i = limpio.indexOf(NEEDLE); i !== -1; i = limpio.indexOf(NEEDLE, i + 1)) {
    const abre = i + NEEDLE.length - 1;
    let depth = 0;
    for (let k = abre; k < limpio.length; k += 1) {
      if (limpio[k] === '{') depth += 1;
      else if (limpio[k] === '}') {
        depth -= 1;
        if (depth === 0) { cuerpos.push(limpio.slice(abre + 1, k)); break; }
      }
    }
  }
  return cuerpos;
}

/** Sólo las propiedades de PRIMER nivel: un `onSuccess` anidado no cuenta. */
function offsetTop(cuerpo: string, needle: string): number {
  let depth = 0;
  for (let k = 0; k < cuerpo.length; k += 1) {
    const c = cuerpo[k]!;
    if ('{[('.includes(c)) depth += 1;
    else if ('}])'.includes(c)) depth -= 1;
    else if (depth === 0 && cuerpo.startsWith(needle, k)) return k;
  }
  return -1;
}

const archivos = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'));

/** Una mutación que recibe `options` y define su propio `onSuccess`. */
type Mutacion = { archivo: string; cuerpo: string; firma: string };

const mutaciones: Mutacion[] = archivos.flatMap((archivo) =>
  cuerposDeMutacion(readFileSync(join(DIR, archivo), 'utf8'))
    .filter((cuerpo) => offsetTop(cuerpo, 'onSuccess') !== -1 && offsetTop(cuerpo, '...options') !== -1)
    .map((cuerpo) => ({
      archivo,
      cuerpo,
      firma: `${archivo}: ${cuerpo.split('\n').find((l) => l.includes('mutationFn'))?.trim() ?? '(?)'}`,
    })),
);

describe('las mutaciones del admin no dejan que el caller pise el refresco', () => {
  it('hay mutaciones que revisar', () => {
    // Sin esta guarda el test se vuelve verde POR VACÍO el día que alguien cambie el
    // formato del directorio, y dejaría de vigilar sin que nadie se entere.
    assert.ok(archivos.length >= 20, `se esperaban 20+ archivos de hooks, hay ${archivos.length}`);
    assert.ok(mutaciones.length >= 40, `se esperaban 40+ mutaciones, hay ${mutaciones.length}`);
  });

  it('ninguna spreadea options DESPUÉS de definir onSuccess', () => {
    const malas = mutaciones.filter(
      (m) => offsetTop(m.cuerpo, '...options') > offsetTop(m.cuerpo, 'onSuccess'),
    );
    assert.deepEqual(malas.map((m) => m.firma), [], 'el onSuccess del caller descarta el refresco del cache');
  });

  it('todas reenvían el onSuccess del caller', () => {
    // La otra mitad: poner `...options` primero arregla el cache, pero se comería el
    // toast de la card si además no llamáramos al suyo. Las dos van juntas o ninguna.
    const mudas = mutaciones.filter((m) => !m.cuerpo.includes('options?.onSuccess?.('));
    assert.deepEqual(mudas.map((m) => m.firma), [], 'estas mutaciones se comen el onSuccess del caller');
  });
});
