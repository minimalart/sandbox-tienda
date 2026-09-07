import { model } from '@medusajs/framework/utils';
import { PdfCatalog } from './pdf-catalog';

/**
 * PdfCatalogChannel — activación de un catálogo en un sales channel.
 *
 * Invariante del feature: "una sola activa por sales channel". Se garantiza con
 * un índice UNIQUE parcial sobre `sales_channel_id` (ver migración): activar un
 * catálogo en un canal ya ocupado "roba" el canal (reconciliación en el
 * workflow), y la DB impide dos filas vivas para el mismo canal.
 */
export const PdfCatalogChannel = model
  .define('pdf_catalog_channel', {
    id: model
      .id({
        prefix: 'pcch',
      })
      .primaryKey(),
    sales_channel_id: model.text(),
    catalog: model.belongsTo(() => PdfCatalog, {
      mappedBy: 'channels',
    }),
  })
  .indexes([
    {
      on: ['sales_channel_id'],
      unique: true,
      where: 'deleted_at IS NULL',
    },
    {
      on: ['catalog_id'],
      where: 'deleted_at IS NULL',
    },
  ]);
