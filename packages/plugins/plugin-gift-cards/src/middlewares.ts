import type { MiddlewareRoute } from '@medusajs/framework/http';
import { adminGiftCardExperienceMiddlewares } from './api/admin/gift-card-experience/middlewares';
import { storeGiftCardExperienceMiddlewares } from './api/store/gift-card-experience/middlewares';
import { sendGridGiftCardWebhookMiddlewares } from './api/webhooks/sendgrid-gift-cards/middlewares';

export {
  adminGiftCardExperienceMiddlewares,
  storeGiftCardExperienceMiddlewares,
  sendGridGiftCardWebhookMiddlewares,
};

export const giftCardsMiddlewares: MiddlewareRoute[] = [
  ...adminGiftCardExperienceMiddlewares,
  ...storeGiftCardExperienceMiddlewares,
  ...sendGridGiftCardWebhookMiddlewares,
];
