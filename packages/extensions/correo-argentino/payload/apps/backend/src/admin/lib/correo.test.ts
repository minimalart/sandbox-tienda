import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  base64ToBytes,
  correoBucketColor,
  correoEnvVarColor,
  correoEnvVarState,
  correoFulfillmentStatusColor,
  correoHealthColor,
  correoHealthLabelKey,
  correoHealthNeedsAction,
  correoPublicTrackingUrl,
  describeBilledWeight,
  formatGrams,
  hasCorreoNameHint,
  isCorreoFulfillmentLike,
  isCorreoShippingMethodLike,
  summarizeCorreoLabels,
  type CorreoEnvVarLike,
  type CorreoLabelOutcome,
} from './correo';

/**
 * Tests de la lógica pura del admin de Correo.
 *
 * El admin NO tiene runner de componentes React, así que lo único que se puede
 * (y se debe) testear es esto: los predicados y las conversiones que deciden qué
 * ve el operador. Están extraídos a `lib/correo.ts` precisamente para que entren
 * en `pnpm test`.
 */

describe('isCorreoShippingMethodLike', () => {
  it('reconoce el provider_id explícito', () => {
    assert.equal(
      isCorreoShippingMethodLike({
        provider_id: 'correo_argentino_correo_argentino',
      }),
      true
    );
  });

  it('reconoce data.carrier y data.provider', () => {
    assert.equal(
      isCorreoShippingMethodLike({ data: { carrier: 'correo_argentino' } }),
      true
    );
    assert.equal(
      isCorreoShippingMethodLike({ data: { provider: 'correo' } }),
      true
    );
  });

  it('reconoce la fulfillment option del seed por prefijo', () => {
    assert.equal(
      isCorreoShippingMethodLike({ data: { id: 'correo-domicilio' } }),
      true
    );
    assert.equal(
      isCorreoShippingMethodLike({ data: { id: 'correo-sucursal' } }),
      true
    );
  });

  it('reconoce data.provider_id', () => {
    assert.equal(
      isCorreoShippingMethodLike({
        data: { provider_id: 'correo_argentino_correo_argentino' },
      }),
      true
    );
  });

  it('acepta el nombre solo con "correo" como palabra completa', () => {
    assert.equal(
      isCorreoShippingMethodLike({ name: 'Correo Argentino a domicilio' }),
      true
    );
    assert.equal(isCorreoShippingMethodLike({ name: 'Envío por correo' }), true);
  });

  /**
   * El punto de todo el ejercicio: NO repetir el regex laxo de Andreani
   * (`/andreani|domicilio|sucursal|punto|hop/i`). Esos nombres son de OTROS
   * carriers y clasificarlos como Correo mostraría el widget equivocado.
   */
  it('NO matchea nombres genéricos de otros carriers', () => {
    for (const name of [
      'Andreani Domicilio',
      'Andreani Sucursal',
      'Punto de retiro HOP',
      'Retiro en tienda',
      'Envío a domicilio',
      'Centro de distribución',
    ]) {
      assert.equal(
        isCorreoShippingMethodLike({ name }),
        false,
        `"${name}" no debería clasificar como Correo`
      );
    }
  });

  it('NO matchea "correo" como substring de otra palabra', () => {
    // El límite de palabra es lo que hace que estos den false.
    assert.equal(isCorreoShippingMethodLike({ name: 'correoso' }), false);
    assert.equal(isCorreoShippingMethodLike({ name: 'incorreoto' }), false);
  });

  it('no matchea "correo" dentro de un id sin el prefijo esperado', () => {
    assert.equal(
      isCorreoShippingMethodLike({ data: { id: 'andreani-correoso' } }),
      false
    );
  });

  it('tolera entradas basura sin tirar', () => {
    for (const input of [null, undefined, 0, '', [], { data: null }, { data: 3 }]) {
      assert.equal(isCorreoShippingMethodLike(input), false);
    }
  });

  it('ignora strings vacíos o de solo espacios', () => {
    assert.equal(
      isCorreoShippingMethodLike({ provider_id: '   ', name: '  ' }),
      false
    );
  });
});

