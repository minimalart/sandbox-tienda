// Constantes y función de selección de facetas para búsquedas Typesense.
// Sin importaciones externas.

/**
 * Tope de valores por faceta que se le pide a Typesense.
 *
 * Historia: era 50 y truncaba marcas EN SILENCIO (el catálogo del ERP tiene 125
 * y el filtro mostraba menos de la mitad); se subió a 250. Con `categories.id`
 * el techo volvió a quedar corto: la tienda principal tiene 349 categorías, así
 * que la faceta llegaba justa al tope y el guard del nav — que ante un facet
 * truncado prefiere NO podar antes que esconder categorías reales — dejaba el
 * menú sin podar, mostrando el árbol global entero.
 *
 * Vive acá y lo consumen tanto el request (`search-core`) como el guard
 * (`nav-categories`): si se separan, el guard vuelve a apagar la poda en
 * silencio. Sólo crecen las facetas de categorías; marcas y tags están muy por
 * debajo, así que el costo de payload es marginal.
 */
export const MAX_FACET_VALUES = 1000;

// Facetas que el schema base de Medusa SIEMPRE indexa. Seguras de pedir en
// cualquier colección del storefront.
export const CORE_FACET_FIELDS = [
  "brand.name",
  "categories.name",
  "collection.title",
  "tags.value",
];

// `promotions.campaign.name` lo define el product-mapper para TODOS los productos
// (objeto promotions, vacío o no), así que el facet field existe en el schema aun
// cuando no hay promociones indexadas — verificado empíricamente: la faceta
// responde con total_values:0, NO con un 404 "facet field not found". Por eso se
// pide por defecto junto con las CORE. Si una colección de otro tenant no lo
// define, search-core reintenta con CORE solamente (fallback ante 404).
// `family.name` (familia del ERP) y `price` se piden por defecto porque el
// storefront NO introspecciona el schema (usa search-only key): una faceta que
// no esté acá no se pide nunca. `price` no se facetea para listar valores sino
// para que Typesense devuelva `facet_counts[].stats` (min/max) y el slider de
// precio arranque en los extremos reales del catálogo. Una colección vieja sin
// estos campos responde 404 y search-core reintenta con CORE solamente.
// `categories.id` va acá y no en CORE por el fallback de search-core: si una
// colección vieja no lo tuviera faceteable, el reintento con CORE tiene que
// seguir trayendo `categories.name`. Es la clave correcta para decidir qué
// categorías tienen productos en el canal — las `product_category` de Medusa
// son GLOBALES (no están scopeadas por sales channel) y dos tiendas distintas
// pueden tener categorías homónimas, así que contar por nombre mezcla ramas de
// otro catálogo. Los consumidores caen a `categories.name` si este facet falta.
// Los `advisor_*` van por defecto por la misma razón que
// `promotions.campaign.name`: `schema.ts` los declara para TODA colección, así
// que la faceta existe aunque el catálogo no tenga valores (responde
// total_values:0, no 404). Son los atributos del asesor guiado, y pedirlos acá
// es lo que hace que el PLP pueda filtrar por superficie, tipo, ambiente, uso
// especial y base — los MISMOS valores que usa el bot de WhatsApp.
export const DEFAULT_FACET_FIELDS = [
  ...CORE_FACET_FIELDS,
  "categories.id",
  "promotions.campaign.name",
  "family.name",
  "price",
  "advisor_surface",
  "advisor_product_type",
  "advisor_environment",
  "advisor_special_use",
  "advisor_base",
];

// Facetas de verticales específicas (perfumería) que NO existen en la mayoría de
// las colecciones. No se piden por defecto para no romper la búsqueda con un 404;
// solo se incluyen cuando un schema conocido confirma su presencia.
export const OPTIONAL_FACET_FIELDS = [
  "olfactory_family.name",
  "usage_suggestion.name",
];

const ALL_FACET_FIELDS = [...DEFAULT_FACET_FIELDS, ...OPTIONAL_FACET_FIELDS];

export function getAvailableFacetFields(schemaFields: Set<string>): string[] {
  // Sin schema conocido (modo solo-search, sin introspección), se piden las
  // facetas por defecto (CORE + promociones). Las verticales opcionales se
  // omiten salvo que un schema explícito las confirme.
  if (schemaFields.size === 0) {
    return DEFAULT_FACET_FIELDS;
  }
  return ALL_FACET_FIELDS.filter((f) => schemaFields.has(f));
}
