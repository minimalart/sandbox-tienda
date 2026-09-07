import { getAiAssistantSettings, getEmbeddingCredentials } from '../settings';

/**
 * Cliente de embeddings vía OpenRouter (endpoint OpenAI-compatible
 * `/api/v1/embeddings`). Reusa la MISMA API key del chat (`OPENROUTER_API_KEY`)
 * salvo que se cargue una dedicada. Espeja la estructura de `chat-client.ts`:
 * misma fuente de configuración, mismo manejo de errores, mismos headers de
 * atribución.
 *
 * Modelo default `openai/text-embedding-3-small` (1536 dims). La dimensión es fija
 * porque la columna SQL es `vector(1536)`: el `dimensionGuard` tira si el provider
 * devuelve otra cosa (p. ej. un cambio accidental a `-3-large`, 3072d, que
 * corromperia el índice). Para cambiar de dimensión hace falta una migración nueva.
 *
 * Switchable a OpenAI directo (u otro endpoint OpenAI-compatible) sin reescribir:
 * `EMBEDDINGS_BASE_URL` + `EMBEDDINGS_API_KEY`, ahora editables desde la card.
 *
 * ─── LA ASIMETRÍA DE ESTE ARCHIVO, QUE ES A PROPÓSITO ───────────────────────
 *
 * Key, URL y modelo salen de `site_setting` (con fallback al entorno). La
 * DIMENSIÓN no: sigue viniendo de `process.env.EMBEDDINGS_DIMENSIONS` porque el
 * descriptor la declara `envOnly`. No es una migración a medias — cambiar el
 * ancho del vector desde un formulario deja la columna en `vector(1536)` y los
 * vectores viejos incomparables con los nuevos, y la búsqueda por similitud
 * empieza a devolver cualquier cosa SIN error. El motivo largo está en el
 * `envOnly` de `descriptors/ai-assistant.ts`.
 */

export const EMBEDDING_DIMENSIONS = 1536;

/** Sub-lotes para no exceder límites del provider con arrays grandes de chunks. */
const MAX_BATCH = 96;

export class EmbeddingAiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function getEmbeddingConfig() {
  const { apiKey, baseUrl, model } = getEmbeddingCredentials(getAiAssistantSettings());
  const dimensions =
    Number.parseInt(process.env.EMBEDDINGS_DIMENSIONS?.trim() ?? '', 10) || EMBEDDING_DIMENSIONS;
  // `|| undefined` conserva el contrato viejo: `isEmbeddingConfigured()` y el
  // `if (!apiKey)` de `embedBatch` esperan falsy, no un string vacío.
  return { apiKey: apiKey || undefined, url: `${baseUrl}/embeddings`, model, dimensions };
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(getEmbeddingConfig().apiKey);
}

type EmbeddingResponse = {
  data?: Array<{ embedding?: number[]; index?: number }>;
  model?: string;
  usage?: { prompt_tokens?: number; total_tokens?: number };
};

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const { apiKey, url, model, dimensions } = getEmbeddingConfig();
  if (!apiKey) {
    throw new EmbeddingAiError('OPENROUTER_API_KEY (o EMBEDDINGS_API_KEY) no está configurada.', 503);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': getAiAssistantSettings().openrouterSiteUrl,
        'X-Title': 'Mercatto AI Assistant',
      },
      body: JSON.stringify({ model, input: inputs, dimensions, encoding_format: 'float' }),
    });
  } catch (err) {
    throw new EmbeddingAiError(
      `No se pudo conectar con el proveedor de embeddings: ${(err as Error).message}`,
      502,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EmbeddingAiError(
      `El proveedor de embeddings respondió ${res.status}: ${body.slice(0, 400)}`,
      502,
    );
  }

  const data = (await res.json().catch(() => null)) as EmbeddingResponse | null;
  const rows = data?.data;
  if (!Array.isArray(rows) || rows.length !== inputs.length) {
    throw new EmbeddingAiError('El proveedor de embeddings devolvió una respuesta inesperada.', 502);
  }

  // Ordenar por `index` por las dudas (la spec no garantiza orden de entrada).
  const sorted = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((r) => {
    const vec = r.embedding;
    if (!Array.isArray(vec) || vec.length !== dimensions) {
      // dimensionGuard: detecta temprano un modelo con otra dimensión.
      throw new EmbeddingAiError(
        `Embedding con dimensión ${Array.isArray(vec) ? vec.length : 'desconocida'}, se esperaban ${dimensions}. Revisá EMBEDDINGS_MODEL/EMBEDDINGS_DIMENSIONS.`,
        500,
      );
    }
    return vec;
  });
}

/** Embebe N textos (en sub-lotes). Devuelve un vector por texto, en el mismo orden. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    const batch = texts.slice(i, i + MAX_BATCH);
    out.push(...(await embedBatch(batch)));
  }
  return out;
}

/** Embebe un único texto. */
export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  if (!vec) throw new EmbeddingAiError('No se pudo generar el embedding.', 502);
  return vec;
}

/** Modelo configurado (para guardar `embedding_model` por fila y versionar). */
export function getEmbeddingModelName(): string {
  return getEmbeddingConfig().model;
}
