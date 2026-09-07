import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseCorreoLabelResponse } from '../../../modules/correo-argentino-fulfillment/label-download';
import {
  MISSING_LABEL_MESSAGE,
  partitionCorreoLabels,
  toCorreoLabelResponse,
} from './_label-response';

const BASE64 = Buffer.from('%PDF-1.4 fake').toString('base64');

/**
 * Respuesta bulk REAL de `POST /labels` con fallas parciales, tal como llega:
 * **HTTP 200** para todo el lote, y el estado por ítem en `result`.
 *
 *  - `111` OK con `fileName`
 *  - `222` `ERROR: ...` (el envío ya fue impuesto)
 *  - `333` `OK` pero sin `fileBase64` → NO es un rótulo
 *  - `444` no aparece en la respuesta → no puede desaparecer en silencio
 *  - `555` OK con la grafía `filename` en minúscula (la doc usa las dos)
 */
const RAW_PARTIAL = [
  { trackingNumber: '111', fileBase64: BASE64, fileName: 'rotulo 111.pdf', result: 'OK' },
  { trackingNumber: '222', fileBase64: '', result: 'ERROR: el envio ya fue impuesto' },
  { trackingNumber: '333', result: 'OK' },
  { trackingNumber: '555', fileBase64: BASE64, filename: 'rótulo-555.PDF', result: 'OK' },
];

const REQUESTED = ['111', '222', '333', '444', '555'];

describe('respuesta bulk de rótulos con fallas parciales', () => {
  it('el resultado NO se colapsa a un solo éxito/fracaso', () => {
    // Es la regla central: `/labels` devuelve fallas parciales con HTTP 200. Si
    // la ruta responde "todo OK" porque la llamada no tiró, el operador se lleva
    // 2 rótulos de los 5 que pidió sin ninguna explicación.
    const body = toCorreoLabelResponse(
      parseCorreoLabelResponse(RAW_PARTIAL, REQUESTED)
    );

    assert.equal(body.labels.length, 5);
    assert.equal(body.ok_count, 2);
    assert.equal(body.error_count, 3);
  });

  it('devuelve el estado POR ÍTEM, en el orden pedido', () => {
    const body = toCorreoLabelResponse(
      parseCorreoLabelResponse(RAW_PARTIAL, REQUESTED)
    );
    assert.deepEqual(
      body.labels.map((l) => [l.tracking_number, l.ok]),
      [
        ['111', true],
        ['222', false],
        ['333', false],
        ['444', false],
        ['555', true],
      ]
    );
  });

  it('un ítem OK trae base64 y ningún error', () => {
    const body = toCorreoLabelResponse(
      parseCorreoLabelResponse(RAW_PARTIAL, REQUESTED)
    );
    const ok = body.labels.find((l) => l.tracking_number === '111');
    assert.equal(ok?.base64, BASE64);
    assert.equal(ok?.error, null);
    assert.equal(ok?.file_name, 'rotulo 111.pdf');
  });

  it('un ítem ERROR trae el motivo sin el prefijo y base64 null', () => {
    const body = toCorreoLabelResponse(
      parseCorreoLabelResponse(RAW_PARTIAL, REQUESTED)
    );
    const failed = body.labels.find((l) => l.tracking_number === '222');
    assert.equal(failed?.base64, null);
    assert.equal(failed?.error, 'el envio ya fue impuesto');
  });

  it('un "OK" sin fileBase64 se reporta como falla, no como rótulo vacío', () => {
    // Meter un buffer vacío en el ZIP produce un PDF corrupto que el operador
    // descubre recién en la impresora.
    const body = toCorreoLabelResponse(
      parseCorreoLabelResponse(RAW_PARTIAL, REQUESTED)
    );
    const noFile = body.labels.find((l) => l.tracking_number === '333');
    assert.equal(noFile?.ok, false);
    assert.equal(noFile?.base64, null);
    assert.match(noFile?.error ?? '', /no fileBase64/);
  });

  it('un TN pedido que Correo no devolvió aparece como fallido', () => {
    const body = toCorreoLabelResponse(
      parseCorreoLabelResponse(RAW_PARTIAL, REQUESTED)
    );
    const missing = body.labels.find((l) => l.tracking_number === '444');
    assert.equal(missing?.ok, false);
    assert.match(missing?.error ?? '', /NO_RESPONSE/);
  });

  it('los conteos describen la lista devuelta, no la del módulo', () => {
    // Recalcular acá evita que un filtrado previo deje los conteos mintiendo.
    const body = toCorreoLabelResponse([
      { trackingNumber: '111', base64: BASE64, fileName: null, ok: true, error: null },
    ]);
    assert.deepEqual(
      { ok: body.ok_count, err: body.error_count },
      { ok: 1, err: 0 }
    );
  });

  it('un ítem sin motivo cae al mensaje genérico en vez de null', () => {
    const body = toCorreoLabelResponse([
      { trackingNumber: '999', base64: null, fileName: null, ok: false, error: null },
    ]);
    assert.equal(body.labels[0]?.error, MISSING_LABEL_MESSAGE);
  });

  it('un ok:true incoherente (sin base64) no expone base64', () => {
    const body = toCorreoLabelResponse([
      { trackingNumber: '999', base64: null, fileName: null, ok: true, error: null },
    ]);
    assert.equal(body.labels[0]?.base64, null);
  });
});

