import assert from 'node:assert/strict';
import test from 'node:test';
import { compactToolResult, MAX_TOOL_RESULT_CHARS } from './tool-result.ts';

const recipe = 'Ingredientes: arroz, hongos, caldo, cebolla. Preparación: dorar, agregar arroz, incorporar caldo. '.repeat(8);

test('Tavily extraction retains page text and search retains complete snippets', () => {
  for (const field of ['raw_content', 'content']) {
    const payload = { results: [{ url: 'https://example.com/recipe', [field]: recipe }] };
    assert.deepEqual(JSON.parse(compactToolResult(JSON.stringify(payload), 'mcp__tavily__tavily_extract')), payload);
  }
});

test('another external server retains markdown and metadata without Medusa assumptions', () => {
  const payload = { markdown: recipe, detail: { source: 'document' }, raw_data: { text: recipe } };
  assert.deepEqual(JSON.parse(compactToolResult(JSON.stringify(payload), 'mcp__firecrawl__firecrawl_scrape')), payload);
});

test('external provider errors retain their cause and report failure to the agent logs', () => {
  const payload = { error: 'Search failed', detail: 'Invalid API key', results: [] };
  const output = compactToolResult(JSON.stringify(payload), 'mcp__tavily__tavily_search');
  assert.match(output, /^Error/);
  assert.match(output, /Invalid API key/);
  assert.doesNotMatch(output, /order|OTRA variante/);
});

test('external empty results do not suggest unsupported Medusa filters', () => {
  assert.equal(compactToolResult('{"results":[]}', 'mcp__tavily__tavily_search'), '{"results":[]}');
});

test('Medusa order compaction stays enabled', () => {
  const payload = { orders: [{ id: 'o1', total: 100, raw_total: { value: '100' }, detail: { duplicate: true }, description: recipe }] };
  const out = JSON.parse(compactToolResult(JSON.stringify(payload), 'manage_medusa_admin_orders'));
  assert.equal(out.orders[0].total, 100);
  assert.equal(out.orders[0].raw_total, undefined);
  assert.equal(out.orders[0].detail, undefined);
  assert.equal(out.orders[0].description.length, 201);
});

test('external document size remains bounded', () => {
  const out = compactToolResult(JSON.stringify({ raw_content: 'x'.repeat(MAX_TOOL_RESULT_CHARS * 2) }), 'mcp__docs__read');
  assert.ok(out.length < MAX_TOOL_RESULT_CHARS + 200);
  assert.match(out, /resultado truncado/);
});
