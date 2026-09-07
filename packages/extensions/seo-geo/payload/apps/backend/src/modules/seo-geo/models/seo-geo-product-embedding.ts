import { model } from '@medusajs/framework/utils';

/**
 * SeoGeoProductEmbedding — embedding del contenido de un producto para el
 * Simulador IA / RAG del catálogo (PRD §12). Una fila por producto. El vector se
 * guarda como JSON (jsonb) y el ranking es cosine en memoria — suficiente para
 * una herramienta interactiva y sin dependencia operativa de pgvector. `text_hash`
 * permite saltear el re-embed de productos sin cambios; `model` versiona el
 * embedding (re-embed si cambia el modelo). `content` guarda el texto embebido
 * para armar el contexto que se le pasa al LLM.
 */
export const SeoGeoProductEmbedding = model
  .define('seo_geo_product_embedding', {
    id: model.id({ prefix: 'seoemb' }).primaryKey(),
    product_id: model.text(),
    product_title: model.text().nullable(),
    product_handle: model.text().nullable(),
    model: model.text(),
    dims: model.number().default(0),
    text_hash: model.text().nullable(),
    content: model.text().nullable(),
    embedding: model.json().nullable(),
  })
  .indexes([
    { on: ['product_id'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['model'], where: 'deleted_at IS NULL' },
  ]);

export default SeoGeoProductEmbedding;
