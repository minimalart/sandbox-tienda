import { MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { UpdatePdfCatalogSchema } from './[id]/route';
import { CreatePdfCatalogSchema } from './route';

export const adminPdfCatalogsMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/pdf-catalogs',
    method: ['POST'],
    middlewares: [validateAndTransformBody(CreatePdfCatalogSchema)],
  },
  {
    matcher: '/admin/pdf-catalogs/:id',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpdatePdfCatalogSchema)],
  },
];
