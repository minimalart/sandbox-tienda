import { model } from '@medusajs/framework/utils';

/** Tipo de operación de imagen que originó la propuesta (PRD §12.2 / §12.3). */
export const ASSET_OPERATION_TYPES = [
  // Técnicas (determinísticas). `optimize` es el resultado combinado de las
  // técnicas seleccionadas: UNA versión optimizada que REEMPLAZA la imagen
  // original (no suma copias).
  'optimize',
  'to_webp',
  'compress',
  'resize',
  'normalize',
  // IA
  'recreate', // recreación/estandarización (fondo blanco)
  'lifestyle', // escena lifestyle
  'lifestyle_editable', // escena lifestyle con ajuste manual de posición/escala
  'background', // fondo configurado
  'generate_missing', // generar principal faltante
  'variation', // variación de una imagen existente
  'import_external', // imagen real encontrada en la web, importada tal cual (no IA)
] as const;

export type AssetOperationType = (typeof ASSET_OPERATION_TYPES)[number];

export const ASSET_PROPOSAL_STATUSES = [
  'pending',
  'proposed',
  'accepted',
  'rejected',
  'applied',
  'error',
] as const;

/**
 * CatalogingAssetProposal — una propuesta de imagen (procesada o generada) para
 * un producto de la ejecución (PRD §24). Conserva referencia al asset original
 * y al generado; NUNCA reemplaza la imagen existente antes de la aprobación
 * (PRD §12.3). Las imágenes generadas se marcan como contenido generado.
 */
export const CatalogingAssetProposal = model
  .define('cataloging_asset_proposal', {
    id: model.id({ prefix: 'catasset' }).primaryKey(),
    execution_product_id: model.text(),
    source_asset_id: model.text().nullable(), // File/media id o URL de origen
    generated_asset_id: model.text().nullable(), // File/media id resultante
    operation_type: model.enum([...ASSET_OPERATION_TYPES]),
    status: model.enum([...ASSET_PROPOSAL_STATUSES]).default('pending'),
    is_ai_generated: model.boolean().default(false),
    metadata: model.json().nullable(), // peso/dim antes-después, prompt ref, etc.
    generation_provider: model.text().nullable(),
    generation_model: model.text().nullable(),
  })
  .indexes([{ on: ['execution_product_id'], where: 'deleted_at IS NULL' }]);

export default CatalogingAssetProposal;
