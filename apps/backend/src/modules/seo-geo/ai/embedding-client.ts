/**
 * Cliente de embeddings self-contained del módulo SEO & GEO (mismo criterio que
 * `catalogador/ai/openrouter.ts`: NO importa el cliente del ai-assistant, para no
 * acoplar la extensión ni penalizar en el composer). Endpoint OpenAI-compatible
 * (`/api/v1/embeddings`), reusa `OPENROUTER_API_KEY` o `EMBEDDINGS_API_KEY`.
 *
 * Sigue sin importar nada del ai-assistant: `readForeignSetting` resuelve por DATO
 * (`findDescriptor`), así que si esa extensión no está instalada, esto degrada solo
 * a `process.env` y el módulo se sigue bastando a sí mismo.
 *
 * A diferencia del vector store del ai-assistant (columna pgvector fija), acá los
 * embeddings del catálogo se guardan como JSON y el ranking se hace en memoria
 * (cosine) — suficiente para el Simulador (herramienta interactiva, no alto QPS)
 * y sin dependencia operativa de pgvector. La dimensión no está clavada.
 */

import { readForeignSetting } from '../../app-settings/foreign';
/** El namespace dueño de la key y de la URL de atribución. Ver `getEmbeddingConfig`. */
const AI_NS = 'extension:ai-assistant';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/text-embedding-3-small';
const MAX_BATCH = 96;

export class EmbeddingAiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

/**
 * Las tres primeras las gestiona el Asistente IA, que es su dueño; acá se lee el
 * MISMO valor efectivo. Con `process.env`, rotar la key desde la card arreglaba el
 * asistente y dejaba las auditorías de SEO tirando 503 sin relación aparente.
 *
 * La CADENA `EMBEDDINGS_API_KEY → OPENROUTER_API_KEY` se conserva y se resuelve a
 * nivel descriptor, no sólo de entorno: si el operador cargó la key de OpenRouter y
 * no una específica de embeddings —que es el caso normal—, esto la encuentra igual.
 * Por eso son dos llamadas y no un `envFallback`: ese parámetro encadena nombres de
 * env, y lo que hace falta acá es encadenar dos DESCRIPTORES distintos.
 *
 * `EMBEDDINGS_DIMENSIONS` sigue leyéndose del entorno a propósito: es `envOnly`
 * porque la columna es `vector(1536)` fija y cambiarla es una migración más un
 * reindex, no un formulario.
 */
export function getEmbeddingConfig() {
  const apiKey =
    readForeignSetting(AI_NS, 'EMBEDDINGS_API_KEY') || readForeignSetting(AI_NS, 'OPENROUTER_API_KEY');
  const baseUrl = (readForeignSetting(AI_NS, 'EMBEDDINGS_BASE_URL') || DEFAULT_BASE_URL).replace(
    /\/+$/,
    '',
  );
  const model = readForeignSetting(AI_NS, 'EMBEDDINGS_MODEL') || DEFAULT_MODEL;
  const dims = Number.parseInt(process.env.EMBEDDINGS_DIMENSIONS?.trim() ?? '', 10) || undefined;
  return { apiKey, url: `${baseUrl}/embeddings`, model, dims };
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(getEmbeddingConfig().apiKey);
}

export function getEmbeddingModelName(): string {
  return getEmbeddingConfig().model;
}

type EmbeddingResponse = { data?: Array<{ embedding?: number[]; index?: number }> };

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const { apiKey, url, model, dims } = getEmbeddingConfig();
  if (!apiKey) throw new EmbeddingAiError('OPENROUTER_API_KEY (o EMBEDDINGS_API_KEY) no está configurada.', 503);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': readForeignSetting(AI_NS, 'OPENROUTER_SITE_URL') || 'https://mercatto.minimalart.studio',
        'X-Title': 'Mercatto SEO & GEO',
      },
      body: JSON.stringify({ model, input: inputs, encoding_format: 'float', ...(dims ? { dimensions: dims } : {}) }),
    });
  } catch (err) {
    throw new EmbeddingAiError(`No se pudo conectar con el proveedor de embeddings: ${(err as Error).message}`, 502);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EmbeddingAiError(`El proveedor de embeddings respondió ${res.status}: ${body.slice(0, 400)}`, 502);
  }
  const data = (await res.json().catch(() => null)) as EmbeddingResponse | null;
  const rows = data?.data;
  if (!Array.isArray(rows) || rows.length !== inputs.length) {
    throw new EmbeddingAiError('El proveedor de embeddings devolvió una respuesta inesperada.', 502);
  }
  return [...rows]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((r) => {
      if (!Array.isArray(r.embedding)) throw new EmbeddingAiError('Embedding inválido en la respuesta.', 502);
      return r.embedding;
    });
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    out.push(...(await embedBatch(texts.slice(i, i + MAX_BATCH))));
  }
  return out;
}

export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  if (!vec) throw new EmbeddingAiError('No se pudo generar el embedding.', 502);
  return vec;
}

/** Similitud coseno entre dos vectores (0..1 para embeddings normalizados). */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
