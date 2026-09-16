import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEED_GRAPH } from '../../../../../lib/whatsapp/flow/seed';
import { addNode, patchNode, removeNode, type Graph } from '../_editor';
import { compareOverlay, DROP_ALERT, metricsOverlay } from './overlays';

const seed = SEED_GRAPH as Graph;

describe('comparar el borrador con lo publicado', () => {
  it('sin cambios no pinta nada', () => {
    const overlay = compareOverlay(seed, seed);
    assert.deepEqual(overlay.nodes, {});
    assert.deepEqual(overlay.edges, {});
    assert.deepEqual(overlay.ghostNodes, []);
  });

  it('un paso nuevo se marca como nuevo', () => {
    const { graph } = addNode(seed, 'message');
    const overlay = compareOverlay(graph, seed);
    assert.equal(overlay.nodes.message_1?.badge, 'Nuevo');
    assert.equal(overlay.nodes.message_1?.tone, 'ok');
  });

  it('un paso cambiado dice QUÉ cambió, en castellano', () => {
    // "Cambió: body" no le dice nada a quien está por publicar.
    const graph = patchNode(seed, 'menu', { body: 'Otro texto' });
    assert.equal(compareOverlay(graph, seed).nodes.menu?.badge, 'Cambió: el texto');
  });

  it('UN PASO BORRADO SE SIGUE DIBUJANDO', () => {
    // Si no, "borraste el paso de ayuda" sería un renglón en una lista en vez de un
    // hueco en el diagrama, que es donde se entiende qué se rompe.
    const graph = removeNode(seed, 'ayuda');
    const overlay = compareOverlay(graph, seed);
    assert.ok(overlay.ghostNodes.some((n) => n.id === 'ayuda'));
    assert.equal(overlay.nodes.ayuda?.badge, 'Se borra');
  });

  it('el paso borrado se dibuja en la posición que tenía', () => {
    const overlay = compareOverlay(removeNode(seed, 'ayuda'), seed);
    const original = seed.nodes.find((n) => n.id === 'ayuda');
    assert.deepEqual(overlay.ghostNodes[0]?.position, original?.position);
  });

  it('las flechas del paso borrado se dibujan punteadas', () => {
    const overlay = compareOverlay(removeNode(seed, 'ayuda'), seed);
    const alguna = overlay.ghostEdges[0];
    assert.ok(alguna, 'no se dibujó ninguna flecha del paso borrado');
    assert.equal(overlay.edges[alguna.id]?.dashed, true);
  });

  it('una flecha cuyo otro extremo también se fue no se intenta dibujar', () => {
    // Dibujarla dejaría una flecha colgando de la nada.
    let graph = removeNode(seed, 'ayuda');
    graph = removeNode(graph, 'asesor');
    const overlay = compareOverlay(graph, seed);
    for (const edge of overlay.ghostEdges) {
      const dibujables = new Set([
        ...graph.nodes.map((n) => n.id),
        ...overlay.ghostNodes.map((n) => n.id),
      ]);
      assert.ok(dibujables.has(edge.source) && dibujables.has(edge.target), edge.id);
    }
  });
});

describe('las métricas sobre el canvas', () => {
  it('cada paso muestra cuántas conversaciones pasaron', () => {
    const overlay = metricsOverlay({
      sessions_total: 10,
      nodes: { menu: { sessions: 10, dropped: 0 } },
      edges: {},
    });
    assert.equal(overlay.nodes.menu?.badge, '10 conv.');
  });

  it('un paso donde se cae mucha gente se marca en rojo y dice cuánta', () => {
    // Es la diferencia entre "el bot convierte poco" y "el 60% abandona en la
    // pregunta de la presentación".
    const overlay = metricsOverlay({
      sessions_total: 10,
      nodes: { menu: { sessions: 10, dropped: 6 } },
      edges: {},
    });
    assert.ok(overlay.nodes.menu?.badge?.includes('60% se corta acá'));
    assert.equal(overlay.nodes.menu?.tone, 'error');
    assert.ok(overlay.nodes.menu?.ring);
  });

  it('un abandono bajo no se marca en rojo', () => {
    const bajo = Math.floor((DROP_ALERT - 0.1) * 10);
    const overlay = metricsOverlay({
      sessions_total: 10,
      nodes: { menu: { sessions: 10, dropped: bajo } },
      edges: {},
    });
    assert.equal(overlay.nodes.menu?.ring, undefined);
  });

  it('cada flecha muestra qué porcentaje sale por ahí', () => {
    const overlay = metricsOverlay({
      sessions_total: 10,
      nodes: {},
      edges: { e_buy: { sessions: 6, percent_of_source: 60 } },
    });
    assert.equal(overlay.edges.e_buy?.label, '60%');
  });

  it('un porcentaje que hubo que adivinar lo dice', () => {
    // Mostrarlo como exacto cuando salió de un par de nodos ambiguo es peor que no
    // mostrarlo.
    const overlay = metricsOverlay({
      sessions_total: 10,
      nodes: {},
      edges: { e_buy: { sessions: 6, percent_of_source: 60, ambiguous: true } },
    });
    assert.equal(overlay.edges.e_buy?.label, '60% aprox.');
  });

  it('sin datos no pinta nada', () => {
    const overlay = metricsOverlay({ sessions_total: 0, nodes: {}, edges: {} });
    assert.deepEqual(overlay.nodes, {});
    assert.deepEqual(overlay.edges, {});
  });
});
