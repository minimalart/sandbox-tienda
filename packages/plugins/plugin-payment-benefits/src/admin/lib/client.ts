import Medusa from '@medusajs/js-sdk';

/**
 * SDK del backoffice local del plugin payment-benefits. No propaga headers de
 * site scope — usa la sesión estándar del admin. Si el host tiene su propio
 * cliente con site-scope (multistore), corre en paralelo; cada widget usa el
 * suyo.
 *
 * TODO: Fase B — si el host expone un cliente site-scoped via
 * `@minimalart/mercatto-plugin-runtime`, cambiar acá y en los hooks.
 */
export const sdk = new Medusa({
  baseUrl: '/',
  auth: {
    type: 'session',
  },
});
