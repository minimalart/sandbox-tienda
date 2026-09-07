import StockLocationModule from '@medusajs/medusa/stock-location';
import { defineLink } from '@medusajs/framework/utils';
import DemoStoreModule from '../modules/demo-store';

/**
 * DemoStore ↔ StockLocation (1:1). The demo's warehouse; linked so it can be
 * cascade-cleaned with the demo.
 */
export default defineLink(
  DemoStoreModule.linkable.demoStore,
  StockLocationModule.linkable.stockLocation,
  {
    database: {
      table: 'demo_store_stock_location',
      idPrefix: 'demosl',
    },
  },
);
