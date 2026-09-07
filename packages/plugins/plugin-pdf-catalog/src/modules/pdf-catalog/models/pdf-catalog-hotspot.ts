import { model } from '@medusajs/framework/utils';
import { PdfCatalog } from './pdf-catalog';

/**
 * PdfCatalogHotspot — un punto interactivo posicionado sobre una página del PDF.
 *
 * `type` decide qué payload aplica:
 * - product → usa `product_id` (+ `variant_id` opcional); precio/stock se
 *   resuelven en vivo por la store API (no se snapshotea, como shop_by_look).
 * - video   → `data = { youtubeUrl, title? }`.
 * - text    → `data = { title, content }`.
 *
 * `page_index` es 0-based. `pos_x` / `pos_y` son porcentajes enteros (0–100)
 * relativos al ancho/alto de la página renderizada.
 */
export const PdfCatalogHotspot = model
  .define('pdf_catalog_hotspot', {
    id: model
      .id({
        prefix: 'pchs',
      })
      .primaryKey(),
    type: model.enum(['product', 'video', 'text']).default('product'),
    page_index: model.number().default(0),
    pos_x: model.number().default(50),
    pos_y: model.number().default(50),
    product_id: model.text().nullable(),
    variant_id: model.text().nullable(),
    data: model.json().nullable(),
    sort_order: model.number().default(0),
    catalog: model.belongsTo(() => PdfCatalog, {
      mappedBy: 'hotspots',
    }),
  })
  .indexes([
    {
      on: ['catalog_id'],
      where: 'deleted_at IS NULL',
    },
    {
      on: ['product_id'],
      where: 'deleted_at IS NULL',
    },
  ]);
