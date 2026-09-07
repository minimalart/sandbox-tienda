import SalesChannelModule from '@medusajs/medusa/sales-channel';
import { defineLink } from '@medusajs/framework/utils';
import DemoStoreModule from '../modules/demo-store';

/**
 * DemoStore ↔ SalesChannel (1:1).
 *
 * Each demo owns exactly one sales channel (its catalog scope). The link lets
 * us cascade-delete the demo's channel when the demo is removed and traverse
 * `demo_store.sales_channel` from queries.
 */
export default defineLink(
  DemoStoreModule.linkable.demoStore,
  SalesChannelModule.linkable.salesChannel,
  {
    database: {
      table: 'demo_store_sales_channel',
      idPrefix: 'demosc',
    },
  },
);
