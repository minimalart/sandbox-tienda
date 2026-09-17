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
  it('no repite la ciudad ni la provincia que la calle ya trae adentro', () => {
    // Caso real de DESDEELSUR-70: sin autocompletado de Places el comprador
    // escribe la dirección entera en el campo calle. La query vieja salía
    // "San Martín 300, 25 de Mayo, Neuquén, 25 de Mayo, Neuquén, Q8319,
    // Argentina" y Google la resolvía en Veinticinco de Mayo de MISIONES.
    assert.equal(
      composeGeocodeQuery({
        address1: 'San Martín 300, 25 de Mayo, Neuquén',
        city: '25 de Mayo',
        province: 'Neuquén',
        postalCode: 'Q8319',
      }),
      'San Martín 300, 25 de Mayo, Neuquén, Q8319, Argentina'
    );
  });

  it('compara sin tildes ni mayúsculas', () => {
    assert.equal(
      composeGeocodeQuery({
        address1: 'Belgrano 450, NEUQUEN',
        city: 'Neuquén',
        province: '',
        postalCode: '8300',
      }),
      'Belgrano 450, NEUQUEN, 8300, Argentina'
    );
  });

  it('una calle que CONTIENE el nombre de la ciudad no la borra de la query', () => {
    // "Av. Lima 500" es un solo segmento: no dice que la ciudad sea Lima.
    // Por eso la comparación es por segmento entero y no por substring.
    assert.equal(
      composeGeocodeQuery({
        address1: 'Av. Lima 500',
        city: 'Lima',
        province: 'Buenos Aires',
        postalCode: '1073',
      }),
      'Av. Lima 500, Lima, Buenos Aires, 1073, Argentina'
    );
  });

  it('ciudad y provincia con el mismo nombre se escriben una sola vez', () => {
    assert.equal(
      composeGeocodeQuery({
        address1: 'Avenida Argentina 120',
        city: 'Neuquén',
        province: 'Neuquén',
        postalCode: 'Q8300',
      }),
      'Avenida Argentina 120, Neuquén, Q8300, Argentina'
    );
  });
});
