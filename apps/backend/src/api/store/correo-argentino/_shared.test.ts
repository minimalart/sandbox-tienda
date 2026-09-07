import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePostalCode } from '../../../modules/correo-argentino-fulfillment/transformers/province-codes';
import {
  correoAgencyCacheKey,
  parseCorreoAgencyQuery,
  parseStorePostalCode,
  provinceIsoOrNull,
  sendCorreoStoreError,
} from './_shared';

describe('parseStorePostalCode', () => {
  it('acepta el CP de 4 dígitos', () => {
    assert.equal(parseStorePostalCode('1414'), '1414');
    assert.equal(parseStorePostalCode('  1414  '), '1414');
  });

  it('acepta el CPA completo y devuelve los 4 dígitos', () => {
    assert.equal(parseStorePostalCode('C1414AAF'), '1414');
    assert.equal(parseStorePostalCode('c1414aaf'), '1414');
    // CPA sin las tres letras finales.
    assert.equal(parseStorePostalCode('C1414'), '1414');
  });

  it('rechaza cualquier cosa que no sea CP ni CPA', () => {
    for (const input of ['abc', '', '   ', '123', '12345', 'CP 1414', '14-14']) {
      assert.equal(
        parseStorePostalCode(input),
        undefined,
        `"${input}" debería ser rechazado`
      );
    }
  });

  it('rechaza lo que no es string', () => {
    for (const input of [undefined, null, 1414, ['1414'], {}]) {
      assert.equal(parseStorePostalCode(input), undefined);
    }
  });

  it('NO es un alias de normalizePostalCode: ese helper no valida', () => {
    // La razón de existir de este wrapper. `normalizePostalCode` es un
    // NORMALIZADOR: cuando el regex del CPA no matchea devuelve el input tal cual
    // en mayúsculas, o sea que un `if (!normalizePostalCode(x))` en una ruta
    // nunca rechaza basura y el 400 lo termina tirando Correo.
    assert.equal(normalizePostalCode('abc'), 'ABC');
    assert.equal(parseStorePostalCode('abc'), undefined);
  });
});

describe('parseCorreoAgencyQuery — provincia', () => {
  const stateIdOf = (query: unknown): string | undefined => {
    const parsed = parseCorreoAgencyQuery(query);
    return parsed.ok ? parsed.query.state_id : undefined;
  };

  it('acepta la letra sola y la devuelve tal cual', () => {
    assert.equal(stateIdOf({ state_id: 'C' }), 'C');
    assert.equal(stateIdOf({ state_id: 'b' }), 'B');
  });

  it('acepta el ISO 3166-2 y lo convierte a la letra', () => {
    // ⚠️ Se acepta el ISO en la ENTRADA (el storefront lo tiene), pero a la API
    // de Correo va la LETRA. Que `/agencies` quiera la letra y no el ISO es una
    // INFERENCIA sin verificar; ver `buildAgencyParams()` en el módulo.
    assert.equal(stateIdOf({ state_id: 'AR-B' }), 'B');
    assert.equal(stateIdOf({ state_id: 'ar-c' }), 'C');
    assert.equal(stateIdOf({ state_id: ' AR-X ' }), 'X');
  });

  it('acepta el nombre y sus variantes del checkout', () => {
    assert.equal(stateIdOf({ province: 'Córdoba' }), 'X');
    assert.equal(stateIdOf({ province: 'CABA' }), 'C');
    assert.equal(stateIdOf({ province: 'Capital Federal' }), 'C');
    assert.equal(stateIdOf({ province: 'Buenos Aires' }), 'B');
    assert.equal(stateIdOf({ province: 'Río Negro' }), 'R');
    assert.equal(stateIdOf({ province: 'RIO NEGRO' }), 'R');
  });

  it('NUNCA confunde CABA (C) con Provincia de Buenos Aires (B)', () => {
    // `"buenosaires"` es substring de `"ciudadautonomadebuenosaires"`: un match
    // parcial mandaría los envíos de CABA a Provincia y viceversa.
    assert.equal(stateIdOf({ province: 'Buenos Aires' }), 'B');
    assert.equal(
      stateIdOf({ province: 'Ciudad Autónoma de Buenos Aires' }),
      'C'
    );
    assert.equal(stateIdOf({ state_id: 'AR-B' }), 'B');
    assert.equal(stateIdOf({ state_id: 'AR-C' }), 'C');
  });

  it('state_id tiene prioridad sobre province', () => {
    assert.equal(stateIdOf({ state_id: 'AR-X', province: 'CABA' }), 'X');
  });

  it('una provincia irreconocible es 400 INVALID_PROVINCE', () => {
    const parsed = parseCorreoAgencyQuery({ province: 'Montevideo' });
    assert.equal(parsed.ok, false);
    assert.equal(parsed.ok === false && parsed.error.code, 'INVALID_PROVINCE');
  });

  it('una letra que no es código de provincia es 400', () => {
    // `I` y `O` no existen en la tabla de Correo.
    assert.equal(parseCorreoAgencyQuery({ state_id: 'I' }).ok, false);
  });

  it('sin provincia el filtro simplemente no está', () => {
    const parsed = parseCorreoAgencyQuery({ postal_code: '1414' });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.ok && parsed.query.state_id, undefined);
  });

  it('toma el primer valor cuando Express parsea el param como array', () => {
    // `?province=CABA&province=Córdoba` llega como array; `String(value)` daría
    // `"CABA,Córdoba"` y un 400 incomprensible.
    assert.equal(stateIdOf({ province: ['CABA', 'Córdoba'] }), 'C');
  });
});

