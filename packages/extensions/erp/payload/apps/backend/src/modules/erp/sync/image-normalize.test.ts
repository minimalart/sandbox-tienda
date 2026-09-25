import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { normalizeToCatalogFormat } from './apply-product-images.ts';

/**
 * Una foto sintética: un rectángulo oscuro de `w`×`h` centrado en un lienzo
 * blanco de `canvas`×`canvas`. Es la forma de la foto de catálogo real — el
 * producto rodeado de blanco — y permite medir el recorte sin mockear sharp.
 */
const photo = async (canvas: number, w: number, h: number, colour = 40): Promise<Buffer> => {
  const subject = await sharp({
    create: { width: w, height: h, channels: 3, background: { r: colour, g: colour, b: colour } },
  })
    .png()
    .toBuffer();
  return sharp({ create: { width: canvas, height: canvas, channels: 3, background: '#ffffff' } })
    .composite([{ input: subject, gravity: 'centre' }])
    .png()
    .toBuffer();
};

/** La misma métrica con la que está medido el catálogo: luminancia contra blanco. */
const occupancy = async (buf: Buffer): Promise<number> => {
  const { data, info } = await sharp(buf).flatten({ background: '#ffffff' }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (255 - lum > 12) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return 0;
  return Math.max(right - left + 1, bottom - top + 1) / Math.max(width, height);
};

describe('normalizeToCatalogFormat', () => {
  /**
   * El caso que rompió la grilla: 180 fotos cuadradas, blancas y del mismo
   * tamaño en píxeles que AUN ASÍ se veían de tamaños distintos, porque el
   * producto ocupaba entre el 50% y el 100% del cuadrado.
   */
  it('deja el producto al 84% del lienzo venga con el aire que venga', async () => {
    for (const canvas of [1000, 600, 2200]) {
      const out = await normalizeToCatalogFormat(await photo(canvas, 300, 300));
      assert.ok(out);
      const got = await occupancy(out.content);
      assert.ok(Math.abs(got - 0.84) < 0.02, `lienzo ${canvas}: ocupación ${got}`);
    }
  });

  it('una foto que ya venía justa también queda al 84%, no al 100%', async () => {
    const out = await normalizeToCatalogFormat(await photo(400, 400, 400));
    assert.ok(out);
    assert.ok(Math.abs((await occupancy(out.content)) - 0.84) < 0.02);
  });

  it('el resultado es cuadrado aunque el original no lo sea', async () => {
    const out = await normalizeToCatalogFormat(await photo(1200, 352, 1100));
    assert.ok(out);
    const { width, height } = await sharp(out.content).metadata();
    assert.equal(width, height);
  });

  /**
   * Sin upscale: el lienzo sale del contenido recortado, así que el resultado
   * puede ser MÁS CHICO que el original. Por eso el gate de resolución mide
   * esto y no la descarga cruda.
   */
  it('no hace upscale: un producto chico en un lienzo grande achica el resultado', async () => {
    const out = await normalizeToCatalogFormat(await photo(1000, 300, 300));
    assert.ok(out);
    const { width } = await sharp(out.content).metadata();
    assert.equal(width, Math.round(300 / 0.84));
  });

  it('sale WebP con fondo blanco opaco', async () => {
    const out = await normalizeToCatalogFormat(await photo(800, 400, 400));
    assert.ok(out);
    assert.equal(out.mimeType, 'image/webp');
    assert.equal(out.extension, 'webp');
    const meta = await sharp(out.content).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.hasAlpha, false);
  });

  /**
   * Un lienzo enteramente blanco no tiene contenido que centrar. Devuelve
   * `null` y el llamador publica los bytes originales: normalizar es una
   * mejora, no un requisito para publicar.
   */
  it('devuelve null si no hay contenido que recortar', async () => {
    const blank = await sharp({
      create: { width: 300, height: 300, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    assert.equal(await normalizeToCatalogFormat(blank), null);
  });

  it('devuelve null si los bytes no son una imagen', async () => {
    assert.equal(await normalizeToCatalogFormat(Buffer.from('no soy una imagen')), null);
  });

  /**
   * Canal por canal detectaría este gris muy claro como contenido y acolcharía
   * de más; en luminancia queda por debajo del umbral, igual que en el
   * verificador con el que está medido el catálogo.
   */
  it('mide luminancia: un borde casi blanco no cuenta como contenido', async () => {
    const soft = await sharp({
      create: { width: 600, height: 600, channels: 3, background: { r: 251, g: 251, b: 251 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: 200, height: 200, channels: 3, background: { r: 30, g: 30, b: 30 } },
          })
            .png()
            .toBuffer(),
          gravity: 'centre',
        },
      ])
      .png()
      .toBuffer();
    const out = await normalizeToCatalogFormat(soft);
    assert.ok(out);
    const { width } = await sharp(out.content).metadata();
    assert.equal(width, Math.round(200 / 0.84));
  });
});
