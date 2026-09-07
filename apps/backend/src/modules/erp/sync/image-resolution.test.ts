import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { isImageTooSmall, readImageDimensions } from './apply-product-images.ts';

/** Un PNG sólido del tamaño pedido, para medirlo de verdad y no mockear sharp. */
const png = (width: number, height: number): Promise<Buffer> =>
  sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .png()
    .toBuffer();

describe('isImageTooSmall', () => {
  /**
   * El caso que motivó el gate: Zeus devolvió 160×160 para los Satinol (SKU
   * 660-663) y el storefront los estiró hasta la card, a 2-5× su tamaño.
   */
  it('descarta la foto de 160x160 que llegó pixelada al storefront', () => {
    assert.equal(isImageTooSmall({ width: 160, height: 160 }, 500), true);
  });

  it('deja pasar la foto grande de la misma línea', () => {
    assert.equal(isImageTooSmall({ width: 1512, height: 1512 }, 500), false);
  });

  it('el umbral es inclusivo: justo en el mínimo pasa', () => {
    assert.equal(isImageTooSmall({ width: 500, height: 500 }, 500), false);
    assert.equal(isImageTooSmall({ width: 499, height: 500 }, 500), true);
  });

  /**
   * Se mira el lado MENOR y no el área ni el ancho: la card es cuadrada o
   * vertical y el CSS estira hasta llenarla, así que una panorámica de 150 px de
   * alto se ve tan rota como un cuadrado de 150.
   */
  it('una panorámica ancha pero baja se descarta igual', () => {
    assert.equal(isImageTooSmall({ width: 1600, height: 150 }, 500), true);
  });

  /**
   * Sin dimensiones no hay veredicto, y sin veredicto la imagen pasa: el gate
   * frena lo que se MIDE mal, no lo que no se puede medir.
   */
  it('sin dimensiones legibles, pasa', () => {
    assert.equal(isImageTooSmall(null, 500), false);
  });

  it('un umbral en cero apaga el gate', () => {
    assert.equal(isImageTooSmall({ width: 16, height: 16 }, 0), false);
  });
});

describe('readImageDimensions', () => {
  it('lee alto y ancho de un PNG real', async () => {
    assert.deepEqual(await readImageDimensions(await png(160, 160)), {
      width: 160,
      height: 160,
    });
  });

  it('lee alto y ancho de un JPEG no cuadrado', async () => {
    const jpeg = await sharp(await png(878, 1000)).jpeg().toBuffer();
    assert.deepEqual(await readImageDimensions(jpeg), { width: 878, height: 1000 });
  });

  /** Un formato ilegible no puede tumbar la fase: devuelve null y la foto pasa. */
  it('devuelve null con bytes que no son una imagen', async () => {
    assert.equal(await readImageDimensions(Buffer.from('no soy una imagen')), null);
  });

  it('devuelve null con un buffer vacío', async () => {
    assert.equal(await readImageDimensions(Buffer.alloc(0)), null);
  });
});
