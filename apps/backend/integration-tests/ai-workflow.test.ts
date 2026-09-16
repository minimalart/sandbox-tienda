// Run with --experimental-test-module-mocks. Only infrastructure/artifact adapters
// are mocked; registry, policy, headless loop, workflow engine and tracing are real.
import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import {
  fakeStore,
  scriptedModel,
  assistantText,
  assistantToolCall,
} from '../src/modules/ai-assistant/ai/agent-fixtures';
import { isNativeTool } from '../src/modules/ai-assistant/ai/native-tools/names';
import type { AgentEvent } from '../src/modules/ai-assistant/ai/types';
import type { ToolRuntime } from '../src/modules/ai-assistant/ai/tool-registry';

mock.module(new URL('../src/modules/ai-assistant/ai/native-tools/index.ts', import.meta.url).href, {
  namedExports: {
    NATIVE_TOOL_DEFS: [],
    isNativeTool,
    executeNativeTool: async () => {
      throw new Error('Unexpected native write');
    },
  },
});
mock.module(new URL('../src/modules/ai-assistant/ai/campaign-enrich.ts', import.meta.url).href, {
  namedExports: {
    ensureBannerMedia: async () => 'failed',
    ensureLandingContent: async () => 'failed',
    resolveProductTitles: async () => [],
  },
});
mock.module(new URL('../src/modules/store-config/index.ts', import.meta.url).href, {
  namedExports: { STORE_CONFIG_MODULE: 'storeConfig' },
});
mock.module(new URL('../src/modules/blog/render.ts', import.meta.url).href, {
  namedExports: { renderBlogContentHtml: () => '' },
});
mock.module(new URL('../src/api/mcp/_loader.ts', import.meta.url).href, {
  namedExports: {
    getMcpTools: async () => ({ discoverTools: async () => [] }),
  },
});

const { runWorkflow } = await import('../src/modules/ai-assistant/ai/workflow-engine');
const { discoverAllTools } = await import('../src/modules/ai-assistant/ai/tool-registry');
const { runHeadlessAnalysis } = await import('../src/modules/ai-assistant/ai/headless');
const { buildToolsForModel } = await import('../src/modules/ai-assistant/ai/runtime');
const { resultContract } = await import('../src/modules/ai-assistant/ai/workflow-result');
const toolName = 'mcp__search__search';
const research = {
  ingredients: ['papa', 'cebolla', 'huevo', 'aceite'],
  steps: ['Cortá', 'Cociná', 'Serví'],
  source_urls: ['https://example.org/recipe'],
};
const result = (data: unknown) => assistantText(`<result>${JSON.stringify(data)}</result>`);

function installation(trusted?: boolean, mode?: 'ask' | 'prohibited' | 'auto') {
  const store = fakeStore({
    policies: mode ? [{ tool_name: toolName, action: '*', resource: '', mode }] : [],
  });
  const runs: any[] = [];
  Object.assign(store, {
    listMcpServers: async () => [
      {
        id: 'srv_fresh',
        enabled: true,
        trust_read_only_hints: trusted,
        tools_cache: [
          {
            name: 'search',
            namespaced_name: toolName,
            read_only_hint: true,
            parameters: { type: 'object', properties: { query: { type: 'string' } } },
          },
        ],
      },
    ],
    createWorkflowRuns: async (data: any) => {
      const run = { ...data, id: 'workflow_fresh' };
      runs.push(run);
      return run;
    },
    updateWorkflowRuns: async (data: any) => Object.assign(runs[0], data),
    retrieveWorkflowRun: async () => runs[0],
  });
  const executed: string[] = [];
  const tools: ToolRuntime = {
    discover: discoverAllTools,
    execute: async (_s, name) => {
      executed.push(name);
      return { content: [{ type: 'text', text: JSON.stringify(research) }] };
    },
  };
  return { store, runs, tools, executed };
}

const definition = {
  key: 'receta',
  name: 'Fresh recipe',
  steps: [
    { key: 'investigar', agent_key: 'general', task: 'Investigá una receta.' },
    {
      key: 'next',
      agent_key: 'general',
      task: 'Usá los datos {{state.investigar}}.',
      result_contract: { answer: { type: 'string' as const } },
    },
  ],
};

