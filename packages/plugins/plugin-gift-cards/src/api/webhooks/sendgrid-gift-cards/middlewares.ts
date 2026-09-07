import type { MiddlewareRoute } from '@medusajs/framework/http';

export const sendGridGiftCardWebhookMiddlewares: MiddlewareRoute[] = [{
  matcher: '/webhooks/sendgrid-gift-cards',
  method: ['POST'],
  bodyParser: { preserveRawBody: true, sizeLimit: '1mb' },
  middlewares: [],
}];
