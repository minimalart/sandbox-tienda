import type { MiddlewareRoute } from '@medusajs/framework/http';

/**
 * Body CRUDO para el webhook de Kapso.
 *
 * Kapso firma el payload con HMAC-SHA256 sobre los BYTES que envió, así que la
 * verificación necesita el body tal cual llegó. Medusa NO lo preserva por
 * defecto: sin este `preserveRawBody`, `req.rawBody` viene `undefined`, la ruta
 * cae a re-serializar `req.body` con `JSON.stringify` —que no coincide byte a
 * byte (orden de claves, escapes, espacios)— y con `KAPSO_WEBHOOK_SECRET`
 * seteado el webhook RECHAZA todo el tráfico entrante en silencio.
 *
 * Mismo patrón que `webhooks/sendgrid-gift-cards/middlewares.ts`.
 */
export const kapsoWebhookMiddlewares: MiddlewareRoute[] = [{
  matcher: '/webhooks/kapso',
  method: ['POST'],
  bodyParser: { preserveRawBody: true, sizeLimit: '1mb' },
  middlewares: [],
}];