test('external research content reaches the workflow model without Medusa compaction', async () => {
  const f = installation(true);
  const page = 'Ingredientes y preparación de la receta. '.repeat(40);
  const payload = { results: [{ url: 'https://example.org/recipe', raw_content: page, content: page }] };
  f.tools.execute = async () => ({ content: [{ type: 'text', text: JSON.stringify(payload) }] });
  const model = scriptedModel([
    assistantToolCall(toolName, { query: 'receta' }, 'c1'),
    result(research),
    result({ answer: 'Receta preparada' }),
  ]);
  const out = await runWorkflow({ store: f.store, definition, modelProvider: model, toolRuntime: f.tools });
  const toolMessage = model.calls[1]!.messages.find(m => m.role === 'tool');
  assert.deepEqual(JSON.parse(String(toolMessage?.content)), payload);
  assert.equal(out.status, 'completed');
});

test('external provider error details reach the model and are traced as failed tools', async () => {
  const f = installation(true);
  f.tools.execute = async () => ({ content: [{ type: 'text', text: JSON.stringify({ error: 'Search failed', detail: 'Invalid API key' }) }] });
  const model = scriptedModel([
    assistantToolCall(toolName, { query: 'receta' }, 'c1'),
    result({ status: 'blocked', code: 'search_failed', reason: 'Invalid API key', missing_fields: [] }),
  ]);
  const out = await runWorkflow({ store: f.store, definition, modelProvider: model, toolRuntime: f.tools });
  const toolMessage = model.calls[1]!.messages.find(m => m.role === 'tool');
  assert.match(String(toolMessage?.content), /^Error.*Invalid API key/);
  assert.equal(f.store.rows.agentSteps.find(s => s.type === 'tool')?.status, 'error');
  assert.equal(out.status, 'needs_input');
});

test('fresh installation: trusted annotated search runs without additional policies', async () => {
  const f = installation(true);
  const model = scriptedModel([
    assistantToolCall(toolName, { query: 'receta' }, 'c1'),
    result(research),
    result({ answer: 'Receta preparada' }),
  ]);
  const out = await runWorkflow({
    store: f.store,
    definition,
    modelProvider: model,
    toolRuntime: f.tools,
  });
  assert.equal(out.status, 'completed');
  assert.deepEqual(f.executed, [toolName]);
  assert.deepEqual(f.runs[0].state.investigar, research);
  assert.equal(f.runs[0].checklist[1].status, 'completed');
});

for (const [title, trusted, mode] of [
  ['old server without trust', undefined, undefined],
  ['untrusted server', false, undefined],
  ['admin requires confirmation', true, 'ask'],
  ['admin prohibits search', true, 'prohibited'],
] as const) {
  test(`fresh installation: ${title} blocks before downstream work`, async () => {
    const f = installation(trusted, mode);
    const events: AgentEvent[] = [];
    const model = scriptedModel([assistantToolCall(toolName, { query: 'receta' }, 'c1')]);
    const out = await runWorkflow({
      store: f.store,
      definition,
      modelProvider: model,
      toolRuntime: f.tools,
      onEvent: (e) => events.push(e),
    });
    assert.equal(out.status, 'needs_input');
    assert.deepEqual(f.executed, []);
    assert.equal(f.runs[0].state.investigar, undefined);
    assert.equal(f.runs[0].state.__blocked.investigar.code, 'permissions_blocked');
    assert.equal(f.runs[0].checklist[1].status, 'pending');
    assert.equal(model.calls.length, 1);
    assert.match(out.summary, /Bloqueado por permisos/);
    assert.ok(
      events.some(
        (e) => e.type === 'workflow_activity' && e.label.includes('Bloqueado por permisos')
      )
    );
    assert.ok(
      f.store.rows.agentSteps.some((s) => (s.detail as any)?.outcome === 'permissions_blocked')
    );
    assert.equal(f.store.rows.agentRuns[0].status, 'needs_approval');
    const exposed = await buildToolsForModel(
      f.store,
      f.tools,
      mode ? [{ tool_name: toolName, action: '*', resource: '', mode }] : []
    );
    assert.equal(
      exposed.some((t) => t.function.name === toolName),
      mode !== 'prohibited'
    );
  });
}

for (const output of [
  assistantText('¿Querés que busque otra receta?'),
  result({}),
  result({ ...research, ingredients: [] }),
  result({ status: 'blocked', reason: 'Falta el tema', missing_fields: ['topic'] }),
]) {
  test(`fresh workflow rejects incomplete output: ${output.content}`, async () => {
    const f = installation(true);
    const model = scriptedModel([output]);
    const out = await runWorkflow({
      store: f.store,
      definition,
      modelProvider: model,
      toolRuntime: f.tools,
    });
    assert.equal(out.status, 'needs_input');
    assert.equal(model.calls.length, 1);
    assert.equal(f.runs[0].state.investigar, undefined);
    assert.equal(f.runs[0].checklist[0].status, 'needs_input');
    assert.equal(f.runs[0].checklist[1].status, 'pending');
    assert.equal(f.store.rows.agentRuns[0].status, 'error');
  });
}

