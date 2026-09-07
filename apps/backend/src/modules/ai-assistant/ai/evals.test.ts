import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { judgeGrounding } from './validation.ts';
import type { ApiMessage } from './types.ts';

/**
 * Eval del juez de grounding (anti-alucinación) contra un golden-set etiquetado.
 * Mide si el juez distingue respuestas respaldadas por los datos de las que
 * inventan cifras. Llama al MODELO REAL (lento + cuesta tokens), así que es
 * opt-in: solo corre con `RUN_AI_EVALS=true` (y requiere `OPENROUTER_API_KEY`).
 * En `npm test` normal se saltea.
 *
 * Para correrlo:
 *   RUN_AI_EVALS=true OPENROUTER_API_KEY=... npm test -- src/modules/ai-assistant/ai/evals.test.ts
 */

type Case = { name: string; data: string; answer: string; expectGrounded: boolean };

const casesUrl = new URL('./__evals__/grounding-cases.json', import.meta.url);
const CASES: Case[] = JSON.parse(readFileSync(fileURLToPath(casesUrl), 'utf8'));

// Umbral de acierto: los jueces LLM son probabilísticos, dejamos holgura.
const MIN_ACCURACY = 0.8;

test(
  'eval: el juez de grounding distingue respuestas respaldadas de alucinadas',
  { skip: process.env.RUN_AI_EVALS === 'true' ? false : 'eval opt-in: poné RUN_AI_EVALS=true' },
  async () => {
    let correct = 0;
    const misses: string[] = [];
    for (const c of CASES) {
      const messages: ApiMessage[] = c.data
        ? [{ role: 'tool', content: c.data }]
        : [{ role: 'user', content: 'sin tools' }];
      const verdict = await judgeGrounding({ messages, answer: c.answer });
      assert.ok(verdict, `el juez devolvió null para "${c.name}"`);
      if (verdict.grounded === c.expectGrounded) correct++;
      else misses.push(`${c.name} (esperado grounded=${c.expectGrounded}, dio ${verdict.grounded})`);
    }
    const accuracy = correct / CASES.length;
    assert.ok(
      accuracy >= MIN_ACCURACY,
      `accuracy ${accuracy.toFixed(2)} < ${MIN_ACCURACY}. Fallos: ${misses.join('; ')}`,
    );
  },
);
