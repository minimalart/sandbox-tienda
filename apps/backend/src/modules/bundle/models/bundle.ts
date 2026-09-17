import { model } from '@medusajs/framework/utils';
import { BundleItem } from './bundle-item';

/**
 * Bundle — a configurable set of existing Medusa Products that a customer can
 * add to the cart as a unit. Bundle owns only the *composition*: what products
 * form the set and in what quantity. Everything else (options, variants,
 * pricing, cart, order) stays in Medusa.
 *
 * A Bundle can be scoped to one or many Stores via the
 * `bundle_demo_store` link (see `src/links/bundle-demo-store.ts`). When the
 * `demo_store` module is not registered, every Bundle behaves as global and
 * the storefront resolves it against the implicit single tenant.
 *
 * - `status`: 'draft' or 'published'. Only published bundles appear in the
 *   storefront listing. Publish requires composition validation
 *   (see admin publish route in F1).
 * - `handle`: url-friendly slug, unique per instance. Enforced at the API layer.
 */
export const Bundle = model
  .define('bundle', {
    id: model.id({ prefix: 'bndl' }).primaryKey(),
    title: model.text(),
    handle: model.text().unique(),
    description: model.text().nullable(),
    thumbnail: model.text().nullable(),
    status: model.enum(['draft', 'published']).default('draft'),
    metadata: model.json().nullable(),
    items: model.hasMany(() => BundleItem, { mappedBy: 'bundle' }),
  })
  .indexes([
    { on: ['status', 'deleted_at'] },
    { on: ['handle'] },
  ]);
