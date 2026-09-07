import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-secret-A';
const { encryptSecret, decryptSecret, tryDecryptSecret } = await import('./crypto.ts');

test('encrypt → decrypt round-trip', () => {
  const plain = '{"api_key":"cb-ABC.123/xyz="}';
  const blob = encryptSecret(plain);
  assert.match(blob, /^v1:[^:]+:[^:]+:[^:]+$/);
  assert.notEqual(blob, plain);
  assert.equal(decryptSecret(blob), plain);
});

test('dos cifrados del mismo texto difieren (IV aleatorio)', () => {
  assert.notEqual(encryptSecret('mismo'), encryptSecret('mismo'));
});

test('blob manipulado no valida (auth tag GCM)', () => {
  const blob = encryptSecret('secreto');
  const parts = blob.split(':');
  const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${Buffer.from('otra-cosa').toString('base64')}`;
  assert.throws(() => decryptSecret(tampered));
});

test('formato inválido lanza', () => {
  assert.throws(() => decryptSecret('no-es-un-blob'));
  assert.throws(() => decryptSecret('v2:a:b:c'));
});

test('rotar JWT_SECRET invalida los blobs viejos', () => {
  const blob = encryptSecret('vigente');
  process.env.JWT_SECRET = 'test-secret-B';
  try {
    assert.throws(() => decryptSecret(blob), /.*/);
  } finally {
    process.env.JWT_SECRET = 'test-secret-A';
  }
  assert.equal(decryptSecret(blob), 'vigente');
});

test('tryDecryptSecret devuelve null en vez de lanzar', () => {
  assert.equal(tryDecryptSecret(null), null);
  assert.equal(tryDecryptSecret(''), null);
  assert.equal(tryDecryptSecret('basura'), null);
  assert.equal(tryDecryptSecret(encryptSecret('ok')), 'ok');
});
