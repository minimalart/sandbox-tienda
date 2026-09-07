// Tipos exportados del módulo Typesense. Sin lógica ni importaciones externas.

export type SortOption =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "created_at"
  | "ranking";

export type TypesenseProductsParams = {
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: SortOption;
  category?: string;
  categoryNames?: string[];
  categoryId?: string;
  collection?: string;
  collectionId?: string;
  brand?: string;
  /** Familia libre del ERP (`family.name`), ortogonal a la categoría. */
  family?: string;
  tag?: string;
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  promotion?: string;
  // Generic "only products with an active promotion" filter (navbar Promociones
  // button → has_promotion:=true). `promotion` filters by a single campaign name.
  onlyPromotions?: boolean;
  fragancia?: string;
  sugerenciaUso?: string;
  familiaOlfativa?: string;
  /**
   * Atributos del asesor guiado (`advisor_*`), derivados al indexar. Son los
   * MISMOS valores que usa el filtrado guiado de WhatsApp, así que un link del
   * PLP y un recorrido del bot filtran igual.
   */
  advisorSurface?: string;
  advisorProductType?: string;
  advisorEnvironment?: string;
  advisorSpecialUse?: string;
  advisorBase?: string;
  productIds?: string[];
  salesChannelId?: string;
  facets?: boolean;
  erpSubcategoryId?: string;
  // Omite el filtro base `price:>0`. Para catálogos donde el precio real no es
  // el retail indexado (ej. selector B2B: el precio sale de una price list por
  // customer group y un producto solo-mayorista indexa price 0).
  omitPriceFilter?: boolean;
};

// Typesense devuelve `stats` solo para facetas numéricas (acá: `price`). Es de
// donde salen los extremos reales del catálogo para el slider de precio.
export type TypesenseFacetStats = {
  min?: number;
  max?: number;
  avg?: number;
  sum?: number;
  total_values?: number;
};

export type TypesenseFacetCount = {
  field_name: string;
  counts: Array<{
    value: string;
    count: number;
  }>;
  stats?: TypesenseFacetStats;
};

// Cada entrada de `categories` en un documento Typesense es plana: el indexer
// del backend mete raíz, intermedias y hoja como elementos hermanos del array.
// `parent_category` solo trae el padre inmediato (1 nivel arriba), pero
// `parent_category_id` y `mpath` permiten reconstruir la cadena completa hasta
// la raíz para árboles de 3+ niveles (mpath: IDs separados por punto, de raíz
// a hijo). `parent_category` puede llegar como null (raíces) u omitirse.
export type TypesenseCategoryRef = {
  id: string;
  name: string;
  handle: string;
  parent_category_id?: string | null;
  mpath?: string | null;
  parent_category?: {
    id: string;
    name: string;
    handle?: string;
    parent_category_id?: string | null;
    mpath?: string | null;
  } | null;
};

export type TypesenseProductDocument = {
  id: string;
  title: string;
  subtitle: string | null;
  handle: string;
  description: string | null;
  thumbnail: string | null;
  images: Array<{ id: string; url: string }>;
  brand: { id: string; name: string } | null;
  family: { id: string; name: string } | null;
  categories: TypesenseCategoryRef[];
  collection: { id: string; title: string; handle: string } | null;
  tags: Array<{ id: string; value: string }>;
  options: Array<{ id: string; title: string; values: string[] }>;
  variants: Array<{
    id: string;
    title: string;
    sku: string | null;
    calculated_price: {
      calculated_amount: number;
      original_amount: number;
      currency_code: string;
    };
  }>;
  sales_channels: Array<{ id: string; name: string }>;
  promotions: Array<{
    id: string;
    code: string;
    type: string;
    status?: string;
    is_automatic?: boolean;
    campaign?: {
      id: string;
      name: string;
      description?: string;
    };
    rules?: Array<{
      id?: string;
      attribute?: string;
      operator?: string;
      values?: Array<{
        id?: string;
        value?: string;
      }>;
    }>;
    application_method?: {
      type?: string;
      value?: number;
      target_type?: string;
      allocation?: string;
      apply_to_quantity?: number;
      buy_rules_min_quantity?: number;
      max_quantity?: number;
      target_rules?: Array<{
        id?: string;
        attribute?: string;
        operator?: string;
        created_at?: string;
        updated_at?: string;
        values?: Array<{
          id?: string;
          value?: string;
          promotion_rule_id?: string;
          created_at?: string;
          updated_at?: string;
        }>;
      }>;
      buy_rules?: Array<{
        id?: string;
        attribute?: string;
        operator?: string;
        created_at?: string;
        updated_at?: string;
        values?: Array<{
          id?: string;
          value?: string;
          promotion_rule_id?: string;
          created_at?: string;
          updated_at?: string;
        }>;
      }>;
    };
  }>;
  price: number;
  subtotal: number;
  discount: number;
  created_at: number;
  stock_available: number;
  is_giftcard?: boolean;
  /**
   * Base entonable del sistema tintométrico. Lo escribe el ERP en la metadata del
   * producto y el mapper lo pasa al índice; la card lo usa para mostrar los
   * swatches y para NO ofrecer quick-add (el color se elige en el PDP).
   */
  tintable?: boolean;
  /** Muestra de hex para la card. No es la carta completa. */
  tint_swatches?: string[];
  /** Cuántos colores validados tiene esta base, para el badge. */
  tint_color_count?: number;
  fragrance: { id: string; name: string } | null;
  olfactory_family:
    | { id: string; name: string }
    | Array<{ id: string; name: string }>
    | null;
  usage_suggestion:
    | { id: string; name: string }
    | Array<{ id: string; name: string }>
    | null;
};

export type TypesenseProductsResponse = {
  products: TypesenseProductDocument[];
  found: number;
  page: number;
  totalPages: number;
  facetCounts: TypesenseFacetCount[];
  facetUniverse: TypesenseFacetCount[];
  /**
   * Cuántos productos matchean la query IGNORANDO los filtros del usuario.
   *
   * Sale de la query de "universo de facetas" que ya se dispara cuando hay
   * filtros activos, así que no cuesta un request extra. Existe para que el
   * estado vacío pueda distinguir los dos casos que hoy se ven iguales: "no
   * tenemos nada parecido a esto" vs "lo tenemos, pero tus filtros lo tapan"
   * — que en un PLP faceteado es la causa MÁS común de cero resultados.
   *
   * `undefined` cuando no había filtros de usuario que quitar.
   */
  unfilteredFound?: number;
};
