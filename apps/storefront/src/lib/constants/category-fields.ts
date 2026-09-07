// Profundidad de jerarquía soportada al pedir categorías a Medusa.
// Cubre 4 niveles de árbol desde la raíz y 4 ancestros desde una hoja, lo que
// alcanza para los 3 niveles que usamos hoy y deja preparado un 4to.
//
// Cada nivel adicional debe declararse explícitamente — Medusa expande solo lo
// que pidas en `fields`, no inferir profundidad. Si en algún momento se sube a
// 5 niveles, agregar un eslabón más a las dos cadenas.

const CHILDREN_TREE = [
  "*category_children",
  "*category_children.category_children",
  "*category_children.category_children.category_children",
].join(", ");

const PARENT_CHAIN = [
  "*parent_category",
  "*parent_category.parent_category",
  "*parent_category.parent_category.parent_category",
].join(", ");

// NOTA: NO incluir `*products` acá. El árbol del filtro de la tienda usa solo
// la estructura (parent/children); los conteos salen del facet de Typesense.
// Expandir `*products` por las 437 categorías traía ~10 MB y reventaba /store
// (500). Sin products, las 437 entran en una sola request (~0.5 MB).
export const CATEGORY_TREE_FIELDS = [
  CHILDREN_TREE,
  PARENT_CHAIN,
].join(", ");

export const CATEGORY_DETAIL_FIELDS = [CHILDREN_TREE, "*products"].join(", ");

export const CATEGORY_NAV_FIELDS = [CHILDREN_TREE, PARENT_CHAIN].join(", ");
