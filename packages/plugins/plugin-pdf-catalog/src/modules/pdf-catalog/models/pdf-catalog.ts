import { model } from '@medusajs/framework/utils';
import { PdfCatalogHotspot } from './pdf-catalog-hotspot';
import { PdfCatalogChannel } from './pdf-catalog-channel';

/**
 * PdfCatalog — un catálogo/revista en PDF navegable como flipbook, con hotspots
 * interactivos encima (producto / video / texto).
 *
 * Se pueden crear varios, pero por cada sales channel hay a lo sumo UNO activo:
 * la exclusividad vive en `PdfCatalogChannel` (unique por sales_channel_id), no
 * acá. `published` es un gate independiente: un catálogo debe estar publicado Y
 * activo en el canal para verse en el storefront.
 */
export const PdfCatalog = model.define('pdf_catalog', {
  id: model
    .id({
      prefix: 'pcat',
    })
    .primaryKey(),
  name: model.text(),
  pdf_url: model.text(),
  pdf_file_id: model.text().nullable(),
  pages: model.number().default(0),
  published: model.boolean().default(false),
  metadata: model.json().nullable(),
  hotspots: model.hasMany(() => PdfCatalogHotspot, {
    mappedBy: 'catalog',
  }),
  channels: model.hasMany(() => PdfCatalogChannel, {
    mappedBy: 'catalog',
  }),
});
