import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmptyResult, compactToolResult } from './tool-result.ts';

test('isEmptyResult: array vacío', () => {
  assert.equal(isEmptyResult([]), true);
  assert.equal(isEmptyResult([1]), false);
});

test('isEmptyResult: count 0', () => {
  assert.equal(isEmptyResult({ count: 0, orders: [] }), true);
  assert.equal(isEmptyResult({ count: 3 }), false);
});

test('isEmptyResult: objeto con propiedades-lista vacías', () => {
  assert.equal(isEmptyResult({ products: [] }), true);
  assert.equal(isEmptyResult({ products: [], variants: [] }), true);
  assert.equal(isEmptyResult({ products: [{ id: 'p1' }] }), false);
  // sin ninguna propiedad-lista no se considera vacío (puede ser un objeto-detalle)
  assert.equal(isEmptyResult({ id: 'o1', total: 0 }), false);
});

test('compactToolResult: anexa la pista de auto-corrección a un resultado vacío', () => {
  const out = compactToolResult(JSON.stringify({ count: 0, orders: [] }));
  assert.match(out, /0 resultados/);
  assert.match(out, /OTRA variante/);
});

test('compactToolResult: NO anexa pista a un resultado con datos', () => {
  const out = compactToolResult(JSON.stringify({ count: 1, orders: [{ id: 'o1' }] }));
  assert.doesNotMatch(out, /0 resultados/);
});

test('compactToolResult: texto no-JSON (error) se deja tal cual', () => {
  const out = compactToolResult('Error ejecutando foo: boom');
  assert.equal(out, 'Error ejecutando foo: boom');
});
