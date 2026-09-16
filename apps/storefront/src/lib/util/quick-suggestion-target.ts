/**
 * A dónde lleva un atajo "Explorar:" del header.
 *
 * ── EL PROBLEMA ──────────────────────────────────────────────────────────────
 *
 * Los atajos se modelaban sólo como `{ label, query }`, o sea búsqueda de texto
 * libre contra Typesense. En una pinturería eso hacía que "Pinturas" devolviera
 * removedores, imprimaciones y bases —cualquier producto cuyo texto mencione la
 * palabra— en vez del rubro (DESDEELSUR-61, BUG-11). El sitio YA navegaba bien por
 * `/store?category=…` desde el menú y las tarjetas del home: el atajo del header era
 * el único que no lo hacía.
 *
 * ── POR QUÉ SE RESUELVE CONTRA EL ÁRBOL Y NO SÓLO POR CONFIG ─────────────────
 *
 * Lo correcto a futuro es que el atajo declare `category` y listo — por eso ése es el
 * camino preferido y el que gana cuando está. Pero los atajos ya cargados en cada
 * sitio dicen `query`, y arreglarlos así pedía agregar el campo al editor del admin,
 * publicarlo y que alguien recargue la data en cada tienda. Mientras tanto el bug
 * sigue vivo en producción.
 *
 * El fallback cierra eso sin data nueva: si el label del atajo NOMBRA una categoría
 * que existe, se usa el href de esa categoría —el mismo que sirve el menú, ya armado
 * y escapado— y si no, se cae a la búsqueda de texto de siempre.
 *
 * ── EL MATCHING ES DELIBERADAMENTE CONSERVADOR ───────────────────────────────
 *
 * Compara sin acentos ni mayúsculas, y prueba el label tal cual y en singular. Nada
 * de coincidencias parciales ni por prefijo: "Pinceles" no debe caer en "Pintura".
 * Un atajo que no matchea NO es un error — se comporta como antes.
 *
 * Con las categorías reales de desdeelsur eso da: "Pinturas" → `Pintura` (singular),
 * "Accesorios" → `Accesorios` (exacto), y "Barnices" no matchea nada porque esa
 * categoría NO EXISTE en el catálogo, así que sigue siendo búsqueda de texto — que es
 * justo lo que corresponde mientras no exista.
 */

export type QuickSuggestion = {
  label: string;
  query?: string;
  category?: string;
};

/** Sólo se leen estos dos campos; el nodo real del menú trae más. */
export type CategoryNode = {
  name: string;
  href: string;
  children?: CategoryNode[];
};

export type QuickSuggestionTarget =
  | { kind: "href"; href: string }
  | { kind: "category"; category: string }
  | { kind: "query"; term: string };

/**
 * Minúsculas y sin diacríticos. `normalize("NFD")` separa la letra del acento y el
 * rango elimina los combining marks — "Artística" y "artistica" tienen que matchear.
 */
const fold = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Variantes a probar de un label: tal cual y en singular.
 *
 * El singular es una regla de dos casos a propósito, no un stemmer: "pinturas" →
 * "pintura" y "aerosoles" → "aerosol". Se descartan los resultados de menos de 3
 * letras para que un label corto no genere una variante que matchee cualquier cosa.
 */
const variantsOf = (label: string): string[] => {
  const base = fold(label);
  const out = [base];
  if (base.endsWith("es")) out.push(base.slice(0, -2));
  if (base.endsWith("s")) out.push(base.slice(0, -1));
  return out.filter((v) => v.length >= 3);
};

/** Recorre el árbol en anchura: una categoría raíz le gana a una subcategoría. */
const flatten = (nodes: CategoryNode[]): CategoryNode[] => {
  const out: CategoryNode[] = [];
  let level = nodes;
  while (level.length) {
    out.push(...level);
    level = level.flatMap((n) => n.children ?? []);
  }
  return out;
};

export function resolveQuickSuggestionTarget(
  suggestion: QuickSuggestion,
  categories: CategoryNode[] = [],
): QuickSuggestionTarget {
  // Config explícita: gana siempre, sin mirar el árbol.
  if (suggestion.category) {
    return { kind: "category", category: suggestion.category };
  }

  const all = flatten(categories);
  for (const variant of variantsOf(suggestion.label)) {
    const hit = all.find((c) => fold(c.name) === variant);
    // El href del nodo ya viene armado y escapado por el menú: se reusa en vez de
    // rearmarlo, así los dos caminos no pueden divergir.
    if (hit?.href) return { kind: "href", href: hit.href };
  }

  return { kind: "query", term: suggestion.query ?? "" };
}
