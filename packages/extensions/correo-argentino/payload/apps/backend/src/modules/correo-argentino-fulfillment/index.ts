/**
 * Registro del ModuleProvider de Correo Argentino.
 *
 * Se engancha en el array `providers` del módulo FULFILLMENT en
 * medusa-config.ts con `id: 'correo_argentino'`. Como el `identifier` del
 * service también es `correo_argentino`, la clave de contenedor queda
 * `fp_correo_argentino_correo_argentino`.
 */

import { ModuleProvider, Modules } from '@medusajs/framework/utils';
import CorreoArgentinoFulfillmentProviderService from './service';

export const CORREO_FULFILLMENT_PROVIDER_ID = 'correo_argentino';

/** Clave de contenedor: `fp_{identifier}_{id}`, los dos `correo_argentino`. */
export const CORREO_FULFILLMENT_REGISTRATION_KEY =
  'fp_correo_argentino_correo_argentino';

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [CorreoArgentinoFulfillmentProviderService],
});
