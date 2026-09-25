import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { previewPlan } from './preview';

describe('qué se puede correr de verdad en una prueba', () => {
  it('buscar productos se corre: no le cambia nada a nadie', () => {
    assert.deepEqual(previewPlan('wa_search_products', { query: 'remera' }), {
      kind: 'search',
      query: 'remera',
    });
  });

  it('mostrar productos elegidos a mano también', () => {
    assert.deepEqual(previewPlan('wa_list_pinned', { product_ids: ['prod_1', 'prod_2'] }), {
      kind: 'pinned',
      productIds: ['prod_1', 'prod_2'],
    });
  });

  it('agregar al carrito NO: tocaría un carrito real', () => {
    const plan = previewPlan('wa_add_to_cart', { variant_id: 'variant_1' });
    assert.equal(plan.kind, 'unsupported');
    assert.match((plan as { reason: string }).reason, /carrito/);
  });

  it('el link de pago NO: generaría un pago real', () => {
    assert.equal(previewPlan('wa_checkout_link', {}).kind, 'unsupported');
  });

  it('derivar a una persona NO: despertaría a alguien del equipo', () => {
    assert.equal(previewPlan('wa_handoff_to_human', {}).kind, 'unsupported');
  });

  it('una tool que nadie clasificó NO se corre', () => {
    // Es la regla que importa: agregar una tool nueva no puede hacer que se ejecute
    // sola en una prueba por haberse olvidado de pensarlo.
    assert.equal(previewPlan('wa_tool_que_no_existe_todavia', {}).kind, 'unsupported');
  });

  it('una búsqueda sin texto explica por qué todavía no muestra nada', () => {
    // Pasa siempre que el paso busca `{{text}}` y el cliente no escribió aún.
    const plan = previewPlan('wa_search_products', { query: '' });
    assert.equal(plan.kind, 'unsupported');
    assert.match((plan as { reason: string }).reason, /escribí algo/i);
  });

  it('una lista sin productos elegidos también', () => {
    const plan = previewPlan('wa_list_pinned', { product_ids: [] });
    assert.equal(plan.kind, 'unsupported');
    assert.match((plan as { reason: string }).reason, /productos elegidos/);
  });

  it('las presentaciones se corren: son el paso que más se traba', () => {
    // Es la acción que dejaba la pregunta siguiente vacía y obligaba a escribir el
    // JSON de las opciones a mano, con los ids de variante adentro.
    assert.deepEqual(previewPlan('wa_list_presentations', { variant_id: 'variant_1' }), {
      kind: 'presentations',
      variantId: 'variant_1',
      productId: '',
    });
  });

  it('las presentaciones sin producto elegido dicen qué falta', () => {
    const plan = previewPlan('wa_list_presentations', {});
    assert.equal(plan.kind, 'unsupported');
    assert.match((plan as { reason: string }).reason, /tocá uno/i);
  });

  it('la ficha de un producto se lee del catálogo', () => {
    assert.deepEqual(previewPlan('wa_product_detail', { variant_id: 'variant_9' }), {
      kind: 'detail',
      variantId: 'variant_9',
    });
  });

  it('ver el carrito dice POR QUÉ no se puede, no "todavía no"', () => {
    // La diferencia entre entender que falta una conversación y creer que el editor
    // está incompleto.
    const plan = previewPlan('wa_view_cart', {});
    assert.equal(plan.kind, 'unsupported');
    assert.match((plan as { reason: string }).reason, /carrito/i);
  });

  it('el asesor guiado explica que lleva su propia conversación', () => {
    const plan = previewPlan('wa_guided_start', {});
    assert.equal(plan.kind, 'unsupported');
    assert.match((plan as { reason: string }).reason, /asesor/i);
  });

  it('un paso sin acción elegida no rompe nada', () => {
    assert.equal(previewPlan(undefined, {}).kind, 'unsupported');
  });

  it('los ids que no son texto se descartan', () => {
    assert.deepEqual(previewPlan('wa_list_pinned', { product_ids: ['prod_1', 42, null] }), {
      kind: 'pinned',
      productIds: ['prod_1'],
    });
  });
});

describe('la consulta de pedido se prueba de verdad', () => {
  it('con las dos respuestas, se corre', () => {
    assert.deepEqual(previewPlan('wa_lookup_order', { order_number: '1234', email: 'ana@mail.com', save_as: 'x' }), {
      kind: 'order',
      orderNumber: '1234',
      email: 'ana@mail.com',
    });
  });

  it('si falta una (pregunta sin contestar o paso mal atado), se explica en vez de buscar', () => {
    const plan = previewPlan('wa_lookup_order', { order_number: '1234', email: '' });
    assert.equal(plan.kind, 'unsupported');
  });
});
