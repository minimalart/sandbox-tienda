import type { PriceListTarget } from './plan-price-updates';

/**
 * ¿Hay una price list que le está tapando al ERP el precio que escribe?
 *
 * Decisión PURA. Existe por un caso REAL y caro: en desdeelsur, entre el
 * 2026-08-14 y el 2026-09-09, el comprador NO pagó el precio del ERP. Medido
 * con la Store API sobre el SKU OMC47: precio base $18.358,97 (lo escribía el
 * catalog sync desde la lista 1 de Zeus, cada 15 minutos, correctamente) y
 * `calculated_price` $12.851,28, con `is_calculated_price_price_list: true`
 * apuntando a una price list llamada "Ecommerce". El ratio, 0,6999, es
 * exactamente el `precio4/precio1 = 0.70` de Zeus: alguien había cargado 2595
 * precios de la lista MAYORISTA a mano, y ahí quedaron congelados.
 *
 * El mecanismo es del core de Medusa, no un bug nuestro: una price list
 * `override` `active` **sin reglas** aplica a TODOS los clientes y gana sobre el
 * precio base. El problema es que el ERP no tenía forma de enterarse. El
 * sync-log decía `updated`, `price_unchanged`, cero fallas — todo verde — y el
 * storefront mostraba precios de hace un mes. El mismo agujero que ya conocemos
 * de `store-config`: el panel dice una cosa y el público otra.
 *
 * De ahí las tres condiciones. Una price list tapa al ERP cuando:
 * 1. está `active` (una `draft` no aplica a nadie),
 * 2. es `override` (una `sale` es un descuento sobre el precio base, que es
 *    justamente lo que el cliente QUIERE poder hacer desde la web), y
 * 3. **no tiene reglas** (con `customer.groups.id` aplica sólo a ese grupo: es
 *    una lista mayorista sana, no un techo para todo el catálogo).
 *
 * Y se excluyen las que el propio ERP administra: esas son el resultado de
 * `catalog_sync.price_lists`, y avisar de ellas sería avisar del trabajo propio.
 */

export type PriceListSnapshot = {
  id: string;
  title: string | null;
  /** `draft` | `active`. */
  status: string | null;
  /** `override` | `sale`. */
  type: string | null;
  /** Reglas de la lista; vacío/ausente = aplica a todos. */
  rules?: Record<string, unknown> | null;
};

export type OverridingPriceList = {
  id: string;
  title: string;
};

/**
 * Las price lists que pisan el precio base del ERP para TODOS los clientes.
 *
 * `managedIds` son las que el sync administra (los `price_list_id` resueltos de
 * `catalog_sync.price_lists`): quedan afuera.
 */
export function detectOverridingPriceLists(input: {
  priceLists: PriceListSnapshot[];
  managedTargets: PriceListTarget[];
}): OverridingPriceList[] {
  const managed = new Set(input.managedTargets.map((target) => target.price_list_id));
  const out: OverridingPriceList[] = [];

  for (const list of input.priceLists) {
    if (managed.has(list.id)) continue;
    if (list.status !== 'active') continue;
    if (list.type !== 'override') continue;
    if (hasRules(list.rules)) continue;
    out.push({ id: list.id, title: list.title?.trim() || list.id });
  }

  return out;
}

/** `null`, `undefined` y `{}` son "sin reglas" = aplica a todos. */
function hasRules(rules: Record<string, unknown> | null | undefined): boolean {
  if (!rules) return false;
  return Object.keys(rules).length > 0;
}

/**
 * El warning para el summary del log. Se nombra la lista y se dice qué hacer,
 * porque "hay una price list que interfiere" no le alcanza a nadie para actuar.
 */
export function overridingPriceListWarning(lists: OverridingPriceList[]): string | null {
  if (!lists.length) return null;
  const names = lists.map((list) => `"${list.title}"`).join(', ');
  return (
    `El precio que ve el comprador NO es el que escribe el ERP: ${names} ` +
    `${lists.length === 1 ? 'es una price list' : 'son price lists'} override activa(s) sin reglas, ` +
    'así que pisa(n) el precio base para todos los clientes. El ERP no la(s) administra: sus precios ' +
    'quedan congelados en el valor con el que se cargaron. Pasala(s) a draft, asignale(s) un customer ' +
    'group, o mapeala(s) desde la configuración del catálogo para que el sync las mantenga.'
  );
}

/**
 * Aviso de que una lista mapeada quedó en `draft` y por lo tanto no aplica.
 *
 * `resolvePriceLists` ya crea en draft cuando falta el customer group y deja un
 * warning, pero sólo en la corrida que la CREA. A partir de la segunda el
 * summary la lista como cualquier otra, con su `price_list_id`, y se lee como
 * que está funcionando. En desdeelsur "LISTA WEB" pasó un mes así.
 */
export function draftPriceListWarning(
  targets: PriceListTarget[],
  statusById: Map<string, string | null>
): string | null {
  const drafts = targets.filter((target) => statusById.get(target.price_list_id) === 'draft');
  if (!drafts.length) return null;
  const names = drafts.map((target) => `"${target.title}" (lista ${target.zeus_index})`).join(', ');
  return (
    `${names} ${drafts.length === 1 ? 'está' : 'están'} en estado draft, así que ` +
    `${drafts.length === 1 ? 'no aplica' : 'no aplican'} a ningún cliente aunque el sync le(s) ` +
    'escriba precios. Asignale(s) un customer group y activala(s) desde el admin de Medusa.'
  );
}
