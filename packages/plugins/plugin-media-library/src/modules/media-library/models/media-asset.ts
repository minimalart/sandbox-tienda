import { model } from '@medusajs/framework/utils';

/**
 * Asset del catálogo de la Biblioteca. Registra un archivo ya subido al File
 * Module (S3): su `url` pública + `file_id` del provider. Reutilizable para
 * adjuntar a productos sin volver a subir.
 */
export const MediaAsset = model
  .define('media_asset', {
    id: model.id({ prefix: 'media' }).primaryKey(),
    file_id: model.text().nullable(),
    url: model.text(),
    filename: model.text(),
    mime_type: model.text().nullable(),
    size: model.number().nullable(),
    alt: model.text().nullable(),
    title: model.text().nullable(),
    // 'upload' | 'backfill:product'
    source: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['filename'] }, { on: ['file_id'] }, { on: ['url'] }]);

export default MediaAsset;
