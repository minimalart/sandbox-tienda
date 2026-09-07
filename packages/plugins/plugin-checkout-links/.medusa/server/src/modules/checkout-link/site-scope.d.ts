import type { SiteScopeDescriptor } from '../../lib/multistore/scope';
/**
 * `empty: 'all'` — un link sin canal usa el por defecto y se ve desde cualquier tienda.
 *
 * Era una de las tres semánticas que este proyecto había dejado sin decidir. La
 * decisión: mostrar de más es recuperable, esconder no. Un link de checkout sigue
 * FUNCIONANDO por su token aunque el admin no lo liste —es público—, así que
 * esconderlo no lo desactiva: sólo hace que el operador crea que desapareció y arme
 * otro, mientras el viejo sigue vendiendo.
 */
export declare const CHECKOUT_LINK_SITE_SCOPE: SiteScopeDescriptor;
