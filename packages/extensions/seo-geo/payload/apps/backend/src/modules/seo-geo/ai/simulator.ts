import type { MedusaContainer } from '@medusajs/framework/types';
import { SEO_GEO_MODULE } from '../index';
import type SeoGeoModuleService from '../service';
import type { SeoGeoConfig } from '../config';
import { cosineSimilarity, embedText, isEmbeddingConfigured } from './embedding-client';
import { chatComplete, isAiConfigured, type ChatMessage } from './openrouter';

export type SimulatorUsedProduct = { product_id: string; title: string | null; similarity: number };
export type SimulatorSkippedProduct = { product_id: string; title: string | null; similarity: number; reason: string };

export type SimulatorResult = {
  answer: string;
  used: SimulatorUsedProduct[];
  not_used: SimulatorSkippedProduct[];
  configured: boolean;
  indexed: number;
};

/**
 * Simulador IA (PRD §12): dado un prompt de usuario, recupera del catálogo los
 * productos más afines (cosine sobre los embeddings) y responde con el LLM
 * usando SOLO esos productos, explicando cuáles usó y cuáles NO (y por qué: baja
 * similitud = información insuficiente para ser recuperado). Es una prueba de
 * recuperabilidad, la evidencia central del enfoque GEO defendible del PRD.
 */
/**
 * `allowedProductIds`: el catálogo de la tienda que simula.
 *
 * `null` = no filtrar (instalación mono-tienda, registro ausente, o ninguna tienda
 * activa), que es el comportamiento histórico. Un array VACÍO no es lo mismo que
 * `null` y se respeta como tal: una tienda que no vende nada tiene que simular
 * sobre cero productos, no sobre todos.
 *
 * Va como opción y no como filtro en la consulta porque `seo_geo_product_embedding`
 * no tiene columna de canal —`product_id` es UNIQUE en toda la instalación, un
 * embedding por producto— así que la pertenencia sólo se puede resolver por el link
 * de canal, que vive del lado del request (`productIdsForSite`).
 */
export async function runSimulator(
  container: MedusaContainer,
  prompt: string,
  cfg: SeoGeoConfig,
  opts: { allowedProductIds?: string[] | null } = {}
): Promise<SimulatorResult> {
  const service = container.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);
  const configured = isEmbeddingConfigured() && isAiConfigured();

  const all = await service.listSeoGeoProductEmbeddings({}, { take: null as unknown as number });
  const allowed = opts.allowedProductIds;
  const rows = allowed === null || allowed === undefined
    ? all
    : ((): typeof all => {
        const set = new Set(allowed);
        return all.filter((r) => set.has(r.product_id as string));
      })();
  // `indexed` cuenta lo que ESTA tienda tiene embebido, no lo de la instalación:
  // si contara todo, una tienda con cero productos indexados vería "1.200 indexados"
  // y "ningún producto responde", que es la combinación que hace pensar que el
  // simulador está roto en vez de que falta embeber SU catálogo.
  const indexed = rows.length;

  if (!configured) {
    return {
      answer:
        'El Simulador necesita configurar la IA (OPENROUTER_API_KEY / EMBEDDINGS_API_KEY) y haber embebido el catálogo.',
      used: [],
      not_used: [],
      configured,
      indexed,
    };
  }
  if (indexed === 0) {
    return {
      answer: 'Todavía no hay catálogo embebido. Corré el embed del catálogo antes de simular.',
      used: [],
      not_used: [],
      configured,
      indexed,
    };
  }

  // 1) Embeder la consulta y rankear por cosine
  const queryVec = await embedText(prompt);
  const scored = rows
    .map((r) => ({
      product_id: r.product_id,
      title: r.product_title,
      content: (r.content as string) || '',
      similarity: Array.isArray(r.embedding) ? cosineSimilarity(queryVec, r.embedding as number[]) : 0,
    }))
    .sort((a, b) => b.similarity - a.similarity);

  const topK = scored.slice(0, cfg.simulator.top_k);
  const used = topK.filter((s) => s.similarity >= cfg.simulator.min_similarity);
  // "No usados": los que quedaron cerca pero bajo el umbral (recuperables a medias).
  const notUsed = topK
    .filter((s) => s.similarity < cfg.simulator.min_similarity)
    .map((s) => ({
      product_id: s.product_id,
      title: s.title,
      similarity: Number(s.similarity.toFixed(3)),
      reason: 'Similitud por debajo del umbral: su contenido no es suficiente para responder esta pregunta.',
    }));

  if (used.length === 0) {
    return {
      answer:
        'Ningún producto del catálogo tiene información suficiente para responder esta pregunta con confianza. ' +
        'Es una señal de cobertura GEO: falta contenido que responda este tipo de consulta.',
      used: [],
      not_used: notUsed,
      configured,
      indexed,
    };
  }

  // 2) Responder con el LLM usando SOLO los productos recuperados
  const context = used
    .map((s, i) => `[${i + 1}] (${s.product_id}) ${s.title ?? ''}\n${s.content}`)
    .join('\n\n');
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'Sos un asistente de compras. Respondé SOLO con los productos provistos en el contexto. ' +
        'Si el contexto no alcanza, decilo con honestidad. No inventes productos ni especificaciones. Respondé en español, breve.',
    },
    { role: 'user', content: `Pregunta: ${prompt}\n\nProductos disponibles:\n${context}` },
  ];
  const answer = await chatComplete(messages, { max_tokens: 700, temperature: 0.3 });

  return {
    answer,
    used: used.map((s) => ({ product_id: s.product_id, title: s.title, similarity: Number(s.similarity.toFixed(3)) })),
    not_used: notUsed,
    configured,
    indexed,
  };
}
