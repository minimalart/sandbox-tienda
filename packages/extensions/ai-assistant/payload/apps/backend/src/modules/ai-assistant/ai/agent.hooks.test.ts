import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assistantText,
  assistantToolCall,
  fakeStore,
  fakeToolRuntime,
  scriptedModel,
} from './agent-fixtures';
import { runUserTurn } from './agent';
import { mergeHooks, NO_HOOKS, type AgentHooks } from './hooks';

/**
 * Los hooks son el punto de enganche que evita que cada policy, approval o
 * validación nueva termine como una condición más adentro del `for`.
 *
 * El PR que los introdujo es no-op por construcción —nadie los pasa y `NO_HOOKS`
 * no tiene ninguna propiedad—, así que lo que se verifica acá es que cuando SÍ se
 * pasan, intervienen exactamente donde dicen y nada más.
 */

const USER_ROW = { role: 'user' as const, content: 'hola' };

test('sin hooks el resultado es idéntico al del loop pelado', async () => {
  const conNada = fakeStore({ messages: [USER_ROW] });
  await runUserTurn({
    store: conNada,
    threadId: 'thr_1',
    modelProvider: scriptedModel([assistantText('hola')]),
    toolRuntime: fakeToolRuntime(),
  });

  const conNoHooks = fakeStore({ messages: [USER_ROW] });
  await runUserTurn({
    store: conNoHooks,
    threadId: 'thr_1',
    modelProvider: scriptedModel([assistantText('hola')]),
    toolRuntime: fakeToolRuntime(),
    hooks: NO_HOOKS,
  });

  assert.deepEqual(conNoHooks.transcript(), conNada.transcript());
  assert.deepEqual(
    conNoHooks.rows.chatMessages.map((r) => r.content),
    conNada.rows.chatMessages.map((r) => r.content),
  );
});

test('beforeStep con `stop` corta el turno sin gastar una llamada al modelo', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const model = scriptedModel([]);
  const hooks: AgentHooks = {
    async beforeStep() {
      return { stop: true, message: 'Fuera de horario de atención.' };
    },
  };

  const result = await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: model,
    toolRuntime: fakeToolRuntime(),
    hooks,
  });

  assert.deepEqual(result, { status: 'complete' });
  assert.equal(model.calls.length, 0);
  assert.equal(store.rows.chatMessages.at(-1)!.content, 'Fuera de horario de atención.');
});

test('beforeStep recibe el índice de vuelta y el agente activo', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const vistos: Array<[number, string]> = [];
  const hooks: AgentHooks = {
    async beforeStep(ctx) {
      vistos.push([ctx.step, ctx.agent.key]);
    },
  };

  await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: scriptedModel([
      assistantToolCall('ver', { action: 'list' }, 'c1'),
      assistantText('listo'),
    ]),
    toolRuntime: fakeToolRuntime(),
    hooks,
  });

  assert.deepEqual(vistos, [
    [0, 'general'],
    [1, 'general'],
  ]);
});

test('beforeModelRequest puede reescribir lo que se le manda al modelo', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const model = scriptedModel([assistantText('ok')]);
  const hooks: AgentHooks = {
    async beforeModelRequest({ request }) {
      return { request: { ...request, tools: [], maxTokens: 123 } };
    },
  };

  await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: model,
    toolRuntime: fakeToolRuntime(),
    hooks,
  });

  assert.deepEqual(model.calls[0]!.tools, []);
  assert.equal(model.calls[0]!.maxTokens, 123);
});

test('beforeToolExecute con `skip` evita la ejecución y fija el resultado', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const tools = fakeToolRuntime('NO DEBERÍA CORRER');
  const hooks: AgentHooks = {
    async beforeToolExecute() {
      return { skip: true, result: 'bloqueado por el gate' };
    },
  };

  await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: scriptedModel([
      assistantToolCall('ver', { action: 'list' }, 'c1'),
      assistantText('listo'),
    ]),
    toolRuntime: tools,
    hooks,
  });

  assert.deepEqual(tools.executed, []);
  assert.equal(
    store.rows.chatMessages.find((r) => r.role === 'tool')!.content,
    'bloqueado por el gate',
  );
});

