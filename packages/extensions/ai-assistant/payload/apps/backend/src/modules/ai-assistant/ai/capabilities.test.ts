import assert from 'node:assert/strict';
import test from 'node:test';

import {
  comboAllowed,
  modeFromProfile,
  resolveCapabilityProfile,
  scopeFor,
  type CapabilityProfile,
} from './capabilities';
import { assistantText, assistantToolCall, fakeStore, fakeToolRuntime, scriptedModel } from './agent-fixtures';
import { runUserTurn } from './agent';
import type { ResolvedAgent } from './agents';

const AGENT: ResolvedAgent = {
  key: 'ventas',
  name: 'Ventas',
  instructions: '',
  skillTexts: [],
  allowedTools: null,
  handoffTargets: [],
  isOrchestrator: false,
  memoryTypes: null,
};

test('resolveCapabilityProfile deriva de las columnas que ya existen', () => {
  const p = resolveCapabilityProfile({
    ...AGENT,
    allowedTools: [{ tool: 'mcp__tavily__search' }, { tool: 'start_workflow' }],
    handoffTargets: ['soporte'],
    memoryTypes: ['faq'],
  });

  assert.deepEqual(p.tools.allow, [{ tool: 'mcp__tavily__search' }, { tool: 'start_workflow' }]);
  assert.deepEqual(p.memory, { read: true, write: true, types: ['faq'] });
  assert.deepEqual(p.web, { search: true, fetch: false });
  assert.deepEqual(p.subagents, {
    canHandoff: true,
    targets: ['soporte'],
    canStartWorkflows: true,
  });
});

test('resolveCapabilityProfile: sin allow-list el agente ve toda la superficie', () => {
  const p = resolveCapabilityProfile(AGENT);
  assert.equal(p.tools.allow, null);
  assert.deepEqual(p.web, { search: true, fetch: true });
  assert.equal(p.subagents.canStartWorkflows, true);
  assert.equal(p.subagents.canHandoff, false);
});

test('scopeFor: match exacto, comodín de sufijo y deny que gana', () => {
  const allow = [{ tool: 'pedidos' }, { tool: 'mcp__tavily__*' }];
  assert.deepEqual(scopeFor({ allow }, 'pedidos'), { tool: 'pedidos' });
  assert.deepEqual(scopeFor({ allow }, 'mcp__tavily__search'), { tool: 'mcp__tavily__*' });
  assert.equal(scopeFor({ allow }, 'productos'), null);
  // Sin allow-list, cualquier tool queda con un scope abierto.
  assert.deepEqual(scopeFor({ allow: null }, 'lo_que_sea' ), { tool: 'lo_que_sea' });
  // `deny` gana.
  assert.equal(scopeFor({ allow: null, deny: [{ tool: 'peligrosa' }] }, 'peligrosa'), null);
  assert.equal(scopeFor({ allow, deny: [{ tool: 'mcp__tavily__*' }] }, 'mcp__tavily__search'), null);
});

test('comboAllowed: un scope pelado no restringe ningún eje', () => {
  // Es el caso de TODOS los agentes de hoy: la UI y los seeds guardan `{ tool }`.
  assert.equal(comboAllowed({ tool: 'pedidos' }, 'create', 'orders'), true);
  assert.equal(comboAllowed({ tool: 'pedidos' }, 'delete', null), true);
});

test('comboAllowed: `actions` y `resources` acotan de verdad', () => {
  const scope = { tool: 'pedidos', actions: ['list', 'get'], resources: ['orders'] };
  assert.equal(comboAllowed(scope, 'list', 'orders'), true);
  assert.equal(comboAllowed(scope, 'create', 'orders'), false, 'create no está en actions');
  assert.equal(comboAllowed(scope, 'list', 'customers'), false, 'customers no está en resources');
  // La acción comodín es la de una tool sin enum de `action`: no hay qué acotar.
  assert.equal(comboAllowed(scope, '*', 'orders'), true);
  // Un resource nulo es una tool sin granularidad por resource.
  assert.equal(comboAllowed({ tool: 'x', resources: ['a'] }, 'list', null), true);
});

