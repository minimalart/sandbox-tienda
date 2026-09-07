import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractLatLng } from './geo.ts';

describe('extractLatLng — normalización de coordenadas', () => {
  it('acepta lat/lng como números', () => {
    assert.deepEqual(extractLatLng({ lat: -34.6037, lng: -58.3816 }), {
      lat: -34.6037,
      lng: -58.3816,
    });
  });

  it('acepta latitude/longitude como strings', () => {
    assert.deepEqual(
      extractLatLng({ latitude: '-34.6037', longitude: '-58.3816' }),
      { lat: -34.6037, lng: -58.3816 },
    );
  });

  it('prioriza lat/lng sobre latitude/longitude', () => {
    assert.deepEqual(
      extractLatLng({
        lat: -34.6,
        lng: -58.4,
        latitude: 10,
        longitude: 20,
      }),
      { lat: -34.6, lng: -58.4 },
    );
  });

  it('acepta mezcla: lat number + longitude string', () => {
    assert.deepEqual(
      extractLatLng({ lat: -34.6, longitude: '-58.4' }),
      { lat: -34.6, lng: -58.4 },
    );
  });

  it('cae a latitude/longitude cuando lat/lng faltan', () => {
    assert.deepEqual(
      extractLatLng({ latitude: 40.7128, longitude: -74.006 }),
      { lat: 40.7128, lng: -74.006 },
    );
  });

  it('acepta 0,0 como coordenada válida', () => {
    assert.deepEqual(extractLatLng({ lat: 0, lng: 0 }), { lat: 0, lng: 0 });
  });

  it('devuelve null si falta lng', () => {
    assert.equal(extractLatLng({ lat: -34.6 }), null);
  });

  it('devuelve null si falta lat', () => {
    assert.equal(extractLatLng({ lng: -58.4 }), null);
  });

  it('devuelve null para objeto vacío', () => {
    assert.equal(extractLatLng({}), null);
  });

  it('devuelve null para metadata no-objeto', () => {
    assert.equal(extractLatLng(null), null);
    assert.equal(extractLatLng(undefined), null);
    assert.equal(extractLatLng('foo'), null);
    assert.equal(extractLatLng(42), null);
    assert.equal(extractLatLng([1, 2]), null);
  });

  it('devuelve null para strings no parseables', () => {
    assert.equal(extractLatLng({ lat: 'abc', lng: 'def' }), null);
    assert.equal(extractLatLng({ lat: '', lng: '' }), null);
  });

  it('devuelve null para lat fuera de rango', () => {
    assert.equal(extractLatLng({ lat: 91, lng: 0 }), null);
    assert.equal(extractLatLng({ lat: -90.1, lng: 0 }), null);
  });

  it('devuelve null para lng fuera de rango', () => {
    assert.equal(extractLatLng({ lat: 0, lng: 180.5 }), null);
    assert.equal(extractLatLng({ lat: 0, lng: -181 }), null);
  });

  it('acepta los límites exactos del rango', () => {
    assert.deepEqual(extractLatLng({ lat: 90, lng: 180 }), {
      lat: 90,
      lng: 180,
    });
    assert.deepEqual(extractLatLng({ lat: -90, lng: -180 }), {
      lat: -90,
      lng: -180,
    });
  });

  it('devuelve null para NaN explícito', () => {
    assert.equal(extractLatLng({ lat: NaN, lng: 0 }), null);
  });
});