describe('partitionCorreoLabels', () => {
  const labels = parseCorreoLabelResponse(RAW_PARTIAL, REQUESTED);

  it('separa lo que va al ZIP de lo que va al summary', () => {
    const { entries, failed } = partitionCorreoLabels(
      labels,
      (label) => `fallback-${label.trackingNumber}.pdf`
    );

    assert.deepEqual(
      entries.map((e) => e.tracking_number),
      ['111', '555']
    );
    assert.deepEqual(
      failed.map((f) => f.tracking_number),
      ['222', '333', '444']
    );
  });

  it('ningún ítem se pierde: entries + failed = total pedido', () => {
    const { entries, failed } = partitionCorreoLabels(labels, () => 'x.pdf');
    assert.equal(entries.length + failed.length, REQUESTED.length);
  });

  it('el buffer del ZIP es el PDF decodificado', () => {
    const { entries } = partitionCorreoLabels(labels, () => 'x.pdf');
    assert.equal(entries[0]?.buffer.toString('utf8'), '%PDF-1.4 fake');
  });

  it('sanitiza el fileName de Correo (espacios y acentos)', () => {
    // El nombre termina en un header `Content-Disposition` y dentro de un ZIP.
    const { entries } = partitionCorreoLabels(labels, () => 'ignorado.pdf');
    assert.equal(entries[0]?.file_name, 'rotulo_111.pdf');
    // `filename` en minúscula también se lee, y `.PDF` no duplica la extensión.
    assert.equal(entries[1]?.file_name, 'r_tulo-555.PDF');
  });

  it('usa el fallback del caller cuando Correo no manda fileName', () => {
    const { entries } = partitionCorreoLabels(
      [{ trackingNumber: '111', base64: BASE64, fileName: null, ok: true, error: null }],
      (label) => `correo-1042-${label.trackingNumber}.pdf`
    );
    assert.equal(entries[0]?.file_name, 'correo-1042-111.pdf');
  });

  it('agrega .pdf si el fallback no lo trae', () => {
    const { entries } = partitionCorreoLabels(
      [{ trackingNumber: '111', base64: BASE64, fileName: null, ok: true, error: null }],
      () => 'sin-extension'
    );
    assert.equal(entries[0]?.file_name, 'sin-extension.pdf');
  });

  it('un ok:true sin base64 va a failed, no al ZIP', () => {
    const { entries, failed } = partitionCorreoLabels(
      [{ trackingNumber: '111', base64: null, fileName: null, ok: true, error: null }],
      () => 'x.pdf'
    );
    assert.equal(entries.length, 0);
    assert.deepEqual(failed, [
      { tracking_number: '111', error: MISSING_LABEL_MESSAGE },
    ]);
  });

  it('una lista vacía no revienta', () => {
    assert.deepEqual(partitionCorreoLabels([], () => 'x.pdf'), {
      entries: [],
      failed: [],
    });
  });
});
