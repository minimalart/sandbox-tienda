import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assistantText,
  assistantToolCall,
  fakeStore,
  fakeToolRuntime,
  scriptedModel,
  type FakeAgentRow,
  type FakeStore,
} from './agent-fixtures';
import { confirmTools, runUserTurn } from './agent';
import type { AgentEvent } from './types';

/**
 * Tests de CARACTERIZACIÓN del loop agéntico.
 *
 * Describen lo que el loop hace HOY —qué filas persiste, en qué orden y con qué
 * estado—, no lo que debería hacer. Son la red que hace segura la refactorización
 * que viene: cuando `runLoop` pase a escribir a través de un stream de eventos,
 * estos tests tienen que seguir pasando SIN TOCARSE. Si alguno necesita cambiar,
 * es porque el refactor cambió comportamiento observable, y eso hay que decidirlo
 * a propósito en vez de descubrirlo en producción.
 *
 * Los dos dobles (`ModelProvider` y `ToolRuntime`) son los que vuelven ejecutable
 * al loop en un test: el primero porque si no habría que hablarle a OpenRouter; el
 * segundo porque el registry real levanta el MCP in-process y deja un handle vivo
 * que impide que el proceso termine.
 */

const USER_ROW = { role: 'user' as const, content: '¿cuántos productos tengo?' };

/** `[role, status]` de cada fila, en orden de escritura. */
function shape(store: FakeStore): Array<[string, string | null]> {
  return store.transcript();
}

test('turno simple: sin tool calls persiste un assistant `complete` y cierra', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const model = scriptedModel([assistantText('Tenés 42 productos.')]);

  const result = await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: model,
    toolRuntime: fakeToolRuntime(),
  });

  assert.deepEqual(result, { status: 'complete' });
  assert.equal(model.calls.length, 1);
  assert.deepEqual(shape(store), [
    ['user', 'complete'],
    ['assistant', 'complete'],
  ]);
  const last = store.rows.chatMessages.at(-1)!;
  assert.equal(last.content, 'Tenés 42 productos.');
  assert.equal(last.agent_key, 'general');
  assert.equal(last.tool_calls, null);
});

test('tool `auto`: ejecuta, persiste assistant + fila tool y da otra vuelta', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const tools = fakeToolRuntime('42 productos');
  const model = scriptedModel([
    assistantToolCall('contar_productos', { action: 'list' }, 'call_a'),
    assistantText('Son 42.'),
  ]);

  const result = await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: model,
    toolRuntime: tools,
  });

  assert.deepEqual(result, { status: 'complete' });
  assert.equal(model.calls.length, 2, 'ejecutar la tool tiene que disparar otra vuelta');
  assert.deepEqual(tools.executed, [['contar_productos', { action: 'list' }]]);
  // El ORDEN es el contrato: el assistant con `tool_calls` antes que su fila `tool`.
  assert.deepEqual(shape(store), [
    ['user', 'complete'],
    ['assistant', 'complete'],
    ['tool', null],
    ['assistant', 'complete'],
  ]);
  const toolRow = store.rows.chatMessages.find((r) => r.role === 'tool')!;
  assert.equal(toolRow.tool_call_id, 'call_a');
  assert.equal(toolRow.content, '42 productos');
  // La segunda vuelta ve el resultado de la tool en el historial.
  assert.ok(
    model.calls[1]!.messages.some((m) => m.role === 'tool' && m.content === '42 productos'),
    'el segundo request al modelo tiene que incluir la fila tool',
  );
});

test('tool `ask`: corta el turno, deja el assistant `pending` y no ejecuta nada', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const tools = fakeToolRuntime();
  // `create` clasifica como escritura y su modo por defecto es `ask`.
  const model = scriptedModel([assistantToolCall('crear_producto', { action: 'create' }, 'call_w')]);

  const result = await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: model,
    toolRuntime: tools,
  });

  assert.equal(result.status, 'needs_approval');
  assert.equal(result.status === 'needs_approval' && result.pending.length, 1);
  assert.equal(result.status === 'needs_approval' && result.pending[0]!.tool_call_id, 'call_w');
  assert.equal(result.status === 'needs_approval' && result.pending[0]!.kind, 'write');
  assert.deepEqual(shape(store), [
    ['user', 'complete'],
    ['assistant', 'pending'],
  ]);
  assert.deepEqual(tools.executed, [], 'una tool en modo ask no se ejecuta antes de aprobarse');
  assert.equal(store.rows.chatMessages.filter((r) => r.role === 'tool').length, 0);
});

