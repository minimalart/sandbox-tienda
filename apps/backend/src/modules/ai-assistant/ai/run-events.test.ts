import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ArrayTranscript,
  EventBus,
  RunTraceSink,
  SseSink,
  toApiMessages,
  toSseFrame,
  toTranscriptRows,
  type ClassifiedToolCall,
  type RunEvent,
  type RunEventSink,
} from './run-events';
import { RunTracer } from './tracing';
import type { AgentEvent, ToolCall } from './types';

/**
 * Los proyectores son funciones puras y son la pieza de mayor retorno para
 * testear: `toSseFrame` ES el contrato con el chat del admin, y `toTranscriptRows`
 * ES lo que `loadThreadView` va a leer después. Si estos se rompen, se rompe la
 * UI sin que nada más se entere.
 */

const CALL: ClassifiedToolCall = {
  id: 'call_1',
  name: 'listar_productos',
  args: { action: 'list' },
  action: 'list',
  resource: '',
  mode: 'auto',
};

const TOOL_CALLS: ToolCall[] = [
  { id: 'call_1', type: 'function', function: { name: 'listar_productos', arguments: '{}' } },
];

/** Un evento de cada variante, para poder afirmar sobre el conjunto completo. */
function everyVariant(): RunEvent[] {
  return [
    { type: 'turn_started', at: 1, maxSteps: 8 },
    { type: 'step_started', at: 1, idx: 0, agentKey: 'general' },
    { type: 'memory_retrieved', at: 1, agentKey: 'general', ids: ['mem_1'] },
    { type: 'assistant_chunk', at: 1, channel: 'content', text: 'hola' },
    { type: 'assistant_chunk', at: 1, channel: 'reasoning', text: 'pensando' },
    {
      type: 'model_completed',
      at: 1,
      idx: 0,
      agentKey: 'general',
      model: 'm',
      purpose: 'step',
      durationMs: 5,
    },
    { type: 'assistant_message', at: 1, agentKey: 'general', content: 'hola', toolCalls: [], status: 'complete' },
    { type: 'tool_called', at: 1, agentKey: 'general', call: CALL },
    { type: 'tool_completed', at: 1, agentKey: 'general', call: CALL, text: 'ok', ok: true, durationMs: 3 },
    { type: 'tool_rejected', at: 1, agentKey: 'general', call: CALL, by: 'policy', text: 'no' },
    { type: 'tool_rejected', at: 1, agentKey: 'general', call: CALL, by: 'handoff', text: 'no' },
    { type: 'tool_suspended', at: 1, agentKey: 'general', pending: [] },
    {
      type: 'agent_handoff',
      at: 1,
      from: 'general',
      target: 'ventas',
      callId: 'call_h',
      ok: true,
      text: 'derivada',
    },
    { type: 'grounding_judged', at: 1, verdict: { grounded: true } },
    { type: 'turn_completed', at: 1, status: 'complete' },
  ];
}

test('toSseFrame: proyecta exactamente los frames que el chat ya parsea', () => {
  const frames = everyVariant().map((ev) => [ev.type, toSseFrame(ev)?.type ?? null]);

  assert.deepEqual(frames, [
    ['turn_started', null],
    ['step_started', 'step'],
    ['memory_retrieved', null],
    ['assistant_chunk', 'token'],
    ['assistant_chunk', 'reasoning'],
    ['model_completed', null],
    ['assistant_message', null],
    ['tool_called', 'tool_call'],
    ['tool_completed', 'tool_result'],
    // Una tool prohibida SÍ emitía su tool_result; la hermana de un handoff no.
    ['tool_rejected', 'tool_result'],
    ['tool_rejected', null],
    ['tool_suspended', null],
    ['agent_handoff', 'handoff'],
    ['grounding_judged', null],
    ['turn_completed', null],
  ]);
});

