import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework/http';
import {
  AdminVimeoOAuthStartQuery,
  AdminVimeoOAuthCallbackQuery,
  AdminVimeoUploadBody,
  AdminVimeoSearchQuery,
} from './validators';

export const adminVimeoMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/vimeo/oauth/start',
    method: ['GET'],
    middlewares: [
      validateAndTransformQuery(AdminVimeoOAuthStartQuery as any, {
        isList: false,
      }),
    ],
  },
  {
    matcher: '/admin/vimeo/oauth/callback',
    method: ['GET'],
    middlewares: [
      validateAndTransformQuery(AdminVimeoOAuthCallbackQuery as any, {
        isList: false,
      }),
    ],
  },
  {
    matcher: '/admin/vimeo/upload',
    method: ['POST'],
    middlewares: [validateAndTransformBody(AdminVimeoUploadBody as any)],
  },
  {
    matcher: '/admin/vimeo/videos',
    method: ['GET'],
    middlewares: [
      validateAndTransformQuery(AdminVimeoSearchQuery as any, {
        isList: false,
      }),
    ],
  },
];
