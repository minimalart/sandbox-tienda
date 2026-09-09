/**
 * El LUGAR FLEXIBLE de la barra inferior mobile: qué puede ir en el cuarto
 * ítem, entre el carrito y el menú.
 *
 * Los otros cuatro son fijos y no se configuran — home (el isotipo), Tienda, el
 * carrito (el FAB del centro) y el menú — porque son los que hacen que la barra
 * sea navegable. El cuarto era `Promos` hardcodeado, y ahí estaba el problema:
 * `Promos` se apaga solo cuando el canal no tiene promociones activas (ofrecer
 * una PLP filtrada que sale vacía es peor que no ofrecerla), la barra caía a 4
 * columnas y el carrito quedaba fuera del centro.
 *
 * Ahora la tienda define una LISTA ORDENADA de candidatos y la barra toma el
 * primero DISPONIBLE. Disponible no es lo mismo que configurado: cada candidato
 * tiene su propio gate (promociones activas, tintometría con carta cargada, el
 * switch de visibilidad de la sección), así que el orden es una preferencia y no
 * una garantía. Con el default de abajo, una tienda sin promos cae a `colores`
 * o, si no tiene tintometría, a `sucursales` — y sigue mostrando 5 íconos.
 *
 * El registro con el label, el href y el ícono de cada candidato vive en
 * `index.tsx`, junto a los ítems fijos.
 */
import type { MobileNavSlotId } from "@lib/site-config/types";

/**
 * Orden por defecto cuando la tienda no configuró `assets.mobileNav`.
 *
 * `promos` va primero para no cambiarle la barra a ninguna tienda existente: con
 * promociones activas se sigue viendo exactamente lo de antes.
 */
export const DEFAULT_MOBILE_NAV_ORDER: MobileNavSlotId[] = [
  "promos",
  "colores",
  "sucursales",
  "blog",
  "contacto",
];

const ALL_SLOT_IDS = new Set<string>(DEFAULT_MOBILE_NAV_ORDER);

/**
 * Normaliza la lista configurada: descarta ids desconocidos y repetidos, y
 * COMPLETA con el default lo que la tienda no listó.
 *
 * El completado es deliberado: una lista parcial (`['blog']`) es "prefiero el
 * blog", no "si el blog no está, dejá la barra en 4". Sin esto, guardar una
 * lista corta reintroduce el desbalanceo que este archivo existe para arreglar.
 */
export function resolveMobileNavOrder(
  configured: readonly string[] | undefined,
): MobileNavSlotId[] {
  const seen = new Set<string>();
  const out: MobileNavSlotId[] = [];
  for (const id of configured ?? []) {
    if (!ALL_SLOT_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id as MobileNavSlotId);
  }
  for (const id of DEFAULT_MOBILE_NAV_ORDER) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Primer candidato disponible del orden dado, o `null` si ninguno aplica (una
 * tienda sin promos, sin tintometría y con blog/contacto/sucursales apagados).
 * En ese caso la barra vuelve a 4 columnas, que es lo mejor que se puede hacer:
 * inventar un ítem sería peor.
 */
export function pickMobileNavSlot(
  order: readonly MobileNavSlotId[],
  isAvailable: (id: MobileNavSlotId) => boolean,
): MobileNavSlotId | null {
  for (const id of order) {
    if (isAvailable(id)) return id;
  }
  return null;
}
