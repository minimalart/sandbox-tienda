import { type MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import {
  CreateProgramSchema,
  UpdateProgramSchema,
  CreateRuleSchema,
  UpdateRuleSchema,
  CreateRewardSchema,
  UpdateRewardSchema,
  CreateTierSchema,
  UpdateTierSchema,
  CreateCampaignSchema,
  UpdateCampaignSchema,
} from './validators';

export const adminLoyaltyMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/loyalty/programs',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateProgramSchema)],
  },
  {
    matcher: '/admin/loyalty/programs/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateProgramSchema)],
  },
  {
    matcher: '/admin/loyalty/rules',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateRuleSchema)],
  },
  {
    matcher: '/admin/loyalty/rules/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateRuleSchema)],
  },
  {
    matcher: '/admin/loyalty/rewards',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateRewardSchema)],
  },
  {
    matcher: '/admin/loyalty/rewards/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateRewardSchema)],
  },
  {
    matcher: '/admin/loyalty/tiers',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateTierSchema)],
  },
  {
    matcher: '/admin/loyalty/tiers/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateTierSchema)],
  },
  {
    matcher: '/admin/loyalty/campaigns',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateCampaignSchema)],
  },
  {
    matcher: '/admin/loyalty/campaigns/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateCampaignSchema)],
  },
];
