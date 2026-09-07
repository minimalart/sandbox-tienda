import { defineLink } from '@medusajs/framework/utils';
import DeliveryModule from '../modules/delivery';
import StoreLocationModule from '../modules/store-location';

/**
 * DeliveryZone ↔ StoreLocation (sucursal / branch).
 *
 * Relación N:1: una sucursal tiene muchas zonas logísticas; cada zona pertenece
 * a una sola sucursal. La zona también denormaliza `store_location_id` como
 * columna (modelo delivery-zone.ts) para filtrar sin graph; el link es la fuente
 * de verdad de la relación y habilita el traversal:
 *  - `store_location.delivery_zones` → zonas de la sucursal.
 *  - `delivery_zone.store_location` → la sucursal dueña.
 *
 * La GEOMETRÍA de la zona NO vive acá: la zona referencia un BranchCoverage de
 * store-location vía `branch_coverage_id` y la resolución punto→zona REUSA el
 * PolygonEngine / resolveByPoint de store-location.
 */
export default defineLink(
  {
    linkable: DeliveryModule.linkable.deliveryZone,
    isList: false,
  },
  {
    linkable: StoreLocationModule.linkable.storeLocation,
    isList: true,
  },
  {
    database: {
      table: 'delivery_zone_store_location',
      idPrefix: 'dzonesl',
    },
  },
);