describe('hasCorreoNameHint', () => {
  it('es insensible a acentos y mayúsculas', () => {
    assert.equal(hasCorreoNameHint('CORREO Argentino'), true);
    // El deacentuado es a favor: cubre las variantes mal tipeadas que igual
    // significan Correo.
    assert.equal(hasCorreoNameHint('Envío a Sucursal Córreo'), true);
    assert.equal(hasCorreoNameHint('Correó'), true);
  });

  it('devuelve false para undefined', () => {
    assert.equal(hasCorreoNameHint(undefined), false);
  });
});

describe('isCorreoFulfillmentLike', () => {
  it('acepta provider_id y data.carrier', () => {
    assert.equal(
      isCorreoFulfillmentLike({ provider_id: 'correo_argentino_correo_argentino' }),
      true
    );
    assert.equal(
      isCorreoFulfillmentLike({ data: { carrier: 'correo_argentino' } }),
      true
    );
  });

  /**
   * La detección de fulfillments es ESTRICTA: con dos carriers en el proyecto,
   * "cualquier fulfillment con tracking_number" haría que Correo se robara los
   * envíos de Andreani y viceversa.
   */
  it('NO acepta un fulfillment solo porque tiene tracking_number', () => {
    assert.equal(
      isCorreoFulfillmentLike({
        provider_id: 'manual_manual',
        data: { tracking_number: '123456' },
      }),
      false
    );
  });

  it('no acepta el fulfillment de Andreani', () => {
    assert.equal(
      isCorreoFulfillmentLike({
        provider_id: 'andreani_andreani',
        data: { carrier: 'andreani', tracking_number: 'X' },
      }),
      false
    );
  });
});

describe('formatGrams', () => {
  it('usa gramos abajo de 1 kg', () => {
    assert.equal(formatGrams(0), '0 g');
    assert.equal(formatGrams(850), '850 g');
    assert.equal(formatGrams(999.6), '1000 g');
  });

  it('usa kg desde 1 kg, con coma decimal', () => {
    assert.equal(formatGrams(1000), '1 kg');
    assert.equal(formatGrams(2500), '2,5 kg');
    assert.equal(formatGrams(25000), '25 kg');
  });

  /**
   * `null`/`[]`/`''` tienen que dar "—" y NO "0 g": un peso ausente mostrado como
   * cero es indistinguible de un paquete que de verdad pesa cero, y en esta
   * pantalla el peso es lo que se factura.
   */
  it('devuelve el guión para entradas inválidas o ausentes', () => {
    for (const input of [undefined, null, '', '  ', 'abc', -1, NaN, {}, [], true]) {
      assert.equal(formatGrams(input), '—', `input: ${JSON.stringify(input)}`);
    }
  });

  it('acepta un numérico que viene como string', () => {
    assert.equal(formatGrams('2500'), '2,5 kg');
  });
});

describe('describeBilledWeight', () => {
  it('detecta cuando el volumétrico le gana al real', () => {
    const result = describeBilledWeight({
      product_weight_g: 1200,
      volumetric_weight_g: 4500,
      billed_weight_g: 4500,
    });
    assert.equal(result.volumetric_wins, true);
    assert.equal(result.billed_g, 4500);
    assert.equal(result.surcharge_g, 3300);
  });

  it('no marca sobrecosto cuando el peso real manda', () => {
    const result = describeBilledWeight({
      product_weight_g: 8000,
      volumetric_weight_g: 2000,
      billed_weight_g: 8000,
    });
    assert.equal(result.volumetric_wins, false);
    assert.equal(result.surcharge_g, 0);
  });

  it('no marca sobrecosto cuando son iguales', () => {
    const result = describeBilledWeight({
      product_weight_g: 3000,
      volumetric_weight_g: 3000,
      billed_weight_g: 3000,
    });
    assert.equal(result.volumetric_wins, false);
  });

  /**
   * Nunca recalcular sobre el valor persistido: el divisor de aforo es
   * configurable por env var, así que recomputar en el admin desincronizaría el
   * número que se muestra del que se facturó.
   */
  it('respeta el billed_weight_g persistido incluso si no es el máximo', () => {
    const result = describeBilledWeight({
      product_weight_g: 1000,
      volumetric_weight_g: 9000,
      billed_weight_g: 5000,
    });
    assert.equal(result.billed_g, 5000);
  });

  it('deriva el facturado del máximo cuando falta', () => {
    const result = describeBilledWeight({
      product_weight_g: 1000,
      volumetric_weight_g: 4000,
    });
    assert.equal(result.billed_g, 4000);
    assert.equal(result.volumetric_wins, true);
  });

  it('tolera parcels inválidos con ceros en vez de NaN', () => {
    const result = describeBilledWeight(null);
    assert.deepEqual(result, {
      product_g: 0,
      volumetric_g: 0,
      billed_g: 0,
      volumetric_wins: false,
      surcharge_g: 0,
    });
  });
});

