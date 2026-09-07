import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeManifest, slugifyKey } from './agent-manifest.ts';

test('slugifyKey normaliza a [a-z0-9_-]', () => {
  assert.equal(slugifyKey('Ventas y Crecimiento'), 'ventas-y-crecimiento');
  assert.equal(slugifyKey('  Órdenes!! '), 'rdenes'); // acentos/símbolos fuera
  assert.equal(slugifyKey('a__b'), 'a__b');
  assert.equal(slugifyKey('--x--'), 'x');
});

test('normalizeManifest deriva key del nombre si falta', () => {
  const m = normalizeManifest({ name: 'Mi Agente', instructions: 'hace cosas' });
  assert.equal(m.key, 'mi-agente');
  assert.equal(m.name, 'Mi Agente');
  assert.equal(m.source === undefined, true); // source lo agrega la route, no el normalizer
});

test('normalizeManifest dedup y limpia skills/handoffs y evita auto-handoff', () => {
  const m = normalizeManifest({
    key: 'ventas',
    name: 'Ventas',
    instructions: 'x',
    skills: ['ventas', 'ventas', ' ', 'productos'],
    handoff_targets: ['catalogo', 'ventas', 'catalogo', ''],
  });
  assert.deepEqual(m.skills, ['ventas', 'productos']);
  // 'ventas' (self) se excluye; 'catalogo' deduplicado
  assert.deepEqual(m.handoff_targets, ['catalogo']);
});

test('normalizeManifest normaliza allowed_tools (null = todas)', () => {
  assert.equal(normalizeManifest({ name: 'a', instructions: 'x' }).allowed_tools, null);
  const m = normalizeManifest({
    name: 'a',
    instructions: 'x',
    allowed_tools: [
      { tool: 'manage_medusa_admin_orders' },
      { tool: 'manage_medusa_admin_orders' }, // duplicado
      { tool: '' }, // inválido
      { resources: ['x'] } as any, // sin tool
      { tool: 'manage_minimalart_extensions', resources: ['brands', 'brands'], actions: ['list'] },
    ],
  });
  assert.equal(m.allowed_tools?.length, 2);
  assert.equal(m.allowed_tools?.[0].tool, 'manage_medusa_admin_orders');
  assert.deepEqual(m.allowed_tools?.[1], {
    tool: 'manage_minimalart_extensions',
    resources: ['brands'],
    actions: ['list'],
  });
});

test('normalizeManifest aplica defaults sensatos', () => {
  const m = normalizeManifest({ name: 'A', instructions: '  hace cosas  ', max_tokens: -5 });
  assert.equal(m.instructions, 'hace cosas');
  assert.equal(m.enabled, true);
  assert.equal(m.is_orchestrator, false);
  assert.equal(m.rank, 0);
  assert.equal(m.model, null);
  assert.equal(m.max_tokens, null); // -5 descartado
  assert.equal(m.description, null);
});
