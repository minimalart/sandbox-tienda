import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type OrderChangeActionForTransfer,
  buildTransferAcceptLink,
  pickTransferDetails,
} from './order-transfer-link';

/**
 * DESDEELSUR-61: "Vincular a mi cuenta" generaba el token y no llegaba ningún
 * mail, porque nadie escuchaba `order.transfer_requested`.
 *
 * Lo que se fija acá es la forma del dato del core, que es donde esto se rompe
 * callado: el evento NO trae el token, y leer mal la acción deja al subscriber
 * sin nada que mandar sin ningún error.
 */

const transferAction = (
  details: Record<string, unknown> = {},
): OrderChangeActionForTransfer => ({
  action: 'TRANSFER_CUSTOMER',
  details: {
    token: '9f2c1d3e-0000-4444-8888-aabbccddeeff',
    original_email: 'invitada@example.com',
    ...details,
  },
});

test('saca el token y el email de la orden de la acción de transferencia', () => {
  const picked = pickTransferDetails([transferAction()]);
  assert.equal(picked?.token, '9f2c1d3e-0000-4444-8888-aabbccddeeff');
  assert.equal(picked?.original_email, 'invitada@example.com');
  assert.equal(picked?.new_email, null);
});

test('ignora las acciones que no son de transferencia', () => {
  const actions = [
    { action: 'ITEM_ADD', details: { token: 'no-es-este' } },
    transferAction(),
  ];
  assert.equal(pickTransferDetails(actions)?.token, '9f2c1d3e-0000-4444-8888-aabbccddeeff');
});

test('devuelve null sin acción, sin token o sin email: no hay medio mail que mandar', () => {
  assert.equal(pickTransferDetails([]), null);
  assert.equal(pickTransferDetails(null), null);
  assert.equal(pickTransferDetails([{ action: 'ITEM_ADD', details: {} }]), null);
  assert.equal(pickTransferDetails([transferAction({ token: '' })]), null);
  assert.equal(pickTransferDetails([transferAction({ original_email: null })]), null);
  assert.equal(pickTransferDetails([{ action: 'TRANSFER_CUSTOMER', details: null }]), null);
});

test('new_email sólo aparece si la solicitud pidió cambiarlo', () => {
  const picked = pickTransferDetails([transferAction({ new_email: 'cuenta@example.com' })]);
  assert.equal(picked?.new_email, 'cuenta@example.com');
});

test('el destinatario es el email de la ORDEN, no el de quien reclama', () => {
  // El candado del flujo: quien pide la vinculación puede ser cualquiera; la
  // confirmación le llega a la dueña del pedido.
  const picked = pickTransferDetails([
    transferAction({ original_email: 'duena@example.com', new_email: 'atacante@example.com' }),
  ]);
  assert.equal(picked?.original_email, 'duena@example.com');
});

test('el link apunta a la página de aceptación, sin countryCode', () => {
  assert.equal(
    buildTransferAcceptLink('https://tienda.com', 'order_01ABC', 'tok-123'),
    'https://tienda.com/order/order_01ABC/transfer/tok-123/accept',
  );
});

test('la barra final de la base no duplica', () => {
  assert.equal(
    buildTransferAcceptLink('https://tienda.com/', 'order_01ABC', 'tok-123'),
    'https://tienda.com/order/order_01ABC/transfer/tok-123/accept',
  );
});

test('el token se escapa: es un uuid, pero el link no puede depender de eso', () => {
  assert.match(buildTransferAcceptLink('https://t.com', 'o/1', 'a b'), /\/order\/o%2F1\/transfer\/a%20b\/accept/);
});
