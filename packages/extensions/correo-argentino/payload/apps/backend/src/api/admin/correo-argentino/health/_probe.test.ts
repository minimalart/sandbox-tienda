/**
 * Tests del clasificador de la sonda.
 *
 * Lo que se pinea acá es la traducción de un error a **una conclusión para el
 * operador**: "revisá la key" (401/403), "esperá y reintentá" (sin respuesta),
 * "pedile a Correo la activación comercial" (202 con rates vacío). Colapsar
 * cualquiera de esas tres en "falló" es el bug que esta ruta existe para no
 * cometer.
 *
 * ⚠️ Ninguno de estos casos se observó contra la API real de Correo: no hay
 * credenciales. Son la clasificación que DECIDIMOS aplicar sobre los errores que
 * producen los clientes del módulo.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyCorreoProbeError,
  classifyMiCorreoRatesResult,
  classifyPaqarAuthStatus,
  CORREO_PROBE_PARCEL,
  credentialsMissingOutcome,
  notProbedOutcome,
  readCorreoErrorStatus,
  redactCorreoProbeMessage,
} from './_probe.ts';
import {
  CORREO_MAX_DIMENSION_CM,
  CORREO_MAX_WEIGHT_G,
  CORREO_MIN_WEIGHT_G,
} from '../../../../modules/correo-argentino-fulfillment/transformers/consolidate-parcel.ts';
import {
  CorreoAPIError,
  CorreoAuthError,
  CorreoRateLimitError,
} from '../../../../modules/correo-argentino-fulfillment/utils/errors.ts';

describe('classifyPaqarAuthStatus — GET /auth', () => {
  it('204 es el OK documentado', () => {
    const outcome = classifyPaqarAuthStatus(204);
    assert.equal(outcome.status, 'ok');
    assert.equal(outcome.http_status, 204);
    assert.equal(outcome.message, null);
  });

  it('200 también se acepta, por si el gateway empieza a mandar cuerpo', () => {
    assert.equal(classifyPaqarAuthStatus(200).status, 'ok');
  });

  it('otro 2xx NO se da por bueno: "contestó algo" no es "las credenciales sirven"', () => {
    const outcome = classifyPaqarAuthStatus(202);
    assert.equal(outcome.status, 'error_desconocido');
    assert.equal(outcome.http_status, 202);
    assert.match(String(outcome.message), /202/);
  });
});

describe('classifyCorreoProbeError — credenciales vs gateway', () => {
  it('401 → credenciales inválidas, y NO reintentable', () => {
    const outcome = classifyCorreoProbeError(
      new CorreoAPIError('auth probe failed: Unauthorized', 401)
    );

    assert.equal(outcome.status, 'credenciales_invalidas');
    assert.equal(outcome.http_status, 401);
    assert.equal(
      outcome.retryable,
      false,
      'reintentar una key mal cargada solo entrena a apretar el botón'
    );
    assert.match(String(outcome.message), /Unauthorized/);
  });

  it('403 → credenciales inválidas (el gateway de paqar usa 403 para todo)', () => {
    const outcome = classifyCorreoProbeError(
      new CorreoAPIError('auth probe failed: Forbidden (/paqar/v1/auth)', 403)
    );

    assert.equal(outcome.status, 'credenciales_invalidas');
    assert.equal(outcome.http_status, 403);
    // El path va en el mensaje justamente porque un 403 puede ser una URL mal
    // armada y no una credencial.
    assert.match(String(outcome.message), /\/paqar\/v1\/auth/);
  });

  it('sin status (timeout / DNS / conexión cortada) → gateway inalcanzable y reintentable', () => {
    const outcome = classifyCorreoProbeError(
      new CorreoAPIError('auth probe failed: timeout of 12000ms exceeded')
    );

    assert.equal(outcome.status, 'gateway_inalcanzable');
    assert.equal(outcome.http_status, null);
    assert.equal(outcome.retryable, true);
  });

  it('5xx NO es "inalcanzable": el gateway contestó, pero reintentar sirve', () => {
    const outcome = classifyCorreoProbeError(
      new CorreoAPIError('auth probe failed: Internal Server Error', 503)
    );

    assert.equal(outcome.status, 'error_desconocido');
    assert.equal(outcome.http_status, 503);
    assert.equal(outcome.retryable, true);
  });

  it('un 4xx que no es de auth es desconocido y no reintentable', () => {
    const outcome = classifyCorreoProbeError(
      new CorreoAPIError('auth probe failed: Bad Request', 400)
    );

    assert.equal(outcome.status, 'error_desconocido');
    assert.equal(outcome.http_status, 400);
    assert.equal(outcome.retryable, false);
  });

  it('rate limit tampoco es "inalcanzable": contestó, y de más', () => {
    const outcome = classifyCorreoProbeError(
      new CorreoRateLimitError('Rate limit exceeded', 60)
    );

    assert.equal(outcome.status, 'error_desconocido');
    assert.equal(outcome.retryable, true);
  });

  it('un error nuestro (Error pelado) NO se disfraza de "Correo no responde"', () => {
    const outcome = classifyCorreoProbeError(new Error('cannot read property'));

    assert.equal(
      outcome.status,
      'error_desconocido',
      'un bug propio clasificado como gateway caído manda a esperar en vez de a leer'
    );
    assert.equal(outcome.retryable, false);
    assert.equal(outcome.message, 'cannot read property');
  });

  it('el CorreoAuthError de MiCorreo (sin status) es desconocido, no gateway caído', () => {
    const outcome = classifyCorreoProbeError(
      new CorreoAuthError('MiCorreo credentials are not configured')
    );

    assert.equal(outcome.status, 'error_desconocido');
    assert.equal(outcome.retryable, false);
  });

  it('lee el status del error REHIDRATADO (objeto plano, sin prototipo)', () => {
    const outcome = classifyCorreoProbeError({
      code: 'CORREO_API_ERROR',
      statusCode: 401,
      message: 'auth probe failed: Unauthorized',
    });

    assert.equal(outcome.status, 'credenciales_invalidas');
    assert.equal(outcome.http_status, 401);
  });

  it('desanida el error envuelto', () => {
    assert.equal(
      readCorreoErrorStatus({
        error: new CorreoAPIError('nope', 403),
        action: 'probe',
      }),
      403
    );
    assert.equal(readCorreoErrorStatus(null), null);
    assert.equal(readCorreoErrorStatus('nope'), null);
  });

  it('un mensaje vacío es null, no una cadena vacía en pantalla', () => {
    assert.equal(classifyCorreoProbeError(new Error('   ')).message, null);
  });
});

describe('redactCorreoProbeMessage — el mensaje va a una respuesta HTTP', () => {
  it('tapa la API-Key aunque venga en el texto del error', () => {
    const redacted = redactCorreoProbeMessage(
      'request failed with header authorization: Apikey eyJhbGciOiJIUzI1NiJ9.SECRETO.zzz'
    );

    assert.ok(!redacted.includes('SECRETO'));
    assert.match(redacted, /Apikey \*\*\*/);
  });

  it('tapa el Bearer de MiCorreo y el Basic del token', () => {
    assert.ok(
      !redactCorreoProbeMessage('Bearer eyJhbGciOi.SECRETO.x').includes('SECRETO')
    );
    assert.ok(
      !redactCorreoProbeMessage('Basic dXNlcjpTRUNSRVRP').includes('dXNlcjpTRUNSRVRP')
    );
  });

  it('tapa un JWT pelado, sin prefijo', () => {
    const redacted = redactCorreoProbeMessage(
      'token rechazado: eyJhbGciOiJIUzI1NiJ9.SECRETOPAYLOAD.firma'
    );
    assert.ok(!redacted.includes('SECRETOPAYLOAD'));
  });

  it('no toca un mensaje normal', () => {
    assert.equal(
      redactCorreoProbeMessage('Unauthorized: revisá el agreement (/auth)'),
      'Unauthorized: revisá el agreement (/auth)'
    );
  });

  it('corta los mensajes larguísimos', () => {
    const redacted = redactCorreoProbeMessage('x'.repeat(2000));
    assert.ok(redacted.length <= 501);
  });
});

