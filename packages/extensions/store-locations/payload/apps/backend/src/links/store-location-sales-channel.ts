import SalesChannelModule from '@medusajs/medusa/sales-channel';
import { defineLink } from '@medusajs/framework/utils';
import StoreLocationModule from '../modules/store-location';

/**
 * Branch ↔ SalesChannel.
 *
 * A branch (StoreLocation) owns many sales channels (B2C, B2B, App, …); each
 * sales channel belongs to at most one branch. Mirrors the product↔brand link
 * shape: the "many" side (salesChannel) carries `isList: true`.
 *
 * Query traversal:
 *  - `store_location.sales_channels` → list of linked channels.
 *  - `sales_channel.store_location` → the owning branch (used to resolve the
 *    branch from a cart's sales_channel_id, e.g. for MercadoPago credentials).
 */
export default defineLink(
  {
    linkable: SalesChannelModule.linkable.salesChannel,
    isList: true,
  },
  {
    linkable: StoreLocationModule.linkable.storeLocation,
    isList: false,
  },
  {
    database: {
      table: 'store_location_sales_channel',
      idPrefix: 'slocsc',
    },
  },
);