test('reentrada con un assistant `pending`: devuelve los pendientes sin llamar al modelo', async () => {
  const store = fakeStore({
    messages: [
      USER_ROW,
      {
        role: 'assistant',
        content: '',
        status: 'pending',
        tool_calls: [
          {
            id: 'call_w',
            type: 'function',
            function: { name: 'crear_producto', arguments: JSON.stringify({ action: 'create' }) },
          },
        ],
      },
    ],
  });
  const model = scriptedModel([]);

  const result = await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: model,
    toolRuntime: fakeToolRuntime(),
  });

  assert.equal(result.status, 'needs_approval');
  assert.equal(model.calls.length, 0, 'el guard tiene que cortar antes de gastar una llamada');
  assert.equal(store.rows.chatMessages.length, 2, 'no persiste nada nuevo');
});

test('confirmTools con rechazo: persiste la fila tool, no ejecuta y cierra el pendiente', async () => {
  const store = fakeStore({
    messages: [
      USER_ROW,
      {
        role: 'assistant',
        content: '',
        status: 'pending',
        tool_calls: [
          {
            id: 'call_w',
            type: 'function',
            function: { name: 'crear_producto', arguments: JSON.stringify({ action: 'create' }) },
          },
        ],
      },
    ],
  });
  const tools = fakeToolRuntime();
  const model = scriptedModel([assistantText('Ok, no lo creo.')]);

  const result = await confirmTools({
    store,
    threadId: 'thr_1',
    decisions: [{ tool_call_id: 'call_w', approved: false }],
    modelProvider: model,
    toolRuntime: tools,
  });

  assert.deepEqual(result, { status: 'complete' });
  assert.deepEqual(tools.executed, []);
  const toolRow = store.rows.chatMessages.find((r) => r.role === 'tool')!;
  assert.equal(toolRow.tool_call_id, 'call_w');
  assert.match(toolRow.content ?? '', /rechaz/i);
  // El assistant que estaba pendiente queda cerrado.
  assert.equal(store.rows.chatMessages.find((r) => r.id === 'msg_seed_1')!.status, 'complete');
});

test('confirmTools con aprobación: ejecuta la tool que estaba pendiente', async () => {
  const store = fakeStore({
    messages: [
      USER_ROW,
      {
        role: 'assistant',
        content: '',
        status: 'pending',
        tool_calls: [
          {
            id: 'call_w',
            type: 'function',
            function: { name: 'crear_producto', arguments: JSON.stringify({ action: 'create' }) },
          },
        ],
      },
    ],
  });
  const tools = fakeToolRuntime('producto creado');
  const model = scriptedModel([assistantText('Listo, lo creé.')]);

  const result = await confirmTools({
    store,
    threadId: 'thr_1',
    decisions: [{ tool_call_id: 'call_w', approved: true }],
    modelProvider: model,
    toolRuntime: tools,
  });

  assert.deepEqual(result, { status: 'complete' });
  assert.deepEqual(tools.executed, [['crear_producto', { action: 'create' }]]);
  assert.equal(store.rows.chatMessages.find((r) => r.role === 'tool')!.content, 'producto creado');
});

