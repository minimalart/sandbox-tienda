import RegionModule from '@medusajs/medusa/region';
import { defineLink } from '@medusajs/framework/utils';
import DemoStoreModule from '../modules/demo-store';

/**
 * DemoStore ↔ Region (1:1). The demo's region drives currency / countries /
 * payment providers; linked so it can be cascade-cleaned with the demo.
 */
export default defineLink(
  DemoStoreModule.linkable.demoStore,
  RegionModule.linkable.region,
  {
    database: {
      table: 'demo_store_region',
      idPrefix: 'demoreg',
    },
  },
);
