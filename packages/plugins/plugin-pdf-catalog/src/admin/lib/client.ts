import Medusa from '@medusajs/js-sdk';

/**
 * SDK del backoffice para el plugin.
 *
 * El plugin no tiene acceso al `siteHeader()` del host, así que se instancia
 * un cliente propio con la misma configuración base (session auth, base `/`).
 * Los admin routes del propio módulo son same-origin y no necesitan headers de
 * tienda: los guards multi-tenant viven en el backend (ver `siteFromRequest`).
 */
export const sdk = new Medusa({
  baseUrl: '/',
  auth: {
    type: 'session',
  },
});
