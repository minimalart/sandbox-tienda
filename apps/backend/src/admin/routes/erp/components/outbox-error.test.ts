import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { splitOutboxError } from './outbox-error.ts';

/** Mensajes copiados TAL CUAL del outbox de desdeelsur (2026-09-23). */
const REJECTED_409 =
  'El ERP rechazó la venta con un conflicto en el PRIMER envío, así que no puede ser un duplicado: nunca se había mandado. Motivo del ERP: {"message":"Código de base y/o código de fórmula no válido/s."}';
const SERVER_500 =
  'Zeus: error del servidor (HTTP 500) — {"status":"INTERNAL_SERVER_ERROR","errors":[{"code":0,"details":null,"message":"Ha ocurrido un error interno. ","status":null}]}';
const INVOICE_WINDOW =
  'Se agotó la ventana esperando el comprobante: el ERP todavía no facturó el pedido. Verificá en el ERP si el pedido se facturó y reintentá el evento a mano.';

describe('splitOutboxError', () => {
  it('saca el motivo del ERP del final de un rechazo 409', () => {
    const parts = splitOutboxError(REJECTED_409);
    assert.equal(parts.erpMessage, 'Código de base y/o código de fórmula no válido/s.');
    assert.equal(
      parts.summary,
      'El ERP rechazó la venta con un conflicto en el PRIMER envío, así que no puede ser un duplicado: nunca se había mandado.'
    );
  });

  it('busca el message dentro de errors[] (500 de Zeus)', () => {
    const parts = splitOutboxError(SERVER_500);
    assert.equal(parts.erpMessage, 'Ha ocurrido un error interno.');
    assert.equal(parts.summary, 'Zeus: error del servidor (HTTP 500)');
  });

  it('un mensaje sin JSON queda entero como resumen', () => {
    assert.deepEqual(splitOutboxError(INVOICE_WINDOW), {
      summary: INVOICE_WINDOW,
      erpMessage: null,
    });
  });

  it('un JSON sin message no se trata como motivo del ERP', () => {
    const raw = 'Algo falló: {"status":"X"}';
    assert.deepEqual(splitOutboxError(raw), { summary: raw, erpMessage: null });
  });

  it('una llave suelta que no abre JSON no rompe nada', () => {
    const raw = 'Texto con { una llave y {"message":"el real"}';
    assert.equal(splitOutboxError(raw).erpMessage, 'el real');
  });

  it('null y vacío dan resumen vacío', () => {
    assert.deepEqual(splitOutboxError(null), { summary: '', erpMessage: null });
    assert.deepEqual(splitOutboxError('   '), { summary: '', erpMessage: null });
  });
});
