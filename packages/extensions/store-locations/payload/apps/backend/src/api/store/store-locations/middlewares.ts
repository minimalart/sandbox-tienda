import { authenticate, type MiddlewareRoute } from '@medusajs/framework/http';
import { shippingCoverageGate } from './shipping-coverage-gate';

// The public list (/store/store-locations) needs no auth.
// The preferred-store routes operate on the authenticated customer.
export const storeStoreLocationsMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/store-locations/preferred',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
  /**
   * Único matcher fuera de /store/store-locations: el gate que saca del checkout
   * el envío de flota propia cuando la dirección cae fuera de los polígonos de
   * cobertura. Vive acá porque la cobertura es política de las SUCURSALES, y es
   * no-op cuando `multi_branch_enabled`/`require_branch_coverage` están apagados.
   * Ver `shipping-coverage-gate.ts`.
   */
  {
    matcher: '/store/shipping-options',
    method: ['GET'],
    middlewares: [shippingCoverageGate],
  },
];
