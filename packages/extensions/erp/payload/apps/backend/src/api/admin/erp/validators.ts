import { z } from 'zod';

const DepositoMappingSchema = z.object({
  /** Código del depósito en el ERP. */
  deposito: z.string().min(1).max(60),
  stock_location_id: z.string().min(1),
  enabled: z.boolean().optional(),
});

const StockSyncSettingsSchema = z.object({
  page_size: z.number().int().min(1).max(1000).optional(),
  update_chunk_size: z.number().int().min(1).max(500).optional(),
  /** Depósito del ERP → stock location, uno a uno. Vacío = una sola location. */
  deposito_map: z.array(DepositoMappingSchema).max(50).optional(),
  /** Acota el sync a estos canales. Vacío = toda la tienda. */
  sales_channel_ids: z.array(z.string().min(1)).max(50).optional(),
});

const PriceListMappingSchema = z.object({
  /** Índice de lista del ERP (Zeus expone `precio0`..`precio9`). */
  zeus_index: z.number().int().min(0).max(9),
  title: z.string().min(1).max(120),
  customer_group_id: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

/**
 * Overrides de las reglas de título (R01–R26). Los defaults viven en
 * `modules/erp/sync/product-title.ts`; acá solo viaja lo que el cliente agrega.
 */
const TitleRulesSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  strip_brand: z.boolean().optional(),
  /** Clave sin tildes ni caso → forma canónica. Valor vacío = borrar la entrada default. */
  dictionary: z.record(z.string().min(1).max(80), z.string().max(120)).optional(),
  promo_legends: z.array(z.string().min(1).max(80)).max(200).optional(),
});

const CatalogSyncSettingsSchema = z.object({
  currency_code: z.string().length(3).optional(),
  base_list_index: z.number().int().min(0).max(9).optional(),
  price_lists: z.array(PriceListMappingSchema).max(10).optional(),
  only_published: z.boolean().optional(),
  create_products: z.boolean().optional(),
  /** Estado con el que nacen los artículos que crea el sync. Default `draft`. */
  created_product_status: z.enum(['draft', 'published']).optional(),
  /** Bajar las imágenes del ERP y subirlas al File module. */
  images: z
    .object({ enabled: z.boolean().optional(), backfill_pending: z.boolean().optional() })
    .optional(),
  product_fields: z
    .array(
      z.enum([
        'title',
        'description',
        'weight',
        'length',
        'height',
        'width',
        'barcode',
        'category',
        'brand',
        'family',
      ])
    )
    .optional(),
  title_rules: TitleRulesSettingsSchema.optional(),
  color_option: z
    .object({ enabled: z.boolean().optional(), backfill_pending: z.boolean().optional() })
    .optional(),
  presentation_option: z
    .object({ enabled: z.boolean().optional(), backfill_pending: z.boolean().optional() })
    .optional(),
  categories_sync: z.boolean().optional(),
  categories_sync_rank: z.boolean().optional(),
  categories_backfill_pending: z.boolean().optional(),
  brands_sync: z.boolean().optional(),
  brands_replace_existing: z.boolean().optional(),
  /** @deprecated override manual; lo reemplaza `categories_sync`. */
  category_map: z.record(z.string(), z.string()).optional(),
  shipping_profile_id: z.string().nullable().optional(),
  /** Canales de venta de los productos creados: sin al menos uno no se ven en la tienda. */
  sales_channel_ids: z.array(z.string().min(1)).max(50).optional(),
  overlap_minutes: z.number().int().min(0).max(1440).optional(),
  full_sweep_hour: z.number().int().min(0).max(23).nullable().optional(),
  /** Qué hace el barrido completo además de traer el catálogo entero. */
  full_sweep: z
    .object({ images: z.boolean().optional(), price_lists: z.boolean().optional() })
    .optional(),
  max_change_pct: z.number().min(1).max(100).optional(),
  /** Espejar el estado de publicación del ERP sobre productos que ya existen. */
  status_sync: z.boolean().optional(),
  /** Además despublicar los que no vinieron en un barrido completo (borrados del ERP). */
  status_sync_unpublish_missing: z.boolean().optional(),
  /** Tope de despublicaciones por corrida, en % de lo que trajo el ERP. */
  max_unpublish_pct: z.number().min(1).max(100).optional(),
  write_chunk_size: z.number().int().min(1).max(1000).optional(),
  /** Lo escribe el motor al terminar; se acepta para poder resetearlo a mano. */
  last_synced_at: z.string().max(40).nullable().optional(),
  /**
   * Lo escribe el motor al terminar un barrido completo. Se acepta para poder
   * borrarlo a mano, que es la palanca para forzar un barrido en el próximo tick.
   */
  last_full_sweep_at: z.string().max(40).nullable().optional(),
});

