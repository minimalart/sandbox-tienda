import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifyImageHead, isSendableVerdict } from './safe-image';

/**
 * Fixtures de cabecera. Se arman a mano porque lo único que mira el clasificador son
 * los primeros bytes: así el test no necesita red ni archivos binarios en el repo.
 */

const pad = (bytes: number[]): Uint8Array => {
  const out = new Uint8Array(32);
  out.set(bytes);
  return out;
};

const ascii = (text: string): number[] => [...text].map((c) => c.charCodeAt(0));

const JPEG = pad([0xff, 0xd8, 0xff, 0xe0]);
const PNG = pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = pad(ascii('GIF89a'));

/** RIFF + 4 bytes de tamaño + WEBP + chunk (+ flags si es VP8X). */
const webp = (chunk: string, flags?: number): Uint8Array =>
  pad([
    ...ascii('RIFF'),
    0x20,
    0x00,
    0x00,
    0x00,
    ...ascii('WEBP'),
    ...ascii(chunk),
    ...(flags === undefined ? [] : [flags]),
  ]);

describe('classifyImageHead', () => {
  test('reconoce lo que Meta acepta', () => {
    assert.equal(classifyImageHead(JPEG), 'jpeg');
    assert.equal(classifyImageHead(PNG), 'png');
    assert.equal(classifyImageHead(webp('VP8 ')), 'webp_static');
    assert.equal(classifyImageHead(webp('VP8L')), 'webp_static');
  });

  /**
   * El caso real del 2026-08-04: `REVESTA_4040-…JPG`, servida como `image/jpeg`, era
   * un WebP con VP8X y el flag ANIM. Meta la rechazó con el error 131053 y se cayó el
   * carrusel entero — las otras dos pinturas tampoco llegaron.
   */
  test('el WebP ANIMADO no es enviable, aunque se llame .JPG', () => {
    assert.equal(classifyImageHead(webp('VP8X', 0x02)), 'animated_webp');
    assert.equal(isSendableVerdict('animated_webp'), false);
    // El mismo VP8X sin el bit de animación sí sirve (extendido con EXIF/alpha).
    assert.equal(classifyImageHead(webp('VP8X', 0x08)), 'webp_static');
    assert.equal(classifyImageHead(webp('VP8X', 0x10)), 'webp_static');
    // ANIM combinado con otros flags sigue siendo animado.
    assert.equal(classifyImageHead(webp('VP8X', 0x0a)), 'animated_webp');
  });

  test('descarta formatos que Meta no decodifica', () => {
    assert.equal(classifyImageHead(GIF), 'unsupported');
    assert.equal(classifyImageHead(pad(ascii('<!DOCTYPE html><html>'))), 'unsupported');
    assert.equal(classifyImageHead(pad(ascii('<svg xmlns='))), 'unsupported');
    assert.equal(classifyImageHead(webp('XXXX')), 'unsupported');
    // RIFF que no es WEBP (un AVI, por ejemplo).
    assert.equal(
      classifyImageHead(pad([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('AVI ')])),
      'unsupported',
    );
  });

  test('una respuesta truncada no se declara válida', () => {
    assert.equal(classifyImageHead(new Uint8Array([0xff, 0xd8, 0xff])), 'unsupported');
    assert.equal(classifyImageHead(new Uint8Array()), 'unsupported');
  });

  test('isSendableVerdict acepta exactamente los tres formatos de Meta', () => {
    assert.deepEqual(
      (['jpeg', 'png', 'webp_static', 'animated_webp', 'unsupported'] as const).filter(
        isSendableVerdict,
      ),
      ['jpeg', 'png', 'webp_static'],
    );
  });
});
