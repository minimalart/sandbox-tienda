import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { CreateAuditSchema } from './audits/route';
import { SimulatorSchema } from './simulator/route';
import { GenerateCorrectionSchema } from './corrections/route';
import { ApplyCorrectionSchema } from './corrections/apply/route';
import { UpdateConfigSchema } from './config/route';

/**
 * Validación de bodies del módulo SEO & GEO. Se agregan en
 * apps/backend/src/api/extension-middlewares.ts (generado por el composer a
 * partir de extension-integrations.js). La autenticación admin la aplica Medusa
 * por el prefijo /admin.
 */
export const adminSeoGeoMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/seo-geo/audits',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreateAuditSchema)],
  },
  {
    matcher: '/admin/seo-geo/simulator',
    method: ['POST'],
    middlewares: [validateAndTransformBody(SimulatorSchema)],
  },
  {
    matcher: '/admin/seo-geo/corrections',
    method: ['POST'],
    middlewares: [validateAndTransformBody(GenerateCorrectionSchema)],
  },
  {
    matcher: '/admin/seo-geo/corrections/apply',
    method: ['POST'],
    middlewares: [validateAndTransformBody(ApplyCorrectionSchema)],
  },
  {
    matcher: '/admin/seo-geo/config',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdateConfigSchema)],
  },
];