const RetryBudgetSchema = z.object({
  max_attempts: z.number().int().min(1).max(200).optional(),
  base_delay_s: z.number().int().min(1).max(3600).optional(),
  max_delay_s: z.number().int().min(1).max(86_400).optional(),
});

const OutboxSettingsSchema = z.object({
  max_attempts: z.number().int().min(1).max(20).optional(),
  base_delay_s: z.number().int().min(1).max(3600).optional(),
  max_delay_s: z.number().int().min(1).max(86_400).optional(),
  /** Presupuesto propio del poll de comprobante (ver `ErpOutboxSettings`). */
  invoice_fetch: RetryBudgetSchema.optional(),
});

/**
 * Cuándo se notifica la venta, y desde qué depósito se factura.
 *
 * OJO: este schema tiene que enumerar TODA clave que se quiera persistir. Los
 * schemas de settings descartan en silencio lo que no declaran, así que un
 * campo nuevo en `ErpSalesNotifySettings` que no se agregue acá nunca se
 * guarda, y sin error.
 */
const SalesNotifySettingsSchema = z.object({
  trigger: z.enum(['payment_captured', 'fulfillment_created']).optional(),
  billing_deposito: z.string().min(1).max(60).nullable().optional(),
});

const ContabiliumSettingsSchema = z.object({
  base_url: z.string().url().optional(),
  deposito_id: z.number().int().positive().nullable().optional(),
  sale_mode: z.enum(['orden_venta', 'factura_cobrada']).optional(),
  punto_venta_id: z.number().int().positive().nullable().optional(),
  tipo_fc: z.string().max(10).optional(),
  condicion_venta: z.string().max(60).optional(),
  default_client_id: z.number().int().positive().nullable().optional(),
  shipping_concept_sku: z.string().max(120).nullable().optional(),
  prices_include_tax: z.boolean().optional(),
  tax_rate: z.number().min(0).max(1).optional(),
});

const BsaleSettingsSchema = z.object({
  base_url: z.string().url().optional(),
  office_id: z.number().int().positive().nullable().optional(),
  document_type_id: z.number().int().positive().nullable().optional(),
  price_list_id: z.number().int().positive().nullable().optional(),
  payment_type_id: z.number().int().positive().nullable().optional(),
  tax_ids: z.array(z.number().int()).max(10).optional(),
  declare_sii: z.boolean().optional(),
  dispatch_stock: z.boolean().optional(),
  send_email: z.boolean().optional(),
  prices_include_tax: z.boolean().optional(),
  tax_rate: z.number().min(0).max(1).optional(),
});

const ZeusSettingsSchema = z.object({
  base_url: z.string().url().optional(),
  ecommerce_id: z.string().max(120).nullable().optional(),
  sucursal: z.number().int().positive().nullable().optional(),
  deposito_id: z.number().int().positive().nullable().optional(),
  pto_vta: z.number().int().positive().nullable().optional(),
  cod_lista: z.number().int().min(0).nullable().optional(),
  cond_venta: z.string().max(60).nullable().optional(),
  tipo_comp: z.string().max(10).nullable().optional(),
  codigo_de_vendedor: z.string().max(60).nullable().optional(),
  default_client_code: z.string().max(60).nullable().optional(),
  create_clients: z.boolean().optional(),
  default_codigo_iva: z.number().int().positive().nullable().optional(),
  shipping_item_code: z.string().max(120).nullable().optional(),
  send_payments: z.boolean().optional(),
  tipo_pago: z.string().max(60).nullable().optional(),
  tarjeta_code: z.string().max(60).nullable().optional(),
  eshop_only: z.boolean().optional(),
  subtract_committed: z.boolean().optional(),
  prices_include_tax: z.boolean().optional(),
  tax_rate: z.number().min(0).max(1).optional(),
});

