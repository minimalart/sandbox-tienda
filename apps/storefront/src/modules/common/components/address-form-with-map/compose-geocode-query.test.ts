import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composeGeocodeQuery } from './compose-geocode-query.ts';

const empty = { address1: '', city: '', province: '', postalCode: '' };

describe('composeGeocodeQuery', () => {
  it('sin calle no arma query', () => {
    assert.equal(
      composeGeocodeQuery({ ...empty, city: 'CABA', province: 'Buenos Aires', postalCode: '1414' }),
      null
    );
  });

  it('calle por debajo del umbral (menos de 6 caracteres útiles) no arma query', () => {
    // "Av 1" → alfanuméricos "Av1" = 3 caracteres, bajo el umbral de 6.
    assert.equal(composeGeocodeQuery({ ...empty, address1: 'Av 1' }), null);
  });

  it('calle justo un caracter bajo el umbral tampoco alcanza', () => {
    // "Peru 1" → alfanuméricos "Peru1" = 5 caracteres.
    assert.equal(composeGeocodeQuery({ ...empty, address1: 'Peru 1' }), null);
  });

  it('calle que llega justo al umbral arma la query', () => {
    // "Peru 12" → alfanuméricos "Peru12" = 6 caracteres, exactamente el umbral.
    assert.equal(composeGeocodeQuery({ ...empty, address1: 'Peru 12' }), 'Peru 12, Argentina');
  });

  it('compone calle, ciudad, provincia, código postal y país en ese orden', () => {
    assert.equal(
      composeGeocodeQuery({
        address1: 'Av. Corrientes 1234',
        city: 'CABA',
        province: 'Buenos Aires',
        postalCode: '1414',
      }),
      'Av. Corrientes 1234, CABA, Buenos Aires, 1414, Argentina'
    );
  });

  it('con sólo la calle igual arma query (ciudad/provincia/CP vacíos se omiten)', () => {
    assert.equal(
      composeGeocodeQuery({ ...empty, address1: 'Corrientes 1234' }),
      'Corrientes 1234, Argentina'
    );
  });

  it('recorta espacios de los bordes de cada campo', () => {
    assert.equal(
      composeGeocodeQuery({
        address1: '  Corrientes 1234  ',
        city: '  CABA  ',
        province: '',
        postalCode: '',
      }),
      'Corrientes 1234, CABA, Argentina'
    );
  });
});
