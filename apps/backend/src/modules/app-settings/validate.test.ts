import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SettingDescriptor, SettingType } from './descriptors/types';
import { coerceAndValidate, coerceFromEnv, isUntouchedSecret } from './validate';

const d = (type: SettingType, extra: Partial<SettingDescriptor> = {}): SettingDescriptor => ({
  key: 'X',
  namespace: 'extension:test',
  env: ['X'],
  type,
  tier: 'runtime',
  group: 'g',
  label: 'X',
  ...extra,
});

const envFrom =
  (map: Record<string, string | undefined>) =>
  (name: string): string | undefined =>
    map[name];

// ─── string / text ───────────────────────────────────────────────────────────

test('string: recorta y acepta', () => {
  assert.deepEqual(coerceAndValidate(d('string'), '  hola  '), { ok: true, value: 'hola' });
});

test('string: vacío se rechaza, no se interpreta como borrar', () => {
  const r = coerceAndValidate(d('string'), '   ');
  assert.equal(r.ok, false);
});

test('string: respeta maxLength y pattern', () => {
  assert.equal(coerceAndValidate(d('string', { maxLength: 3 }), 'abcd').ok, false);
  assert.equal(coerceAndValidate(d('string', { pattern: '^[a-z]+$' }), 'ABC').ok, false);
  assert.equal(coerceAndValidate(d('string', { pattern: '^[a-z]+$' }), 'abc').ok, true);
});

test('string: un número no pasa como texto', () => {
  assert.equal(coerceAndValidate(d('string'), 42).ok, false);
});

// ─── url ─────────────────────────────────────────────────────────────────────

test('url: exige absoluta con http/https', () => {
  assert.deepEqual(coerceAndValidate(d('url'), 'https://a.com/x'), {
    ok: true,
    value: 'https://a.com/x',
  });
  assert.equal(coerceAndValidate(d('url'), '/relativa').ok, false);
  assert.equal(coerceAndValidate(d('url'), 'ftp://a.com').ok, false);
});

// ─── number ──────────────────────────────────────────────────────────────────

test('number: acepta string numérico y respeta min/max', () => {
  assert.deepEqual(coerceAndValidate(d('number'), '8108'), { ok: true, value: 8108 });
  assert.equal(coerceAndValidate(d('number', { min: 1, max: 10 }), 0).ok, false);
  assert.equal(coerceAndValidate(d('number', { min: 1, max: 10 }), 11).ok, false);
  assert.equal(coerceAndValidate(d('number'), 'ocho').ok, false);
});

// ─── boolean ─────────────────────────────────────────────────────────────────

test('boolean: la DB nunca guarda el string "true"', () => {
  assert.deepEqual(coerceAndValidate(d('boolean'), 'true'), { ok: true, value: true });
  assert.deepEqual(coerceAndValidate(d('boolean'), '0'), { ok: true, value: false });
  assert.deepEqual(coerceAndValidate(d('boolean'), false), { ok: true, value: false });
  assert.equal(coerceAndValidate(d('boolean'), 'quizás').ok, false);
});

// ─── enum ────────────────────────────────────────────────────────────────────

test('enum: sólo valores declarados', () => {
  const desc = d('enum', {
    options: [
      { value: 'http', label: 'HTTP' },
      { value: 'https', label: 'HTTPS' },
    ],
  });
  assert.deepEqual(coerceAndValidate(desc, 'https'), { ok: true, value: 'https' });
  assert.equal(coerceAndValidate(desc, 'gopher').ok, false);
});

// ─── json ────────────────────────────────────────────────────────────────────

test('json: parsea string y acepta objeto', () => {
  assert.deepEqual(coerceAndValidate(d('json'), '{"a":1}'), { ok: true, value: { a: 1 } });
  assert.deepEqual(coerceAndValidate(d('json'), [1, 2]), { ok: true, value: [1, 2] });
  assert.equal(coerceAndValidate(d('json'), '{no}').ok, false);
});

// ─── secret ──────────────────────────────────────────────────────────────────

test('secret: NO se recorta (un = final o un espacio son parte de la clave)', () => {
  assert.deepEqual(coerceAndValidate(d('secret'), ' abc= '), { ok: true, value: ' abc= ' });
});

test('secret vacío significa "no lo toqué", nunca "borralo"', () => {
  const desc = d('secret');
  assert.equal(isUntouchedSecret(desc, ''), true);
  assert.equal(isUntouchedSecret(desc, null), true);
  assert.equal(isUntouchedSecret(desc, undefined), true);
  assert.equal(isUntouchedSecret(desc, 'algo'), false);
  // Y en un campo que no es secreto, el vacío NO se ignora: se rechaza.
  assert.equal(isUntouchedSecret(d('string'), ''), false);
});

// ─── refine ──────────────────────────────────────────────────────────────────

test('refine corre después de la coerción y puede rechazar', () => {
  const desc = d('json', {
    refine: (v) => (Array.isArray(v) ? null : 'Tiene que ser un array de cuentas'),
  });
  assert.equal(coerceAndValidate(desc, '[]').ok, true);
  const bad = coerceAndValidate(desc, '{"a":1}');
  assert.equal(bad.ok, false);
  assert.match((bad as { error: string }).error, /array de cuentas/);
});

// ─── lectura de env ──────────────────────────────────────────────────────────

test('env: convierte según el tipo declarado', () => {
  assert.equal(coerceFromEnv(d('number'), envFrom({ X: '8108' })), 8108);
  assert.equal(coerceFromEnv(d('boolean'), envFrom({ X: 'true' })), true);
  assert.equal(coerceFromEnv(d('boolean'), envFrom({ X: 'false' })), false);
  assert.deepEqual(coerceFromEnv(d('json'), envFrom({ X: '{"a":1}' })), { a: 1 });
  assert.equal(coerceFromEnv(d('string'), envFrom({ X: ' hola ' })), 'hola');
});

test('env: ausente y vacío son lo mismo (una fila en blanco en el panel de deploy)', () => {
  assert.equal(coerceFromEnv(d('string'), envFrom({})), undefined);
  assert.equal(coerceFromEnv(d('string'), envFrom({ X: '   ' })), undefined);
});

test('env: los alias se leen en orden de precedencia', () => {
  const desc = d('string', { env: ['GA_MEASUREMENT_ID', 'NEXT_PUBLIC_GA_MEASUREMENT_ID'] });
  assert.equal(
    coerceFromEnv(desc, envFrom({ GA_MEASUREMENT_ID: 'A', NEXT_PUBLIC_GA_MEASUREMENT_ID: 'B' })),
    'A',
  );
  assert.equal(coerceFromEnv(desc, envFrom({ NEXT_PUBLIC_GA_MEASUREMENT_ID: 'B' })), 'B');
});

test('env: un valor fuera de rango NO se descarta — tiene que seguir andando como antes', () => {
  // La validación de rango es para lo que entra por el admin. Aplicarla al env
  // cambiaría el comportamiento de deployments que hoy funcionan.
  assert.equal(coerceFromEnv(d('number', { min: 1, max: 10 }), envFrom({ X: '999' })), 999);
});

test('env: un valor con tipo imposible se saltea y sigue con el próximo alias', () => {
  const desc = d('number', { env: ['A', 'B'] });
  assert.equal(coerceFromEnv(desc, envFrom({ A: 'no-es-numero', B: '7' })), 7);
});
