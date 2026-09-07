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
  type FakeToolRuntime,
} from './agent-fixtures';
import { runUserTurn } from './agent';
import { runHeadlessAnalysis, runWhatsappTurn } from './headless';
import type { AgentHooks } from './hooks';
import type { RunEvent, RunEventSink } from './run-events';
import type { ChatCompletionMessage } from './chat-client';

/**
 * CONTRATO DEL RUNTIME, verificado contra los dos drivers.
 *
 * Quedaron dos loops legítimamente distintos: el del chat (historial en
 * `chat_message`, handoff, suspensión por aprobación, grounding) y
 * `runStatelessTurn` (headless y WhatsApp). La pregunta que estos tests contestan
 * NO es "¿hacen lo mismo?" —no deben— sino "¿cumplen las mismas garantías?".
 *
 * Es el seguro contra el modo de falla que motivó todo el refactor: se agrega una
 * feature, se la cablea en el chat, y nadie se acuerda de headless/WhatsApp. Si
 * eso vuelve a pasar, acá se rompe.
 *
 * Los ejes del contrato:
 *   1. esqueleto del ciclo de vida (turn/step/model/tool)
 *   2. enforcement de capabilities
 *   3. orden de los hooks
 *   4. tool policy: nada que escriba corre sin consentimiento
 *   5. tracing
 *   6. semántica de cierre de memoria
 *   7. MAX_STEPS
 *   8. normalización de errores
 */

/** Captura el stream sin participar en el turno. */
function probe(): { sink: RunEventSink; events: RunEvent[] } {
  const events: RunEvent[] = [];
  return { sink: { emit: (ev) => void events.push(ev) }, events };
}

type Scenario = {
  script: ChatCompletionMessage[];
  agent?: FakeAgentRow;
  tools?: FakeToolRuntime;
  hooks?: AgentHooks;
};

type Observation = {
  events: RunEvent[];
  store: FakeStore;
  tools: FakeToolRuntime;
  /** `needs_approval` sólo lo puede devolver el chat; los otros cierran en texto. */
  suspended: boolean;
};

type Driver = { name: string; run(s: Scenario): Promise<Observation> };

const BOT: FakeAgentRow = {
  id: 'ag_1',
  key: 'agente',
  name: 'Agente',
  instructions: 'Hacés cosas.',
  is_orchestrator: true,
};

const DRIVERS: Driver[] = [
  {
    name: 'chat',
    async run({ script, agent, tools, hooks }) {
      const store = fakeStore({
        messages: [{ role: 'user', content: 'hacelo' }],
        agents: [agent ?? BOT],
      });
      const t = tools ?? fakeToolRuntime('ok');
      const { sink, events } = probe();
      const result = await runUserTurn({
        store,
        threadId: 'thr_1',
        modelProvider: scriptedModel(script),
        toolRuntime: t,
        observers: [sink],
        hooks,
      });
      return { events, store, tools: t, suspended: result.status === 'needs_approval' };
    },
  },
  {
    name: 'headless',
    async run({ script, agent, tools, hooks }) {
      const store = fakeStore({ agents: [agent ?? BOT] });
      const t = tools ?? fakeToolRuntime('ok');
      const { sink, events } = probe();
      await runHeadlessAnalysis({
        store,
        agentKey: 'agente',
        task: 'hacelo',
        modelProvider: scriptedModel(script),
        toolRuntime: t,
        observers: [sink],
        hooks,
      });
      return { events, store, tools: t, suspended: false };
    },
  },
  {
    name: 'whatsapp',
    async run({ script, agent, tools, hooks }) {
      const store = fakeStore({ agents: [agent ?? BOT] });
      const t = tools ?? fakeToolRuntime('ok');
      const { sink, events } = probe();
      await runWhatsappTurn({
        store,
        agentKey: 'agente',
        message: 'hacelo',
        modelProvider: scriptedModel(script),
        toolRuntime: t,
        observers: [sink],
        hooks,
      });
      return { events, store, tools: t, suspended: false };
    },
  },
];

/** El esqueleto: se ignoran los hechos propios de cada driver. */
const SKELETON = new Set([
  'turn_started',
  'step_started',
  'model_completed',
  'tool_called',
  'tool_completed',
  'tool_rejected',
  'step_completed',
  'turn_completed',
]);
const skeleton = (events: RunEvent[]) => events.filter((e) => SKELETON.has(e.type)).map((e) => e.type);

