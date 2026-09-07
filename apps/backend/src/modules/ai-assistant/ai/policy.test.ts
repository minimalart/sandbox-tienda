import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAction,
  defaultMode,
  resolveMode,
  actionFromArgs,
  resourceFromArgs,
  type PolicyOverride,
} from './policy.ts';

test('classifyAction: lecturas vs escrituras', () => {
  for (const a of ['list', 'get', 'retrieve', 'search', 'count', 'find', 'list_orders']) {
    assert.equal(classifyAction(a), 'read', a);
  }
  for (const a of ['create', 'update', 'delete', 'cancel', 'request']) {
    assert.equal(classifyAction(a), 'write', a);
  }
});

test('defaultMode: read→auto, write→ask', () => {
  assert.equal(defaultMode('manage_medusa_admin_orders', 'list'), 'auto');
  assert.equal(defaultMode('manage_medusa_admin_orders', 'create'), 'ask');
});

test('defaultMode: escape hatch v2.request prohibido', () => {
  assert.equal(defaultMode('manage_medusa_admin_v2', 'request'), 'prohibited');
});

test('defaultMode: resources read-only de extensiones no se pueden escribir', () => {
  assert.equal(
    defaultMode('manage_minimalart_extensions', 'update', 'commerce_dashboard'),
    'prohibited',
  );
  assert.equal(
    defaultMode('manage_minimalart_extensions', 'list', 'commerce_dashboard'),
    'auto',
  );
});

test('resolveMode: el override de DB gana al default', () => {
  const overrides: PolicyOverride[] = [
    { tool_name: 'manage_medusa_admin_orders', action: 'create', resource: '', mode: 'auto' },
  ];
  assert.equal(resolveMode('manage_medusa_admin_orders', 'create', '', overrides), 'auto');
  // sin override aplica el default (write → ask)
  assert.equal(resolveMode('manage_medusa_admin_orders', 'delete', '', overrides), 'ask');
});

test('actionFromArgs / resourceFromArgs', () => {
  assert.equal(actionFromArgs({ action: 'list' }), 'list');
  assert.equal(actionFromArgs({}), '*');
  assert.equal(resourceFromArgs({ resource: 'brands' }), 'brands');
  assert.equal(resourceFromArgs({}), '');
});
