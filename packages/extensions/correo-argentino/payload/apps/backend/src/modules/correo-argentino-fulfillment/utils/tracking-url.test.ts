/**
 * La URL de seguimiento se le muestra al COMPRADOR (WhatsApp, detalle de orden),
 * así que una base mal armada no rompe nada del lado nuestro: produce un link
 * que no lleva a ninguna parte y que nadie se entera hasta que alguien lo clickea.
 *
 * Por eso el resolver es conservador: ante un valor dudoso prefiere el default
 * conocido antes que construir un link roto.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CORREO_DEFAULT_TRACKING_BASE_URL,
  buildCorreoTrackingUrl,
  resolveCorreoTrackingBaseUrl,
} from './tracking-url.ts';

describe('resolveCorreoTrackingBaseUrl', () => {
  it('sin la variable usa el default', () => {
    assert.equal(resolveCorreoTrackingBaseUrl({}), CORREO_DEFAULT_TRACKING_BASE_URL);
  });

  it('vacío o solo espacios cae al default', () => {
    assert.equal(
      resolveCorreoTrackingBaseUrl({ CORREO_ARGENTINO_TRACKING_BASE_URL: '   ' }),
      CORREO_DEFAULT_TRACKING_BASE_URL,
    );
  });

  it('respeta un override válido', () => {
    assert.equal(
      resolveCorreoTrackingBaseUrl({
        CORREO_ARGENTINO_TRACKING_BASE_URL: 'https://nuevo.correoargentino.com.ar/seguimiento',
      }),
      'https://nuevo.correoargentino.com.ar/seguimiento',
    );
  });

  it('saca el / final para que el ?id= no quede tras un doble slash', () => {
    assert.equal(
      resolveCorreoTrackingBaseUrl({
        CORREO_ARGENTINO_TRACKING_BASE_URL: 'https://x.example/seguimiento///',
      }),
      'https://x.example/seguimiento',
    );
  });

  it('acepta http:// además de https://', () => {
    assert.equal(
      resolveCorreoTrackingBaseUrl({
        CORREO_ARGENTINO_TRACKING_BASE_URL: 'http://interno.example/track',
      }),
      'http://interno.example/track',
    );
  });

  // El caso que justifica el resolver: media URL pegada a mano en un `.env`.
  // Mejor el default conocido que un link que no lleva a ninguna parte.
  it('IGNORA un valor sin esquema y usa el default', () => {
    for (const raw of ['www.correoargentino.com.ar/track', 'correoargentino.com.ar', '/track']) {
      assert.equal(
        resolveCorreoTrackingBaseUrl({ CORREO_ARGENTINO_TRACKING_BASE_URL: raw }),
        CORREO_DEFAULT_TRACKING_BASE_URL,
        raw,
      );
    }
  });
});

describe('buildCorreoTrackingUrl', () => {
  it('arma la URL con el default', () => {
    assert.equal(
      buildCorreoTrackingUrl('CA123'),
      `${CORREO_DEFAULT_TRACKING_BASE_URL}?id=CA123`,
    );
  });

  it('sin tracking number no devuelve URL', () => {
    assert.equal(buildCorreoTrackingUrl(''), undefined);
    assert.equal(buildCorreoTrackingUrl('   '), undefined);
    assert.equal(buildCorreoTrackingUrl(null), undefined);
    assert.equal(buildCorreoTrackingUrl(undefined), undefined);
  });

  it('escapa el TN', () => {
    assert.match(buildCorreoTrackingUrl('CA 1&2') ?? '', /\?id=CA%201%262$/);
  });

  it('usa la base que se le pasa', () => {
    assert.equal(
      buildCorreoTrackingUrl('CA123', 'https://x.example/t'),
      'https://x.example/t?id=CA123',
    );
  });
});
