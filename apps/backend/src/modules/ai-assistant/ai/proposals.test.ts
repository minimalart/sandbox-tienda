import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProposals,
  buildAnalysisTask,
  resolveProposalAgentKeys,
  PROPOSAL_EXCLUDED_AGENT_KEYS,
  extractActionResult,
  resolvePipedArgs,
} from './proposals.ts';

test('parseProposals extrae un bloque válido con acciones', () => {
  const text =
    'Intro\n<proposal>{"title":"Bajar precio X","summary":"resumen","rationale":"porque cayó","actions":[{"tool":"manage_medusa_admin_pricing","args":{"action":"create"},"label":"Crear promo"}],"expected_impact":{"metric":"ventas"}}</proposal>';
  const out = parseProposals(text);
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'Bajar precio X');
  assert.equal(out[0].proposed_actions.length, 1);
  assert.equal(out[0].proposed_actions[0].tool, 'manage_medusa_admin_pricing');
  assert.deepEqual(out[0].proposed_actions[0].args, { action: 'create' });
  assert.deepEqual(out[0].expected_impact, { metric: 'ventas' });
});

test('parseProposals admite múltiples bloques y acciones vacías (asesora)', () => {
  const text =
    '<proposal>{"title":"A","summary":"s"}</proposal><proposal>{"title":"B","summary":"s2","actions":[]}</proposal>';
  const out = parseProposals(text);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].proposed_actions, []);
  assert.deepEqual(out[1].proposed_actions, []);
});

test('parseProposals ignora JSON inválido y bloques sin title/summary', () => {
  const text =
    '<proposal>{no es json}</proposal><proposal>{"title":"sin summary"}</proposal><proposal>{"summary":"sin title"}</proposal>';
  assert.equal(parseProposals(text).length, 0);
});

test('parseProposals descarta acciones sin tool', () => {
  const text =
    '<proposal>{"title":"T","summary":"s","actions":[{"args":{}},{"tool":"x"}]}</proposal>';
  const out = parseProposals(text);
  assert.equal(out[0].proposed_actions.length, 1);
  assert.equal(out[0].proposed_actions[0].tool, 'x');
});

test('parseProposals devuelve [] para texto sin bloques', () => {
  assert.deepEqual(parseProposals('Sin propuestas.'), []);
  assert.deepEqual(parseProposals(''), []);
});

test('buildAnalysisTask incluye el límite, el foco y el formato <proposal>', () => {
  const t = buildAnalysisTask({ limit: 5, focus: 'stock bajo' });
  assert.match(t, /hasta 5/);
  assert.match(t, /stock bajo/);
  assert.match(t, /<proposal>/);
});

test('buildAnalysisTask instruye arrancar con las tools de analytics', () => {
  const t = buildAnalysisTask();
  assert.match(t, /analyze_sales/);
  assert.match(t, /analyze_products/);
  assert.match(t, /analyze_customers/);
});

test('buildAnalysisTask cubre todo el playbook (comercial + contenido + segmentos)', () => {
  const t = buildAnalysisTask();
  // Comercial
  assert.match(t, /prepare_promotion/);
  assert.match(t, /manage_medusa_admin_pricing/);
  assert.match(t, /manage_medusa_admin_collections/);
  assert.match(t, /manage_medusa_admin_inventory/);
  // Contenido / marketing
  assert.match(t, /create_blog_post/);
  assert.match(t, /create_banner_draft/);
  assert.match(t, /create_landing_draft/);
  assert.match(t, /campania_comercial/);
  // Segmentos
  assert.match(t, /create_dynamic_group/);
});

test('buildAnalysisTask incluye diversidad y la regla de piping', () => {
  const t = buildAnalysisTask();
  assert.match(t, /Máximo UNA propuesta de descuento puro/);
  assert.match(t, /\$prev\./);
});

test('buildAnalysisTask cubre fidelización, segmentos poblados y ciclo de vida de promos', () => {
  const t = buildAnalysisTask();
  assert.match(t, /create_dynamic_group/);
  assert.match(t, /create_loyalty_campaign/);
  assert.match(t, /create_loyalty_reward/);
  assert.match(t, /issue_gift_card/);
  assert.match(t, /analyze_promotions/);
  assert.match(t, /analyze_carts/);
  assert.match(t, /analyze_search_gaps/);
});