test('handoff: cambia el agente activo del hilo y el paso siguiente corre con el destino', async () => {
  const agents: FakeAgentRow[] = [
    {
      id: 'ag_general',
      key: 'general',
      name: 'General',
      instructions: 'Orquestás.',
      is_orchestrator: true,
      rank: 0,
      handoff_targets: ['ventas'],
    },
    { id: 'ag_ventas', key: 'ventas', name: 'Ventas', instructions: 'Vendés.', rank: 1 },
  ];
  const store = fakeStore({ messages: [USER_ROW], agents });
  const tools = fakeToolRuntime();
  const model = scriptedModel([
    assistantToolCall(
      'handoff_to_agent',
      { target: 'ventas', reason: 'consulta comercial' },
      'call_h',
    ),
    assistantText('Hola, soy Ventas.'),
  ]);

  const result = await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: model,
    toolRuntime: tools,
  });

  assert.deepEqual(result, { status: 'complete' });
  assert.equal(store.rows.threads[0]!.active_agent_id, 'ag_ventas');
  assert.deepEqual(tools.executed, [], 'el handoff lo intercepta el loop: no pasa por el registry');
  assert.deepEqual(shape(store), [
    ['user', 'complete'],
    ['assistant', 'complete'],
    ['tool', null],
    ['assistant', 'complete'],
  ]);
  const toolRow = store.rows.chatMessages.find((r) => r.role === 'tool')!;
  assert.equal(toolRow.tool_call_id, 'call_h');
  assert.match(toolRow.content ?? '', /derivada/i);
  // La respuesta final la firma el agente destino, no el que derivó.
  assert.equal(store.rows.chatMessages.at(-1)!.agent_key, 'ventas');
});

test('tool `prohibited`: persiste el rechazo sin ejecutar y el loop sigue', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const tools = fakeToolRuntime();
  const model = scriptedModel([
    // `manage_medusa_admin_v2/request` es el escape hatch: prohibido siempre.
    assistantToolCall('manage_medusa_admin_v2', { action: 'request' }, 'call_p'),
    assistantText('No puedo hacer eso.'),
  ]);

  const result = await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: model,
    toolRuntime: tools,
  });

  assert.deepEqual(result, { status: 'complete' });
  assert.deepEqual(tools.executed, []);
  const toolRow = store.rows.chatMessages.find((r) => r.role === 'tool')!;
  assert.equal(toolRow.tool_call_id, 'call_p');
  assert.match(toolRow.content ?? '', /^Acción prohibida/);
});

test('MAX_STEPS: tras 8 vueltas corta con el mensaje fijo, atribuido al último agente', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const tools = fakeToolRuntime();
  const model = scriptedModel(
    Array.from({ length: 8 }, (_, i) =>
      assistantToolCall('contar_productos', { action: 'list' }, `call_${i}`),
    ),
  );

  const result = await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: model,
    toolRuntime: tools,
  });

  assert.deepEqual(result, { status: 'complete' });
  assert.equal(model.calls.length, 8, 'MAX_STEPS = 8');
  assert.equal(tools.executed.length, 8);
  const last = store.rows.chatMessages.at(-1)!;
  assert.match(last.content ?? '', /^Alcancé el máximo de pasos/);
  assert.equal(last.agent_key, 'general');
  assert.equal(last.status, 'complete');
});

test('paridad de streaming: con y sin `onEvent` se persiste exactamente lo mismo', async () => {
  const script = () => [
    assistantToolCall('contar_productos', { action: 'list' }, 'call_a'),
    assistantText('Son 42.'),
  ];

  const plain = fakeStore({ messages: [USER_ROW] });
  const plainResult = await runUserTurn({
    store: plain,
    threadId: 'thr_1',
    modelProvider: scriptedModel(script()),
    toolRuntime: fakeToolRuntime('42 productos'),
  });

  const streamed = fakeStore({ messages: [USER_ROW] });
  const events: AgentEvent[] = [];
  const streamedResult = await runUserTurn({
    store: streamed,
    threadId: 'thr_1',
    modelProvider: scriptedModel(script()),
    toolRuntime: fakeToolRuntime('42 productos'),
    onEvent: (ev) => events.push(ev),
  });

  assert.deepEqual(streamedResult, plainResult);
  assert.deepEqual(shape(streamed), shape(plain));
  assert.deepEqual(
    streamed.rows.chatMessages.map((r) => [r.role, r.content, r.tool_call_id]),
    plain.rows.chatMessages.map((r) => [r.role, r.content, r.tool_call_id]),
  );
  // Y el streaming sí tiene que haber emitido: si no, la paridad sería trivial.
  // Este orden es exactamente lo que PR-3 tiene que reproducir vía proyección.
  assert.deepEqual(
    events.map((e) => e.type),
    ['step', 'tool_call', 'tool_result', 'step', 'token'],
  );
});
