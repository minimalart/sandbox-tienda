import { model } from '@medusajs/framework/utils';

export const GiftCardDesign = model
  .define('gift_card_design', {
    id: model.id({ prefix: 'gcdesign' }).primaryKey(),
    public_id: model.text(),
    name: model.text(),
    occasion: model.enum([
      'general',
      'birthday',
      'thanks',
      'congratulations',
      'holidays',
      'brand',
    ]).default('general'),
    desktop_image_url: model.text(),
    mobile_image_url: model.text().nullable(),
    text_color: model.text().default('#FFFFFF'),
    content_position: model.enum([
      'top_left', 'top_center', 'top_right',
      'center_left', 'center', 'center_right',
      'bottom_left', 'bottom_center', 'bottom_right',
    ]).default('center'),
    active: model.boolean().default(true),
    sort_order: model.number().default(0),
    metadata: model.json().nullable(),
    /**
     * La tienda dueña del diseño. `NULL` = diseño GLOBAL, disponible en todas.
     *
     * Es branding: la tarjeta lleva la marca de la tienda que la vende. Un diseño sin
     * tienda es de la instancia —el `brand-default` sembrado— y por eso `empty: 'all'`:
     * esconderlo dejaría a una tienda sin ningún diseño disponible.
     */
    site_id: model.text().nullable(),
  })
  .indexes([
    // DOS parciales: en Postgres `NULL != NULL`.
    { on: ['public_id'], unique: true, where: 'site_id IS NULL AND deleted_at IS NULL' },
    { on: ['site_id', 'public_id'], unique: true, where: 'site_id IS NOT NULL AND deleted_at IS NULL' },
    { on: ['site_id'] },
    { on: ['active', 'sort_order'] },
  ]);