describe('classifyMiCorreoRatesResult — el caso que justifica el paso 2', () => {
  // ⚠️ Una cuenta que Correo no activó comercialmente AUTENTICA BIEN y devuelve
  // 202 con rates: []. Un health check que se quede en POST /token dice "todo
  // ok" mientras el checkout cotiza $0 y muestra "Gratuito" en cada venta.
  it('202 con rates vacío → cuenta_no_activada, y el mensaje dice qué pedirle a Correo', () => {
    const outcome = classifyMiCorreoRatesResult({
      outcome: 'account_not_activated',
      httpStatus: 202,
    });

    assert.equal(outcome.status, 'cuenta_no_activada');
    assert.equal(outcome.http_status, 202);
    assert.match(String(outcome.message), /activada comercialmente/);
    assert.equal(
      outcome.retryable,
      false,
      'no se arregla reintentando: se arregla con un mail al ejecutivo de cuenta'
    );
  });

  it('con tarifas → ok', () => {
    const outcome = classifyMiCorreoRatesResult({
      outcome: 'ok',
      httpStatus: 200,
    });

    assert.equal(outcome.status, 'ok');
    assert.equal(outcome.message, null);
  });

  it('200 con rates vacío es "sin_tarifas", NO ok y NO cuenta_no_activada', () => {
    const outcome = classifyMiCorreoRatesResult({
      outcome: 'no_rates',
      httpStatus: 200,
    });

    assert.equal(outcome.status, 'sin_tarifas');
    assert.notEqual(outcome.status, 'ok');
    assert.notEqual(outcome.status, 'cuenta_no_activada');
  });

  it('los tres resultados son distinguibles entre sí', () => {
    const statuses = (['ok', 'account_not_activated', 'no_rates'] as const).map(
      (outcome) =>
        classifyMiCorreoRatesResult({ outcome, httpStatus: 200 }).status
    );

    assert.equal(new Set(statuses).size, 3);
  });
});

