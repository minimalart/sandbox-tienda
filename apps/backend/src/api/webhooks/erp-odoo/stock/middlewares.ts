import type { MiddlewareRoute } from '@medusajs/framework/http';

/**
 * Body JSON del webhook de stock de Odoo. Pequeño (<1KB por evento). No
 * preservamos el body crudo porque Odoo no firma la request — la protección es
 * por token compartido en el header, no por HMAC. Ese diseño es a propósito:
 * los server actions de tipo `code` de Odoo no tienen soporte nativo para
 * HMAC, y armar la firma desde Python quedaría enredado. Con token compartido
 * el flujo es simétrico y trivial de rotar.
 */
export const erpOdooStockWebhookMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/webhooks/erp-odoo/stock',
    method: ['POST'],
    bodyParser: { preserveRawBody: false, sizeLimit: '32kb' },
    middlewares: [],
  },
];
