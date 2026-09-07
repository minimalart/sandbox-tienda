import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.APP_SETTINGS_ENC_KEY = 'test-secret-A';
const { encryptSecret, decryptSecret, tryDecryptSecret, maskSecret } = await import('./crypto.ts');

test('encrypt → decrypt round-trip', () => {
  const plain = 'xyz-ABC.123/abc=';
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

test('rotar la clave invalida los blobs viejos', () => {
  const blob = encryptSecret('vigente');
  process.env.APP_SETTINGS_ENC_KEY = 'test-secret-B';
  try {
    assert.throws(() => decryptSecret(blob), /.*/);
  } finally {
    process.env.APP_SETTINGS_ENC_KEY = 'test-secret-A';
  }
  assert.equal(decryptSecret(blob), 'vigente');
});

test('tryDecryptSecret devuelve null en vez de lanzar', () => {
  assert.equal(tryDecryptSecret(null), null);
  assert.equal(tryDecryptSecret(''), null);
  assert.equal(tryDecryptSecret('basura'), null);
  assert.equal(tryDecryptSecret(encryptSecret('ok')), 'ok');
});

test('la salt propia hace que un blob de erp no se pueda leer acá', () => {
  // Blob válido en formato pero cifrado con otra derivación: tiene que fallar
  // el tag, no parsear como si fuera nuestro.
  const foreign = 'v1:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA==:AAAA';
  assert.equal(tryDecryptSecret(foreign), null);
});

test('maskSecret muestra los últimos 4 sólo si el secreto es largo', () => {
  assert.equal(maskSecret('abcdefghijkl'), '••••ijkl');
  assert.equal(maskSecret('12345678'), '••••5678');
  assert.equal(maskSecret('corto'), '••••');
  assert.equal(maskSecret(''), null);
  assert.equal(maskSecret(null), null);
});
