import type { SiteScopeDescriptor } from '../../lib/multistore/scope';
import { STORE_LOCATION_SITE_SCOPE } from '../store-location/site-scope';

/**
 * `delivery` no necesitó ninguna columna nueva.
 *
 * Todo lo que gestiona —zonas, choferes, vehículos, rutas, ejecuciones— ya apunta a
 * una `store_location`, y la sucursal ya sabe a qué tiendas atiende. La tienda se
 * hereda por esa FK en vez de duplicarse: una flota se reasigna de sucursal seguido,
 * y con `site_id` propio cada reasignación tendría que acordarse de actualizar dos
 * columnas en vez de una.
 *
 * `empty: 'all'` en casi todo es deliberado. Una fila sin sucursal es infraestructura
 * compartida —el CD nacional, un chofer que todavía no se asignó—, y esconderla del
 * operador que está mirando su tienda le haría creer que no existe.
 */
const viaLocation = (table: string, fk = 'store_location_id'): SiteScopeDescriptor => ({
  kind: 'via_parent',
  table,
  fk,
  parent: STORE_LOCATION_SITE_SCOPE,
  empty: 'all',
});

export const DELIVERY_ZONE_SITE_SCOPE = viaLocation('delivery_zone');
export const DELIVERY_EXECUTION_SITE_SCOPE = viaLocation('delivery_execution');
export const DELIVERY_ROUTE_SITE_SCOPE = viaLocation('delivery_route');
export const DRIVER_SITE_SCOPE = viaLocation('driver');

/** Un vehículo puede estar asignado a varias sucursales: la FK es un array. */
export const VEHICLE_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'via_parent',
  table: 'vehicle',
  fk: 'store_location_ids',
  fkIsArray: true,
  parent: STORE_LOCATION_SITE_SCOPE,
  empty: 'all',
};

/**
 * Las reglas cuelgan de la zona, y `delivery_zone_id NULL` es una regla GLOBAL —
 * aplica a todas las zonas, así que se ve desde todas las tiendas. Es exactamente
 * el caso que `empty: 'global'` nombra: al listar se comporta como `'all'`, pero si
 * alguien la usa para resolver un valor efectivo tiene que ir por precedencia.
 */
export const DELIVERY_RULE_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'via_parent',
  table: 'delivery_rule',
  fk: 'delivery_zone_id',
  parent: DELIVERY_ZONE_SITE_SCOPE,
  empty: 'global',
};

/** Las paradas cuelgan de su ruta; sin ruta no existen. */
export const ROUTE_STOP_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'via_parent',
  table: 'delivery_route_stop',
  fk: 'route_id',
  parent: DELIVERY_ROUTE_SITE_SCOPE,
  empty: 'unassigned',
};

/** Eventos y pruebas cuelgan de la ejecución que los generó. */
const viaExecution = (table: string): SiteScopeDescriptor => ({
  kind: 'via_parent',
  table,
  fk: 'delivery_execution_id',
  parent: DELIVERY_EXECUTION_SITE_SCOPE,
  empty: 'unassigned',
});

export const TRACKING_EVENT_SITE_SCOPE = viaExecution('tracking_event');
export const PROOF_OF_DELIVERY_SITE_SCOPE = viaExecution('proof_of_delivery');

/** Los turnos cuelgan del chofer. */
export const DRIVER_SHIFT_SITE_SCOPE: SiteScopeDescriptor = {
  kind: 'via_parent',
  table: 'driver_shift',
  fk: 'driver_id',
  parent: DRIVER_SITE_SCOPE,
  empty: 'unassigned',
};
