import {
  type MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework/http';
import {
  AdminListCommentsSchema,
  AdminUpdateCommentSettingsSchema,
} from './validators';

// /admin/* already gets admin auth from the framework. We only add validation.
export const adminCommentsMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/comments',
    method: ['GET'],
    middlewares: [
      validateAndTransformQuery(AdminListCommentsSchema as any, {
        isList: true,
      }),
    ],
  },
  {
    matcher: '/admin/comments/settings',
    method: ['POST'],
    middlewares: [
      validateAndTransformBody(AdminUpdateCommentSettingsSchema as any),
    ],
  },
];
