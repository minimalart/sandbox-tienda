import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { buildJpegUrl, readJpegTarget } from './image-proxy';

/**
 * La firma es lo único que separa al conversor de ser un proxy abierto, así que se
 * prueba por los dos lados: que lo que firma el backend se acepte, y que nada que no
 * haya firmado el backend entre.
 */

const params = (url: string): { u?: string; s?: string } => {
  const query = new URL(url).searchParams;
  return { u: query.get('u') ?? undefined, s: query.get('s') ?? undefined };
};

describe('image-proxy', () => {
  const previous = { ...process.env };

  beforeEach(() => {
    process.env.BACKEND_URL = 'https://back.test';
    process.env.JWT_SECRET = 'secreto-de-prueba';
    delete process.env.MEDUSA_BACKEND_URL;
    delete process.env.COOKIE_SECRET;
  });

  afterEach(() => {
    process.env = { ...previous };
  });

  test('ida y vuelta: lo que firma el backend se acepta', () => {
    const original = 'https://cdn.test/carpeta/foto con espacio.webp?v=1&x=2';
    const signed = buildJpegUrl(original);
    assert.ok(signed);
    assert.equal(readJpegTarget(params(signed)), original);
  });

  test('una URL sin firmar no entra', () => {
    const u = Buffer.from('http://169.254.169.254/latest/meta-data/', 'utf8').toString('base64url');
    assert.equal(readJpegTarget({ u, s: 'a'.repeat(32) }), null);
    assert.equal(readJpegTarget({ u }), null);
    assert.equal(readJpegTarget({}), null);
  });

  /** Cambiar el destino invalida la firma: es el ataque que la firma existe para frenar. */
  test('la firma de una imagen no sirve para otra URL', () => {
    const signed = buildJpegUrl('https://cdn.test/a.webp');
    assert.ok(signed);
    const { s } = params(signed);
    const otra = Buffer.from('http://localhost:9200/_cat/indices', 'utf8').toString('base64url');
    assert.equal(readJpegTarget({ u: otra, s }), null);
  });

  test('sólo http y https', () => {
    assert.equal(buildJpegUrl('file:///etc/passwd'), null);
    assert.equal(buildJpegUrl('data:image/webp;base64,AAAA'), null);
  });

  test('sin secreto no se firma ni se acepta nada', () => {
    delete process.env.JWT_SECRET;
    assert.equal(buildJpegUrl('https://cdn.test/a.webp'), null);
    assert.equal(readJpegTarget({ u: 'aaa', s: 'b'.repeat(32) }), null);
  });

  test('sin URL pública del backend no hay conversor', () => {
    delete process.env.BACKEND_URL;
    assert.equal(buildJpegUrl('https://cdn.test/a.webp'), null);
    // `MEDUSA_BACKEND_URL` sirve igual: es el par que ya usa el resto del backend.
    process.env.MEDUSA_BACKEND_URL = 'https://otro.test';
    assert.ok(buildJpegUrl('https://cdn.test/a.webp')?.startsWith('https://otro.test/whatsapp-image'));
  });

  test('el COOKIE_SECRET alcanza cuando no hay JWT_SECRET', () => {
    delete process.env.JWT_SECRET;
    process.env.COOKIE_SECRET = 'otro-secreto';
    const signed = buildJpegUrl('https://cdn.test/a.webp');
    assert.ok(signed);
    assert.equal(readJpegTarget(params(signed)), 'https://cdn.test/a.webp');
  });
});
