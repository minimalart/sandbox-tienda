import {
  authenticate,
  type MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework/http';
import {
  StoreCreateCommentSchema,
  StoreListCommentsSchema,
  StoreReplyCommentSchema,
  StoreUpdateCommentSchema,
} from './validators';

// GET /store/comments is public (just validates query). Writes require an
// authenticated customer (session or bearer).
export const storeCommentsMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/comments',
    method: ['GET'],
    middlewares: [
      validateAndTransformQuery(StoreListCommentsSchema as any, {
        isList: false,
      }),
    ],
  },
  {
    matcher: '/store/comments/eligibility',
    method: ['GET'],
    middlewares: [
      authenticate('customer', ['session', 'bearer']),
      validateAndTransformQuery(StoreListCommentsSchema as any, {
        isList: false,
      }),
    ],
  },
  {
    matcher: '/store/comments',
    method: ['POST'],
    middlewares: [
      authenticate('customer', ['session', 'bearer']),
      validateAndTransformBody(StoreCreateCommentSchema as any),
    ],
  },
  {
    matcher: '/store/comments/:id',
    method: ['PUT'],
    middlewares: [
      authenticate('customer', ['session', 'bearer']),
      validateAndTransformBody(StoreUpdateCommentSchema as any),
    ],
  },
  {
    matcher: '/store/comments/:id',
    method: ['DELETE'],
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
  {
    matcher: '/store/comments/:id/reply',
    method: ['POST'],
    middlewares: [
      authenticate('customer', ['session', 'bearer']),
      validateAndTransformBody(StoreReplyCommentSchema as any),
    ],
  },
];
