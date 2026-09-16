import { type MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import {
  DeleteErpTintingFormulasSchema,
  PostErpTintingConfirmBasesSchema,
  PostErpTintingDeleteColorsSchema,
  PostErpTintingDetectBasesSchema,
  PostErpTintingImportSchema,
  PostErpTintingProbeSchema,
  PostErpOrderBillingDepositoSchema,
  PostErpOutboxResyncSchema,
  PostErpTintingSyncProductsSchema,
  UpsertErpConfigSchema,
  ValidateConnectionSchema,
} from './validators';
import { erpFulfillmentGate } from './fulfillment-gate';

/**
 * Todos los POST de /admin/erp pasan por zod. Los de tintometría escriben data
 * maestra a partir de una planilla pegada a mano, así que validar el shape antes
 * de tocar la base no es opcional.
 */
export const adminErpMiddlewares: MiddlewareRoute[] = [
  /**
   * Único matcher fuera de /admin/erp: el gate que impide despachar (y por lo
   * tanto facturar) desde un depósito que no es el facturador, o con un
   * fulfillment parcial. Vive acá porque es política del ERP, y es no-op cuando
   * el ERP no factura por fulfillment. Ver `fulfillment-gate.ts`.
   */
  {
    matcher: '/admin/orders/:id/fulfillments',
    method: ['POST'],
    middlewares: [erpFulfillmentGate],
  },
  {
    matcher: '/admin/erp/config',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpsertErpConfigSchema)],
  },
  {
    matcher: '/admin/erp/orders/:id/billing-deposito',
    method: ['POST'],
    middlewares: [validateAndTransformBody(PostErpOrderBillingDepositoSchema)],
  },
  {
    matcher: '/admin/erp/validate-connection',
    method: ['POST'],
    middlewares: [validateAndTransformBody(ValidateConnectionSchema)],
  },
  {
    matcher: '/admin/erp/outbox-events/resync',
    method: ['POST'],
    middlewares: [validateAndTransformBody(PostErpOutboxResyncSchema)],
  },
  {
    matcher: '/admin/erp/tinting/import',
    method: ['POST'],
    middlewares: [validateAndTransformBody(PostErpTintingImportSchema)],
  },
  {
    matcher: '/admin/erp/tinting/bases/detect',
    method: ['POST'],
    middlewares: [validateAndTransformBody(PostErpTintingDetectBasesSchema)],
  },
  {
    matcher: '/admin/erp/tinting/bases/confirm',
    method: ['POST'],
    middlewares: [validateAndTransformBody(PostErpTintingConfirmBasesSchema)],
  },
  {
    matcher: '/admin/erp/tinting/bases/sync-products',
    method: ['POST'],
    middlewares: [validateAndTransformBody(PostErpTintingSyncProductsSchema)],
  },
  {
    matcher: '/admin/erp/tinting/colors',
    method: ['DELETE'],
    middlewares: [validateAndTransformBody(PostErpTintingDeleteColorsSchema)],
  },
  {
    matcher: '/admin/erp/tinting/formulas',
    method: ['DELETE'],
    middlewares: [validateAndTransformBody(DeleteErpTintingFormulasSchema)],
  },
  {
    matcher: '/admin/erp/tinting/price-probe',
    method: ['POST'],
    middlewares: [validateAndTransformBody(PostErpTintingProbeSchema)],
  },
];
