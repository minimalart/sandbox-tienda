import { defineLink } from '@medusajs/framework/utils';
import BundleModule from '../modules/bundle';
import DemoStoreModule from '../modules/demo-store';

/**
 * Bundle ↔ DemoStore (many-to-many).
 *
 * A Bundle can be published in one or many Stores; each Store lists many
 * Bundles. Reuses the existing DemoStore entity — Brick's multi-store
 * abstraction — instead of introducing a second store model (PRD §6).
 *
 * Query traversal:
 *  - `bundle.demo_stores` → the Stores a Bundle is available in (admin: which
 *    stores does this bundle target; publish validation).
 *  - `demo_store.bundles` → the Bundles a Store publishes (storefront listing).
 *
 * When the `demo_store` module is not registered in a given project, this
 * link is not resolved and every Bundle is treated as global (single-tenant
 * fallback documented in docs/bundled-products/plan.md §5.2).
 */
export default defineLink(
  {
    linkable: BundleModule.linkable.bundle,
    isList: true,
  },
  {
    linkable: DemoStoreModule.linkable.demoStore,
    isList: true,
  },
  {
    database: {
      table: 'bundle_demo_store',
      idPrefix: 'bndlds',
    },
  },
);
