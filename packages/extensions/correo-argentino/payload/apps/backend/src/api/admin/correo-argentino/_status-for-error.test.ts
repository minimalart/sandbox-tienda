import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { statusForCorreoTicketError } from './_status-for-error';

/**
 * La tabla completa de prefijos que emite `correoGenerateTicketsWorkflow` (y los
 * transformers que llama). Se testea CADA uno, no una muestra: un código sin
 * mapear cae al 500 del default y ahí es indistinguible de un bug nuestro, que
 * es exactamente el fallo que este archivo existe para evitar.
 */
const EXPECTED_STATUS: ReadonlyArray<[string, number]> = [
  ['ORDER_NOT_FOUND', 404],

  ['ORDER_NOT_PAID', 400],
  ['ORDER_NOT_FULFILLED', 400],
  ['ORDER_NOT_CORREO', 400],
  ['ORDER_MISSING_ITEMS', 400],
  ['ORDER_MISSING_SHIPPING_ADDRESS', 400],
  ['CORREO_AGENCY_ID_MISSING', 400],
  ['CORREO_MISSING_RECIPIENT_NAME', 400],
  ['CORREO_MISSING_RECIPIENT_STREET', 400],
  ['CORREO_MISSING_RECIPIENT_CITY', 400],
  ['CORREO_INVALID_PROVINCE', 400],
  ['CORREO_INVALID_POSTAL_CODE', 400],
  ['CORREO_POSTAL_CODE_PROVINCE_MISMATCH', 400],
  ['CORREO_MISSING_PRODUCT_DIMENSIONS', 400],
  ['CORREO_PARCEL_LIMIT_EXCEEDED', 400],
  ['CORREO_ORDER_PAYLOAD_INVALID', 400],
  ['CORREO_ORDER_CREATE_REJECTED', 400],

  ['CORREO_ORDER_CREATE_UNAVAILABLE', 503],

  ['CORREO_TRACKING_NUMBER_MISSING', 502],

  ['CORREO_PARCEL_INVALID', 500],
  ['CORREO_TICKET_STATE_INVALID', 500],
];

describe('statusForCorreoTicketError', () => {
  for (const [code, status] of EXPECTED_STATUS) {
    it(`${code} → ${status}`, () => {
      assert.deepEqual(statusForCorreoTicketError(`${code}: detalle del error`), {
        status,
        code,
      });
    });
  }

  it('cubre los 21 prefijos del workflow', () => {
    // Guard contra el borrado accidental de una fila de la tabla de arriba.
    assert.equal(EXPECTED_STATUS.length, 21);
  });

  it('un prefijo desconocido cae a 500, no a 400', () => {
    // Un código nuevo que nadie mapeó es un bug NUESTRO. Caer a 400 le diría al
    // operador "arreglá los datos de la orden" cuando no hay nada que arreglar.
    assert.deepEqual(statusForCorreoTicketError('CORREO_ALGO_NUEVO: qué es esto'), {
      status: 500,
      code: 'CORREO_ALGO_NUEVO',
    });
  });

  it('un mensaje sin prefijo cae a 500 con el mensaje como code', () => {
    assert.deepEqual(statusForCorreoTicketError('boom'), {
      status: 500,
      code: 'boom',
    });
  });

  it('un mensaje vacío no revienta y usa un code genérico', () => {
    assert.deepEqual(statusForCorreoTicketError(''), {
      status: 500,
      code: 'CORREO_ERROR',
    });
  });

  it('tolera espacios alrededor del prefijo', () => {
    // El mensaje puede venir de un error rehidratado por el workflow-engine.
    assert.deepEqual(statusForCorreoTicketError('  ORDER_NOT_FOUND : nope'), {
      status: 404,
      code: 'ORDER_NOT_FOUND',
    });
  });

  it('solo mira el PRIMER segmento, no el resto del mensaje', () => {
    // Un mensaje que menciona otro código adentro no puede cambiar el status.
    assert.deepEqual(
      statusForCorreoTicketError(
        'CORREO_ORDER_CREATE_UNAVAILABLE: falló tras 3 intentos (ORDER_NOT_FOUND)'
      ),
      { status: 503, code: 'CORREO_ORDER_CREATE_UNAVAILABLE' }
    );
  });

  it('distingue reintentable (503) de no reintentable (400) en el alta', () => {
    // Es LA distinción que le importa al operador frente a un lote fallido.
    assert.equal(
      statusForCorreoTicketError('CORREO_ORDER_CREATE_UNAVAILABLE: timeout').status,
      503
    );
    assert.equal(
      statusForCorreoTicketError('CORREO_ORDER_CREATE_REJECTED: zipCode inválido')
        .status,
      400
    );
  });
});
