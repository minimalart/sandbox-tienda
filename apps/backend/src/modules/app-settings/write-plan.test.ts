import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SettingDescriptor, SettingType } from './descriptors/types';
import { buildWritePlan } from './write-plan';

const d = (
  key: string,
  type: SettingType,
  extra: Partial<SettingDescriptor> = {},
): SettingDescriptor => ({
  key,
  namespace: 'extension:test',
  env: [key],
  type,
  tier: 'runtime',
  group: 'g',
  label: key,
  ...extra,
});

const DESCRIPTORS = [
  d('HOST', 'string'),
  d('PORT', 'number', { min: 1, max: 65535 }),
  d('ENABLED', 'boolean'),
  d('API_KEY', 'secret'),
  d('COLLECTION', 'string'),
];

test('values es un PATCH: lo ausente no se toca', () => {
  const plan = buildWritePlan({ descriptors: DESCRIPTORS, values: { HOST: 'search.local' } });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.deepEqual(plan.writes, [{ key: 'HOST', value: 'search.local', isSecret: false }]);
  assert.deepEqual(plan.deletes, []);
});

test('un secreto vacío se IGNORA — guardar otro campo no borra la credencial', () => {
  const plan = buildWritePlan({
    descriptors: DESCRIPTORS,
    values: { HOST: 'search.local', API_KEY: '' },
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.deepEqual(
    plan.writes.map((w) => w.key),
    ['HOST'],
  );
});

test('borrar es explícito por unset[]', () => {
  const plan = buildWritePlan({ descriptors: DESCRIPTORS, unset: ['API_KEY'] });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.deepEqual(plan.deletes, ['API_KEY']);
  assert.deepEqual(plan.writes, []);
});

test('todo o nada: un campo inválido no deja pasar a los válidos', () => {
  const plan = buildWritePlan({
    descriptors: DESCRIPTORS,
    values: { HOST: 'search.local', PORT: 999999 },
  });
  assert.equal(plan.ok, false);
  if (plan.ok) return;
  assert.ok(plan.errors.PORT);
  assert.equal(plan.errors.HOST, undefined);
});

test('una key desconocida es 400, no una fila huérfana', () => {
  const plan = buildWritePlan({ descriptors: DESCRIPTORS, values: { TYPO_HSOT: 'x' } });
  assert.equal(plan.ok, false);
  if (plan.ok) return;
  assert.match(plan.errors.TYPO_HSOT, /No existe un ajuste/);
});

test('una key desconocida en unset también es 400', () => {
  const plan = buildWritePlan({ descriptors: DESCRIPTORS, unset: ['NO_EXISTE'] });
  assert.equal(plan.ok, false);
});

test('guardar y borrar el mismo ajuste es una contradicción, no una preferencia', () => {
  const plan = buildWritePlan({
    descriptors: DESCRIPTORS,
    values: { API_KEY: 'nueva' },
    unset: ['API_KEY'],
  });
  assert.equal(plan.ok, false);
  if (plan.ok) return;
  assert.match(plan.errors.API_KEY, /guardar y borrar/);
});

test('coerciona por tipo: la DB nunca guarda el string "true"', () => {
  const plan = buildWritePlan({
    descriptors: DESCRIPTORS,
    values: { ENABLED: 'true', PORT: '8108' },
  });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  const byKey = Object.fromEntries(plan.writes.map((w) => [w.key, w.value]));
  assert.equal(byKey.ENABLED, true);
  assert.equal(byKey.PORT, 8108);
});

test('marca los secretos para que el service sepa qué cifrar', () => {
  const plan = buildWritePlan({ descriptors: DESCRIPTORS, values: { API_KEY: 'xyz' } });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.equal(plan.writes[0].isSecret, true);
});

/**
 * Reemplaza al viejo test de `touchesBootTier`.
 *
 * Ese flag existía para el tier `'boot'`, que prometía "guardá y reiniciá" sobre
 * una lectura que `medusa-config.ts` nunca hizo. Con el tier eliminado, el plan no
 * tiene por qué llevar un campo que sólo podía valer `false`: la invariante que
 * queda es que TODO lo que se guarda por acá aplica al instante, y eso se afirma
 * mirando que el plan no traiga ninguna señal de "esto no aplica todavía".
 */
test('el plan no promete reinicios: todo lo que se guarda aplica al instante', () => {
  const plan = buildWritePlan({ descriptors: DESCRIPTORS, values: { COLLECTION: 'productos' } });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.deepEqual(Object.keys(plan).sort(), ['deletes', 'ok', 'writes']);
  for (const descriptor of DESCRIPTORS) {
    assert.equal(descriptor.tier, 'runtime', `${descriptor.key}: no hay otro tier`);
  }
});

test('un body vacío es un no-op válido, no un error', () => {
  const plan = buildWritePlan({ descriptors: DESCRIPTORS });
  assert.equal(plan.ok, true);
  if (!plan.ok) return;
  assert.deepEqual(plan.writes, []);
  assert.deepEqual(plan.deletes, []);
});