test('toSseFrame: los frames llevan los mismos campos que antes', () => {
  assert.deepEqual(toSseFrame({ type: 'step_started', at: 1, idx: 2, agentKey: 'ventas' }), {
    type: 'step',
    agent: 'ventas',
  });
  assert.deepEqual(toSseFrame({ type: 'tool_called', at: 1, agentKey: 'g', call: CALL }), {
    type: 'tool_call',
    name: 'listar_productos',
    action: 'list',
  });
  assert.deepEqual(
    toSseFrame({ type: 'tool_completed', at: 1, agentKey: 'g', call: CALL, text: 'x', ok: false, durationMs: 1 }),
    { type: 'tool_result', name: 'listar_productos', ok: false },
  );
  assert.deepEqual(
    toSseFrame({
      type: 'agent_handoff',
      at: 1,
      from: 'general',
      target: 'ventas',
      reason: 'porque sí',
      callId: 'c',
      ok: true,
      text: 't',
    }),
    { type: 'handoff', from: 'general', target: 'ventas', reason: 'porque sí' },
  );
});

test('toTranscriptRows: reproduce las filas que el loop escribía a mano', () => {
  assert.deepEqual(
    toTranscriptRows({
      type: 'assistant_message',
      at: 1,
      agentKey: 'general',
      content: 'hola',
      toolCalls: TOOL_CALLS,
      status: 'pending',
    }),
    [{ role: 'assistant', content: 'hola', tool_calls: TOOL_CALLS, status: 'pending', agent_key: 'general' }],
  );
  // Sin tool calls la clave no va: el loop tampoco la mandaba.
  assert.deepEqual(
    toTranscriptRows({
      type: 'assistant_message',
      at: 1,
      agentKey: 'general',
      content: 'hola',
      toolCalls: [],
      status: 'complete',
    }),
    [{ role: 'assistant', content: 'hola', status: 'complete', agent_key: 'general' }],
  );
  assert.deepEqual(
    toTranscriptRows({ type: 'tool_completed', at: 1, agentKey: 'g', call: CALL, text: 'ok', ok: true, durationMs: 1 }),
    [{ role: 'tool', tool_call_id: 'call_1', content: 'ok' }],
  );
  assert.deepEqual(
    toTranscriptRows({
      type: 'agent_handoff',
      at: 1,
      from: 'g',
      target: 'v',
      callId: 'call_h',
      ok: true,
      text: 'derivada',
    }),
    [{ role: 'tool', tool_call_id: 'call_h', content: 'derivada' }],
  );
  // Nada más genera transcripción.
  const generadores = everyVariant().filter((ev) => toTranscriptRows(ev).length > 0).map((ev) => ev.type);
  assert.deepEqual([...new Set(generadores)], [
    'assistant_message',
    'tool_completed',
    'tool_rejected',
    'agent_handoff',
  ]);
});

test('toApiMessages: mismo contenido que la transcripción, en formato de API', () => {
  assert.deepEqual(
    toApiMessages({
      type: 'assistant_message',
      at: 1,
      agentKey: 'g',
      content: 'hola',
      toolCalls: TOOL_CALLS,
      status: 'complete',
    }),
    [{ role: 'assistant', content: 'hola', tool_calls: TOOL_CALLS }],
  );
  assert.deepEqual(
    toApiMessages({ type: 'tool_completed', at: 1, agentKey: 'g', call: CALL, text: 'ok', ok: true, durationMs: 1 }),
    [{ role: 'tool', content: 'ok', tool_call_id: 'call_1' }],
  );
});

test('EventBus: despacha en orden de array y secuencialmente', async () => {
  const orden: string[] = [];
  const lento: RunEventSink = {
    async emit() {
      await new Promise((r) => setTimeout(r, 10));
      orden.push('lento');
    },
  };
  const rapido: RunEventSink = {
    emit() {
      orden.push('rapido');
    },
  };
  const bus = new EventBus({ kind: 'chat', threadId: 't' }, [lento, rapido]);

  await bus.emit({ type: 'turn_started', at: 1, maxSteps: 8 });
  await bus.emit({ type: 'turn_started', at: 2, maxSteps: 8 });

  // Si el despacho fuese concurrente, `rapido` se colaría antes que `lento`.
  assert.deepEqual(orden, ['lento', 'rapido', 'lento', 'rapido']);
});

