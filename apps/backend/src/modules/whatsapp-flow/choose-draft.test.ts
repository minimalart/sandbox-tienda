import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chooseDraftTarget } from './choose-draft';

describe('a qué fila escribe un guardado', () => {
  it('a la pedida, cuando es un borrador de esta tienda', () => {
    assert.equal(chooseDraftTarget({ status: 'draft', site_id: 'site_a' }, 'site_a'), 'update');
  });

  it('el recorrido general se edita sin tienda', () => {
    assert.equal(chooseDraftTarget({ status: 'draft', site_id: null }, null), 'update');
  });

  it('NUNCA le pisa el grafo a la versión publicada', () => {
    // Es la que está atendiendo clientes en este momento. Se crea una copia y el
    // publicado queda intacto hasta que alguien publique la copia.
    assert.equal(chooseDraftTarget({ status: 'active', site_id: 'site_a' }, 'site_a'), 'create');
  });

  it('ni a una versión vieja', () => {
    // Una supersedida es el registro de lo que atendió: sobrescribirla dejaría la
    // traza de conversaciones reales apuntando a un dibujo que nunca corrió.
    assert.equal(chooseDraftTarget({ status: 'superseded', site_id: null }, null), 'create');
  });

  it('ni a un borrador de OTRA tienda', () => {
    assert.equal(chooseDraftTarget({ status: 'draft', site_id: 'site_b' }, 'site_a'), 'create');
  });

  it('un borrador general no se edita desde una tienda', () => {
    // El general lo comparten todas: editarlo desde una cambiaría el recorrido de
    // las demás sin que nadie lo pida.
    assert.equal(chooseDraftTarget({ status: 'draft', site_id: null }, 'site_a'), 'create');
  });

  it('sin fila pedida, se crea', () => {
    assert.equal(chooseDraftTarget(null, 'site_a'), 'create');
  });

  it('una fila sin estado se trata como ajena', () => {
    assert.equal(chooseDraftTarget({ site_id: 'site_a' }, 'site_a'), 'create');
  });

  it('`null` y cadena vacía son la misma tienda', () => {
    // Es la convención del índice único parcial: `coalesce(site_id, '')`.
    assert.equal(chooseDraftTarget({ status: 'draft', site_id: '' }, null), 'update');
  });
});
