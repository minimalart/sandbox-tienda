import { model } from '@medusajs/framework/utils';

/**
 * Caja (bulto) disponible para el armado de envíos Andreani.
 *
 * Single-tenant: las cajas son globales (no se filtran por credential_id como
 * en la versión multi-tenant). El box-packer elige entre las cajas activas.
 */
export const AndreaniBox = model.define('andreani_box', {
  id: model.id().primaryKey(),
  name: model.text(),
  height: model.number(),
  width: model.number(),
  deep: model.number(),
  max_capacity: model.number().default(0),
  is_active: model.boolean().default(true),
});

export default AndreaniBox;