test('beforeToolExecute con `args` ejecuta con los argumentos reescritos', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const tools = fakeToolRuntime();
  const hooks: AgentHooks = {
    async beforeToolExecute({ call }) {
      return { args: { ...call.args, limit: 10 } };
    },
  };

  await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: scriptedModel([
      assistantToolCall('ver', { action: 'list' }, 'c1'),
      assistantText('listo'),
    ]),
    toolRuntime: tools,
    hooks,
  });

  assert.deepEqual(tools.executed, [['ver', { action: 'list', limit: 10 }]]);
});

test('afterToolExecute reescribe el texto que se persiste', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const hooks: AgentHooks = {
    async afterToolExecute({ result }) {
      return { result: `[redactado] ${result.length} chars` };
    },
  };

  await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: scriptedModel([
      assistantToolCall('ver', { action: 'list' }, 'c1'),
      assistantText('listo'),
    ]),
    toolRuntime: fakeToolRuntime('datos sensibles'),
    hooks,
  });

  assert.equal(
    store.rows.chatMessages.find((r) => r.role === 'tool')!.content,
    '[redactado] 15 chars',
  );
});

test('beforeTurnStop con `continue` fuerza otra vuelta en vez de cerrar', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const model = scriptedModel([assistantText('primera'), assistantText('segunda')]);
  let veces = 0;
  const hooks: AgentHooks = {
    async beforeTurnStop({ reason }) {
      veces += 1;
      // Sólo la primera vez: si no, el loop giraría hasta MAX_STEPS.
      if (reason === 'no_tool_calls' && veces === 1) return { continue: true };
    },
  };

  const result = await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: model,
    toolRuntime: fakeToolRuntime(),
    hooks,
  });

  assert.deepEqual(result, { status: 'complete' });
  assert.equal(model.calls.length, 2, 'el hook tiene que haber forzado una segunda vuelta');
  // La respuesta de la primera vuelta NO se persistió: el hook cortó antes.
  assert.deepEqual(
    store.rows.chatMessages.filter((r) => r.role === 'assistant').map((r) => r.content),
    ['segunda'],
  );
});

test('beforeTurnStop se entera del corte por MAX_STEPS', async () => {
  const store = fakeStore({ messages: [USER_ROW] });
  const razones: string[] = [];
  const hooks: AgentHooks = {
    async beforeTurnStop({ reason, steps }) {
      razones.push(`${reason}:${steps}`);
    },
  };

  await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: scriptedModel(
      Array.from({ length: 8 }, (_, i) => assistantToolCall('ver', { action: 'list' }, `c${i}`)),
    ),
    toolRuntime: fakeToolRuntime(),
    hooks,
  });

  assert.deepEqual(razones, ['max_steps:8']);
});

test('mergeHooks corre en orden y corta en el primer override', async () => {
  const orden: string[] = [];
  const a: AgentHooks = {
    async beforeToolExecute() {
      orden.push('a');
    },
  };
  const b: AgentHooks = {
    async beforeToolExecute() {
      orden.push('b');
      return { skip: true, result: 'de b' };
    },
  };
  const c: AgentHooks = {
    async beforeToolExecute() {
      orden.push('c');
      return { skip: true, result: 'de c' };
    },
  };

  const store = fakeStore({ messages: [USER_ROW] });
  await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: scriptedModel([
      assistantToolCall('ver', { action: 'list' }, 'c1'),
      assistantText('listo'),
    ]),
    toolRuntime: fakeToolRuntime(),
    hooks: mergeHooks(a, b, c),
  });

  assert.deepEqual(orden, ['a', 'b'], 'c no llega a correr: b ya decidió');
  assert.equal(store.rows.chatMessages.find((r) => r.role === 'tool')!.content, 'de b');
});

test('mergeHooks sin hooks devuelve NO_HOOKS y con uno solo lo devuelve tal cual', () => {
  assert.equal(mergeHooks(), NO_HOOKS);
  const uno: AgentHooks = { async beforeStep() {} };
  assert.equal(mergeHooks(uno), uno);
});
