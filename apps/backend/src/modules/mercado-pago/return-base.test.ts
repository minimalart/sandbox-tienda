import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnBase } from './return-base';

test('payment returns to the exact registered school or its supported path', () => {
  const root = 'https://north.schools.example';
  const path = 'https://schools.example/tienda/north';
  assert.equal(safeReturnBase(root, root + '/', [root, path]), root);
  assert.equal(safeReturnBase(root, path, [root, path]), path);
  for (const candidate of ['https://south.schools.example', root + '.evil.com', root + '/elsewhere', root + '?next=https://evil.com', 'https://user@north.schools.example', '//evil.com', 'javascript:alert(1)']) {
    assert.equal(safeReturnBase(root, candidate, [root, path]), root);
  }
});