describe('bulto de la sonda de /rates', () => {
  // Si la sonda mandara medidas fuera de rango, un rechazo de MiCorreo sería
  // culpa nuestra y el operador leería "la cuenta no cotiza" por un bug de la
  // sonda.
  it('está dentro de los límites duros que valida el cliente', () => {
    assert.ok(CORREO_PROBE_PARCEL.weight >= CORREO_MIN_WEIGHT_G);
    assert.ok(CORREO_PROBE_PARCEL.weight <= CORREO_MAX_WEIGHT_G);

    for (const side of ['height', 'width', 'length'] as const) {
      assert.ok(CORREO_PROBE_PARCEL[side] > 0);
      assert.ok(CORREO_PROBE_PARCEL[side] <= CORREO_MAX_DIMENSION_CM);
    }
  });
});

describe('estados que no salen a la red', () => {
  it('sin sonda pedida, "no_probado" y nada más', () => {
    const outcome = notProbedOutcome();
    assert.equal(outcome.status, 'no_probado');
    assert.equal(outcome.http_status, null);
    assert.equal(outcome.message, null);
  });

  it('faltan credenciales → se nombran las variables, no se intenta la llamada', () => {
    const outcome = credentialsMissingOutcome([
      'CORREO_ARGENTINO_API_KEY',
      'CORREO_ARGENTINO_AGREEMENT',
    ]);

    assert.equal(outcome.status, 'sin_credenciales');
    assert.equal(outcome.http_status, null);
    assert.match(String(outcome.message), /CORREO_ARGENTINO_API_KEY/);
    assert.equal(outcome.retryable, false);
  });
});
