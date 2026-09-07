import { test } from 'node:test';
import assert from 'node:assert/strict';
import { namespacedName, EXTERNAL_PREFIX } from './tool-registry.ts';

const NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

test('namespacedName: caso simple', () => {
  assert.equal(namespacedName('slack', 'send_message'), 'mcp__slack__send_message');
});

test('namespacedName: sanea espacios y caracteres raros', () => {
  const n = namespacedName('My Server!', 'do.thing/now');
  assert.equal(n, 'mcp__My_Server__do_thing_now');
  assert.match(n, NAME_RE);
});

test('namespacedName: respeta el límite de 64 con hash corto y estable', () => {
  const longTool = 'a'.repeat(120);
  const n1 = namespacedName('serverlargo', longTool);
  const n2 = namespacedName('serverlargo', longTool);
  assert.ok(n1.length <= 64, `len=${n1.length}`);
  assert.match(n1, NAME_RE);
  assert.ok(n1.startsWith(EXTERNAL_PREFIX));
  assert.equal(n1, n2); // determinístico
  // distinto tool ⇒ distinto hash
  assert.notEqual(n1, namespacedName('serverlargo', longTool + 'x'));
});

test('namespacedName: siempre arranca con el prefijo externo', () => {
  assert.ok(namespacedName('x', 'y').startsWith(EXTERNAL_PREFIX));
});
