import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, buildMemoryBlock, decorateUserMessage, SKILL_PROMPTS } from './prompt.ts';

test('buildSystemPrompt sin args = prompt histórico de un solo agente', () => {
  const base = buildSystemPrompt();
  assert.match(base, /analista de e-commerce/i);
  assert.ok(base.length > 0);
});

test('buildSystemPrompt compone instrucciones del agente y skills', () => {
  const p = buildSystemPrompt({ instructions: 'SOS-VENTAS', skillTexts: ['SKILL-A', 'SKILL-B'] });
  assert.match(p, /SOS-VENTAS/);
  assert.match(p, /SKILL-A/);
  assert.match(p, /SKILL-B/);
});

test('buildSystemPrompt filtra instrucciones vacías (idéntico al base)', () => {
  const withEmpty = buildSystemPrompt({ instructions: '', skillTexts: [] });
  assert.equal(withEmpty, buildSystemPrompt());
});

test('decorateUserMessage inyecta período y skill, o deja el texto crudo', () => {
  const withPeriod = decorateUserMessage('hola', {
    period: { from: '2026-01-01', to: '2026-02-01' },
  });
  assert.match(withPeriod, /2026-01-01/);
  assert.match(withPeriod, /hola$/);

  const withSkill = decorateUserMessage('hola', { skill: 'ventas' });
  assert.match(withSkill, /SKILL/i);

  assert.equal(decorateUserMessage('hola', {}), 'hola');
  assert.equal(decorateUserMessage('hola', { skill: 'auto' }), 'hola');
});

test('buildMemoryBlock: vacío sin memorias; subordina a datos en vivo con memorias', () => {
  assert.equal(buildMemoryBlock([]), '');
  assert.equal(buildMemoryBlock(['  ']), '');
  const block = buildMemoryBlock(['(business_rule) Margen primero: el cliente prioriza margen.']);
  assert.match(block, /datos en vivo/i);
  assert.match(block, /Margen primero/);
});

test('buildSystemPrompt inyecta el bloque de memoria cuando hay memoryTexts', () => {
  const p = buildSystemPrompt({ memoryTexts: ['(faq) Devoluciones: 30 días.'] });
  assert.match(p, /Contexto recordado/i);
  assert.match(p, /Devoluciones: 30 días/);
  // Sin memorias no aparece el bloque.
  assert.doesNotMatch(buildSystemPrompt(), /Contexto recordado/i);
});

test('SKILL_PROMPTS tiene los 5 skills concretos', () => {
  for (const k of ['ventas', 'productos', 'clientes', 'ordenes', 'promociones'] as const) {
    assert.ok(typeof SKILL_PROMPTS[k] === 'string' && SKILL_PROMPTS[k].length > 0, k);
  }
});
