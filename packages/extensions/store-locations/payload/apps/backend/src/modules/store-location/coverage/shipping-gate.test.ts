import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCoordinates,
  filterOptionsByCoverage,
  isOwnFleetHomeOption,
  OWN_FLEET_PROVIDER_ID,
  type CoverageShippingOption,
} from './shipping-gate.ts';

const ownFleetHome: CoverageShippingOption = { id: 'so_flota', provider_id: OWN_FLEET_PROVIDER_ID };
const storePickup: CoverageShippingOption = {
  id: 'so_retiro_tienda',
  provider_id: OWN_FLEET_PROVIDER_ID,
  data: { pickup_kind: 'store' },
};
const carrierPickup: CoverageShippingOption = {
  id: 'so_retiro_andreani',
  provider_id: 'andreani_andreani',
  data: { pickup_kind: 'carrier' },
};
const andreani: CoverageShippingOption = { id: 'so_andreani', provider_id: 'andreani_andreani' };
const correo: CoverageShippingOption = {
  id: 'so_correo',
  provider_id: 'correo_argentino_correo_argentino',
};

describe('isOwnFleetHomeOption', () => {
  it('reconoce la flota propia a domicilio', () => {
    assert.equal(isOwnFleetHomeOption(ownFleetHome), true);
  });

  it('trata como domicilio el data sin pickup_kind y el pickup_kind vacío', () => {
    assert.equal(isOwnFleetHomeOption({ ...ownFleetHome, data: {} }), true);
    assert.equal(isOwnFleetHomeOption({ ...ownFleetHome, data: { pickup_kind: '  ' } }), true);
    assert.equal(isOwnFleetHomeOption({ ...ownFleetHome, data: null }), true);
  });

  it('no reconoce retiro ni carriers', () => {
    assert.equal(isOwnFleetHomeOption(storePickup), false);
    assert.equal(isOwnFleetHomeOption(carrierPickup), false);
    assert.equal(isOwnFleetHomeOption(andreani), false);
    assert.equal(isOwnFleetHomeOption(correo), false);
  });
});

describe('filterOptionsByCoverage', () => {
  const options = [ownFleetHome, storePickup, carrierPickup, andreani, correo];

  it('con cobertura no filtra nada y devuelve el mismo array', () => {
    const result = filterOptionsByCoverage(options, true);
    assert.equal(result, options);
    assert.deepEqual(
      result.map((o) => o.id),
      ['so_flota', 'so_retiro_tienda', 'so_retiro_andreani', 'so_andreani', 'so_correo']
    );
  });

  it('sin cobertura descarta SÓLO la flota propia a domicilio', () => {
    assert.deepEqual(
      filterOptionsByCoverage(options, false).map((o) => o.id),
      ['so_retiro_tienda', 'so_retiro_andreani', 'so_andreani', 'so_correo']
    );
  });

  it('sin cobertura conserva el retiro (tienda y carrier): es la salida del cliente fuera del polígono', () => {
    assert.deepEqual(
      filterOptionsByCoverage([storePickup, carrierPickup], false).map((o) => o.id),
      ['so_retiro_tienda', 'so_retiro_andreani']
    );
  });

  it('sin cobertura conserva Andreani y Correo: su cobertura es nacional', () => {
    assert.deepEqual(
      filterOptionsByCoverage([andreani, correo], false).map((o) => o.id),
      ['so_andreani', 'so_correo']
    );
  });

  it('sin cobertura y sólo flota propia devuelve vacío', () => {
    assert.deepEqual(filterOptionsByCoverage([ownFleetHome], false), []);
  });
});

describe('extractCoordinates', () => {
  it('devuelve null cuando no hay dirección ni metadata', () => {
    assert.equal(extractCoordinates(null), null);
    assert.equal(extractCoordinates(undefined), null);
    assert.equal(extractCoordinates({}), null);
    assert.equal(extractCoordinates({ metadata: null }), null);
  });

  it('devuelve null con metadata vacío o incompleto', () => {
    assert.equal(extractCoordinates({ metadata: {} }), null);
    assert.equal(extractCoordinates({ metadata: { latitude: '-34.6' } }), null);
    assert.equal(extractCoordinates({ metadata: { latitude: '', longitude: '' } }), null);
  });

  it('devuelve null con valores no numéricos o fuera de rango', () => {
    assert.equal(extractCoordinates({ metadata: { latitude: 'ahí', longitude: 'nomás' } }), null);
    assert.equal(extractCoordinates({ metadata: { latitude: Number.NaN, longitude: -58.4 } }), null);
    assert.equal(extractCoordinates({ metadata: { latitude: 91, longitude: -58.4 } }), null);
  });

  it('acepta los strings que escribe Google Places', () => {
    assert.deepEqual(extractCoordinates({ metadata: { latitude: '-34.6037', longitude: '-58.3816' } }), {
      lat: '-34.6037',
      lng: '-58.3816',
    });
  });

  it('acepta números y los normaliza a string para GeoPoint', () => {
    assert.deepEqual(extractCoordinates({ metadata: { latitude: -34.6037, longitude: -58.3816 } }), {
      lat: '-34.6037',
      lng: '-58.3816',
    });
  });

  it('acepta también la convención lat/lng', () => {
    assert.deepEqual(extractCoordinates({ metadata: { lat: '-34.6', lng: '-58.4' } }), {
      lat: '-34.6',
      lng: '-58.4',
    });
  });
});