describe('parseCorreoAgencyQuery — código postal', () => {
  it('normaliza el CPA', () => {
    const parsed = parseCorreoAgencyQuery({ postal_code: 'C1414AAF' });
    assert.equal(parsed.ok && parsed.query.postal_code, '1414');
  });

  it('un CP inválido es 400 INVALID_POSTAL_CODE', () => {
    const parsed = parseCorreoAgencyQuery({ postal_code: 'abc' });
    assert.equal(parsed.ok, false);
    assert.equal(parsed.ok === false && parsed.error.code, 'INVALID_POSTAL_CODE');
  });
});

describe('parseCorreoAgencyQuery — flags de sucursal', () => {
  it('parsea pickup_availability y package_reception', () => {
    const parsed = parseCorreoAgencyQuery({
      state_id: 'C',
      pickup_availability: 'true',
      package_reception: 'false',
    });
    assert.equal(parsed.ok, true);
    assert.deepEqual(parsed.ok && parsed.query, {
      state_id: 'C',
      pickup_availability: true,
      package_reception: false,
    });
  });

  it('un flag ausente queda undefined, NO false', () => {
    // `false` significa "dame las que NO reciben paquetes": el opuesto exacto de
    // "no filtres por eso".
    const parsed = parseCorreoAgencyQuery({ state_id: 'C' });
    assert.equal(parsed.ok && 'pickup_availability' in parsed.query, false);
    assert.equal(parsed.ok && 'package_reception' in parsed.query, false);
  });

  it('un flag basura se ignora en vez de filtrar al revés', () => {
    const parsed = parseCorreoAgencyQuery({
      state_id: 'C',
      pickup_availability: 'quizás',
    });
    assert.equal(parsed.ok && parsed.query.pickup_availability, undefined);
  });

  it('acepta 1/0 además de true/false', () => {
    const parsed = parseCorreoAgencyQuery({
      state_id: 'C',
      pickup_availability: '1',
      package_reception: '0',
    });
    assert.equal(parsed.ok && parsed.query.pickup_availability, true);
    assert.equal(parsed.ok && parsed.query.package_reception, false);
  });

  it('acepta booleanos nativos (body JSON, no query string)', () => {
    const parsed = parseCorreoAgencyQuery({
      state_id: 'C',
      pickup_availability: true,
    });
    assert.equal(parsed.ok && parsed.query.pickup_availability, true);
  });
});

describe('correoAgencyCacheKey', () => {
  it('el postal_code NO entra en la clave', () => {
    // Si entrara, cada CP del país sería una entrada distinta: miles de llamadas
    // para cachear el mismo padrón provincial.
    assert.equal(
      correoAgencyCacheKey({ state_id: 'C', postal_code: '1414' }),
      correoAgencyCacheKey({ state_id: 'C', postal_code: '1425' })
    );
  });

  it('los filtros que SÍ van a la API cambian la clave', () => {
    const base = correoAgencyCacheKey({ state_id: 'C' });
    assert.notEqual(base, correoAgencyCacheKey({ state_id: 'B' }));
    assert.notEqual(
      base,
      correoAgencyCacheKey({ state_id: 'C', pickup_availability: true })
    );
    assert.notEqual(
      base,
      correoAgencyCacheKey({ state_id: 'C', package_reception: true })
    );
  });

  it('undefined y false son claves distintas', () => {
    // Son consultas distintas contra la API: no pueden compartir caché.
    assert.notEqual(
      correoAgencyCacheKey({ state_id: 'C' }),
      correoAgencyCacheKey({ state_id: 'C', pickup_availability: false })
    );
  });

  it('sin provincia la clave es estable', () => {
    assert.equal(correoAgencyCacheKey({}), 'all|any|any');
  });
});

describe('provinceIsoOrNull', () => {
  it('devuelve el ISO de la letra', () => {
    assert.equal(provinceIsoOrNull('C'), 'AR-C');
    assert.equal(provinceIsoOrNull('B'), 'AR-B');
  });

  it('null cuando no hay provincia', () => {
    assert.equal(provinceIsoOrNull(undefined), null);
  });
});

describe('sendCorreoStoreError', () => {
  it('arma el envelope { error, timestamp }', () => {
    let capturedStatus = 0;
    let capturedBody: unknown;
    const res = {
      status(code: number) {
        capturedStatus = code;
        return this;
      },
      json(body: unknown) {
        capturedBody = body;
        return this;
      },
    };

    sendCorreoStoreError(
      res as unknown as Parameters<typeof sendCorreoStoreError>[0],
      400,
      { code: 'INVALID_DESTINATION', message: 'CP inválido' }
    );

    assert.equal(capturedStatus, 400);
    const body = capturedBody as {
      error: { code: string; message: string };
      timestamp: string;
    };
    assert.deepEqual(body.error, {
      code: 'INVALID_DESTINATION',
      message: 'CP inválido',
    });
    // El timestamp no es decorativo: el storefront cachea, y sin él no se sabe
    // si el error que se muestra es de ahora o de hace diez minutos.
    assert.ok(!Number.isNaN(Date.parse(body.timestamp)));
  });
});
