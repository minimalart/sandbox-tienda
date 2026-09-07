import { authenticate, type MiddlewareRoute } from '@medusajs/framework/http';

/**
 * La descarga del comprobante EXIGE cliente autenticado. Sin esto, un id de
 * orden adivinado bajaría la factura de otra persona — con su nombre, su CUIT y
 * lo que compró adentro. La ruta además verifica que la orden sea del customer
 * autenticado; el middleware es la primera de las dos barreras, no la única.
 */
export const storeErpMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/erp/invoices/*',
    middlewares: [authenticate('customer', ['session', 'bearer'])],
  },
];
