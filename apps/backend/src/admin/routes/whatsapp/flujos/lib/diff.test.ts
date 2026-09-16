import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEED_GRAPH } from '../../../../../lib/whatsapp/flow/seed';
import {
  addNode,
  applyPositions,
  connect,
  patchNode,
  patchOption,
  removeNode,
  type Graph,
} from '../_editor';
import { describeDiff, diffGraphs, edgeDiffState, nodeDiffState } from './diff';

const seed = SEED_GRAPH as Graph;

describe('qué cambió respecto de lo publicado', () => {
  it('el mismo recorrido no tiene cambios', () => {
    const diff = diffGraphs(seed, seed);
    assert.equal(diff.same, true);
    assert.equal(describeDiff(diff), 'No hay cambios respecto de lo publicado.');
  });

  it('ACOMODAR EL DIAGRAMA NO ES UN CAMBIO', () => {
    // Mover una tarjeta no cambia lo que el cliente recibe. Si contara, acomodar el
    // recorrido lo marcaría entero como distinto y el resumen dejaría de decir nada.
    const movido = applyPositions(
      seed,
      seed.nodes.map((n) => ({ id: n.id, position: { x: 999, y: 999 } })),
    );
    assert.equal(diffGraphs(seed, movido).same, true);
  });

  it('un paso nuevo aparece como agregado', () => {
    const { graph } = addNode(seed, 'message');
    const diff = diffGraphs(seed, graph);
    assert.deepEqual(diff.nodes.added, ['message_1']);
    assert.equal(diff.same, false);
  });

  it('un paso borrado aparece como borrado, con sus flechas', () => {
    const diff = diffGraphs(seed, removeNode(seed, 'ayuda'));
    assert.deepEqual(diff.nodes.removed, ['ayuda']);
    assert.ok(diff.edges.removed.length > 0);
  });

  it('cambiar el texto de un mensaje marca ese campo', () => {
    const diff = diffGraphs(seed, patchNode(seed, 'menu', { body: 'Otro texto' }));
    assert.deepEqual(diff.nodes.changed, [{ id: 'menu', fields: ['body'] }]);
  });

  it('renombrar una respuesta marca las opciones', () => {
    const diff = diffGraphs(seed, patchOption(seed, 'menu', 'buy', { label: 'Quiero comprar' }));
    assert.deepEqual(diff.nodes.changed[0]?.fields, ['options']);
  });

  it('el nombre interno también cuenta: lo lee quien edita después', () => {
    const diff = diffGraphs(seed, patchNode(seed, 'menu', { label: 'Menú v2' }));
    assert.deepEqual(diff.nodes.changed[0]?.fields, ['label']);
  });

  it('una flecha nueva aparece como agregada', () => {
    const graph = connect(seed, { source: 'pedido', target: 'fin' });
    assert.equal(diffGraphs(seed, graph).edges.added.length, 1);
  });

  it('re-dibujar la MISMA flecha no es un cambio', () => {
    // Las flechas se comparan por su forma —de dónde a dónde, por qué salida— y no
    // por id: borrar una y volver a dibujarla igual no le cambia nada al cliente.
    const sinFlecha: Graph = {
      nodes: seed.nodes,
      edges: seed.edges.filter((e) => e.id !== 'e_buy'),
    };
    const redibujada: Graph = {
      nodes: seed.nodes,
      edges: [...sinFlecha.edges, { id: 'e_nueva', source: 'menu', target: 'sabe_producto', on: 'buy' }],
    };
    assert.equal(diffGraphs(seed, redibujada).same, true);
  });

  it('re-atar una flecha a otra respuesta SÍ es un cambio', () => {
    const reatada: Graph = {
      nodes: seed.nodes,
      edges: seed.edges.map((e) => (e.id === 'e_buy' ? { ...e, on: 'help' } : e)),
    };
    const diff = diffGraphs(seed, reatada);
    assert.equal(diff.edges.added.length, 1);
    assert.equal(diff.edges.removed.length, 1);
  });

  it('un campo vacío y uno ausente son lo mismo', () => {
    // El editor borra las claves vacías en unos campos y las deja en otros: sin esta
    // tolerancia, abrir un paso y cerrarlo sin tocar nada lo marcaba como cambiado.
    const conVacio = patchNode(seed, 'salida', { body: '' });
    assert.equal(diffGraphs(seed, conVacio).same, true);
  });
});

describe('el resumen en una línea', () => {
  it('cuenta lo que cambió, en singular y plural', () => {
    let graph = addNode(seed, 'message').graph;
    graph = addNode(graph, 'end').graph;
    graph = patchNode(graph, 'menu', { body: 'Otro' });
    const texto = describeDiff(diffGraphs(seed, graph));
    assert.ok(texto.includes('2 pasos nuevos'));
    assert.ok(texto.includes('1 paso modificado'));
  });

  it('un solo cambio se lee en singular', () => {
    const texto = describeDiff(diffGraphs(seed, addNode(seed, 'message').graph));
    assert.equal(texto, '1 paso nuevo');
  });
});

describe('cómo se pinta cada paso en la comparación', () => {
  it('distingue agregado, borrado, cambiado y sin cambios', () => {
    let graph = addNode(seed, 'message').graph;
    graph = patchNode(graph, 'menu', { body: 'Otro' });
    graph = removeNode(graph, 'ayuda');
    const diff = diffGraphs(seed, graph);

    assert.equal(nodeDiffState(diff, 'message_1'), 'added');
    assert.equal(nodeDiffState(diff, 'ayuda'), 'removed');
    assert.equal(nodeDiffState(diff, 'menu'), 'changed');
    assert.equal(nodeDiffState(diff, 'inicio'), 'same');
  });

  it('las flechas también', () => {
    const graph = connect(seed, { source: 'pedido', target: 'fin' });
    const diff = diffGraphs(seed, graph);
    assert.equal(edgeDiffState(diff, diff.edges.added[0] as string), 'added');
    assert.equal(edgeDiffState(diff, 'e_buy'), 'same');
  });
});

describe('contra un recorrido que nunca se publicó', () => {
  it('todo es nuevo', () => {
    const diff = diffGraphs({ nodes: [], edges: [] }, seed);
    assert.equal(diff.nodes.added.length, seed.nodes.length);
    assert.equal(diff.edges.added.length, seed.edges.length);
    assert.equal(diff.nodes.removed.length, 0);
  });
});
