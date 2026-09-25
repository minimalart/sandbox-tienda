import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';

import { buildJpegUrl } from '../../lib/whatsapp/image-proxy';
import { GET } from './route';

/**
 * La ruta que descarga META. No se puede probar con Meta adelante, así que se prueba
 * lo que sí es nuestro: que sin firma no descargue nada, y que lo que devuelve sea
 * un jpeg de verdad (por los BYTES, que es la lección de `safe-image.ts`).
 */

type Sent = { status: number; headers: Record<string, string>; body: unknown };

const fakeRes = (out: Sent) =>
  ({
    setHeader: (key: string, value: string) => {
      out.headers[key.toLowerCase()] = value;
    },
    status: (code: number) => {
      out.status = code;
      return fakeRes(out);
    },
    send: (body: unknown) => {
      out.body = body;
    },
  }) as never;

const paramsOf = (signed: string) => {
  const query = new URL(signed).searchParams;
  return { u: query.get('u'), s: query.get('s') };
};

describe('GET /whatsapp-image', () => {
  const previous = { ...process.env };
  const realFetch = globalThis.fetch;
  let webpBytes: Buffer;

  beforeEach(async () => {
    process.env.BACKEND_URL = 'https://back.test';
    process.env.JWT_SECRET = 'secreto-de-prueba';
    // Un webp de verdad, generado acá: el test no depende de ningún archivo ni de la red.
    webpBytes = await sharp({
      create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .webp()
      .toBuffer();
  });

  afterEach(() => {
    process.env = { ...previous };
    globalThis.fetch = realFetch;
  });

  test('sin firma válida no se descarga nada', async () => {
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response('');
    }) as typeof globalThis.fetch;

    const out: Sent = { status: 200, headers: {}, body: null };
    await GET({ query: { u: 'aaa', s: 'b'.repeat(32) } } as never, fakeRes(out));

    assert.equal(out.status, 403);
    assert.equal(fetched, false, 'no tiene que salir a la red con una firma inválida');
  });

  test('un webp firmado vuelve como jpeg', async () => {
    globalThis.fetch = (async () =>
      new Response(webpBytes, { status: 200 })) as typeof globalThis.fetch;

    const signed = buildJpegUrl('https://cdn.test/a.webp');
    assert.ok(signed);
    const out: Sent = { status: 200, headers: {}, body: null };
    await GET({ query: paramsOf(signed) } as never, fakeRes(out));

    assert.equal(out.status, 200);
    assert.equal(out.headers['content-type'], 'image/jpeg');
    assert.match(out.headers['cache-control'] ?? '', /immutable/);
    const body = out.body as Buffer;
    assert.equal(body.subarray(0, 3).toString('hex'), 'ffd8ff', 'los bytes tienen que ser JPEG');
    // El alfa del webp se aplana a blanco: en jpeg no existe, y sin esto sale negro.
    const { channels, hasAlpha } = await sharp(body).metadata();
    assert.equal(hasAlpha, false);
    assert.equal(channels, 3);
  });

  test('si el original no está, no se inventa una imagen', async () => {
    globalThis.fetch = (async () =>
      new Response('no such key', { status: 404 })) as typeof globalThis.fetch;

    const signed = buildJpegUrl('https://cdn.test/a.webp');
    assert.ok(signed);
    const out: Sent = { status: 200, headers: {}, body: null };
    await GET({ query: paramsOf(signed) } as never, fakeRes(out));

    assert.equal(out.status, 502);
    assert.equal(out.headers['content-type'], undefined);
  });
});
