import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { extensionForMime, processTechnical, NORMALIZE_MAX_SIDE } from './images.ts';

/**
 * Regresiones del procesamiento técnico.
 *
 * Estos tests existen por un bug concreto: las cuatro operaciones de la UI
 * ("Convertir a WebP", "Comprimir", "Redimensionar", "Normalizar") colapsaban en un
 * único ternario `normalize ? normalizeSquareWebp : optimizeToWebp`, así que marcar
 * una sola daba byte por byte el mismo resultado que marcar tres, y "Comprimir" NO
 * aplicaba `max_kb` en cuanto "Normalizar" estaba tildado — el caso por defecto de
 * la UI. Lo que se afirma acá es justamente que cada etapa es independiente.
 */

const CONFIG = { quality: 82, maxKb: 200, maxDimension: 1600 };

/**
 * JPEG ruidoso y grande: el ruido pseudoaleatorio es lo que hace que NO comprima
 * fácil, así que el loop de calidad tiene que trabajar de verdad. Con un degradado
 * suave cualquier calidad entraría en `max_kb` y los tests pasarían sin probar nada.
 */
async function noisyJpeg(width = 2400, height = 1800): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) % 256;
  return sharp(raw, { raw: { width, height, channels: 3 } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

/** PNG con un círculo opaco sobre fondo transparente. */
async function transparentPng(size = 600): Promise<Buffer> {
  const raw = Buffer.alloc(size * size * 4);
  const c = size / 2;
  for (let i = 0; i < size * size; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    raw[i * 4] = 220;
    raw[i * 4 + 1] = 40;
    raw[i * 4 + 2] = 40;
    raw[i * 4 + 3] = Math.hypot(x - c, y - c) < size / 3 ? 255 : 0;
  }
  return sharp(raw, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toBuffer();
}

test('sólo "resize" reescala y NO comprime al peso objetivo', async () => {
  const src = await noisyJpeg();
  const out = await processTechnical(src, { ops: ['resize'], ...CONFIG });

  assert.equal(out.width, 1600, 'acota el lado mayor a max_dimension');
  assert.equal(out.height, 1200, 'mantiene la relación de aspecto');
  // Lo que define a esta operación: sin "compress" no hay loop, así que puede
  // (y debe poder) quedar por encima de max_kb.
  assert.ok(out.bytes > CONFIG.maxKb * 1024, 'sin "compress" no se persigue max_kb');
  assert.equal(out.targetKbMissed, false, 'no se reporta objetivo incumplido si no se pidió comprimir');
});

test('sólo "compress" respeta el peso objetivo y NO reescala', async () => {
  // Imagen chica: acá el objetivo SÍ es alcanzable, así que se puede afirmar el peso.
  const src = await noisyJpeg(900, 700);
  const out = await processTechnical(src, { ops: ['compress'], ...CONFIG });

  assert.equal(out.width, 900, 'no toca el ancho');
  assert.equal(out.height, 700, 'no toca el alto');
  assert.ok(out.bytes <= CONFIG.maxKb * 1024, `debe entrar en max_kb (dio ${out.bytes} bytes)`);
  assert.equal(out.targetKbMissed, false);
});

test('sin "to_webp" se conserva el formato de origen; con él, sale WebP', async () => {
  const src = await noisyJpeg(800, 600);

  const kept = await processTechnical(src, { ops: ['resize'], ...CONFIG });
  assert.equal(kept.format, 'jpeg', 'un JPEG de origen sigue siendo JPEG');
  assert.equal(kept.mimeType, 'image/jpeg');

  const converted = await processTechnical(src, { ops: ['resize', 'to_webp'], ...CONFIG });
  assert.equal(converted.format, 'webp');
  assert.equal(converted.mimeType, 'image/webp');
});

test('"normalize" + "compress" deja el cuadrado Y respeta max_kb', async () => {
  // LA regresión del síntoma "comprimir no se sabe si funciona": con el ternario
  // viejo `normalize` ganaba y `max_kb` no se aplicaba NUNCA.
  //
  // El umbral de 200KB discrimina de verdad: esta misma imagen sin la etapa de
  // compresión —o sea, lo que producía el código viejo— pesa 266KB. Con la etapa,
  // el loop la deja en ~189KB. Un umbral más holgado pasaría también con el bug.
  const src = await noisyJpeg();
  const out = await processTechnical(src, {
    ops: ['normalize', 'compress', 'to_webp'],
    maxKb: 200,
    quality: 82,
    maxDimension: 1600,
  });

  assert.equal(out.width, out.height, 'el lienzo es cuadrado');
  assert.equal(out.width, NORMALIZE_MAX_SIDE, 'el lienzo respeta el tope de normalize');
  assert.ok(out.bytes <= 200 * 1024, `debe entrar en max_kb=200 (dio ${Math.round(out.bytes / 1024)}KB)`);
  assert.equal(out.targetKbMissed, false, 'el objetivo era alcanzable, así que no debe marcarse incumplido');
  assert.ok(out.quality < 82, 'el loop bajó la calidad: sin él quedaría en 266KB');
});

test('cada combinación de operaciones da un resultado DISTINTO', async () => {
  const src = await noisyJpeg(1200, 900);
  const fingerprint = async (ops: string[]) => {
    const out = await processTechnical(src, { ops, ...CONFIG, maxDimension: 800 });
    return `${out.width}x${out.height}|${out.format}|${out.bytes}`;
  };

  const onlyResize = await fingerprint(['resize']);
  const onlyCompress = await fingerprint(['compress']);
  const onlyWebp = await fingerprint(['to_webp']);
  const onlyNormalize = await fingerprint(['normalize']);

  const all = [onlyResize, onlyCompress, onlyWebp, onlyNormalize];
  assert.equal(new Set(all).size, all.length, `las 4 operaciones deben diferir, dieron: ${all.join(' / ')}`);
});

test('"compress" reporta cuando no alcanza el objetivo en vez de callarse', async () => {
  const src = await noisyJpeg();
  // 5KB para una imagen ruidosa de 2400x1800 es inalcanzable sin reescalar.
  const out = await processTechnical(src, { ops: ['compress'], quality: 82, maxKb: 5, maxDimension: 1600 });

  assert.equal(out.targetKbMissed, true, 'se marca el objetivo incumplido');
  assert.ok(out.bytes > 5 * 1024);
  // Se afirma el invariante ("llegó al piso") y no un número exacto: el loop baja de
  // a 5 desde 82, así que cruza el piso de 20 y termina en 17.
  assert.ok(out.quality <= 20, `se bajó hasta el piso de calidad antes de rendirse (quedó en ${out.quality})`);
});

test('"resize" preserva el canal alfa de un PNG', async () => {
  // Sin `to_webp` se conserva el formato de origen, así que un PNG con transparencia
  // sigue siendo PNG y NO se aplana. Es lo que hace que recortes con fondo
  // transparente sobrevivan al procesamiento técnico.
  const src = await transparentPng();

  const out = await processTechnical(src, { ops: ['resize'], ...CONFIG, maxDimension: 400 });
  assert.equal(out.format, 'png');
  assert.equal(out.width, 400);
  assert.equal((await sharp(out.buffer).metadata()).hasAlpha, true, 'el alfa sobrevive al resize');
});

test('"to_webp" sobre un PNG transparente conserva la transparencia', async () => {
  // WebP soporta alfa, así que convertir no debe aplanar. La combinación
  // alfa + JPEG no es alcanzable acá (un JPEG de origen nunca tiene alfa, y un PNG
  // con alfa conserva su formato), y por eso no se testea.
  const out = await processTechnical(await transparentPng(), {
    ops: ['to_webp', 'resize'],
    ...CONFIG,
    maxDimension: 300,
  });

  assert.equal(out.format, 'webp');
  assert.equal((await sharp(out.buffer).metadata()).hasAlpha, true, 'el alfa sobrevive a la conversión');
});

test('"normalize" nunca supera su tope aunque max_dimension sea mayor', async () => {
  const src = await noisyJpeg(3000, 3000);
  const out = await processTechnical(src, { ops: ['normalize'], quality: 82, maxKb: 5000, maxDimension: 4000 });

  assert.equal(out.width, NORMALIZE_MAX_SIDE);
  assert.equal(out.height, NORMALIZE_MAX_SIDE);
});

test('extensionForMime deriva la extensión y cae a webp ante lo desconocido', () => {
  assert.equal(extensionForMime('image/webp'), 'webp');
  assert.equal(extensionForMime('image/jpeg'), 'jpg');
  assert.equal(extensionForMime('image/png'), 'png');
  assert.equal(extensionForMime('image/avif'), 'avif');
  // El fallback importa: `uploadResult` arma el filename con esto, y una extensión
  // vacía o inventada produciría objetos que ningún consumidor sabe leer.
  assert.equal(extensionForMime('image/gif'), 'webp');
  assert.equal(extensionForMime(''), 'webp');
});
