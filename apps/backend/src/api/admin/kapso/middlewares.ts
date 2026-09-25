import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { SaveBindingSchema } from './bindings/validators';
import { UpdateFloatingButtonSchema } from './floating-button/validators';
import { UpdateBotChannelsSchema } from './bot-channels/validators';
import { UpdateBotSwitchSchema } from './bot-switch/validators';
import {
  CreateKapsoTemplateSchema,
  UpdateKapsoTemplateSchema,
} from './templates/validators';

export const adminKapsoMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/kapso/templates',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateKapsoTemplateSchema)],
  },
  {
    matcher: '/admin/kapso/templates/:name',
    method: ['PUT'],
    middlewares: [validateAndTransformBody(UpdateKapsoTemplateSchema)],
  },
  {
    matcher: '/admin/kapso/bindings',
    method: ['POST'],
    middlewares: [validateAndTransformBody(SaveBindingSchema)],
  },
  {
    matcher: '/admin/kapso/floating-button',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateFloatingButtonSchema)],
  },
  {
    matcher: '/admin/kapso/bot-channels',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateBotChannelsSchema)],
  },
  {
    matcher: '/admin/kapso/bot-switch',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateBotSwitchSchema)],
  },
];