describe('summarizeCorreoLabels', () => {
  const label = (over: Partial<CorreoLabelOutcome>): CorreoLabelOutcome => ({
    tracking_number: 'TN',
    ok: true,
    file_name: 'r.pdf',
    base64: 'QQ==',
    error: null,
    ...over,
  });

  /**
   * El caso que motiva todo: 10 pedidos, 2 fallan, HTTP 200. El operador tiene
   * que saber CUÁLES.
   */
  it('reporta las fallas parciales una por una', () => {
    const labels = [
      label({ tracking_number: 'A' }),
      label({ tracking_number: 'B' }),
      label({
        tracking_number: 'C',
        ok: false,
        base64: null,
        error: 'ERROR: envío inexistente',
      }),
      label({ tracking_number: 'D' }),
      label({
        tracking_number: 'E',
        ok: false,
        base64: null,
        error: 'ERROR: rótulo no disponible',
      }),
    ];

    const summary = summarizeCorreoLabels(labels);
    assert.equal(summary.total, 5);
    assert.equal(summary.ok_count, 3);
    assert.equal(summary.error_count, 2);
    assert.equal(summary.all_ok, false);
    assert.equal(summary.all_failed, false);
    assert.deepEqual(summary.failures, [
      { tracking_number: 'C', error: 'ERROR: envío inexistente' },
      { tracking_number: 'E', error: 'ERROR: rótulo no disponible' },
    ]);
  });

  /**
   * `ok: true` sin PDF es una FALLA: dar por bueno un base64 vacío produce un
   * archivo corrupto que se descubre recién en la impresora.
   */
  it('trata "ok sin base64" como falla, con mensaje por defecto', () => {
    const summary = summarizeCorreoLabels([
      label({ tracking_number: 'A', base64: null, error: null }),
    ]);
    assert.equal(summary.ok_count, 0);
    assert.equal(summary.error_count, 1);
    assert.equal(summary.failures[0]?.error, 'Correo no devolvió el rótulo');
  });

  it('marca all_ok cuando salieron todos', () => {
    const summary = summarizeCorreoLabels([label({}), label({})]);
    assert.equal(summary.all_ok, true);
    assert.equal(summary.all_failed, false);
  });

  it('marca all_failed cuando no salió ninguno', () => {
    const summary = summarizeCorreoLabels([
      label({ ok: false, base64: null, error: 'x' }),
    ]);
    assert.equal(summary.all_failed, true);
    assert.equal(summary.all_ok, false);
  });

  /**
   * El camino del PDF directo: con UN solo TN la ruta responde
   * `application/pdf` en vez del JSON por ítem, así que el ítem llega con
   * `bytes` y sin `base64`. Tiene que contar igual.
   */
  it('cuenta como ok un ítem que trae bytes en vez de base64', () => {
    const summary = summarizeCorreoLabels([
      {
        tracking_number: 'A',
        ok: true,
        error: null,
        bytes: new Uint8Array([1, 2, 3]),
      },
    ]);
    assert.equal(summary.ok_count, 1);
    assert.equal(summary.all_ok, true);
  });

  it('cuenta como falla un ítem con bytes vacíos', () => {
    const summary = summarizeCorreoLabels([
      { tracking_number: 'A', ok: true, error: null, bytes: new Uint8Array(0) },
    ]);
    assert.equal(summary.error_count, 1);
    assert.equal(summary.failures[0]?.error, 'Correo no devolvió el rótulo');
  });

  it('ignora un base64 de solo espacios', () => {
    const summary = summarizeCorreoLabels([
      { tracking_number: 'A', ok: true, error: null, base64: '   ' },
    ]);
    assert.equal(summary.error_count, 1);
  });

  it('un lote vacío no es ni todo-ok ni todo-falla', () => {
    const summary = summarizeCorreoLabels([]);
    assert.equal(summary.all_ok, false);
    assert.equal(summary.all_failed, false);
    assert.equal(summary.total, 0);
  });
});

