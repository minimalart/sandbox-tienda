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
