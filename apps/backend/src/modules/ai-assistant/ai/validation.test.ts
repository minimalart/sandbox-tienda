import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildToolContext,
  buildJudgeMessages,
  buildCorrectionInstruction,
  parseVerdict,
} from './validation.ts';
import type { ApiMessage } from './types.ts';

test('buildToolContext: junta solo los mensajes role tool con contenido', () => {
  const messages: ApiMessage[] = [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'hola' },
    { role: 'tool', content: '{"count":2}' },
    { role: 'assistant', content: 'resp' },
    { role: 'tool', content: '{"orders":[]}' },
  ];
  const ctx = buildToolContext(messages);
  assert.match(ctx, /count/);
  assert.match(ctx, /orders/);
  assert.doesNotMatch(ctx, /hola/);
  assert.doesNotMatch(ctx, /resp/);
});

test('buildToolContext: sin tools devuelve string vacío', () => {
  assert.equal(buildToolContext([{ role: 'user', content: 'x' }]), '');
});

test('buildJudgeMessages: incluye datos y respuesta; placeholder si no hay datos', () => {
  const msgs = buildJudgeMessages('', 'La venta fue $100');
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, 'system');
  assert.match(msgs[1].content as string, /sin datos/);
  assert.match(msgs[1].content as string, /La venta fue \$100/);
});

test('parseVerdict: JSON limpio', () => {
  const v = parseVerdict('{"grounded": false, "score": 0.2, "issues": ["el total no aparece"]}');
  assert.equal(v.grounded, false);
  assert.equal(v.score, 0.2);
  assert.deepEqual(v.issues, ['el total no aparece']);
});

test('parseVerdict: JSON envuelto en texto/fences', () => {
  const v = parseVerdict('```json\n{"grounded": true, "score": 0.9, "issues": []}\n```');
  assert.equal(v.grounded, true);
  assert.equal(v.score, 0.9);
});

test('parseVerdict: clamp de score y grounded derivado del score', () => {
  const v = parseVerdict('{"score": 1.7}');
  assert.equal(v.score, 1);
  assert.equal(v.grounded, true); // score>=0.5 → grounded
  const v2 = parseVerdict('{"score": 0.1}');
  assert.equal(v2.grounded, false);
});

test('parseVerdict: entrada inválida → grounded por defecto (no dispara corrección)', () => {
  assert.deepEqual(parseVerdict(null), { grounded: true, score: 1, issues: [] });
  assert.deepEqual(parseVerdict('no es json'), { grounded: true, score: 1, issues: [] });
});

test('buildCorrectionInstruction: lista los problemas detectados', () => {
  const txt = buildCorrectionInstruction(['cifra A sin respaldo', 'cifra B sin respaldo']);
  assert.match(txt, /cifra A sin respaldo/);
  assert.match(txt, /cifra B sin respaldo/);
  assert.match(txt, /NO inventes/);
});