describe('base64ToBytes', () => {
  it('decodifica base64 plano', () => {
    assert.deepEqual(Array.from(base64ToBytes('QUJD')), [65, 66, 67]);
  });

  it('tolera whitespace y data-URL', () => {
    assert.deepEqual(Array.from(base64ToBytes('QU\nJD ')), [65, 66, 67]);
    assert.deepEqual(
      Array.from(base64ToBytes('data:application/pdf;base64,QUJD')),
      [65, 66, 67]
    );
  });

  it('devuelve vacío en vez de tirar con entrada inválida', () => {
    for (const input of [undefined, null, 42, '', '  ', '@@@@']) {
      assert.equal(base64ToBytes(input).length, 0);
    }
  });
});

describe('correoBucketColor', () => {
  it('mapea los buckets del normalizador', () => {
    assert.equal(correoBucketColor('delivered'), 'green');
    assert.equal(correoBucketColor('in_transit'), 'blue');
    assert.equal(correoBucketColor('out_for_delivery'), 'blue');
    assert.equal(correoBucketColor('admitted'), 'blue');
    assert.equal(correoBucketColor('pre_shipment'), 'orange');
    assert.equal(correoBucketColor('failed'), 'red');
    assert.equal(correoBucketColor('returned'), 'red');
    assert.equal(correoBucketColor('canceled'), 'red');
  });

  /**
   * `unknown` es GRIS y no rojo: la tabla de `statusId` de Correo no está
   * publicada, así que "no supimos mapear" es lo esperable y pintarlo de rojo
   * entrenaría al operador a ignorar los rojos de verdad.
   */
  it('deja unknown en gris', () => {
    assert.equal(correoBucketColor('unknown'), 'grey');
    assert.equal(correoBucketColor(undefined), 'grey');
    assert.equal(correoBucketColor('algo_nuevo_de_correo'), 'grey');
  });
});

describe('correoFulfillmentStatusColor', () => {
  it('mapea los estados nativos de Medusa', () => {
    assert.equal(correoFulfillmentStatusColor('delivered'), 'green');
    assert.equal(correoFulfillmentStatusColor('shipped'), 'blue');
    assert.equal(correoFulfillmentStatusColor('pending'), 'orange');
    assert.equal(correoFulfillmentStatusColor('canceled'), 'red');
    assert.equal(correoFulfillmentStatusColor('lo_que_sea'), 'grey');
  });
});

describe('correoPublicTrackingUrl', () => {
  it('arma la URL pública y escapa el TN', () => {
    assert.equal(
      correoPublicTrackingUrl('ABC 123'),
      'https://www.correoargentino.com.ar/formularios/e-commerce?id=ABC%20123'
    );
  });
});

