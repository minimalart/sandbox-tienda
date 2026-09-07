import { model } from '@medusajs/framework/utils';

/**
 * StoreLocation — a physical store / branch ("sucursal") of the merchant.
 *
 * Besides the public-facing store data, a StoreLocation doubles as the
 * operational **Branch**: it owns an inventory location (`stock_location_id`)
 * and is linked to one or more sales channels (see
 * `src/links/store-location-sales-channel.ts`). Coverage polygons and delivery
 * settings hang off it via `coverages` / `delivery` (one-to-many / one-to-one).
 *
 * - `store_type`: 'distribution_center' | 'wholesale' | 'point_of_sale'
 * - `business_hours`: Record<day, { closed: boolean; is24Hours: boolean; slots: { open: string; close: string }[] }>
 * - `images`: string[] of URLs (max 3, validated at the API layer; uploaded to
 *   file storage / S3 from the admin and stored as public URLs)
 * - `delivery_pin`: 6-digit PIN for kit deliveries (random server-side, uniqueness not DB-enforced in V1)
 * - `is_visible`: public visibility on the storefront `/sucursales` map.
 * - `sales_channel_ids`: string[] of sales channel ids that scope that public
 *   visibility. null/[] = visible in every channel. NOT the operational
 *   channel↔branch ownership of `src/links/store-location-sales-channel.ts`.
 * - `active`: operational status (a branch can be hidden but still operate, or
 *   listed but paused). The storefront/checkout resolution requires `active`.
 * - `stock_location_id`: the Medusa inventory location this branch ships from.
 */
export const StoreLocation = model
  .define('store_location', {
    id: model.id({ prefix: 'sloc' }).primaryKey(),
    code: model.text().nullable(),
    store_type: model.text().default('point_of_sale'),
    name: model.text(),
    province: model.text(),
    city: model.text(),
    street: model.text(),
    phone: model.text().nullable(),
    whatsapp: model.text().nullable(),
    email: model.text().nullable(),
    website: model.text().nullable(),
    instagram: model.text().nullable(),
    facebook: model.text().nullable(),
    tiktok: model.text().nullable(),
    linkedin: model.text().nullable(),
    business_hours: model.json().nullable(),
    images: model.json().nullable(),
    is_visible: model.boolean().default(false),
    // Visibilidad por sales channel (NO es la propiedad operativa canal↔sucursal
    // del link store_location_sales_channel): array de ids; null/[] = visible en
    // todos los canales. En demo el storefront pide solo las de su canal.
    sales_channel_ids: model.json().nullable(),
    active: model.boolean().default(true),
    stock_location_id: model.text().nullable(),
    delivers_kits: model.boolean().default(false),
    delivery_pin: model.number().nullable(),
    lat: model.text().nullable(),
    lng: model.text().nullable(),
  })
  .indexes([
    { on: ['is_visible', 'deleted_at'] },
    { on: ['active', 'deleted_at'] },
    { on: ['stock_location_id'] },
  ]);