test('recipe accepts explicitly labelled knowledge fallback without claiming web research', async () => {
  const f = installation();
  const data = { ...research, source_urls: [], note: 'sin búsqueda web' };
  const model = scriptedModel([result(data), result({ answer: 'Preparado' })]);
  const out = await runWorkflow({
    store: f.store,
    definition,
    modelProvider: model,
    toolRuntime: f.tools,
  });
  assert.equal(out.status, 'completed');
  assert.equal(f.runs[0].state.investigar.note, 'sin búsqueda web');
});

test('automatic subagent enforces explicit agent allow-list', async () => {
  const f = installation(true);
  f.store.listAgents = async () => [
    {
      id: 'restricted',
      key: 'general',
      name: 'Restricted',
      instructions: '',
      enabled: true,
      allowed_tools: [],
    },
  ];
  const model = scriptedModel([assistantToolCall(toolName, {}, 'c1')]);
  const raw = await runHeadlessAnalysis({
    store: f.store,
    agentKey: 'general',
    task: 'Search',
    activityContext: { runId: 'run', stepKey: 'investigar' },
    workflowContract: resultContract('receta', 'investigar'),
    modelProvider: model,
    toolRuntime: f.tools,
  });
  assert.match(raw, /permissions_blocked/);
  assert.deepEqual(f.executed, []);
});

test('parallel resume reuses completed sibling and never forwards invalid state', async () => {
  const f = installation(true);
  const steps = ['a', 'b'].map((key) => ({
    key,
    agent_key: 'general',
    task: key,
    parallel_group: 'g',
    result_contract: { answer: { type: 'string' as const } },
  }));
  const d = { key: 'custom', name: 'Parallel', steps };
  const first = await runWorkflow({
    store: f.store,
    definition: d,
    modelProvider: scriptedModel([result({ answer: 'A' }), assistantText('¿Algo más?')]),
    toolRuntime: f.tools,
  });
  assert.equal(first.status, 'needs_input');
  assert.deepEqual(f.runs[0].state.a, { answer: 'A' });
  assert.equal(f.runs[0].state.b, undefined);
  const model = scriptedModel([result({ answer: 'B' })]);
  const resumed = await runWorkflow({
    store: f.store,
    definition: d,
    runId: first.runId,
    modelProvider: model,
    toolRuntime: f.tools,
  });
  assert.equal(resumed.status, 'completed');
  assert.equal(model.calls.length, 1);
  assert.deepEqual(f.runs[0].state.a, { answer: 'A' });
});

test('optional failed step follows declared continue policy and remains failed', async () => {
  const f = installation(true);
  const steps = [
    {
      key: 'optional',
      agent_key: 'general',
      task: 'Enrich',
      on_error: 'continue' as const,
      result_contract: { answer: { type: 'string' as const } },
    },
  ];
  const out = await runWorkflow({
    store: f.store,
    definition: { key: 'custom', name: 'Optional', steps },
    modelProvider: scriptedModel([result({})]),
    toolRuntime: f.tools,
  });
  assert.equal(out.status, 'completed');
  assert.equal(f.runs[0].checklist[0].status, 'failed');
  assert.equal(f.runs[0].state.optional, undefined);
  assert.match(out.summary, /pasos_fallidos_no_criticos/);
});

test('custom step without a contract stops before dispatching any agent', async () => {
  const f = installation(true);
  const model = scriptedModel([]);
  const out = await runWorkflow({
    store: f.store,
    definition: {
      key: 'custom',
      name: 'Missing contract',
      steps: [{ key: 'a', agent_key: 'general', task: 'Write' }],
    },
    modelProvider: model,
    toolRuntime: f.tools,
  });
  assert.equal(out.status, 'needs_input');
  assert.equal(model.calls.length, 0);
  assert.equal(f.runs[0].state.__blocked.a.code, 'missing_contract');
});

test('resumption preserves the original input and does not auto-approve permissions', async () => {
  const f = installation(false);
  const first = await runWorkflow({
    store: f.store,
    definition,
    input: { topic: 'Tortilla' },
    modelProvider: scriptedModel([assistantToolCall(toolName, {}, 'c1')]),
    toolRuntime: f.tools,
  });
  assert.equal(first.status, 'needs_input');
  const resumed = await runWorkflow({
    store: f.store,
    definition,
    runId: first.runId,
    modelProvider: scriptedModel([assistantToolCall(toolName, {}, 'c2')]),
    toolRuntime: f.tools,
  });
  assert.equal(resumed.status, 'needs_input');
  assert.deepEqual(f.executed, []);
  assert.equal(f.runs[0].input.topic, 'Tortilla');
});
