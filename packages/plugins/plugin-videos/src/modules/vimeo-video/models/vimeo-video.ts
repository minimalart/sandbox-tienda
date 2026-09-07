import { model } from '@medusajs/framework/utils';
import type { ProductVideoLink } from './product-video-link';

export const VimeoVideo = model.define('vimeo_video', {
  id: model.id().primaryKey(),
  vimeo_id: model.text().unique(),
  vimeo_uri: model.text(),
  title: model.text(),
  description: model.text().nullable(),
  thumbnail_url: model.text().nullable(),
  // Poster elegido a mano desde el admin. Tiene prioridad sobre thumbnail_url
  // (el de Vimeo) y se muestra en el front mientras el video carga.
  poster_url: model.text().nullable(),
  vimeo_url: model.text().nullable(),
  duration: model.number().nullable(),
  status: model
    .enum([
      'uploading',
      'transcoding',
      'processing',
      'available',
      'error',
      'quota_exceeded',
      'total_cap_exceeded',
      'transcode_starting',
      'unavailable',
    ])
    .default('uploading'),
  is_active: model.boolean().default(true),
  // Controla si el video aparece en el carrousel de la home (independiente de
  // is_active, que habilita el video en general, ej. en la ficha de producto).
  show_in_carousel: model.boolean().default(true),
  sort_order: model.number().default(0),
  // Segmentación por sales channel: array de ids. null/[] = visible en todos
  // los canales (global). En contexto demo el storefront pide solo los videos
  // cuyo array incluye el canal de la demo.
  sales_channel_ids: model.json().nullable(),
  metadata: model.json().nullable(),
  product_links: model.hasMany(
    (): typeof ProductVideoLink => {
      return require('./product-video-link').ProductVideoLink;
    },
    {
      mappedBy: 'vimeo_video',
    }
  ),
});
