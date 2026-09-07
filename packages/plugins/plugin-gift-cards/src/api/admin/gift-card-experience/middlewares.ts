import { type MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { GIFT_CARD_ADMIN_PERMISSIONS, requireGiftCardAdminPermission } from './permissions';
import { GiftCardDeliveryUpdate, GiftCardDesignInput, GiftCardDesignUpdate, GiftCardSettingsUpdate } from './validators';

export const adminGiftCardExperienceMiddlewares: MiddlewareRoute[] = [
  { matcher: '/admin/gift-card-experience/designs', method: ['GET'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.read)] },
  { matcher: '/admin/gift-card-experience/designs', method: ['POST'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.designs), validateAndTransformBody(GiftCardDesignInput)] },
  { matcher: '/admin/gift-card-experience/designs/:id', method: ['POST'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.designs), validateAndTransformBody(GiftCardDesignUpdate)] },
  { matcher: '/admin/gift-card-experience/designs/:id', method: ['DELETE'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.designs)] },
  { matcher: '/admin/gift-card-experience/deliveries', method: ['GET'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.read)] },
  { matcher: '/admin/gift-card-experience/deliveries/:id', method: ['GET'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.read)] },
  { matcher: '/admin/gift-card-experience/deliveries/:id', method: ['POST'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.deliveries), validateAndTransformBody(GiftCardDeliveryUpdate)] },
  { matcher: '/admin/gift-card-experience/deliveries/:id/retry', method: ['POST'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.deliveries)] },
  { matcher: '/admin/gift-card-experience/deliveries/:id/cancel', method: ['POST'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.deliveries)] },
  { matcher: '/admin/gift-card-experience/deliveries/:id/secure-link', method: ['POST'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.deliveries)] },
  { matcher: '/admin/gift-card-experience/settings', method: ['GET'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.settings)] },
  { matcher: '/admin/gift-card-experience/settings', method: ['POST'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.settings), validateAndTransformBody(GiftCardSettingsUpdate)] },
  { matcher: '/admin/gift-card-experience/analytics', method: ['GET'], middlewares: [requireGiftCardAdminPermission(GIFT_CARD_ADMIN_PERMISSIONS.metrics)] },
];
