// Presentación de nombres de categorías/valores de filtro. Módulo puro (sin
// React ni acceso a datos) para que lo compartan la barra de filtros de la
// tienda (cliente) y el menú "Categorías" del nav (servidor): antes vivía sólo
// en store-client-page y el menú mostraba los nombres crudos del ERP.

/** Alias sólo de presentación. Los valores de Medusa/Typesense/URL no se tocan. */
const CATEGORY_DISPLAY_OVERRIDES: Record<string, string> = {
  telas: "Textiles",
};

/**
 * Los catálogos que vienen de un ERP traen todo en MAYÚSCULAS ("PINTURA HOGAR Y
 * OBRA", "PERFILERIA METAL - MADERA"), que se lee como un grito. Se pasa a
 * mayúscula inicial SOLO para mostrar: el valor que va a la URL y al filtro de
 * Typesense queda intacto (si no, no matchearía nada).
 *
 * Un texto que ya trae minúsculas se deja como está: es un nombre curado a mano
 * ("Óleos Müller") y bajarlo a sentence case lo empeoraría. Las palabras con
 * dígitos se preservan tal cual para no arruinar marcas como 3M o WD-40.
 */
export const toDisplayCase = (text: string): string => {
  if (/[a-záéíóúñü]/.test(text)) return text;
  return text
    .toLocaleLowerCase("es-AR")
    .split(" ")
    .map((word, index) => {
      const original = text.split(" ")[index];
      if (original && /\d/.test(original)) return original;
      if (index > 0) return word;
      return word.charAt(0).toLocaleUpperCase("es-AR") + word.slice(1);
    })
    .join(" ");
};

/** Nombre a mostrar de una categoría: alias si hay, si no `toDisplayCase`. */
export const getCategoryDisplayName = (name: string): string =>
  CATEGORY_DISPLAY_OVERRIDES[name.toLowerCase()] ?? toDisplayCase(name);