test('EventBus: un sink que tira no frena a los siguientes ni rompe el turno', async () => {
  const visto: string[] = [];
  const roto: RunEventSink = {
    emit() {
      throw new Error('boom');
    },
  };
  const sano: RunEventSink = {
    emit(ev) {
      visto.push(ev.type);
    },
  };
  const bus = new EventBus({ kind: 'chat', threadId: 't' }, [roto, sano]);

  await bus.emit({ type: 'turn_started', at: 1, maxSteps: 8 });

  assert.deepEqual(visto, ['turn_started']);
});

test('SseSink: escribe sólo los eventos que proyectan a un frame', () => {
  const frames: AgentEvent[] = [];
  const sink = new SseSink((f) => frames.push(f));
  for (const ev of everyVariant()) sink.emit(ev, { kind: 'chat', threadId: 't' });

  assert.deepEqual(
    frames.map((f) => f.type),
    ['step', 'token', 'reasoning', 'tool_call', 'tool_result', 'tool_result', 'handoff'],
  );
});

test('RunTraceSink: produce los pasos con idx 0..N-1 y el tipo correcto', async () => {
  const steps: Array<Record<string, unknown>> = [];
  const runs: Array<Record<string, unknown>> = [];
  const store = {
    async createAgentRuns(data: any) {
      const row = { id: 'run_1', ...data };
      runs.push(row);
      return row;
    },
    async updateAgentRuns(data: any) {
      runs.push({ update: data });
      return data;
    },
    async createAgentSteps(data: any) {
      steps.push(data);
      return data;
    },
  };
  const sink = new RunTraceSink(new RunTracer(store, { kind: 'chat', thread_id: 't' }));
  const meta = { kind: 'chat' as const, threadId: 't' };

  await sink.emit(
    { type: 'model_completed', at: 1, idx: 0, agentKey: 'general', model: 'm', purpose: 'step', durationMs: 7, promptTokens: 10, completionTokens: 5 },
    meta,
  );
  await sink.emit({ type: 'tool_called', at: 1, agentKey: 'general', call: CALL }, meta);
  await sink.emit(
    { type: 'tool_completed', at: 1, agentKey: 'general', call: CALL, text: 'ok', ok: true, durationMs: 3 },
    meta,
  );
  await sink.emit(
    { type: 'agent_handoff', at: 1, from: 'general', target: 'ventas', callId: 'c', ok: true, text: 't' },
    meta,
  );
  await sink.emit({ type: 'memory_retrieved', at: 1, agentKey: 'general', ids: ['mem_1', 'mem_2'] }, meta);
  await sink.emit({ type: 'turn_completed', at: 1, status: 'complete' }, meta);

  // `tool_called` no escribe: el paso se asienta cuando la tool TERMINA.
  assert.deepEqual(
    steps.map((s) => [s.idx, s.type, s.name]),
    [
      [0, 'model', 'm'],
      [1, 'tool', 'listar_productos'],
      [2, 'handoff', 'handoff → ventas'],
    ],
  );
  assert.equal(steps[0]!.tokens, 15);
  const cierre = runs.find((r) => r.update) as { update: Record<string, unknown> };
  assert.equal(cierre.update.status, 'complete');
  assert.equal(cierre.update.steps, 3);
  assert.deepEqual(cierre.update.injected_memory_ids, ['mem_1', 'mem_2']);
  assert.deepEqual(sink.memoryIds(), ['mem_1', 'mem_2']);
});

test('ArrayTranscript: acumula el historial efímero desde el mismo stream', () => {
  const t = new ArrayTranscript();
  const meta = { kind: 'proactive' as const, threadId: null };

  t.emit({ type: 'step_started', at: 1, idx: 0, agentKey: 'g' }, meta);
  t.emit(
    { type: 'assistant_message', at: 1, agentKey: 'g', content: '', toolCalls: TOOL_CALLS, status: 'complete' },
    meta,
  );
  t.emit({ type: 'tool_completed', at: 1, agentKey: 'g', call: CALL, text: 'ok', ok: true, durationMs: 1 }, meta);

  assert.deepEqual(t.history(), [
    { role: 'assistant', content: '', tool_calls: TOOL_CALLS },
    { role: 'tool', content: 'ok', tool_call_id: 'call_1' },
  ]);
});