test('resolveProposalAgentKeys excluye subagentes mecánicos y el bot', () => {
  const rows = [
    { key: 'ventas' },
    { key: 'catalogo' },
    { key: 'ordenes' },
    { key: 'redactor' },
    { key: 'imagenes' },
    { key: 'investigador' },
    { key: 'promociones' },
    { key: 'validador' },
    { key: 'whatsapp' },
    { key: 'mi-agente-custom' },
    { key: 'orchestrator', is_orchestrator: true },
    { key: 'apagado', enabled: false },
  ];
  const keys = resolveProposalAgentKeys(rows, 'ventas');
  assert.deepEqual(
    keys.sort(),
    ['catalogo', 'imagenes', 'investigador', 'mi-agente-custom', 'ordenes', 'redactor', 'ventas'].sort(),
  );
  for (const k of PROPOSAL_EXCLUDED_AGENT_KEYS) assert.ok(!keys.includes(k));
});

test('resolveProposalAgentKeys cae al orquestador si solo hay agentes excluidos', () => {
  const rows = [
    { key: 'whatsapp' },
    { key: 'validador' },
    { key: 'orchestrator', is_orchestrator: true },
  ];
  assert.deepEqual(resolveProposalAgentKeys(rows, 'ventas'), ['orchestrator']);
});

test('resolveProposalAgentKeys cae al fallback sin agentes sembrados', () => {
  assert.deepEqual(resolveProposalAgentKeys([], 'ventas'), ['ventas']);
});

test('extractActionResult: pares clave=valor de mensajes humanos', () => {
  const out = extractActionResult(
    'OK: grupo dinámico creado y poblado (12 cliente(s)). dynamic_group_id=dg_123 | customer_group_id=cusgroup_456. Se administra en Grupos dinámicos.',
  );
  assert.equal(out.dynamic_group_id, 'dg_123');
  assert.equal(out.customer_group_id, 'cusgroup_456');
});

test('extractActionResult: bloque <result> con JSON', () => {
  const out = extractActionResult(
    'OK: promoción creada INACTIVA. <result>{"promotion_id":"promo_9","type":"bogo","status":"inactive"}</result>',
  );
  assert.equal(out.promotion_id, 'promo_9');
  assert.equal(out.type, 'bogo');
});

test('extractActionResult: texto entero JSON (respuesta MCP)', () => {
  const out = extractActionResult('{"customer_group":{"id":"cg_1","name":"VIP"}}');
  assert.deepEqual(out.customer_group, { id: 'cg_1', name: 'VIP' });
});

test('extractActionResult: texto sin nada estructurado devuelve {}', () => {
  assert.deepEqual(extractActionResult('Sin datos.'), {});
  assert.deepEqual(extractActionResult(''), {});
});

test('resolvePipedArgs: resuelve $prev en strings anidados y arrays', () => {
  const prev = { customer_group_id: 'cg_9', nested: { id: 'x_1' } };
  const { args, error } = resolvePipedArgs(
    {
      name: 'Promo',
      customer_group_ids: ['$prev.customer_group_id'],
      deep: { ref: '$prev.nested.id' },
      normal: 'sin-cambios',
    },
    prev,
  );
  assert.equal(error, undefined);
  assert.deepEqual(args.customer_group_ids, ['cg_9']);
  assert.deepEqual(args.deep, { ref: 'x_1' });
  assert.equal(args.normal, 'sin-cambios');
});

test('resolvePipedArgs: path inexistente o sin resultado previo devuelve error', () => {
  const r1 = resolvePipedArgs({ a: '$prev.no_existe' }, { otra: 1 });
  assert.match(r1.error ?? '', /no_existe/);
  const r2 = resolvePipedArgs({ a: '$prev.x' }, null);
  assert.match(r2.error ?? '', /no hay resultado/);
});

test('resolvePipedArgs: sin referencias devuelve los args tal cual', () => {
  const { args, error } = resolvePipedArgs({ a: 1, b: 'texto', c: { d: true } }, null);
  assert.equal(error, undefined);
  assert.deepEqual(args, { a: 1, b: 'texto', c: { d: true } });
});
