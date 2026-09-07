import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CorreoAPIError,
  CorreoAuthError,
  CorreoRateLimitError,
  CorreoValidationError,
  extractErrorMessage,
  formatCorreoApiErrorBody,
  isTransientCorreoError,
} from './errors.ts';

describe('isTransientCorreoError — se reintenta rate-limit, 5xx y sin status', () => {
  it('rate limit → true', () => {
    assert.equal(
      isTransientCorreoError(new CorreoRateLimitError('Rate limit exceeded', 60)),
      true,
    );
  });

  it('5xx → true', () => {
    assert.equal(isTransientCorreoError(new CorreoAPIError('boom', 500)), true);
    assert.equal(isTransientCorreoError(new CorreoAPIError('boom', 502)), true);
    assert.equal(isTransientCorreoError(new CorreoAPIError('boom', 503)), true);
  });

  it('sin statusCode (network / timeout, no hubo respuesta HTTP) → true', () => {
    assert.equal(isTransientCorreoError(new CorreoAPIError('ETIMEDOUT')), true);
  });

  it('4xx → false: son deterministas, reintentarlos solo quema tiempo', () => {
    for (const status of [400, 401, 403, 404, 409, 422]) {
      assert.equal(
        isTransientCorreoError(new CorreoAPIError('nope', status)),
        false,
        `${status} no debe reintentarse`,
      );
    }
  });

  it('el 403 del gateway de paqar tampoco se reintenta', () => {
    // El gateway devuelve 403 para CUALQUIER path, incluso inexistentes.
    assert.equal(isTransientCorreoError(new CorreoAPIError('forbidden', 403)), false);
  });

  it('errores de auth y de validación → false', () => {
    assert.equal(isTransientCorreoError(new CorreoAuthError('bad creds')), false);
    assert.equal(
      isTransientCorreoError(new CorreoValidationError('bad weight', 'weight')),
      false,
    );
  });

  it('errores ajenos → false', () => {
    assert.equal(isTransientCorreoError(new Error('cualquier cosa')), false);
    assert.equal(isTransientCorreoError('string'), false);
    assert.equal(isTransientCorreoError(null), false);
    assert.equal(isTransientCorreoError(undefined), false);
    assert.equal(isTransientCorreoError({}), false);
  });
});

describe('isTransientCorreoError — errores rehidratados por el workflow engine', () => {
  // El workflow-engine redis serializa el error del step: llega como objeto
  // plano, sin prototipo Error, así que `instanceof` da false.
  it('objeto plano con code de rate limit → true', () => {
    assert.equal(
      isTransientCorreoError({ code: 'CORREO_RATE_LIMIT', message: 'slow down' }),
      true,
    );
  });

  it('objeto plano de API error con 5xx → true, con 4xx → false', () => {
    assert.equal(
      isTransientCorreoError({ code: 'CORREO_API_ERROR', statusCode: 503 }),
      true,
    );
    assert.equal(
      isTransientCorreoError({ code: 'CORREO_API_ERROR', statusCode: 400 }),
      false,
    );
  });

  it('objeto plano de API error sin statusCode → true (fue network/timeout)', () => {
    assert.equal(isTransientCorreoError({ code: 'CORREO_API_ERROR' }), true);
    assert.equal(
      isTransientCorreoError({ code: 'CORREO_API_ERROR', statusCode: null }),
      true,
    );
  });

  it('desanida el wrapper { error, action, handlerType } del engine', () => {
    assert.equal(
      isTransientCorreoError({
        action: 'create-order-shipment',
        handlerType: 'invoke',
        error: { code: 'CORREO_API_ERROR', statusCode: 500 },
      }),
      true,
    );
    assert.equal(
      isTransientCorreoError({
        action: 'create-order-shipment',
        error: { code: 'CORREO_API_ERROR', statusCode: 400 },
      }),
      false,
    );
  });

  it('un objeto sin code no se reintenta (no sabemos qué es)', () => {
    assert.equal(isTransientCorreoError({ statusCode: 500 }), false);
  });
});

describe('extractErrorMessage', () => {
  it('Error nativo → .message', () => {
    assert.equal(extractErrorMessage(new Error('boom')), 'boom');
  });

  it('string → tal cual', () => {
    assert.equal(extractErrorMessage('boom'), 'boom');
  });

  it('objeto plano rehidratado → recupera el .message real', () => {
    // Sin este helper, String(error) devolvería "[object Object]".
    assert.equal(
      extractErrorMessage({ name: 'CorreoAPIError', message: 'API 400: zipCode' }),
      'API 400: zipCode',
    );
  });

  it('desanida el wrapper del engine', () => {
    assert.equal(
      extractErrorMessage({
        action: 'create-order-shipment',
        handlerType: 'invoke',
        error: { message: 'agencyId is required' },
      }),
      'agencyId is required',
    );
  });

  it('desanida varios niveles', () => {
    assert.equal(
      extractErrorMessage({ error: { error: { message: 'raíz' } } }),
      'raíz',
    );
  });

  it('objeto sin message → dump JSON en vez de "[object Object]"', () => {
    const message = extractErrorMessage({ statusCode: 400, field: 'zipCode' });
    assert.notEqual(message, '[object Object]');
    assert.match(message, /zipCode/);
  });

  it('message vacío no gana sobre el dump', () => {
    const message = extractErrorMessage({ message: '   ', statusCode: 500 });
    assert.match(message, /500/);
  });

  it('primitivos', () => {
    assert.equal(extractErrorMessage(null), 'null');
    assert.equal(extractErrorMessage(undefined), 'undefined');
    assert.equal(extractErrorMessage(42), '42');
  });
});

describe('formatCorreoApiErrorBody — shape { timestamp, status, error, message, path }', () => {
  it('combina error y message', () => {
    assert.equal(
      formatCorreoApiErrorBody({
        timestamp: '2026-04-26T20:00:00Z',
        status: 400,
        error: 'Bad Request',
        message: 'zipCode no corresponde a la provincia',
        path: '/paqar/v1/orders',
      }),
      'Bad Request: zipCode no corresponde a la provincia (/paqar/v1/orders)',
    );
  });

  it('message vacío no deja el error pelado (Correo lo manda vacío a menudo)', () => {
    assert.equal(
      formatCorreoApiErrorBody({ status: 401, error: 'Unauthorized', message: '' }),
      'Unauthorized',
    );
  });

  it('solo message', () => {
    assert.equal(
      formatCorreoApiErrorBody({ message: 'weight out of range' }),
      'weight out of range',
    );
  });

  it('error y message idénticos no se duplican', () => {
    assert.equal(
      formatCorreoApiErrorBody({ error: 'Forbidden', message: 'Forbidden' }),
      'Forbidden',
    );
  });

  it('body string', () => {
    assert.equal(formatCorreoApiErrorBody('  plain text  '), 'plain text');
    assert.equal(formatCorreoApiErrorBody(''), undefined);
  });

  it('body sin campos conocidos → dump truncado, para no perder la causa', () => {
    const formatted = formatCorreoApiErrorBody({ detalle: 'algo raro' });
    assert.match(formatted ?? '', /algo raro/);
  });

  it('null / undefined → undefined', () => {
    assert.equal(formatCorreoApiErrorBody(null), undefined);
    assert.equal(formatCorreoApiErrorBody(undefined), undefined);
  });
});