const OdooSettingsSchema = z.object({
  base_url: z.string().url().optional(),
  db: z.string().max(120).optional(),
  uid: z.number().int().positive().optional(),
  allowed_company_ids: z.array(z.number().int().positive()).optional(),
  timeout_ms: z.number().int().min(1000).max(300_000).optional(),
  shipping_item_code: z.string().max(120).nullable().optional(),
  auto_confirm: z.boolean().optional(),
  only_published: z.boolean().optional(),
});

/**
 * Sistema tintométrico. OJO: este schema descarta en silencio las claves que no
 * estén enumeradas acá, así que un campo nuevo en `ErpTintingSettings` que no se
 * agregue también en este objeto nunca se persiste.
 */
const TintingSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  default_collection: z.string().max(120).nullable().optional(),
  total_includes_tax: z.boolean().optional(),
  price_cache_ttl_s: z.number().int().min(0).max(86_400).optional(),
  price_cache_gen: z.number().int().min(0).optional(),
  max_quantity: z.number().int().min(1).max(200).optional(),
});

export const ErpSettingsSchema = z.object({
  stock_location_id: z.string().nullable().optional(),
  stock_sync: StockSyncSettingsSchema.optional(),
  catalog_sync: CatalogSyncSettingsSchema.optional(),
  outbox: OutboxSettingsSchema.optional(),
  sales_notify: SalesNotifySettingsSchema.optional(),
  contabilium: ContabiliumSettingsSchema.optional(),
  bsale: BsaleSettingsSchema.optional(),
  zeus: ZeusSettingsSchema.optional(),
  odoo: OdooSettingsSchema.optional(),
  tinting: TintingSettingsSchema.optional(),
});

/**
 * Override del depósito facturador de una orden. `null` = volver al default de
 * la config (por eso es `nullable` y no `optional`: "borrar" tiene que ser
 * expresable, y una clave ausente significaría "no tocar").
 */
export const PostErpOrderBillingDepositoSchema = z.object({
  deposito: z.string().min(1).max(60).nullable(),
});
export type PostErpOrderBillingDepositoInput = z.infer<typeof PostErpOrderBillingDepositoSchema>;

export const UpsertErpConfigSchema = z.object({
  provider: z.string().min(1).optional(),
  country_code: z.string().length(2).optional(),
  enabled: z.boolean().optional(),
  stock_sync_enabled: z.boolean().optional(),
  catalog_sync_enabled: z.boolean().optional(),
  sales_notify_enabled: z.boolean().optional(),
  /** Write-only: se mergean sobre las guardadas; omitido no toca nada. */
  credentials: z.record(z.string(), z.string()).optional(),
  /**
   * Credenciales a borrar, por NOMBRE de clave. Es lo único que la UI puede
   * mandar: los valores nunca se le devuelven.
   */
  credentials_remove: z.array(z.string().min(1)).max(50).optional(),
  settings: ErpSettingsSchema.optional(),
});

export type UpsertErpConfigInput = z.infer<typeof UpsertErpConfigSchema>;

export const ValidateConnectionSchema = z.object({
  provider: z.string().min(1).optional(),
  /** Si llegan, se validan SIN persistir (dry-run pre-guardado). */
  credentials: z.record(z.string(), z.string()).optional(),
});

export type ValidateConnectionInput = z.infer<typeof ValidateConnectionSchema>;

/**
 * Import de data maestra tintométrica. `dry_run` NO tiene default en el schema a
 * propósito: la ruta trata "ausente" como preview, así que hay que pedir
 * explícitamente `dry_run: false` para escribir.
 */
