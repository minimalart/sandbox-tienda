import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SEED_GRAPH } from '../../../../../lib/whatsapp/flow/seed';
import { addNode, connect, patchNode, type Graph } from '../_editor';
import {
  flowLevelIssues,
  issuesByEdge,
  issuesByNode,
  issueTargets,
  liveIssues,
  nextIssueTarget,
  type EditorIssue,
} from './issues';

const EMPTY: Graph = { nodes: [], edges: [] };

/** Un recorrido mínimo que publica limpio: entrada catch-all → mensaje → fin. */
function sano(): Graph {
  let g = addNode(EMPTY, 'start').graph;
  g = patchNode(g, 'start_1', { match: { fallback: true } });
  g = addNode(g, 'message').graph;
  g = patchNode(g, 'message_1', { body: 'Hola' });
  g = addNode(g, 'end').graph;
  g = connect(g, { source: 'start_1', target: 'message_1' });
  g = connect(g, { source: 'message_1', target: 'end_1' });
  return g;
}

const mensajes = (issues: EditorIssue[]): string[] => issues.map((i) => i.message);

describe('los problemas se ven mientras se dibuja', () => {
  it('el recorrido base no tiene ninguno', () => {
    // Si el recorrido que el editor ofrece cargar saliera con problemas, nadie
    // volvería a creerle al contador.
    assert.deepEqual(liveIssues(SEED_GRAPH as Graph), []);
  });

  it('un recorrido sano tampoco', () => {
    assert.deepEqual(liveIssues(sano()), []);
  });

  it('un canvas vacío avisa que falta la entrada', () => {
    // El texto dice "Entrada" con mayúscula, que es como se llama el paso en la
    // biblioteca y en la tarjeta: el mensaje tiene que nombrar lo que el operador ve.
    assert.ok(mensajes(liveIssues(EMPTY)).some((m) => m.includes('ninguna Entrada')));
  });

  it('un paso sin salida se reporta contra ese paso', () => {
    let g = sano();
    g = addNode(g, 'message').graph;
    g = patchNode(g, 'message_2', { body: 'Suelto' });
    const issues = liveIssues(g);
    assert.ok(issues.some((i) => i.nodeId === 'message_2' && i.severity === 'blocking'));
  });

  it('lo que el servidor rechaza al publicar viene marcado como bloqueante', () => {
    const issues = liveIssues(EMPTY);
    assert.ok(issues.length > 0);
    assert.ok(issues.every((i) => i.severity === 'blocking'));
  });

  it('una opción SIN TEXTO es un aviso, no un bloqueo', () => {
    /**
     * Es el caso que el servidor no puede ver: `normalizeGraph` completa la etiqueta
     * vacía con el id interno antes de validar, así que al validador le llega
     * "arreglada" y publica — pero el cliente termina viendo un botón que dice
     * `opcion_1`. El editor sí lo ve, y avisar sin bloquear es la única lectura
     * honesta: prometer un rechazo que no va a pasar es peor que no avisar.
     */
    let g = sano();
    g = addNode(g, 'ask_buttons').graph;
    g = patchNode(g, 'ask_buttons_1', { body: '¿Qué querés?', options: [{ value: 'a', label: '' }] });
    g = connect(g, { source: 'ask_buttons_1', target: 'end_1', sourceHandle: 'a' });

    const issues = liveIssues(g);
    const aviso = issues.find((i) => i.message.includes('sin texto'));
    assert.ok(aviso, `esperaba el aviso de opción sin texto, salieron: ${mensajes(issues).join(' | ')}`);
    assert.equal(aviso?.severity, 'warning');
    assert.equal(aviso?.nodeId, 'ask_buttons_1');
  });

  it('no repite el mismo mensaje dos veces para el mismo paso', () => {
    const issues = liveIssues(EMPTY);
    const claves = issues.map((i) => `${i.nodeId ?? ''}|${i.message}`);
    assert.equal(new Set(claves).size, claves.length);
  });

  it('una arista hacia un paso borrado no se reporta: el servidor la descarta', () => {
    // El editor normaliza igual que la ruta antes de validar. Sin eso reportaría un
    // problema que al guardar desaparece solo, y el operador lo perseguiría.
    const g = sano();
    const conFantasma: Graph = {
      nodes: g.nodes,
      edges: [...g.edges, { id: 'e_fantasma', source: 'message_1', target: 'no_existe' }],
    };
    assert.ok(!mensajes(liveIssues(conFantasma)).some((m) => m.includes('no_existe')));
  });
});

describe('dónde se pinta cada problema', () => {
  const issues: EditorIssue[] = [
    { nodeId: 'a', message: 'uno', severity: 'blocking' },
    { nodeId: 'a', message: 'dos', severity: 'warning' },
    { edgeId: 'e1', message: 'tres', severity: 'blocking' },
    { message: 'sin entrada', severity: 'blocking' },
  ];

  it('agrupa por paso', () => {
    assert.deepEqual(mensajes(issuesByNode(issues).get('a') ?? []), ['uno', 'dos']);
  });

  it('agrupa por flecha', () => {
    assert.deepEqual(mensajes(issuesByEdge(issues).get('e1') ?? []), ['tres']);
  });

  it('los que no son de nadie van al panel del recorrido', () => {
    // Si no, el header cuenta problemas que no se ven en ninguna parte del canvas.
    assert.deepEqual(mensajes(flowLevelIssues(issues)), ['sin entrada']);
  });

  it('los lugares a mirar no se repiten y mantienen el orden', () => {
    assert.deepEqual(issueTargets(issues), [
      { kind: 'node', id: 'a' },
      { kind: 'edge', id: 'e1' },
    ]);
  });
});

describe('ir saltando de problema en problema', () => {
  const issues: EditorIssue[] = [
    { nodeId: 'a', message: 'uno', severity: 'blocking' },
    { nodeId: 'b', message: 'dos', severity: 'blocking' },
  ];

  it('sin nada seleccionado, arranca por el primero', () => {
    assert.deepEqual(nextIssueTarget(issues, null), { kind: 'node', id: 'a' });
  });

  it('avanza al siguiente', () => {
    assert.deepEqual(nextIssueTarget(issues, { kind: 'node', id: 'a' }), { kind: 'node', id: 'b' });
  });

  it('desde el último vuelve al primero', () => {
    // Frenarse en el último deja al operador pensando que el botón se rompió.
    assert.deepEqual(nextIssueTarget(issues, { kind: 'node', id: 'b' }), { kind: 'node', id: 'a' });
  });

  it('si el seleccionado ya no tiene problemas, arranca de nuevo', () => {
    assert.deepEqual(nextIssueTarget(issues, { kind: 'node', id: 'z' }), { kind: 'node', id: 'a' });
  });

  it('sin problemas no hay a dónde ir', () => {
    assert.equal(nextIssueTarget([], null), null);
  });
});
