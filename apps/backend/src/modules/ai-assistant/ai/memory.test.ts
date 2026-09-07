import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkText, serializeVector, buildRetrievalQuery, rankAndFilter } from './memory.ts';

test('chunkText: texto corto devuelve un solo chunk', () => {
  assert.deepEqual(chunkText('hola mundo'), ['hola mundo']);
  assert.deepEqual(chunkText('   '), []);
});

test('chunkText: empaqueta párrafos sin exceder maxChars', () => {
  const p = 'a'.repeat(40);
  const text = [p, p, p, p].join('\n\n');
  const chunks = chunkText(text, { maxChars: 100, overlap: 10 });
  assert.ok(chunks.length >= 2);
  for (const c of chunks) assert.ok(c.length <= 100, `chunk too long: ${c.length}`);
});

test('chunkText: corta un párrafo gigante por ventanas con overlap', () => {
  const huge = 'x'.repeat(350);
  const chunks = chunkText(huge, { maxChars: 100, overlap: 20 });
  assert.ok(chunks.length >= 4);
  for (const c of chunks) assert.ok(c.length <= 100);
});

test('serializeVector: literal pgvector', () => {
  assert.equal(serializeVector([0.1, 0.2, 0.3]), '[0.1,0.2,0.3]');
});

test('buildRetrievalQuery: con agentKey incluye scope y bindings en orden', () => {
  const { sql, bindings } = buildRetrievalQuery({
    tenantId: 'default',
    agentKey: 'ventas',
    memoryTypes: ['business_rule', 'decision'],
    embeddingLiteral: '[1,2,3]',
    limit: 15,
  });
  assert.match(sql, /agent_key is null or agent_key = \?/);
  assert.match(sql, /memory_type in \(\?, \?\)/);
  // orden: literal, tenant, ...types, agentKey, literal, limit
  assert.deepEqual(bindings, ['[1,2,3]', 'default', 'business_rule', 'decision', 'ventas', '[1,2,3]', 15]);
});

test('buildRetrievalQuery: sin agentKey usa solo memorias globales', () => {
  const { sql, bindings } = buildRetrievalQuery({
    tenantId: 'default',
    agentKey: null,
    memoryTypes: ['faq'],
    embeddingLiteral: '[9]',
    limit: 5,
  });
  assert.match(sql, /and agent_key is null/);
  assert.doesNotMatch(sql, /agent_key = \?/);
  assert.deepEqual(bindings, ['[9]', 'default', 'faq', '[9]', 5]);
});

test('rankAndFilter: filtra por similitud mínima y respeta topK', () => {
  const rows = [
    { id: '1', title: 'A', content: 'ca', memory_type: 'business_rule', similarity: 0.9, importance_score: 50 },
    { id: '2', title: 'B', content: 'cb', memory_type: 'decision', similarity: 0.5, importance_score: 50 },
    { id: '3', title: 'C', content: 'cc', memory_type: 'faq', similarity: 0.2, importance_score: 99 },
  ];
  const out = rankAndFilter(rows, { minSimilarity: 0.35, topK: 5 });
  assert.deepEqual(out.map((r) => r.id), ['1', '2']); // '3' cae por similitud baja
});

test('rankAndFilter: la importancia desempata el orden', () => {
  const rows = [
    { id: 'low', title: 'L', content: 'x', memory_type: 'decision', similarity: 0.6, importance_score: 10 },
    { id: 'high', title: 'H', content: 'x', memory_type: 'decision', similarity: 0.6, importance_score: 100 },
  ];
  const out = rankAndFilter(rows, { minSimilarity: 0.35, topK: 5 });
  assert.equal(out[0].id, 'high');
});

test('rankAndFilter: dedup por título', () => {
  const rows = [
    { id: '1', title: 'Misma', content: 'a', memory_type: 'faq', similarity: 0.9, importance_score: 50 },
    { id: '2', title: 'misma', content: 'b', memory_type: 'faq', similarity: 0.8, importance_score: 50 },
  ];
  const out = rankAndFilter(rows, { topK: 5 });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, '1');
});

test('rankAndFilter: corta por presupuesto de tokens', () => {
  const big = 'palabra '.repeat(500); // ~4000 chars => ~1000 tokens c/u
  const rows = [
    { id: '1', title: 'A', content: big, memory_type: 'faq', similarity: 0.9, importance_score: 50 },
    { id: '2', title: 'B', content: big, memory_type: 'faq', similarity: 0.8, importance_score: 50 },
    { id: '3', title: 'C', content: big, memory_type: 'faq', similarity: 0.7, importance_score: 50 },
  ];
  const out = rankAndFilter(rows, { topK: 5, tokenBudget: 300, snippetChars: 600 });
  // El primero entra siempre; el resto excede el presupuesto.
  assert.equal(out.length, 1);
});
