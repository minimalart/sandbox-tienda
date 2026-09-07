import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  STOREFRONT_TYPESENSE_NUM_TYPOS_VALUES,
  STOREFRONT_TYPESENSE_PREFIX_VALUES,
  STOREFRONT_TYPESENSE_QUERY_BY_FIELDS,
  STOREFRONT_TYPESENSE_QUERY_BY_WEIGHT_VALUES,
} from './search-defaults';

/**
 * ESTE es el test que evita la divergencia que originó el problema: el storefront
 * buscaba en 5 campos y el admin en 11, así que un término que sólo matcheaba por
 * tag o por título de variante aparecía en el buscador del backoffice y NO en el
 * del comprador. El operador curaba contra una realidad distinta a la que veía su
 * cliente.
 *
 * La fuente de verdad es el storefront. Este archivo la espeja, y esto lo prueba
 * leyendo el archivo real en vez de confiar en que alguien se acuerde de sincronizar.
 */
const STOREFRONT_QUERY_BY_PATH = join(
  import.meta.dirname,
  '..','..','..','..','storefront','src','lib','typesense','core','query-by.ts'
);

type ParsedField = {
  field: string;
  weight: number;
  numTypos: number;
  prefix: boolean;
};

function parseStorefrontFields(): ParsedField[] {
  const src = readFileSync(STOREFRONT_QUERY_BY_PATH, 'utf8');
  const entry =
    /\{\s*field:\s*"([^"]+)",\s*weight:\s*(\d+),\s*numTypos:\s*(\d),\s*prefix:\s*(true|false)\s*\}/g;
  const parsed: ParsedField[] = [];
  for (const m of src.matchAll(entry)) {
    parsed.push({
      field: m[1],
      weight: Number(m[2]),
      numTypos: Number(m[3]),
      prefix: m[4] === 'true',
    });
  }
  return parsed;
}

test('el espejo del admin no divergió de la config del storefront', () => {
  const storefront = parseStorefrontFields();

  assert.ok(
    storefront.length > 0,
    'no se pudo parsear query-by.ts del storefront — ¿cambió su forma?'
  );

  assert.deepEqual(
    storefront.map((f) => f.field),
    [...STOREFRONT_TYPESENSE_QUERY_BY_FIELDS],
    'los campos de query_by divergieron'
  );
  assert.deepEqual(
    storefront.map((f) => f.weight),
    [...STOREFRONT_TYPESENSE_QUERY_BY_WEIGHT_VALUES],
    'los pesos divergieron'
  );
  assert.deepEqual(
    storefront.map((f) => f.numTypos),
    [...STOREFRONT_TYPESENSE_NUM_TYPOS_VALUES],
    'los typos por campo divergieron'
  );
  assert.deepEqual(
    storefront.map((f) => f.prefix),
    [...STOREFRONT_TYPESENSE_PREFIX_VALUES],
    'los prefix por campo divergieron'
  );
});

test('los cuatro arrays paralelos del admin tienen el mismo largo', () => {
  // Typesense responde 400 ante desalineación.
  const n = STOREFRONT_TYPESENSE_QUERY_BY_FIELDS.length;
  assert.equal(STOREFRONT_TYPESENSE_QUERY_BY_WEIGHT_VALUES.length, n);
  assert.equal(STOREFRONT_TYPESENSE_NUM_TYPOS_VALUES.length, n);
  assert.equal(STOREFRONT_TYPESENSE_PREFIX_VALUES.length, n);
});
