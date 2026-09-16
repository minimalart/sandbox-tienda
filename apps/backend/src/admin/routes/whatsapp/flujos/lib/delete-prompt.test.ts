import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEED_GRAPH } from '../../../../../lib/whatsapp/flow/seed';
import { addNode, connect, patchNode, type Graph } from '../_editor';
import { describeDeletion } from './delete-prompt';

const seed = SEED_GRAPH as Graph;
const EMPTY: Graph = { nodes: [], edges: [] };

describe('qué se lleva un borrado', () => {
  it('un paso suelto no arrastra nada', () => {
    const g = addNode(EMPTY, 'message').graph;
    const prompt = describeDeletion(g, { kind: 'nodes', ids: ['message_1'] });
    assert.ok(prompt.description.includes('no se lleva nada'));
  });

  it('un paso con conexiones dice CUÁNTAS se lleva', () => {
    // Es lo que hace frenar: "¿seguro?" no aporta nada, "se lleva 3 conexiones" sí.
    const prompt = describeDeletion(seed, { kind: 'nodes', ids: ['menu'] });
    // `menu` recibe una del inicio y saca tres: cuatro en total.
    assert.ok(prompt.description.includes('4'), prompt.description);
  });

  it('cuenta también las que LLEGAN, no sólo las que salen', () => {
    // Contar sólo las salientes escondería las que rompen el recorrido de otro lado.
    let g = addNode(EMPTY, 'message').graph;
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'message_1', target: 'end_1' });
    const prompt = describeDeletion(g, { kind: 'nodes', ids: ['end_1'] });
    assert.ok(prompt.description.includes('1'), prompt.description);
  });

  it('el título usa el nombre que le puso el operador', () => {
    assert.equal(describeDeletion(seed, { kind: 'nodes', ids: ['menu'] }).title, 'Borrar "Menú principal"');
  });

  it('y si no tiene nombre, el tipo', () => {
    const g = addNode(EMPTY, 'message').graph;
    assert.equal(describeDeletion(g, { kind: 'nodes', ids: ['message_1'] }).title, 'Borrar "Mensaje"');
  });

  it('varios pasos se cuentan en plural', () => {
    const prompt = describeDeletion(seed, { kind: 'nodes', ids: ['menu', 'ayuda'] });
    assert.equal(prompt.title, 'Borrar 2 pasos');
  });

  it('una conexión dice entre qué pasos estaba', () => {
    const prompt = describeDeletion(seed, { kind: 'edge', id: 'e_buy' });
    assert.ok(prompt.description.includes('Menú principal'));
    assert.ok(prompt.description.includes('¿Sabe qué busca?'));
  });

  it('una conexión que ya no existe no rompe el texto', () => {
    const prompt = describeDeletion(seed, { kind: 'edge', id: 'e_fantasma' });
    assert.ok(prompt.title.length > 0 && prompt.description.length > 0);
  });

  it('el singular y el plural de las conexiones se distinguen', () => {
    let g = addNode(EMPTY, 'message').graph;
    g = addNode(g, 'end').graph;
    g = connect(g, { source: 'message_1', target: 'end_1' });
    const una = describeDeletion(g, { kind: 'nodes', ids: ['message_1'] });
    assert.ok(una.description.includes('la conexión que lo toca'), una.description);

    let dos = patchNode(g, 'message_1', {});
    dos = addNode(dos, 'end').graph;
    dos = connect(dos, { source: 'message_1', target: 'end_2' });
    const varias = describeDeletion(dos, { kind: 'nodes', ids: ['message_1'] });
    assert.ok(varias.description.includes('las conexiones que lo tocan'), varias.description);
  });
});
