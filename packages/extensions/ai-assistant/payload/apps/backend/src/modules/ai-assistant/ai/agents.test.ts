import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveActiveAgent, resolveAgentByKey, GENERAL_AGENT } from './agents.ts';

type Row = any;

function makeStore(agents: Row[] = [], skills: Row[] = []) {
  return {
    async retrieveChatThread(id: string) {
      return { id, active_agent_id: null };
    },
    async listAgents(filters: Row = {}) {
      let rows = agents.filter((a) => a.enabled !== false);
      if (filters.key) rows = rows.filter((a) => a.key === filters.key);
      return [...rows].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    },
    async retrieveAgent(id: string) {
      return agents.find((a) => a.id === id) ?? null;
    },
    async listSkills(filters: Row = {}) {
      const keys = filters.key;
      if (Array.isArray(keys)) return skills.filter((s) => keys.includes(s.key));
      return skills;
    },
  };
}

const VENTAS: Row = {
  id: 'a_v',
  key: 'ventas',
  name: 'Ventas',
  instructions: 'v',
  rank: 1,
  enabled: true,
  is_orchestrator: false,
  skills: ['ventas'],
  handoff_targets: ['catalogo'],
  allowed_tools: [{ tool: 'manage_medusa_admin_orders' }],
};
const ORQ: Row = {
  id: 'a_o',
  key: 'orchestrator',
  name: 'Orquestador',
  instructions: 'o',
  rank: 0,
  enabled: true,
  is_orchestrator: true,
};

test('resolveActiveAgent cae a GENERAL_AGENT si no hay agentes', async () => {
  const a = await resolveActiveAgent(makeStore([]) as any, 'thr_1');
  assert.equal(a.key, GENERAL_AGENT.key);
  assert.equal(a.allowedTools, null);
});

test('resolveActiveAgent elige el orquestador cuando el hilo no tiene agente activo', async () => {
  const a = await resolveActiveAgent(makeStore([VENTAS, ORQ]) as any, 'thr_1');
  assert.equal(a.key, 'orchestrator');
  assert.equal(a.isOrchestrator, true);
});

test('resolveActiveAgent respeta el active_agent_id del hilo', async () => {
  const store = makeStore([VENTAS, ORQ]);
  store.retrieveChatThread = async (id: string) => ({ id, active_agent_id: 'a_v' });
  const a = await resolveActiveAgent(store as any, 'thr_1');
  assert.equal(a.key, 'ventas');
});

test('resolveAgentByKey arma allow-list, handoffs y resuelve skills a texto', async () => {
  const skills = [{ key: 'ventas', instructions: 'SKILL-VENTAS-TEXT', enabled: true }];
  const a = await resolveAgentByKey(makeStore([VENTAS], skills) as any, 'ventas');
  assert.equal(a.key, 'ventas');
  assert.deepEqual(a.handoffTargets, ['catalogo']);
  assert.deepEqual(a.allowedTools, [{ tool: 'manage_medusa_admin_orders' }]);
  assert.deepEqual(a.skillTexts, ['SKILL-VENTAS-TEXT']);
});

test('resolveAgentByKey cae a GENERAL_AGENT si la key no existe', async () => {
  const a = await resolveAgentByKey(makeStore([]) as any, 'nope');
  assert.equal(a.key, GENERAL_AGENT.key);
});
