import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { advance, emptyState } from './engine';
import { validateGraph, type FlowGraph } from './graph';

/** Menú → el agente contesta la consulta libre → vuelve el recorrido. */
const CON_AGENTE: FlowGraph = {
  nodes: [
    { id: 'inicio', type: 'start', match: { fallback: true } },
    {
      id: 'consulta',
      type: 'agent',
      agent_key: 'whatsapp',
      body: 'Contestá sólo sobre plazos de envío.',
    },
    {
      id: 'sigue',
      type: 'ask_buttons',
      body: '¿Te sirvió?',
      options: [{ value: 'si', label: 'Sí' }],
    },
    { id: 'fin', type: 'end', body: 'Gracias.' },
  ],
  edges: [
    { id: 'e0', source: 'inicio', target: 'consulta' },
    { id: 'e1', source: 'consulta', target: 'sigue' },
    { id: 'e2', source: 'sigue', target: 'fin', on: 'si' },
  ],
};

describe('un paso que le pasa el turno a un agente', () => {
  it('pide correr al agente con su key', () => {
    const plan = advance(CON_AGENTE, emptyState('v1'), { text: '¿cuánto tarda?', selectionId: null });
    const step = plan.steps[0];
    assert.equal(step?.kind, 'run_agent');
    assert.equal((step as { agentKey: string }).agentKey, 'whatsapp');
  });

  it('le pasa lo que escribió el cliente: es la pregunta a contestar', () => {
    const plan = advance(CON_AGENTE, emptyState('v1'), { text: '¿cuánto tarda?', selectionId: null });
    assert.equal((plan.steps[0] as { message: string }).message, '¿cuánto tarda?');
  });

  it('y la instrucción del paso, que es lo que lo acota', () => {
    // Sin esto, un agente amplio se lleva la conversación para cualquier lado y el
    // recorrido pierde el hilo que venía llevando.
    const plan = advance(CON_AGENTE, emptyState('v1'), { text: 'hola', selectionId: null });
    assert.match((plan.steps[0] as { context?: string }).context ?? '', /plazos de envío/);
  });

  it('el recorrido queda esperando ahí, no sigue de largo', () => {
    const plan = advance(CON_AGENTE, emptyState('v1'), { text: 'hola', selectionId: null });
    assert.equal(plan.state.node_id, 'consulta');
    assert.equal(plan.reason, 'awaiting_reply');
  });

  it('contesta UNA vez: el turno siguiente vuelve al recorrido', () => {
    // Es la diferencia con soltarle la conversación al agente. Después de que
    // contestó, lo que sigue lo decide el dibujo y no el modelo.
    const primero = advance(CON_AGENTE, emptyState('v1'), { text: 'hola', selectionId: null });
    const segundo = advance(CON_AGENTE, primero.state, { text: 'gracias', selectionId: null });
    assert.deepEqual(
      segundo.steps.map((s) => s.nodeId),
      ['sigue'],
    );
  });

  it('un tap sin texto no lo deja sin nada que contestar', () => {
    // Llegar por un botón es lo normal ("Hablar de envíos"): el agente arranca con la
    // instrucción del paso.
    const plan = advance(CON_AGENTE, emptyState('v1'), { text: null, selectionId: 'flow:otro:x' });
    assert.equal((plan.steps[0] as { message: string }).message, '');
    assert.match((plan.steps[0] as { context?: string }).context ?? '', /plazos/);
  });
});

describe('qué exige el validador', () => {
  it('el recorrido con agente bien armado no tiene problemas', () => {
    assert.deepEqual(validateGraph(CON_AGENTE), []);
  });

  it('un paso de agente sin agente elegido', () => {
    const g: FlowGraph = {
      ...CON_AGENTE,
      nodes: CON_AGENTE.nodes.map((n) => (n.id === 'consulta' ? { ...n, agent_key: undefined } : n)),
    };
    assert.match(
      validateGraph(g).map((i) => i.message).join(' | '),
      /no habría quién conteste/,
    );
  });
});
