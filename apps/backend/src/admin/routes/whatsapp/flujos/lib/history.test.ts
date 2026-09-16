import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addNode, patchNode, type Graph } from '../_editor';
import {
  canRedo,
  canUndo,
  COALESCE_MS,
  HISTORY_LIMIT,
  push,
  redo,
  resetHistory,
  startHistory,
  undo,
} from './history';

const EMPTY: Graph = { nodes: [], edges: [] };
const conUnPaso = addNode(EMPTY, 'message').graph;
const conDos = addNode(conUnPaso, 'end').graph;

describe('deshacer y rehacer', () => {
  it('una historia nueva no tiene nada que deshacer', () => {
    const h = startHistory(EMPTY);
    assert.equal(canUndo(h), false);
    assert.equal(canRedo(h), false);
  });

  it('deshacer devuelve el grafo anterior', () => {
    // Es lo que faltaba: borrar un paso se llevaba sus flechas y la única forma de
    // volver atrás era recargar, perdiendo todo lo no guardado.
    let h = startHistory(EMPTY);
    h = push(h, conUnPaso);
    assert.equal(h.present, conUnPaso);

    h = undo(h);
    assert.equal(h.present, EMPTY);
    assert.equal(canRedo(h), true);
  });

  it('rehacer vuelve adelante', () => {
    let h = push(startHistory(EMPTY), conUnPaso);
    h = redo(undo(h));
    assert.equal(h.present, conUnPaso);
  });

  it('deshacer varias veces recorre la historia entera', () => {
    let h = startHistory(EMPTY);
    h = push(h, conUnPaso);
    h = push(h, conDos);
    assert.equal(undo(undo(h)).present, EMPTY);
  });

  it('sin nada que deshacer, deshacer no rompe', () => {
    const h = startHistory(EMPTY);
    assert.equal(undo(h), h);
    assert.equal(redo(h), h);
  });

  it('editar después de deshacer descarta lo rehacible', () => {
    // Seguir ofreciéndolo llevaría a un grafo que mezcla dos ramas de historia.
    let h = push(startHistory(EMPTY), conUnPaso);
    h = undo(h);
    h = push(h, conDos);
    assert.equal(canRedo(h), false);
  });

  it('guardar el mismo grafo no apila una entrada', () => {
    const h = push(startHistory(conUnPaso), conUnPaso);
    assert.equal(canUndo(h), false);
  });
});

describe('agrupar el tipeo', () => {
  const a = patchNode(conUnPaso, 'message_1', { body: 'H' });
  const b = patchNode(conUnPaso, 'message_1', { body: 'Ho' });
  const c = patchNode(conUnPaso, 'message_1', { body: 'Hol' });

  it('tipear seguido en el mismo campo es UNA sola entrada', () => {
    // Sin agrupar, escribir "Hola" deja cuatro entradas y deshacer borra una letra
    // por vez.
    let h = startHistory(conUnPaso);
    h = push(h, a, { key: 'message_1:body', now: 1000 });
    h = push(h, b, { key: 'message_1:body', now: 1100 });
    h = push(h, c, { key: 'message_1:body', now: 1200 });

    assert.equal(h.past.length, 1);
    assert.equal(undo(h).present, conUnPaso);
  });

  it('cambiar de campo abre una entrada nueva', () => {
    let h = startHistory(conUnPaso);
    h = push(h, a, { key: 'message_1:body', now: 1000 });
    h = push(h, b, { key: 'message_1:label', now: 1100 });
    assert.equal(h.past.length, 2);
  });

  it('parar un rato también', () => {
    let h = startHistory(conUnPaso);
    h = push(h, a, { key: 'message_1:body', now: 1000 });
    h = push(h, b, { key: 'message_1:body', now: 1000 + COALESCE_MS + 1 });
    assert.equal(h.past.length, 2);
  });

  it('sin clave nunca agrupa: mover dos nodos son dos decisiones', () => {
    let h = startHistory(EMPTY);
    h = push(h, conUnPaso, { now: 1000 });
    h = push(h, conDos, { now: 1001 });
    assert.equal(h.past.length, 2);
  });

  it('después de deshacer, la edición siguiente no se funde con la deshecha', () => {
    let h = startHistory(conUnPaso);
    h = push(h, a, { key: 'message_1:body', now: 1000 });
    h = undo(h);
    h = push(h, b, { key: 'message_1:body', now: 1050 });
    assert.equal(h.present, b);
    assert.equal(undo(h).present, conUnPaso);
  });
});

describe('el tope del historial', () => {
  it('no crece sin límite', () => {
    // Sin tope, una sesión larga se come la memoria de la pestaña.
    let h = startHistory(EMPTY);
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
      h = push(h, { nodes: [{ id: `n${i}`, type: 'message' }], edges: [] });
    }
    assert.equal(h.past.length, HISTORY_LIMIT);
  });
});

describe('cargar un recorrido distinto borra la historia', () => {
  it('no se puede deshacer hasta antes de cargar el base', () => {
    // Deshacer hasta antes de una carga dejaría el canvas mostrando un recorrido que
    // ya no es el que se está editando.
    let h = push(startHistory(EMPTY), conUnPaso);
    h = resetHistory(conDos);
    assert.equal(canUndo(h), false);
    assert.equal(h.present, conDos);
  });
});