describe('correoHealthColor', () => {
  it('ok en verde, no probado en gris', () => {
    assert.equal(correoHealthColor('ok'), 'green');
    assert.equal(correoHealthColor('no_probado'), 'grey');
    assert.equal(correoHealthColor(undefined), 'grey');
  });

  /**
   * El test que importa de este mapeo. `cuenta_no_activada` significa que
   * MiCorreo autentica pero devuelve la cotización VACÍA: el checkout muestra
   * "Gratuito" y el flete lo paga el comercio en cada venta. Un naranja tibio
   * ahí es plata perdida con cara de advertencia.
   */
  it('cuenta_no_activada es ROJO, no un warning tibio', () => {
    assert.equal(correoHealthColor('cuenta_no_activada'), 'red');
    assert.notEqual(correoHealthColor('cuenta_no_activada'), 'orange');
    assert.ok(correoHealthNeedsAction('cuenta_no_activada'));
  });

  it('credenciales mal y error desconocido también son rojos', () => {
    assert.equal(correoHealthColor('credenciales_invalidas'), 'red');
    assert.equal(correoHealthColor('error_desconocido'), 'red');
  });

  it('lo transitorio o incompleto es naranja', () => {
    assert.equal(correoHealthColor('gateway_inalcanzable'), 'orange');
    assert.equal(correoHealthColor('sin_credenciales'), 'orange');
    assert.equal(correoHealthColor('sin_tarifas'), 'orange');
  });

  it('reintentar solo tiene sentido cuando no hay nada que arreglar a mano', () => {
    assert.equal(correoHealthNeedsAction('gateway_inalcanzable'), false);
    assert.equal(correoHealthNeedsAction('no_probado'), false);
    assert.equal(correoHealthNeedsAction('ok'), false);
    assert.ok(correoHealthNeedsAction('sin_credenciales'));
    assert.ok(correoHealthNeedsAction('credenciales_invalidas'));
  });

  it('cada estado tiene su clave de i18n y lo desconocido no queda sin texto', () => {
    assert.equal(correoHealthLabelKey('ok'), 'HEALTH_STATUS_OK');
    assert.equal(
      correoHealthLabelKey('cuenta_no_activada'),
      'HEALTH_STATUS_CUENTA_NO_ACTIVADA'
    );
    assert.equal(
      correoHealthLabelKey('algo_nuevo'),
      'HEALTH_STATUS_ERROR_DESCONOCIDO'
    );
  });
});

describe('correoEnvVarState', () => {
  const entry = (
    overrides: Partial<CorreoEnvVarLike> = {}
  ): CorreoEnvVarLike => ({
    name: 'CORREO_ARGENTINO_API_KEY',
    configured: true,
    usable: true,
    requirement: 'requerida',
    group: 'paqar',
    ...overrides,
  });

  it('cargada y aceptada por el módulo → ok', () => {
    assert.equal(correoEnvVarState(entry()), 'ok');
    assert.equal(correoEnvVarColor(entry()), 'green');
  });

  /**
   * El caso traicionero: la clave TIENE valor —venga de donde venga— y el
   * normalizador lo descarta igual (la planilla de Correo trae la celda con el
   * prefijo `"Apikey "` puesto). Ni "cargada" ni "sin cargar" lo describen.
   */
  it('cargada pero descartada por el normalizador → invalida, y en rojo', () => {
    const invalid = entry({ configured: true, usable: false });
    assert.equal(correoEnvVarState(invalid), 'invalida');
    assert.equal(correoEnvVarColor(invalid), 'red');
  });

  it('una obligatoria ausente es roja', () => {
    const missing = entry({ configured: false, usable: false });
    assert.equal(correoEnvVarState(missing), 'ausente');
    assert.equal(correoEnvVarColor(missing), 'red');
  });

  it('una opcional ausente es gris: tiene default', () => {
    const optional = entry({
      configured: false,
      usable: false,
      requirement: 'opcional',
    });
    assert.equal(correoEnvVarState(optional), 'ausente');
    assert.equal(correoEnvVarColor(optional), 'grey');
  });

  it('una opcional CARGADA MAL sigue siendo roja', () => {
    // `CORREO_ARGENTINO_EXT_CLIENT` con 2 dígitos: es opcional, pero cargarla
    // mal no es lo mismo que no cargarla — el módulo la tira a la basura.
    const optionalInvalid = entry({
      name: 'CORREO_ARGENTINO_EXT_CLIENT',
      configured: true,
      usable: false,
      requirement: 'opcional',
    });
    assert.equal(correoEnvVarColor(optionalInvalid), 'red');
  });
});
