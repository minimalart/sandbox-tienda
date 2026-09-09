import { normalizeErpGroupingLabel } from './category-name';

/**
 * Normalización del nombre de FAMILIA del ERP.
 *
 * La familia (Zeus `familia`) es una agrupación libre ortogonal a la categoría:
 * una familia cruza varias categorías y viceversa. Vive en
 * `product.metadata.family`, la indexa Typesense como `family.name` y el
 * storefront la publica como el filtro **"familia"** del PLP
 * (`store/templates/store-client-page.tsx`). O sea: es texto que el cliente lee,
 * no un código interno.
 *
 * Hasta DESDEELSUR-48 el sync copiaba `row.family` LITERAL, así que las 36
 * familias de desdeelsur salían en MAYÚSCULAS SOSTENIDAS y sin tildes
 * (`ARTISTICA PINCELES`, `HERRAMIENTAS ELECTRICAS Y EXPLOSION`) — sin casing y
 * sin ortografía, peor que las categorías, que al menos tenían el casing
 * arreglado. Mismo patrón que la descripción antes de DESDEELSUR-34: el
 * normalizador existía para un eje y el de al lado copiaba el crudo.
 *
 * ## Por qué reusa el motor de las categorías y no tiene reglas propias
 *
 * Desde el punto de vista del formato, familia y categoría son lo mismo: una
 * etiqueta que Zeus manda gritada y sin tildes y que el storefront muestra tal
 * cual. Comparten `normalizeErpGroupingLabel` para que agregar una palabra al
 * diccionario corrija las dos superficies a la vez, igual que
 * `product-description.ts` comparte `applyReadingCase` con el título.
 *
 * Lo que NO se comparte son los overrides de nombre completo: `Perfilería: metal
 * y madera` es una decisión editorial sobre el árbol de categorías y no tiene
 * por qué alcanzar a una familia que se llame parecido. Si alguna familia
 * necesita una reescritura así, va en `FAMILY_NAME_OVERRIDES` y no en la de
 * categorías.
 *
 * ## Sobre el crudo
 *
 * `variant.metadata.zeus_familia` sigue guardando el valor TAL CUAL lo manda
 * Zeus, a propósito: es la fuente, el equivalente de `zeus_source_title`. Lo que
 * se normaliza es `product.metadata.family`, que es lo que se indexa y se
 * muestra. Así el barrido siempre puede recalcular desde el crudo.
 */

/**
 * Familias que necesitan MÁS que ortografía y casing. Vacío por ahora: de las 36
 * familias reales de desdeelsur ninguna lo pidió, y `FAMILIAS ACCESORIOS VARIAS`
 * —la única que suena a nombre de sistema— no se toca porque nadie lo pidió.
 *
 * Clave = nombre COMPLETO del ERP plegado; valor = el nombre final.
 */
export const FAMILY_NAME_OVERRIDES: Record<string, string> = {};

const collapse = (input: string): string => input.trim().replace(/\s+/g, ' ');

function fold(input: string): string {
  return collapse(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Nombre de familia listo para mostrar, o `null` si el ERP no mandó nada.
 *
 * Devuelve `null` —y no `''`— para que `erpProductMetadata` pueda seguir usando
 * el mismo guard de siempre y NUNCA escriba una familia vacía encima de una que
 * ya estaba: el sync no borra un valor existente porque el ERP vino pelado.
 */
export function normalizeFamilyName(raw: string | null | undefined): string | null {
  const name = collapse(raw ?? '');
  if (!name) return null;

  const override = FAMILY_NAME_OVERRIDES[fold(name)];
  if (override) return override;

  return normalizeErpGroupingLabel(name) || null;
}
