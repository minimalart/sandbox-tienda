import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assistantText,
  assistantToolCall,
  fakeStore,
  fakeToolRuntime,
  scriptedModel,
  type FakeAgentRow,
} from './agent-fixtures';
import { runHeadlessAnalysis, runWhatsappTurn } from './agent';

/**
 * Caracterización de los otros dos loops, ahora que comparten el stream de
 * eventos con el chat. La diferencia es sólo el juego de sinks: acá la
 * transcripción va a un `ApiMessage[]` en memoria (`ArrayTranscript`) en vez de a
 * `chat_message`.
 *
 * El bot de WhatsApp es el único camino sin verificación por UI, así que su
 * garantía dura —no ejecuta escrituras— se fija acá.
 */

const AGENTS: FakeAgentRow[] = [
  {
    id: 'ag_analista',
    key: 'analista',
    name: 'Analista',
    instructions: 'Analizás el negocio.',
    rank: 0,
  },
];

test('headless: sin tool calls devuelve el texto y no traza pasos de tool', async () => {
  const store = fakeStore({ agents: AGENTS });
  const model = scriptedModel([assistantText('<proposal>{}</proposal>')]);

  const out = await runHeadlessAnalysis({
    store,
    agentKey: 'analista',
    task: 'analizá las ventas',
    modelProvider: model,
    toolRuntime: fakeToolRuntime(),
  });

  assert.equal(out, '<proposal>{}</proposal>');
  assert.equal(model.calls.length, 1);
  // El primer request lleva system + user; nada más.
  assert.deepEqual(
    model.calls[0]!.messages.map((m) => m.role),
    ['system', 'user'],
  );
  assert.deepEqual(
    store.rows.agentSteps.map((s) => s.type),
    ['model'],
  );
});

test('headless: la transcripción efímera se arma desde el stream', async () => {
  const store = fakeStore({ agents: AGENTS });
  const tools = fakeToolRuntime('ventas: 100');
  const model = scriptedModel([
    assistantToolCall('ver_ventas', { action: 'list' }, 'call_1'),
    assistantText('Vendiste 100.'),
  ]);

  const out = await runHeadlessAnalysis({
    store,
    agentKey: 'analista',
    task: 'analizá las ventas',
    modelProvider: model,
    toolRuntime: tools,
  });

  assert.equal(out, 'Vendiste 100.');
  assert.deepEqual(tools.executed, [['ver_ventas', { action: 'list' }]]);
  // La segunda vuelta ve el assistant con tool_calls y su resultado, en ese orden.
  assert.deepEqual(
    model.calls[1]!.messages.map((m) => m.role),
    ['system', 'user', 'assistant', 'tool'],
  );
  assert.equal(model.calls[1]!.messages[3]!.content, 'ventas: 100');
  // Y quedan trazados los dos pasos de modelo más el de la tool.
  assert.deepEqual(
    store.rows.agentSteps.map((s) => s.type),
    ['model', 'tool', 'model'],
  );
});

test('headless: una tool que no es `auto` no se ejecuta y se propone', async () => {
  const store = fakeStore({ agents: AGENTS });
  const tools = fakeToolRuntime();
  const model = scriptedModel([
    // `create` es escritura → modo `ask` → en headless NO se ejecuta.
    assistantToolCall('crear_promo', { action: 'create' }, 'call_1'),
    assistantText('Propongo crear la promo.'),
  ]);

  await runHeadlessAnalysis({
    store,
    agentKey: 'analista',
    task: 'proponé promos',
    modelProvider: model,
    toolRuntime: tools,
  });

  assert.deepEqual(tools.executed, [], 'headless nunca ejecuta escrituras');
  const toolMsg = model.calls[1]!.messages.find((m) => m.role === 'tool')!;
  assert.match(String(toolMsg.content), /^No ejecutado \(modo análisis headless\)/);
});

test('whatsapp: responde en texto y AHORA sí deja rastro en la traza', async () => {
  const store = fakeStore({
    agents: [{ id: 'ag_bot', key: 'bot', name: 'Bot', instructions: 'Atendés clientes.' }],
  });
  const model = scriptedModel([assistantText('Hola, ¿en qué te ayudo?')]);

  const out = await runWhatsappTurn({
    store,
    agentKey: 'bot',
    message: 'hola',
    modelProvider: model,
    toolRuntime: fakeToolRuntime(),
  });

  assert.equal(out, 'Hola, ¿en qué te ayudo?');
  // Cambio deliberado al unificar los loops: el bot era el ÚNICO sin tracer, y
  // eso significaba que una conversación que salía mal no dejaba rastro en
  // ninguna parte. Ahora la corrida aparece en la pantalla de Logs.
  assert.equal(store.rows.agentRuns.length, 1);
  assert.equal(store.rows.agentRuns[0]!.agent_key, 'bot');
  assert.deepEqual(
    store.rows.agentSteps.map((s) => s.type),
    ['model'],
  );
});

test('whatsapp: rechaza las escrituras y se lo explica al modelo', async () => {
  const store = fakeStore({
    agents: [{ id: 'ag_bot', key: 'bot', name: 'Bot', instructions: 'Atendés clientes.' }],
  });
  const tools = fakeToolRuntime();
  const model = scriptedModel([
    assistantToolCall('cancelar_pedido', { action: 'update' }, 'call_1'),
    assistantText('No puedo hacer eso, te paso con una persona.'),
  ]);

  const out = await runWhatsappTurn({
    store,
    agentKey: 'bot',
    message: 'cancelá mi pedido',
    modelProvider: model,
    toolRuntime: tools,
  });

  assert.equal(out, 'No puedo hacer eso, te paso con una persona.');
  assert.deepEqual(tools.executed, [], 'el bot NUNCA ejecuta escrituras');
  const toolMsg = model.calls[1]!.messages.find((m) => m.role === 'tool')!;
  assert.match(String(toolMsg.content), /^No ejecutado: el bot de atención solo puede leer/);
});

test('whatsapp: una lectura `auto` sí se ejecuta y vuelve al historial', async () => {
  const store = fakeStore({
    agents: [{ id: 'ag_bot', key: 'bot', name: 'Bot', instructions: 'Atendés clientes.' }],
  });
  const tools = fakeToolRuntime('pedido #123: en camino');
  const model = scriptedModel([
    assistantToolCall('ver_pedido', { action: 'get' }, 'call_1'),
    assistantText('Tu pedido está en camino.'),
  ]);

  await runWhatsappTurn({
    store,
    agentKey: 'bot',
    message: '¿dónde está mi pedido?',
    modelProvider: model,
    toolRuntime: tools,
  });

  assert.deepEqual(tools.executed, [['ver_pedido', { action: 'get' }]]);
  assert.deepEqual(
    model.calls[1]!.messages.map((m) => m.role),
    ['system', 'user', 'assistant', 'tool'],
  );
  assert.equal(model.calls[1]!.messages[3]!.content, 'pedido #123: en camino');
});
