/**
 * Validación de "grounding" (anti-alucinación). Tras la respuesta final del
 * agente, un juez LLM barato verifica que los números y afirmaciones de la
 * respuesta estén respaldados por los datos que devolvieron las tools del turno.
 * Devuelve un veredicto `{ grounded, score, issues }` que se persiste en la traza
 * y, si no está grounded, dispara UN paso correctivo en el loop.
 *
 * Las piezas puras (`buildJudgeMessages`, `parseVerdict`, `buildToolContext`) van
 * separadas de la llamada al modelo para poder testearlas en aislamiento.
 */
import { chatComplete } from './chat-client';
import type { ApiMessage } from './types';

export type GroundingVerdict = {
  grounded: boolean;
  score: number; // 0..1
  issues: string[];
};

/** Tope del contexto de datos que se le pasa al juez (chars, los más recientes). */
const MAX_TOOL_CONTEXT_CHARS = 12_000;

const JUDGE_SYSTEM = [
  'Sos un verificador de "grounding" de un asistente de e-commerce.',
  'Te paso (1) los DATOS que devolvieron las herramientas y (2) la RESPUESTA del asistente.',
  'Tu tarea: decidir si los números y afirmaciones concretas de la RESPUESTA están respaldados por los DATOS.',
  'Reglas:',
  '- Si la respuesta afirma cifras (montos, cantidades, %, rankings) que NO aparecen ni se derivan de los datos → NO está grounded.',
  '- Si no hay datos y la respuesta hace afirmaciones numéricas concretas → NO está grounded.',
  '- Texto cualitativo/recomendaciones razonables no cuentan como alucinación.',
  'Respondé SOLO con un JSON: {"grounded": boolean, "score": number entre 0 y 1, "issues": [strings cortos]}.',
].join('\n');

/** Junta los resultados de tools del turno (role `tool`), recortando a lo más reciente. */
export function buildToolContext(messages: ApiMessage[]): string {
  const toolTexts = messages
    .filter((m) => m.role === 'tool' && typeof m.content === 'string' && m.content.length > 0)
    .map((m) => m.content as string);
  if (toolTexts.length === 0) return '';
  const joined = toolTexts.join('\n---\n');
  return joined.length > MAX_TOOL_CONTEXT_CHARS ? joined.slice(-MAX_TOOL_CONTEXT_CHARS) : joined;
}

/**
 * Instrucción de corrección que se le pasa al modelo cuando su respuesta no quedó
 * grounded. Le pide rehacer la respuesta usando SOLO los datos ya obtenidos
 * (sin inventar cifras): quitar/atenuar lo no respaldado, no agregar números nuevos.
 */
export function buildCorrectionInstruction(issues: string[]): string {
  const list = issues.length > 0 ? `\nProblemas detectados:\n- ${issues.join('\n- ')}` : '';
  return [
    'Tu respuesta anterior tiene afirmaciones o cifras que NO están respaldadas por los datos obtenidos.',
    'Rehacela usando SOLO los datos ya disponibles en este turno: quitá o atenuá lo no respaldado y NO inventes números nuevos.',
    'Si un dato no está disponible, decilo explícitamente en vez de estimarlo.',
    list,
  ].join('\n');
}

export function buildJudgeMessages(toolContext: string, answer: string): ApiMessage[] {
  const data = toolContext.trim() || '(sin datos de herramientas en este turno)';
  return [
    { role: 'system', content: JUDGE_SYSTEM },
    { role: 'user', content: `DATOS:\n${data}\n\nRESPUESTA:\n${answer}` },
  ];
}

/**
 * Parsea el veredicto del juez. Es tolerante: si no se puede parsear, asume
 * grounded (no queremos disparar correcciones por un parseo fallido).
 */
export function parseVerdict(raw: string | null): GroundingVerdict {
  const fallback: GroundingVerdict = { grounded: true, score: 1, issues: [] };
  if (!raw) return fallback;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return fallback;
  }
  if (!parsed || typeof parsed !== 'object') return fallback;
  const obj = parsed as Record<string, unknown>;
  const score =
    typeof obj.score === 'number' && Number.isFinite(obj.score)
      ? Math.min(Math.max(obj.score, 0), 1)
      : 1;
  const grounded = typeof obj.grounded === 'boolean' ? obj.grounded : score >= 0.5;
  const issues = Array.isArray(obj.issues)
    ? obj.issues.filter((i): i is string => typeof i === 'string').slice(0, 10)
    : [];
  return { grounded, score, issues };
}

/**
 * Corre el juez. Best-effort: ante cualquier error devuelve `null` para que el
 * caller siga sin tocar el turno. Usa el mismo cliente OpenRouter, con un
 * presupuesto chico y razonamiento bajo (es una verificación, no análisis).
 */
export async function judgeGrounding(opts: {
  messages: ApiMessage[];
  answer: string;
  model?: string;
}): Promise<GroundingVerdict | null> {
  const toolContext = buildToolContext(opts.messages);
  try {
    const res = await chatComplete({
      model: opts.model,
      messages: buildJudgeMessages(toolContext, opts.answer),
      maxTokens: 800,
      reasoningEffort: 'low',
    });
    return parseVerdict(res.content);
  } catch {
    return null;
  }
}
