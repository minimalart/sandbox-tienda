import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { answerOrderLookup, ORDER_NOT_FOUND_MESSAGE } from './order-lookup';

/**
 * Un container con UN pedido: #1234 de ana@mail.com. Cuenta las consultas para
 * poder afirmar que un dato ilegible no llega a buscar nada.
 */
function fakeContainer() {
  const calls: Array<Record<string, unknown>> = [];
  const query = {
    graph: async ({ filters }: { filters: Record<string, unknown> }) => {
      calls.push(filters);
      if ('display_id' in filters) {
        return {
          data: filters.display_id === 1234 ? [{ id: 'order_1', display_id: 1234, email: ' Ana@Mail.com ' }] : [],
        };
      }
      return {
        data: [
          {
            id: 'order_1',
            display_id: 1234,
            payment_status: 'captured',
            fulfillment_status: 'shipped',
            total: 5000,
            currency_code: 'ars',
            shipping_methods: [{ name: 'Envío a domicilio' }],
            fulfillments: [],
          },
        ],
      };
    },
  };
  return { container: { resolve: () => query } as never, calls };
}

describe('consulta de pedido desde un recorrido (DESDEELSUR-81)', () => {
  it('con número y email del mismo pedido, contesta el estado', async () => {
    const { container } = fakeContainer();
    const answer = await answerOrderLookup(container, 'el pedido #1234', 'ana@mail.com');
    assert.equal(answer.outcome, 'found');
    assert.match(answer.text, /Pedido #1234/);
    assert.match(answer.text, /Pago: pagado/);
    assert.match(answer.text, /Entrega: Envío a domicilio/);
  });

  it('el email se compara sin mayúsculas ni espacios', async () => {
    const { container } = fakeContainer();
    const answer = await answerOrderLookup(container, '1234', '  ANA@mail.COM ');
    assert.equal(answer.outcome, 'found');
  });

  /**
   * §28: con el número solo cualquiera leería el pedido de otra persona probando
   * números. Por eso un email que no coincide contesta EXACTAMENTE lo mismo que un
   * pedido que no existe: distinguirlos ya confirmaría que el pedido existe.
   */
  it('un email que no coincide no muestra NADA y no se distingue de un pedido inexistente', async () => {
    const { container } = fakeContainer();
    const ajeno = await answerOrderLookup(container, '1234', 'otro@mail.com');
    const inexistente = await answerOrderLookup(container, '9999', 'ana@mail.com');
    assert.equal(ajeno.outcome, 'not_found');
    assert.equal(ajeno.text, ORDER_NOT_FOUND_MESSAGE);
    assert.deepEqual(ajeno, inexistente);
    assert.doesNotMatch(ajeno.text, /1234/);
  });

  it('un número ilegible dice qué corregir y no consulta nada', async () => {
    const { container, calls } = fakeContainer();
    const answer = await answerOrderLookup(container, 'no me acuerdo', 'ana@mail.com');
    assert.equal(answer.outcome, 'invalid');
    assert.equal(answer.outcome === 'invalid' && answer.field, 'order_number');
    assert.equal(calls.length, 0);
  });

  it('un email ilegible dice qué corregir y no consulta nada', async () => {
    const { container, calls } = fakeContainer();
    const answer = await answerOrderLookup(container, '1234', 'ana arroba mail');
    assert.equal(answer.outcome, 'invalid');
    assert.equal(answer.outcome === 'invalid' && answer.field, 'email');
    assert.equal(calls.length, 0);
  });

  it('una respuesta que falta (paso mal atado) no revienta: pide el dato', async () => {
    const { container } = fakeContainer();
    const answer = await answerOrderLookup(container, undefined, '');
    assert.equal(answer.outcome, 'invalid');
  });
});
