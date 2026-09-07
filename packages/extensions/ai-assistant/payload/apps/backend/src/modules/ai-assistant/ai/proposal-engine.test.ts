import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTriageLeads,
  buildTriagePrompt,
  buildSpecialistTask,
  LEAD_AGENT_KEYS,
  PROPOSAL_LEAD_TYPES,
  type ProposalLead,
} from './proposal-engine.ts';
import { PROPOSAL_EXCLUDED_AGENT_KEYS } from './proposals.ts';

test('parseTriageLeads: array JSON limpio', () => {
  const text =
    '[{"type":"promo","evidence":"prod_1 cayó 30%","focus":"promo 2x1"},{"type":"inventory","evidence":"sku X en quiebre","focus":"reponer"}]';
  const leads = parseTriageLeads(text, 5);
  assert.equal(leads.length, 2);
  assert.equal(leads[0].type, 'promo');
  assert.equal(leads[1].evidence, 'sku X en quiebre');
});

test('parseTriageLeads: tolera fences y texto alrededor', () => {
  const text = 'Acá van los leads:\n```json\n[{"type":"banner","evidence":"e","focus":"f"}]\n```\nlisto';
  const leads = parseTriageLeads(text, 5);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].type, 'banner');
});

test('parseTriageLeads: descarta tipos inválidos y respeta el máximo', () => {
  const text =
    '[{"type":"promo","evidence":"a","focus":"b"},{"type":"inexistente","evidence":"x","focus":"y"},{"type":"blog","evidence":"c","focus":"d"},{"type":"ops","evidence":"e","focus":"f"}]';
  const leads = parseTriageLeads(text, 2);
  assert.equal(leads.length, 2);
  assert.deepEqual(
    leads.map((l) => l.type),
    ['promo', 'blog'],
  );
});

test('parseTriageLeads: JSON roto o sin array devuelve []', () => {
  assert.deepEqual(parseTriageLeads('no hay json', 3), []);
  assert.deepEqual(parseTriageLeads('[{roto', 3), []);
  assert.deepEqual(parseTriageLeads('{"type":"promo"}', 3), []);
  assert.deepEqual(parseTriageLeads('', 3), []);
});

test('buildTriagePrompt incluye los tipos, el límite y el digest', () => {
  const p = buildTriagePrompt({ sales: { kpis: {} } }, 4);
  assert.match(p, /las 4 MEJORES/);
  for (const t of PROPOSAL_LEAD_TYPES) assert.ok(p.includes(t), `falta el tipo ${t}`);
  assert.match(p, /DIGEST:/);
  assert.match(p, /"sales"/);
  assert.match(p, /máximo UN lead de descuento puro/);
});

test('LEAD_AGENT_KEYS mapea cada tipo a un agente NO excluido del fan-out', () => {
  for (const t of PROPOSAL_LEAD_TYPES) {
    const agent = LEAD_AGENT_KEYS[t];
    assert.ok(agent, `tipo ${t} sin agente`);
    assert.ok(!PROPOSAL_EXCLUDED_AGENT_KEYS.has(agent), `tipo ${t} mapeado a agente excluido`);
  }
  assert.equal(LEAD_AGENT_KEYS.banner, 'imagenes');
  assert.equal(LEAD_AGENT_KEYS.blog, 'redactor');
  assert.equal(LEAD_AGENT_KEYS.inventory, 'catalogo');
  assert.equal(LEAD_AGENT_KEYS.ops, 'ordenes');
  assert.equal(LEAD_AGENT_KEYS.loyalty, 'ventas');
  assert.equal(LEAD_AGENT_KEYS.search_gap, 'catalogo');
  assert.equal(LEAD_AGENT_KEYS.cart_recovery, 'ventas');
  assert.equal(LEAD_AGENT_KEYS.promo_lifecycle, 'ventas');
});

test('buildSpecialistTask: incluye evidencia, encargo y pide EXACTAMENTE un bloque', () => {
  for (const t of PROPOSAL_LEAD_TYPES) {
    const lead: ProposalLead = { type: t, evidence: 'EVIDENCIA-123', focus: 'ENCARGO-456' };
    const task = buildSpecialistTask(lead);
    assert.match(task, /EVIDENCIA-123/);
    assert.match(task, /ENCARGO-456/);
    assert.match(task, /EXACTAMENTE UN bloque <proposal>/);
    assert.match(task, /Sin propuestas\./);
  }
});

test('buildSpecialistTask: cada tipo referencia su tool principal', () => {
  const toolByType: Record<string, RegExp> = {
    promo: /prepare_promotion/,
    pricing: /manage_medusa_admin_pricing/,
    inventory: /manage_medusa_admin_inventory/,
    bundle: /manage_medusa_admin_collections/,
    winback: /prepare_promotion/,
    blog: /create_blog_post/,
    banner: /create_banner_draft/,
    landing: /create_landing_draft/,
    campaign: /start_workflow/,
    dynamic_group: /create_dynamic_group/,
    promo_lifecycle: /analyze_promotions/,
    cart_recovery: /analyze_carts/,
    search_gap: /analyze_search_gaps/,
    loyalty: /create_loyalty_campaign/,
  };
  for (const [type, re] of Object.entries(toolByType)) {
    const task = buildSpecialistTask({ type: type as any, evidence: 'e', focus: 'f' });
    assert.match(task, re, `tipo ${type} no referencia su tool`);
  }
});
