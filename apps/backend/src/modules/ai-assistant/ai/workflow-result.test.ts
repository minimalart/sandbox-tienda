import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorkflowResult, resultContract, validateWorkflowResult } from './workflow-result';
import { resolveMode, classifyAction } from './policy';

const hints = { trusted: true, read_only_hint: true, has_action: false };
test('fresh permissions: only trusted actionless read annotations are automatic', () => {
  assert.equal(resolveMode('mcp__search__search', '*', '', [], hints), 'auto');
  assert.equal(classifyAction('*', hints), 'read');
  for (const changed of [
    undefined,
    { ...hints, trusted: false },
    { ...hints, read_only_hint: false },
    { ...hints, has_action: true },
  ]) {
    assert.equal(resolveMode('mcp__search__search', '*', '', [], changed), 'ask');
  }
  assert.equal(resolveMode('mcp__search__search', 'create', '', [], hints), 'ask');
  for (const mode of ['ask', 'prohibited', 'auto'] as const) {
    assert.equal(
      resolveMode(
        'mcp__search__search',
        '*',
        '',
        [{ tool_name: 'mcp__search__search', action: '*', resource: '', mode }],
        hints
      ),
      mode
    );
  }
});

test('questions, arrays, malformed, ambiguous and empty results cannot complete research', () => {
  const contract = resultContract('receta', 'investigar');
  for (const text of [
    '¿Qué receta querés?',
    '<result>[]</result>',
    '<result>{}</result>',
    '<result>{bad}</result>',
    '<result>{}</result><result>{}</result>',
    '<result>{"text":"¿Puedo buscar?"}</result>',
  ]) {
    assert.equal(validateWorkflowResult(parseWorkflowResult(text), contract).ok, false, text);
  }
});

const research = {
  ingredients: ['papa', 'cebolla', 'huevo', 'aceite'],
  steps: ['Cortá', 'Cociná', 'Serví'],
  source_urls: ['https://example.org/receta'],
};
test('research requires ingredients, preparation and sources or the declared fallback', () => {
  const contract = resultContract('receta', 'investigar');
  assert.equal(validateWorkflowResult(research, contract).ok, true);
  for (const data of [
    { ...research, ingredients: [] },
    { ...research, steps: ['¿Qué preparo?'] },
    { ...research, source_urls: [] },
    { ...research, source_urls: ['javascript:alert(1)'] },
  ]) {
    assert.equal(validateWorkflowResult(data, contract).ok, false);
  }
  assert.equal(
    validateWorkflowResult({ ...research, source_urls: [], note: 'sin búsqueda web' }, contract).ok,
    true
  );
});

test('every canonical step has a result contract; custom steps need an explicit contract', () => {
  for (const [workflow, steps] of Object.entries({
    receta: ['investigar', 'redactar', 'portada', 'productos'],
    campania_comercial: [
      'resolver_productos',
      'preparar_promocion',
      'crear_nota',
      'crear_banner',
      'crear_landing',
      'validar',
    ],
  })) {
    for (const step of steps) assert.ok(resultContract(workflow, step));
  }
  assert.equal(validateWorkflowResult({ answer: 'Listo' }, undefined).ok, false);
  assert.equal(
    validateWorkflowResult({ answer: 'Listo' }, { answer: { type: 'string' } }).ok,
    true
  );
  assert.equal(
    validateWorkflowResult({ cover_set: false }, resultContract('receta', 'portada')).ok,
    false
  );
});

test('promotion domain status and highlight-only alternative stay compatible', () => {
  const contract = resultContract('campania_comercial', 'preparar_promocion');
  assert.equal(
    validateWorkflowResult({ promotion_id: 'promo_1', status: 'inactive' }, contract).ok,
    true
  );
  assert.equal(
    validateWorkflowResult({ promotion_id: null, status: 'none', type: 'highlight_only' }, contract)
      .ok,
    true
  );
  assert.equal(validateWorkflowResult({ promotion_id: null }, contract).ok, false);
});