/** Escenario canónico: pide una tool, la ejecuta, responde. */
const HAPPY = (): ChatCompletionMessage[] => [
  assistantToolCall('consultar', { action: 'list' }, 'call_1'),
  assistantText('listo'),
];

for (const driver of DRIVERS) {
  test(`[${driver.name}] esqueleto del ciclo de vida`, async () => {
    const { events } = await driver.run({ script: HAPPY() });

    assert.deepEqual(skeleton(events), [
      'turn_started',
      'step_started',
      'model_completed',
      'tool_called',
      'tool_completed',
      'step_completed',
      'step_started',
      'model_completed',
      'step_completed',
      'turn_completed',
    ]);
  });

  test(`[${driver.name}] el turno abre y cierra exactamente una vez`, async () => {
    const { events } = await driver.run({ script: HAPPY() });
    const types = events.map((e) => e.type);

    assert.equal(types.filter((t) => t === 'turn_started').length, 1);
    assert.equal(types.filter((t) => t === 'turn_completed').length, 1);
    assert.equal(types[0], 'turn_started', 'turn_started tiene que ser el primero');
    assert.equal(types.at(-1), 'turn_completed', 'turn_completed tiene que ser el último');
  });

  test(`[${driver.name}] cada step_started tiene su step_completed`, async () => {
    const { events } = await driver.run({ script: HAPPY() });
    const abiertos = events.filter((e) => e.type === 'step_started').length;
    const cerrados = events.filter((e) => e.type === 'step_completed').length;
    assert.equal(abiertos, cerrados);
    assert.equal(abiertos, 2, 'una vuelta para la tool y otra para la respuesta');
  });

  test(`[${driver.name}] enforcement de capabilities: fuera de scope no se ejecuta`, async () => {
    const acotado: FakeAgentRow = { ...BOT, allowed_tools: [{ tool: 'consultar', actions: ['list'] }] };
    const tools = fakeToolRuntime('NO DEBERÍA CORRER');
    const { events } = await driver.run({
      agent: acotado,
      tools,
      script: [assistantToolCall('consultar', { action: 'create' }, 'call_1'), assistantText('no puedo')],
    });

    if (driver.name === 'headless') {
      // Headless abre TODA la superficie a propósito (para poder proponer), así que
      // el allow-list de chat del agente no lo acota. Lo que sí lo frena es la
      // ToolPolicy: `create` es escritura y en headless las escrituras no corren.
      assert.deepEqual(tools.executed, []);
      return;
    }
    assert.deepEqual(tools.executed, [], 'la acción fuera de scope no puede ejecutarse');
    const rechazo = events.find((e) => e.type === 'tool_rejected');
    const suspension = events.find((e) => e.type === 'tool_suspended');
    assert.ok(rechazo || suspension, 'tiene que quedar registrado el rechazo');
  });

  test(`[${driver.name}] tool policy: una escritura nunca corre sin consentimiento`, async () => {
    const tools = fakeToolRuntime('NO DEBERÍA CORRER');
    const { events, suspended } = await driver.run({
      tools,
      script: [assistantToolCall('crear', { action: 'create' }, 'call_1'), assistantText('ok')],
    });

    assert.deepEqual(tools.executed, []);
    // El chat SUSPENDE esperando al humano; los stateless RECHAZAN y siguen. Son
    // salidas distintas de la misma garantía.
    const registrado = events.some((e) => e.type === 'tool_rejected' || e.type === 'tool_suspended');
    assert.ok(registrado, 'la negativa tiene que quedar en el stream');
    assert.equal(suspended, driver.name === 'chat');
  });

  test(`[${driver.name}] orden de los hooks`, async () => {
    const orden: string[] = [];
    const hooks: AgentHooks = {
      async beforeStep() {
        orden.push('beforeStep');
      },
      async beforeModelRequest() {
        orden.push('beforeModelRequest');
      },
      async beforeToolExecute() {
        orden.push('beforeToolExecute');
      },
      async afterToolExecute() {
        orden.push('afterToolExecute');
      },
      async beforeTurnStop() {
        orden.push('beforeTurnStop');
      },
    };

    await driver.run({ script: HAPPY(), hooks });

    assert.deepEqual(orden, [
      'beforeStep',
      'beforeModelRequest',
      'beforeToolExecute',
      'afterToolExecute',
      'beforeStep',
      'beforeModelRequest',
      'beforeTurnStop',
    ]);
  });

  test(`[${driver.name}] los hooks pueden bloquear una tool en cualquier driver`, async () => {
    const tools = fakeToolRuntime('NO DEBERÍA CORRER');
    await driver.run({
      tools,
      script: HAPPY(),
      hooks: {
        async beforeToolExecute() {
          return { skip: true, result: 'bloqueado' };
        },
      },
    });
    assert.deepEqual(tools.executed, []);
  });

  test(`[${driver.name}] tracing: deja una corrida con sus pasos`, async () => {
    const { store } = await driver.run({ script: HAPPY() });

    assert.equal(store.rows.agentRuns.length, 1, 'una corrida por turno');
    assert.deepEqual(
      store.rows.agentSteps.map((s) => s.type),
      ['model', 'tool', 'model'],
    );
    // Los `idx` son consecutivos: la UI de Logs ordena por ahí.
    assert.deepEqual(
      store.rows.agentSteps.map((s) => s.idx),
      [0, 1, 2],
    );
  });

  test(`[${driver.name}] MAX_STEPS: corta en el tope`, async () => {
    const model = scriptedModel([
      ...Array.from({ length: 8 }, (_, i) => assistantToolCall('consultar', { action: 'list' }, `c${i}`)),
      // Los stateless piden una vuelta más para cerrar en prosa; el chat no.
      assistantText('cierre'),
    ]);
    const store = fakeStore({
      messages: [{ role: 'user', content: 'hacelo' }],
      agents: [BOT],
    });
    const { sink, events } = probe();
    const common = { store, modelProvider: model, toolRuntime: fakeToolRuntime(), observers: [sink] };

    if (driver.name === 'chat') await runUserTurn({ ...common, threadId: 'thr_1' });
    else if (driver.name === 'headless') {
      await runHeadlessAnalysis({ ...common, agentKey: 'agente', task: 'hacelo' });
    } else await runWhatsappTurn({ ...common, agentKey: 'agente', message: 'hacelo' });

    assert.equal(events.filter((e) => e.type === 'step_started').length, 8, 'ni una vuelta de más');
    assert.equal(events.at(-1)?.type, 'turn_completed');
  });

  test(`[${driver.name}] normalización de errores: el turno se cierra como 'error' y propaga`, async () => {
    const explota: ChatCompletionMessage[] = [];
    const model = {
      calls: [],
      streamed: [],
      async complete() {
        throw new Error('el proveedor se cayó');
      },
      async stream() {
        throw new Error('el proveedor se cayó');
      },
    };
    void explota;
    const store = fakeStore({ messages: [{ role: 'user', content: 'hacelo' }], agents: [BOT] });
    const { sink, events } = probe();
    const common = { store, modelProvider: model, toolRuntime: fakeToolRuntime(), observers: [sink] };

    await assert.rejects(
      async () => {
        if (driver.name === 'chat') await runUserTurn({ ...common, threadId: 'thr_1' });
        else if (driver.name === 'headless') {
          await runHeadlessAnalysis({ ...common, agentKey: 'agente', task: 'hacelo' });
        } else await runWhatsappTurn({ ...common, agentKey: 'agente', message: 'hacelo' });
      },
      /el proveedor se cayó/,
      'el error tiene que propagar al llamador',
    );

    const cierre = events.at(-1);
    assert.equal(cierre?.type, 'turn_completed');
    assert.equal(cierre?.type === 'turn_completed' && cierre.status, 'error');
    assert.match(
      (cierre?.type === 'turn_completed' && cierre.error) || '',
      /el proveedor se cayó/,
    );
  });

  test(`[${driver.name}] cierre de memoria: memory_retrieved siempre antes de turn_completed`, async () => {
    const { events } = await driver.run({ script: HAPPY() });
    const iMem = events.findIndex((e) => e.type === 'memory_retrieved');
    const iFin = events.findIndex((e) => e.type === 'turn_completed');
    assert.ok(iFin >= 0);
    // Sin memoria activa no hay ids; si los hubiera, el orden es el que importa,
    // porque el sink de traza los persiste al cerrar el run.
    if (iMem >= 0) assert.ok(iMem < iFin, 'las memorias se asientan antes de cerrar');
  });
}
