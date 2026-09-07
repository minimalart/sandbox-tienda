import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

/**
 * Forma de la colección de productos.
 *
 * `name` es un PLACEHOLDER: el nombre real lo inyecta el service al crear, desde
 * `this.collectionName`. Antes acá se leía `TYPESENSE_COLLECTION_NAME` en el top
 * level del módulo, o sea una sola vez al importar, mientras el service resolvía
 * el nombre por su cuenta — dos fuentes para el mismo dato que podían divergir.
 */
export const typesenseSchema: CollectionCreateSchema = {
  name: 'products',
  enable_nested_fields: true,
  fields: [
    { name: 'id', type: 'string', facet: false, index: true, optional: true, sort: true },
    { name: 'title', type: 'string', facet: false, index: true, optional: true, sort: true },
    { name: 'subtitle', type: 'string', facet: false, index: true, optional: true, sort: false },
    { name: 'handle', type: 'string', facet: false, index: true, optional: true, sort: false },
    { name: 'description', type: 'string', facet: false, index: true, optional: true, sort: false },
    { name: 'status', type: 'string', facet: true, index: true, optional: true, sort: false },
    { name: 'is_giftcard', type: 'bool', facet: false, index: true, optional: true, sort: false },
    { name: 'thumbnail', type: 'string', facet: false, index: true, optional: true, sort: false },

    // Price fields
    // `price` es facetable no para listar valores sino para que Typesense
    // devuelva `facet_counts[].stats` (min/max/avg): de ahí saca el storefront
    // los extremos reales del catálogo para el slider de rango de precio.
    { name: 'price', type: 'float', facet: true, index: true, optional: true, sort: true },
    { name: 'price_currency', type: 'string', facet: true, index: true, optional: true, sort: false },
    { name: 'discount', type: 'float', facet: false, index: true, optional: true, sort: true },
    { name: 'subtotal', type: 'float', facet: true, index: true, optional: false, sort: true },
    { name: 'has_promotion', type: 'bool', facet: true, index: true, optional: false, sort: false },

    // Timestamps
    { name: 'created_at', type: 'int64', facet: false, index: true, optional: false, sort: true },

    // Categories
    {
      name: 'categories',
      type: 'object[]',
      facet: true,
      index: true,
      optional: true,
      sort: false,
    },
    { name: 'categories.id', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'categories.name', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'categories.handle', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'categories.is_active', type: 'bool[]', facet: true, index: true, optional: true, sort: false },
    { name: 'categories.is_internal', type: 'bool[]', facet: true, index: true, optional: true, sort: false },
    { name: 'categories.parent_category', type: 'object[]', facet: false, index: true, optional: true, sort: false },
    { name: 'categories.parent_category.id', type: 'string[]', facet: false, index: true, optional: true, sort: false },
    { name: 'categories.parent_category.name', type: 'string[]', facet: true, index: true, optional: true, sort: false },

    // Hierarchical category levels for faceted navigation
    { name: 'categories.lvl0', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'categories.lvl1', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'categories.lvl2', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'category_id', type: 'string', facet: true, index: true, optional: true, sort: false },
    { name: 'category_path_ids', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'category_path_label', type: 'string', facet: false, index: true, optional: true, sort: false },

    // Collection
    { name: 'collection', type: 'object', facet: false, index: true, optional: true, sort: false },
    { name: 'collection.id', type: 'string', facet: true, index: true, optional: true, sort: false },
    { name: 'collection.title', type: 'string', facet: true, index: true, optional: true, sort: false },
    { name: 'collection.handle', type: 'string', facet: true, index: true, optional: true, sort: false },

    // Type
    { name: 'type', type: 'object', facet: true, index: true, optional: true, sort: false },
    { name: 'type.id', type: 'string', facet: true, index: true, optional: true, sort: false },
    { name: 'type.value', type: 'string', facet: true, index: true, optional: true, sort: false },

    // Brand — optional, sourced from product.metadata.brand (Medusa has no native brand entity)
    { name: 'brand', type: 'object', facet: true, index: true, optional: true, sort: false },
    { name: 'brand.id', type: 'string', facet: true, index: true, optional: true, sort: false },
    { name: 'brand.name', type: 'string', facet: true, index: true, optional: true, sort: false },

    // Family — familia libre del ERP (Zeus `familia`), ortogonal a la categoría:
    // una familia cruza varias categorías y viceversa. Sale de
    // product.metadata.family y espeja la forma de `brand` para que el
    // storefront reuse el mismo camino de faceta y filtro.
    { name: 'family', type: 'object', facet: true, index: true, optional: true, sort: false },
    { name: 'family.id', type: 'string', facet: true, index: true, optional: true, sort: false },
    { name: 'family.name', type: 'string', facet: true, index: true, optional: true, sort: false },

    // Asesor guiado — 5 dimensiones derivadas al indexar (ver advisor.ts). Van
    // como campos EXPLÍCITOS y no dentro de `metadata`: el wildcard `metadata.*`
    // es `facet: false`, y el flujo guiado necesita `facet_counts` para saber
    // cuántos productos quedan y qué opciones ofrecer en la próxima pregunta.
    // `optional: true` porque un catálogo sin reglas cargadas no los emite.
    { name: 'advisor_surface', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'advisor_product_type', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'advisor_environment', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'advisor_special_use', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'advisor_base', type: 'string[]', facet: true, index: true, optional: true, sort: false },

    // Tags
    { name: 'tags', type: 'object[]', facet: true, index: true, optional: true, sort: false },
    { name: 'tags.id', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'tags.value', type: 'string[]', facet: true, index: true, optional: true, sort: false },

    // Promotions — opcional. Solo se popula cuando el producto tiene
    // promociones activas (ver product-mapper.ts). El storefront facetea y
    // filtra por `promotions.campaign.name`; los demás campos se guardan para
    // mostrar el beneficio. Todos `optional` para que productos sin promo no fallen.
    { name: 'promotions', type: 'object[]', facet: false, index: true, optional: true, sort: false },
    { name: 'promotions.id', type: 'string[]', facet: false, index: true, optional: true, sort: false },
    { name: 'promotions.code', type: 'string[]', facet: false, index: true, optional: true, sort: false },
    { name: 'promotions.campaign.id', type: 'string[]', facet: false, index: true, optional: true, sort: false },
    { name: 'promotions.campaign.name', type: 'string[]', facet: true, index: true, optional: true, sort: false },

    // Variants
    { name: 'variants', type: 'object[]', facet: false, index: true, optional: true, sort: false },
    { name: 'variants.id', type: 'string[]', facet: false, index: true, optional: true, sort: false },
    { name: 'variants.title', type: 'string[]', facet: false, index: true, optional: true, sort: false },
    { name: 'variants.sku', type: 'string[]', facet: false, index: true, optional: true, sort: false },
    { name: 'variants.ean', type: 'string[]', facet: false, index: true, optional: true, sort: false },
    { name: 'variants.barcode', type: 'string[]', facet: false, index: true, optional: true, sort: false },
    { name: 'variants.inventory_quantity', type: 'int64[]', facet: false, index: true, optional: true, sort: false },
    { name: 'variants.allow_backorder', type: 'bool[]', facet: false, index: true, optional: true, sort: false },
    { name: 'variants.manage_inventory', type: 'bool[]', facet: false, index: true, optional: true, sort: false },
    { name: 'variants.variant_rank', type: 'int64[]', facet: false, index: true, optional: true, sort: false },
    {
      name: 'variants.calculated_price.calculated_amount',
      type: 'int64[]',
      facet: true,
      index: true,
      optional: true,
      sort: false,
    },
    {
      name: 'variants.calculated_price.original_amount',
      type: 'int64[]',
      facet: false,
      index: true,
      optional: true,
      sort: false,
    },
    {
      name: 'variants.calculated_price.currency_code',
      type: 'string[]',
      facet: false,
      index: true,
      optional: true,
      sort: false,
    },

    // Options
    { name: 'options', type: 'object[]', facet: false, index: true, optional: true, sort: false },
    { name: 'options.id', type: 'string[]', facet: false, index: true, optional: true, sort: false },
    { name: 'options.title', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'options.values', type: 'string[]', facet: true, index: true, optional: true, sort: false },

    // Images
    { name: 'images', type: 'object[]', facet: false, index: true, optional: true, sort: false },
    { name: 'images.id', type: 'string[]', facet: false, index: true, optional: true, sort: false },
    { name: 'images.url', type: 'string[]', facet: false, index: true, optional: true, sort: false },

    // Sales channels
    { name: 'sales_channels', type: 'object[]', facet: true, index: true, optional: true, sort: false },
    { name: 'sales_channels.id', type: 'string[]', facet: true, index: true, optional: true, sort: false },
    { name: 'sales_channels.name', type: 'string[]', facet: true, index: true, optional: true, sort: false },

    // Stock
    { name: 'stock_available', type: 'int64', facet: false, index: true, optional: true, sort: true },

    // Metadata (auto-typed wildcard)
    { name: 'metadata', type: 'object', facet: false, index: true, optional: true, sort: false },
    // Explicit because the storefront filters by it — auto fields only materialize
    // once a document contains them, and filtering on a missing field is a 400.
    { name: 'metadata.hidden_from_store', type: 'bool', facet: true, index: true, optional: false, sort: false },
    // Explicit because the storefront sorts by it (missing_values: last handles absent docs)
    { name: 'metadata.ranking', type: 'int64', facet: false, index: true, optional: true, sort: true },
    { name: 'metadata.*', type: 'auto', facet: false, index: true, optional: true, sort: false },
  ],
};