export const PostErpTintingImportSchema = z.object({
  kind: z.enum(['colors', 'formulas', 'bases']),
  /** Texto de la planilla. Acepta `,` o `;` y alias de columna en castellano. */
  csv: z.string().max(5_000_000).optional(),
  /** Alternativa al CSV: filas ya como objetos. */
  rows: z.array(z.record(z.string(), z.unknown())).max(20_000).optional(),
  dry_run: z.boolean().optional(),
});
export type PostErpTintingImportType = z.infer<typeof PostErpTintingImportSchema>;

export const PostErpTintingDetectBasesSchema = z.object({
  /** Sin esto sólo devuelve el preview de lo detectado. */
  commit: z.boolean().optional(),
  /** Carta que aplica a las bases detectadas. */
  collection: z.string().max(120).nullable().optional(),
  /** Default true: las de confianza baja quedan afuera salvo que se pidan. */
  only_high_confidence: z.boolean().optional(),
});
export type PostErpTintingDetectBasesType = z.infer<typeof PostErpTintingDetectBasesSchema>;

export const PostErpTintingConfirmBasesSchema = z.object({
  article_codes: z.array(z.string().min(1)).min(1).max(2_000),
  /** Default true. `false` deshabilita el entonado de esas bases. */
  confirmed: z.boolean().optional(),
});
export type PostErpTintingConfirmBasesType = z.infer<typeof PostErpTintingConfirmBasesSchema>;

export const PostErpTintingProbeSchema = z.object({
  base_code: z.string().min(1).max(60),
  /** Se manda como lo muestra Gestión; el adapter le saca los espacios. */
  formula_code: z.string().min(1).max(60),
  /** Default: `catalog_sync.base_list_index`. */
  list_index: z.number().int().min(0).max(9).optional(),
});
export type PostErpTintingProbeType = z.infer<typeof PostErpTintingProbeSchema>;

/**
 * Alta de bases entonables en Medusa. `dry_run` ausente = preview: esta ruta crea
 * productos en una tienda viva, así que escribir tiene que ser explícito.
 */
export const PostErpTintingSyncProductsSchema = z.object({
  dry_run: z.boolean().optional(),
  /** Canales donde publicar las bases creadas. Vacío = ninguno (no visibles). */
  sales_channel_ids: z.array(z.string().min(1)).max(20).optional(),
  /** Override del perfil de envío; por default el de `catalog_sync`. */
  shipping_profile_id: z.string().min(1).optional(),
  /** Carta que se asocia a las bases creadas. */
  collection: z.string().max(120).optional(),
});
export type PostErpTintingSyncProductsType = z.infer<typeof PostErpTintingSyncProductsSchema>;

/**
 * Borrado de colores de la carta. Sin `collection` borra el código en TODAS las
 * cartas, así que la carta se pide para el caso normal (un mismo código puede
 * existir en dos cartas distintas y sólo una está mal).
 */
export const PostErpTintingDeleteColorsSchema = z.object({
  codes: z.array(z.string().min(1)).min(1).max(2_000),
  collection: z.string().max(120).optional(),
});
export type PostErpTintingDeleteColorsType = z.infer<typeof PostErpTintingDeleteColorsSchema>;

/**
 * Borrado de fórmulas por su clave natural completa. A diferencia del de
 * colores, acá la carta es OBLIGATORIA y cada fila va nombrada entera: borrar
 * fórmulas es borrar la capacidad de vender un color, y un filtro amplio mal
 * armado (una línea, una carta) se lleva puesta media tabla sin que nadie lo
 * note hasta que un cliente no encuentra su color.
 *
 * `dry_run` arranca en true en la ruta, igual que el import.
 */
export const DeleteErpTintingFormulasSchema = z.object({
  collection: z.string().min(1).max(120),
  items: z
    .array(
      z.object({
        color_code: z.string().min(1).max(120),
        product_line: z.string().min(1).max(240),
        base_letter: z.string().max(10).nullish(),
      })
    )
    .min(1)
    .max(2_000),
  dry_run: z.boolean().optional(),
});
export type DeleteErpTintingFormulasType = z.infer<typeof DeleteErpTintingFormulasSchema>;