test('modeFromProfile: prohíbe lo fuera de scope y calla en lo demás', () => {
  const profile: CapabilityProfile = {
    tools: { allow: [{ tool: 'pedidos', actions: ['list'] }] },
    memory: { read: true, write: true, types: null },
    web: { search: false, fetch: false },
    subagents: { canHandoff: false, targets: [], canStartWorkflows: false },
  };

  // Dentro del scope: el perfil no opina y decide la ToolPolicy global.
  assert.equal(modeFromProfile(profile, 'pedidos', 'list', null), null);
  // Fuera del scope por acción.
  assert.equal(modeFromProfile(profile, 'pedidos', 'create', null), 'prohibited');
  // Tool que ni siquiera está en el allow-list.
  assert.equal(modeFromProfile(profile, 'productos', 'list', null), 'prohibited');
});

test('el perfil sólo ANGOSTA: nunca convierte en permitido lo que la policy prohíbe', () => {
  const abierto: CapabilityProfile = {
    tools: { allow: null },
    memory: { read: true, write: true, types: null },
    web: { search: true, fetch: true },
    subagents: { canHandoff: false, targets: [], canStartWorkflows: true },
  };
  // Con allow-list abierta el perfil devuelve `null` siempre: la última palabra
  // sobre `manage_medusa_admin_v2/request` la sigue teniendo la ToolPolicy.
  assert.equal(modeFromProfile(abierto, 'manage_medusa_admin_v2', 'request', null), null);
});

// ── enforcement de punta a punta, contra el loop real ────────────────────────

test('end-to-end: una acción fuera del scope del agente NO se ejecuta', async () => {
  const store = fakeStore({
    messages: [{ role: 'user', content: 'creá un pedido' }],
    agents: [
      {
        id: 'ag_ventas',
        key: 'ventas',
        name: 'Ventas',
        instructions: 'Vendés.',
        is_orchestrator: true,
        // Este agente declara que sólo puede LISTAR pedidos.
        allowed_tools: [{ tool: 'pedidos', actions: ['list'] }],
      },
    ],
  });
  const tools = fakeToolRuntime();
  const model = scriptedModel([
    assistantToolCall('pedidos', { action: 'create' }, 'call_1'),
    assistantText('No puedo crear pedidos.'),
  ]);

  await runUserTurn({ store, threadId: 'thr_1', modelProvider: model, toolRuntime: tools });

  assert.deepEqual(tools.executed, [], 'antes de esto, `create` se ejecutaba igual');
  const toolRow = store.rows.chatMessages.find((r) => r.role === 'tool')!;
  assert.match(toolRow.content ?? '', /^Acción prohibida/);
  // Y queda trazado como fallo, no como éxito.
  const step = store.rows.agentSteps.find((s) => s.type === 'tool')!;
  assert.equal(step.status, 'error');
});

test('end-to-end: la acción que SÍ está en el scope se ejecuta normal', async () => {
  const store = fakeStore({
    messages: [{ role: 'user', content: 'listá pedidos' }],
    agents: [
      {
        id: 'ag_ventas',
        key: 'ventas',
        name: 'Ventas',
        instructions: 'Vendés.',
        is_orchestrator: true,
        allowed_tools: [{ tool: 'pedidos', actions: ['list'] }],
      },
    ],
  });
  const tools = fakeToolRuntime('3 pedidos');
  const model = scriptedModel([
    assistantToolCall('pedidos', { action: 'list' }, 'call_1'),
    assistantText('Tenés 3.'),
  ]);

  await runUserTurn({ store, threadId: 'thr_1', modelProvider: model, toolRuntime: tools });

  assert.deepEqual(tools.executed, [['pedidos', { action: 'list' }]]);
  assert.equal(store.rows.chatMessages.find((r) => r.role === 'tool')!.content, '3 pedidos');
});

test('end-to-end: un agente con `{ tool }` pelado no cambia de comportamiento', async () => {
  // Es la forma que escriben la UI y los 5 seeds: este PR no los toca.
  const store = fakeStore({
    messages: [{ role: 'user', content: 'creá un pedido' }],
    agents: [
      {
        id: 'ag_ventas',
        key: 'ventas',
        name: 'Ventas',
        instructions: 'Vendés.',
        is_orchestrator: true,
        allowed_tools: [{ tool: 'pedidos' }],
      },
    ],
  });
  const model = scriptedModel([assistantToolCall('pedidos', { action: 'create' }, 'call_1')]);

  const result = await runUserTurn({
    store,
    threadId: 'thr_1',
    modelProvider: model,
    toolRuntime: fakeToolRuntime(),
  });

  // Sigue cayendo en el gate de aprobación de la ToolPolicy, no en una prohibición.
  assert.equal(result.status, 'needs_approval');
});
