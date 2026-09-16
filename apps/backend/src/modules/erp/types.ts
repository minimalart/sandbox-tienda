import type { ImageFailures } from './sync/image-failures';

/**
 * Tipos compartidos del módulo ERP.
 *
 * El módulo integra sistemas de gestión externos con dos flujos MVP:
 * stock ERP → Medusa por SKU (pull programado/manual) y notificación de
 * venta Medusa → ERP (outbox asincrónico e idempotente que nunca bloquea
 * el checkout). Diseñado para crecer a múltiples ERPs (adapter registry)
 * y países (country layer).
 */

export type ErpSyncLogType = 'stock_sync' | 'catalog_sync';

export type ErpSyncTrigger = 'cron' | 'manual';

export type ErpSyncLogStatus = 'running' | 'completed' | 'completed_with_errors' | 'failed';

export type ErpSyncLogItemStatus =
  | 'updated'
  | 'not_found'
  | 'duplicate_sku'
  | 'invalid_quantity'
  | 'skipped'
  | 'failed'
  /** Catalog sync: producto creado en Medusa (borrador o publicado, según `created_product_status`). */
  | 'created'
  /** Catalog sync: el precio del ERP coincide con el de Medusa, no se escribe. */
  | 'price_unchanged'
  /** Catalog sync: la variante existe pero no tiene price set vinculado. */
  | 'no_price_set'
  /** Catalog sync: el artículo del ERP no matchea ninguna variante por SKU. */
  | 'variant_not_found'
  /** Catalog sync: el ERP lo marca inactivo o no publicable en ecommerce. */
  | 'not_published';

/**
 * Estados del outbox de ventas:
 * - `pending`: creado, todavía no enviado.
 * - `processing`: tomado por el processor (claim).
 * - `sent`: el ERP lo aceptó.
 * - `failed`: falló con reintento programado (`next_retry_at`).
 * - `dead_letter`: agotó los reintentos.
 * - `skipped`: no se envía por configuración/capability (fila auditable).
 * - `duplicate`: el ERP respondió que la venta ya existía.
 */
export type ErpOutboxStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'dead_letter'
  | 'skipped'
  | 'duplicate';

export type ErpRetryBudget = {
  /** Intentos máximos antes de `dead_letter`. */
  max_attempts?: number;
  /** Base del backoff exponencial, en segundos. */
  base_delay_s?: number;
  /** Tope del backoff, en segundos. */
  max_delay_s?: number;
};

export type ErpOutboxSettings = ErpRetryBudget & {
  /**
   * Presupuesto de reintentos PROPIO para `invoice_fetch`.
   *
   * El default general (5 intentos, tope 30 min) se agota en ~1 h, y eso no
   * alcanza para recuperar un comprobante: el ERP factura a su ritmo (en Zeus,
   * el pedido se inserta al instante pero la factura puede salir en un lote
   * horas después). Con el presupuesto general, una venta perfectamente sana
   * terminaría en `dead_letter` sólo porque el ERP todavía no facturó.
   *
   * "Todavía no facturado" es un REINTENTO, nunca un error.
   */
  invoice_fetch?: ErpRetryBudget;
};

export const DEFAULT_OUTBOX_SETTINGS: Required<ErpRetryBudget> = {
  max_attempts: 5,
  base_delay_s: 60,
  max_delay_s: 1800,
};

/** ~24 intentos escalando hasta 1 h ≈ 20 h de ventana para que el ERP facture. */
export const DEFAULT_INVOICE_FETCH_SETTINGS: Required<ErpRetryBudget> = {
  max_attempts: 24,
  base_delay_s: 300,
  max_delay_s: 3600,
};

/**
 * Cuándo se encola la notificación de venta al ERP. Excluyentes: una venta se
 * notifica UNA sola vez.
 *
 * - `payment_captured` (default, comportamiento histórico): al cobrarse la
 *   orden. Trigger real `payment.captured`, con reconciliación en
 *   `order.placed` para la carrera de webhooks de MercadoPago.
 * - `fulfillment_created`: al crearse el fulfillment DESDE EL ADMIN. Es para
 *   operativas donde la mercadería vive repartida entre depósitos y hay que
 *   consolidarla a mano en el ERP antes de facturar: el fulfillment es la
 *   confirmación humana de que la transferencia ya ocurrió.
 */
export type ErpSalesTrigger = 'payment_captured' | 'fulfillment_created';

export type ErpSalesNotifySettings = {
  /** Default `payment_captured`: no cambiar el comportamiento de lo ya instalado. */
  trigger?: ErpSalesTrigger;
  /**
   * Código del depósito FACTURADOR (el mismo espacio de códigos que
   * `stock_sync.deposito_map[].deposito`). Es el depósito desde el que se emite
   * el comprobante y, por lo tanto, el único desde el que se acepta crear el
   * fulfillment cuando el trigger es `fulfillment_created`.
   *
   * Se puede pisar por orden con `order.metadata.erp_billing_deposito`.
   */
  billing_deposito?: string | null;
};

export const DEFAULT_SALES_NOTIFY_SETTINGS: Required<
  Pick<ErpSalesNotifySettings, 'trigger'>
> = {
  trigger: 'payment_captured',
};

/**
 * Marca que deja el gate de fulfillment en `order.metadata.erp_billing` cuando
 * un operador crea el fulfillment desde el admin y la validación pasó.
 *
 * Vive en la ORDEN y no en el fulfillment a propósito: es el registro auditable
 * de qué depósito confirmó una persona, y no depende de que Medusa persista el
 * `metadata` del body de la ruta de fulfillment.
 *
 * Su ausencia es lo que distingue un fulfillment humano de uno creado por el
 * auto-fulfill de un carrier (Andreani, Correo, flota propia crean fulfillments
 * en `order.placed`/`payment.captured` sin pasar por HTTP).
 */
export type ErpBillingConfirmation = {
  /** Código del depósito facturador confirmado. */
  deposito: string;
  /** Stock location de Medusa mapeada a ese depósito. */
  stock_location_id: string;
  /** ISO. */
  confirmed_at: string;
  /** `actor_id` del admin, cuando el request lo trae. */
  confirmed_by?: string | null;
};

/** Un depósito del ERP → una stock location de Medusa. */
export type ErpDepositoMapping = {
  /** Código del depósito en el ERP (en Zeus: `stock_por_deposito[].deposito`). */
  deposito: string;
  stock_location_id: string;
  enabled?: boolean;
};

export type ErpStockSyncSettings = {
  /** Variantes por página al recorrer el catálogo de Medusa. */
  page_size?: number;
  /** Updates de inventario por tanda contra el workflow core. */
  update_chunk_size?: number;
  /**
   * Depósitos del ERP → stock locations de Medusa, uno a uno.
   *
   * Con este mapeo cada depósito escribe SU cantidad en la location que le
   * corresponde, que es lo que necesita un negocio con sucursales: el total de
   * Medusa sale de la suma de los niveles. Sin mapeo se cae al comportamiento
   * viejo (el total del ERP en una sola location, `stock_location_id`).
   *
   * OJO: no es un multiselect de locations. Escribir el TOTAL en varias
   * locations multiplicaría el stock.
   */
  deposito_map?: ErpDepositoMapping[];
  /**
   * Acota el sync a los productos de estos sales channels. Vacío = toda la tienda.
   *
   * En una plataforma con varios demos esto no es un lujo: el sync matchea por
   * SKU y los códigos del ERP son cortos y numéricos (`36`, `44`, `100`), así que
   * sin acotar puede pisarle el stock a un producto de otro demo que casualmente
   * comparte el SKU.
   */
  sales_channel_ids?: string[];
};

/** Mapeo de una lista de precios del ERP a una price list de Medusa. */
export type ErpPriceListMapping = {
  /** Índice de lista en el ERP (en Zeus: 4 = `precio4`, la mayorista). */
  zeus_index: number;
  /** Título de la price list en Medusa; se crea si no existe. */
  title: string;
  /** Customer group que accede a esta lista. Sin él la price list queda `draft`. */
  customer_group_id?: string | null;
  enabled?: boolean;
};

/**
 * Normalización del título que llega del ERP (reglas R01–R26 de la
 * especificación funcional acordada con el cliente). La implementación vive en
 * `sync/product-title.ts`, con sus defaults de código; acá viajan solo los
 * overrides del cliente.
 */
export type ErpTitleRulesSettings = {
  /** Master switch. Default true. */
  enabled?: boolean;
  /**
   * Quitar la marca del inicio del título cuando coincide con el atributo
   * estructurado del ERP. Default true. Nunca se quita por inferencia: sin marca
   * informada el título se normaliza completo.
   */
  strip_brand?: boolean;
  /**
   * Se MEZCLA sobre `DEFAULT_TITLE_DICTIONARY`: clave sin tildes ni caso → forma
   * canónica ("metalico" → "metálico", "base t" → "Base T"). Un valor vacío
   * borra la entrada default.
   */
  dictionary?: Record<string, string>;
  /** Leyendas comerciales entre paréntesis que se quitan; se MEZCLA con las default. */
  promo_legends?: string[];
};

/**
 * Settings del catalog sync (productos + precios ERP → Medusa).
 *
 * Los defaults salen de medir la cuenta real del cliente: `precio1` es el precio
 * de venta al público (3410 de 3438 artículos lo tienen) y `precio4` es el
 * mayorista (= `precio1 × 0.70` en el 99.9% del catálogo). `precio0` está vacío
 * salvo en 23 artículos, así que el índice base NO es 0.
 */
export type ErpCatalogSyncSettings = {
  /** Moneda de los precios del ERP (Zeus no expone código ISO). Default 'ars'. */
  currency_code?: string;
  /** Lista del ERP que alimenta el precio base del storefront. Default 1. */
  base_list_index?: number;
  /** Listas del ERP → price lists de Medusa. Default: `precio4` → "Mayorista". */
  price_lists?: ErpPriceListMapping[];
  /** Solo sincronizar artículos activos y publicables en ecommerce. Default true. */
  only_published?: boolean;
  /** Crear en Medusa los artículos del ERP que no existen. Default false. */
  create_products?: boolean;
  /**
   * Estado con el que nacen los artículos creados por el sync. Default `draft`.
   *
   * El default es conservador y no cosmético: un `draft` no entra al índice de
   * búsqueda, así que un alta masiva sin fotos ni copy no contamina el catálogo
   * del storefront mientras alguien la revisa. Pero Medusa NO tiene "publicar en
   * masa" desde el admin, así que dejar miles de borradores es una condena a la
   * consola — por eso esto es configurable y no una constante.
   *
   * `published` es la elección sana cuando el ERP ya trae títulos normalizados y
   * `images.enabled` está prendido: ahí el artículo entra completo.
   */
  created_product_status?: ErpCreatedProductStatus;
  /**
   * Traer las imágenes del artículo desde el ERP, subirlas al File module de
   * Medusa (S3/Spaces en producción) y dejarlas como `images` + `thumbnail`.
   *
   * Se DESCARGA y se re-sube en lugar de hotlinkear a propósito. El endpoint de
   * imágenes de Zeus también acepta el JWT como query param (`?key=<jwt>`), lo
   * que permitiría linkear directo y ahorrar la transferencia — pero ese token
   * lee el catálogo, crea clientes y crea pedidos, y una URL de storefront es
   * pública. Si algún día hace falta hotlinkear, el camino sano es pedirle a
   * Zeus una API key restringida a imágenes.
   *
   * Idempotente: solo toca productos sin `thumbnail` NI `images`. Nunca pisa una
   * foto cargada a mano.
   */
  images?: {
    /** Default false: son cientos de MB de transferencia en la primera corrida. */
    enabled?: boolean;
    /**
     * Hay un backfill pendiente: la próxima corrida recorre el catálogo COMPLETO
     * en lugar del delta. Se prende al activar `enabled`; el motor lo apaga al
     * terminar bien. Mismo mecanismo que `presentation_option`.
     */
    backfill_pending?: boolean;
    /**
     * Artículos cuya imagen viene fallando, para saltearlos y que un puñado de
     * códigos rotos no bloquee el backfill entero. Lo escribe el motor solo; no
     * se edita a mano. Ver `sync/image-failures.ts` para los strikes y el
     * cooldown, y por qué esto existe.
     */
    failures?: ImageFailures;
    /**
     * Lado menor mínimo, en píxeles, para aceptar una foto del ERP. Default 500.
     *
     * El storefront estira la imagen hasta llenar la card, así que un archivo
     * chico no se ve chico: se ve pixelado. Zeus devolvió fotos de 160×160 para
     * varios artículos y entraron sin chistar. Un `0` apaga el gate.
     *
     * Solo aplica a lo que ENTRA. Las fotos chicas que ya están en el catálogo
     * no se tocan: el planner saltea todo producto que ya tenga imagen.
     */
    min_dimension_px?: number;
  };
  /**
   * Campos de producto que el sync puede sobrescribir en productos existentes.
   * Default conservador SIN `title`/`description`: aun con `title_rules`
   * prendido, empezar a escribir títulos sobre un catálogo existente es una
   * decisión por cliente y se toma a mano.
   */
  product_fields?: ErpProductField[];
  /**
   * Normalización del título recibido del ERP. Aplica SIEMPRE en las altas (el
   * alta usa el título del ERP con o sin allowlist, así que un producto nuevo
   * entra ya formateado); en productos existentes además hace falta `title` en
   * `product_fields`.
   */
  title_rules?: ErpTitleRulesSettings;
  /**
   * Escribir la presentación normalizada en el VALOR de la opción de variante
   * (`Formato: 1 l`), que es lo que pinta la card del PLP.
   *
   * El título ya sale normalizado, pero la card no lee el título: lee la opción, y
   * ahí el catálogo tiene el placeholder `Único` que el storefront esconde a
   * propósito. Con esto prendido el sync lo rellena desde
   * `variant.metadata.zeus_presentacion`.
   *
   * NUNCA pisa una etiqueta puesta a mano: solo rellena placeholders y normaliza
   * la forma cruda de la MISMA medida (`3,6 LTS` → `3,6 l`).
   */
  /**
   * Escribir el color del título como opción `Color` de variante, que es lo que
   * pinta el círculo en la card. Zeus no manda color en ningún campo (los cuatro
   * `codigo_color`/`codigo_acabado`/`codigo_talle`/`codigo_tamanio` están vacíos
   * en los 3.438 artículos), así que sale del título contra un vocabulario
   * CERRADO — ver `sync/color-option.ts`.
   *
   * Nunca toca un producto que ya tiene una opción de color, ni uno con varias
   * variantes (ahí el color puede ser por variante y eso es agrupar, R11).
   */
  color_option?: {
    /** Default false: agrega una opcion a los productos del catalogo. */
    enabled?: boolean;
    /** Backfill pendiente; lo apaga el motor al terminar bien. */
    backfill_pending?: boolean;
  };
  presentation_option?: {
    /** Default false: cambia lo que se ve en todas las cards del catálogo. */
    enabled?: boolean;
    /**
     * Hay un backfill pendiente: la próxima corrida recorre el catálogo COMPLETO
     * en lugar del delta. Se prende al activar `enabled`; el motor lo apaga al
     * terminar bien. Mismo mecanismo que `categories_backfill_pending`.
     */
    backfill_pending?: boolean;
  };
  /**
   * Espejar el árbol de categorías del ERP en `product_category` y asignar la
   * categoría a los productos, incluidos los que ya existen.
   *
   * Modo ADITIVO: el ERP administra SOLO las categorías que él creó
   * (identificadas por `external_id = <provider>:<código>`) y nunca toca una
   * categoría asignada a mano. Requiere `categories_pull` en el adapter.
   */
  categories_sync?: boolean;
  /**
   * Forzar el `rank` del ERP también al ACTUALIZAR categorías existentes.
   * Default false: el módulo de producto re-rankea a TODOS los hermanos cuando
   * recibe `rank`, y en la raíz los nodos del ERP comparten hermanos con las
   * categorías manuales → se reordenarían solas en cada corrida. En el ALTA el
   * orden del ERP se respeta siempre (se crean en orden).
   */
  categories_sync_rank?: boolean;
  /**
   * Hay una retro-categorización pendiente: la próxima corrida pide el catálogo
   * COMPLETO para atribuir categoría/familia/marca a todos los artículos y no
   * solo al delta. Se prende al activar `categories_sync`; el motor lo apaga al
   * terminar bien.
   */
  categories_backfill_pending?: boolean;
  /**
   * Crear y asociar entidades de marca (extensión Marcas). Sin la extensión
   * instalada el sync igual escribe `product.metadata.brand`, que es lo que
   * alimenta el filtro del storefront.
   */
  brands_sync?: boolean;
  /**
   * La marca del ERP reemplaza el set de marcas del producto. Default true: el
   * ERP trae UNA marca por artículo, así que dejarlo aditivo haría que un
   * cambio de marca dejara el producto en dos para siempre. El borrado es soft.
   */
  brands_replace_existing?: boolean;
  /**
   * Código de categoría del ERP → id de `product_category` de Medusa.
   *
   * @deprecated Lo reemplaza `categories_sync` (espejo automático del árbol),
   * posible desde que se descubrió que Zeus expone los NOMBRES en
   * `GET /articulos/categorias`. Se sigue respetando y GANA sobre el árbol
   * espejado: es el override de quien ya mapeó a mano códigos del ERP a
   * categorías propias, y la única vía para códigos que el árbol no cubre.
   */
  category_map?: Record<string, string>;
  /** Shipping profile para los productos creados (sin él no hay opciones de envío). */
  shipping_profile_id?: string | null;
  /**
   * Canales de venta a los que se linkean los productos que crea el sync.
   *
   * NO es cosmético: `/store/*` scopea por los canales de la publishable key, así
   * que un producto sin ningún link no aparece en el storefront **aunque esté
   * `published`**. Sin esto, `created_product_status: 'published'` no se ve.
   *
   * Vacío a propósito por default: elegir "el canal default" desde el motor es el
   * mismo error arbitrario que `resolveShippingProfile` evita (ver
   * `apply-product-changes.ts`). En una plataforma con varias tiendas, adivinar
   * significa publicar el catálogo de un cliente en la tienda de otro. La UI avisa
   * cuando el alta va a quedar invisible.
   *
   * Distinto de `stock_sync.sales_channel_ids`, que decide qué stock se lee: son
   * dos decisiones y no se comparten.
   */
  sales_channel_ids?: string[];
  /** Minutos que se resta al watermark para cubrir relojes desfasados. Default 30. */
  overlap_minutes?: number;
  /** Hora (0-23) del barrido completo diario sin `fechasincro`. Default 4. `null` lo apaga. */
  full_sweep_hour?: number | null;
  /**
   * Qué hace el barrido completo además de traer el catálogo entero.
   *
   * El barrido existe porque el ERP no informa bajas: el delta solo nunca se
   * enteraría de un artículo despublicado. Pero traer todo el catálogo no obliga a
   * rehacer TODO el trabajo sobre todo el catálogo, y estas dos fases son las
   * caras. La lógica vive en `sync/full-sweep-scope.ts`.
   */
  full_sweep?: {
    /**
     * Revisar imágenes también en el barrido completo. Default false.
     *
     * Apagado, la fase de imágenes solo mira el delta (o el catálogo completo si
     * hay un backfill pendiente). El razonamiento del default: lo que sobrevive al
     * planner en un barrido son justamente los artículos SIN foto, y los que el ERP
     * tampoco tiene no van a aparecer por preguntar de nuevo — y cuando aparecen,
     * el ERP mueve la fecha de modificación y entran por el delta.
     *
     * Prenderlo tiene sentido si el ERP carga imágenes SIN tocar el artículo: ahí
     * el delta no las ve nunca y hace falta barrer.
     */
    images?: boolean;
    /**
     * Escribir las price lists en el barrido completo. Default true.
     *
     * OJO al apagarlo: el barrido es la red de seguridad de los precios. Si el
     * watermark se corrió o el ERP no informó una modificación, el delta pierde ese
     * cambio para siempre y el barrido es lo único que lo arrastra. Apagarlo deja
     * los precios de las listas dependiendo de que el ERP informe bien siempre.
     *
     * El precio BASE no se ve afectado por este flag: es lo que ve el comprador y
     * el barrido lo garantiza siempre.
     */
    price_lists?: boolean;
  };
  /** Aborta sin escribir si el delta pretende cambiar más de este % del catálogo. Default 40. */
  max_change_pct?: number;
  /**
   * Espejar el estado de publicación del ERP sobre productos que YA existen, en
   * las dos direcciones: publicable en el ERP → `published`, no publicable →
   * `draft`. Default false.
   *
   * Apagado por default porque prenderlo en una instalación existente puede
   * despublicar catálogo, y esa es una decisión del cliente y no un efecto
   * colateral de actualizar la extensión. Sin esto, `only_published` sigue siendo
   * lo que siempre fue: un filtro de entrada que saltea el artículo sin tocar el
   * producto.
   */
  status_sync?: boolean;
  /**
   * Además despublicar los productos del ERP que NO vinieron en un barrido
   * completo (artículo BORRADO de la gestión, que no llega ni con los flags en
   * false). Default false. Requiere `status_sync`.
   *
   * Solo actúa en `full_sweep`: en un delta "no vino" significa "no cambió", así
   * que aplicarlo ahí vaciaría la tienda cada 15 minutos.
   */
  status_sync_unpublish_missing?: boolean;
  /**
   * No despublica NADA si el plan pretende despublicar más de este % de los
   * artículos que trajo el ERP. Default 10.
   *
   * La asimetría es deliberada: publicar de más se revierte desde el admin, pero
   * despublicar de más es venta perdida sin que nadie se entere. Un
   * `publica_en_ecommerce` que Zeus mande vacío por un bug propio no puede bajar
   * la tienda a las 4 de la mañana.
   */
  max_unpublish_pct?: number;
  /** Artículos por tanda de escritura. Default 200. */
  write_chunk_size?: number;
  /** Watermark: máximo `modified_at` visto en la última corrida exitosa. Lo escribe el motor. */
  last_synced_at?: string | null;
  /**
   * Cuándo terminó bien el último barrido completo. Lo escribe el motor.
   *
   * Existe para que el barrido diario sea UNO: la condición vieja era solo
   * `getHours() === full_sweep_hour`, y con el cron cada 15 minutos eso daba
   * cuatro barridos completos por noche (4:00, 4:15, 4:30, 4:45).
   */
  last_full_sweep_at?: string | null;
};

/** Estado de publicación con el que nacen los productos que crea el catalog sync. */
export type ErpCreatedProductStatus = 'draft' | 'published';

/** Campos de producto/variante que el catalog sync sabe actualizar. */
export type ErpProductField =
  | 'title'
  | 'description'
  | 'weight'
  | 'length'
  | 'height'
  | 'width'
  | 'barcode'
  | 'category'
  | 'brand'
  | 'family';

/** Allowlist por default: dimensiones y metadatos, nunca contenido editorial. */
export const DEFAULT_PRODUCT_FIELDS: ErpProductField[] = [
  'weight',
  'length',
  'height',
  'width',
  'barcode',
  'brand',
  'family',
];

export const DEFAULT_CATALOG_SYNC_SETTINGS = {
  currency_code: 'ars',
  base_list_index: 1,
  only_published: true,
  create_products: false,
  created_product_status: 'draft',
  categories_sync: false,
  categories_sync_rank: false,
  brands_sync: false,
  brands_replace_existing: true,
  overlap_minutes: 30,
  full_sweep_hour: 4,
  max_change_pct: 40,
  status_sync: false,
  status_sync_unpublish_missing: false,
  max_unpublish_pct: 10,
  write_chunk_size: 200,
} as const;

/**
 * Settings del adapter Contabilium (Argentina). Los IDs (depósito, punto de
 * venta, cliente consumidor final) salen de la cuenta: ver
 * `docs/recipes/erp-contabilium.md` para cómo encontrarlos vía API.
 */
export type ErpContabiliumSettings = {
  /** Base de la API; default https://rest.contabilium.com. */
  base_url?: string;
  /** Depósito/inventario para stock y ventas (IDInventario). REQUERIDO para notificar ventas; sin él el stock suma todos los depósitos. */
  deposito_id?: number | null;
  /**
   * Qué crea cada venta: `orden_venta` (default, registra la venta SIN
   * facturar) o `factura_cobrada` (emite factura electrónica cobrada —
   * requiere FE habilitada y punto de venta).
   */
  sale_mode?: 'orden_venta' | 'factura_cobrada';
  /** Punto de venta para factura_cobrada (ID de /api/puntosdeventa/search). */
  punto_venta_id?: number | null;
  /** Tipo de comprobante para factura_cobrada; default 'FCB'. */
  tipo_fc?: string;
  /** Condición de venta del comprobante; default 'Contado'. */
  condicion_venta?: string;
  /** Cliente genérico ("Consumidor Final") para órdenes sin documento fiscal. */
  default_client_id?: number | null;
  /** SKU de un concepto "envío": las órdenes de venta no aceptan ítems libres. */
  shipping_concept_sku?: string | null;
  /** Los precios de Medusa incluyen IVA (neto = precio / (1+tax_rate)). Default true. */
  prices_include_tax?: boolean;
  /** Alícuota para calcular netos (y el campo Iva de la factura). Default 0.21. */
  tax_rate?: number;
};

/**
 * Settings del adapter Bsale (Chile). Los IDs numéricos (sucursal, tipo de
 * documento, forma de pago, impuestos) salen de la cuenta Bsale del cliente:
 * ver `docs/recipes/erp-bsale.md` para cómo encontrarlos vía API.
 */
export type ErpBsaleSettings = {
  /** Base de la API; default https://api.bsale.io (Chile). */
  base_url?: string;
  /** Sucursal para leer stock y emitir documentos. Sin esto el stock suma todas las sucursales. */
  office_id?: number | null;
  /** Tipo de documento a emitir por venta (boleta electrónica / nota de venta). REQUERIDO para notificar ventas. */
  document_type_id?: number | null;
  /** Lista de precios del documento (opcional; Bsale usa la default de la sucursal). */
  price_list_id?: number | null;
  /** Forma de pago del documento; sin esto el documento se emite sin pagos. */
  payment_type_id?: number | null;
  /** IDs de impuestos de cada línea; default [1] (IVA 19% en cuentas estándar). */
  tax_ids?: number[];
  /** 1 = declarar el documento al SII. Default false (probar primero con nota de venta). */
  declare_sii?: boolean;
  /** 1 = descontar stock en Bsale al emitir. Default false (patrón aec-chile). */
  dispatch_stock?: boolean;
  /** 1 = Bsale envía el documento por email al cliente. Default false. */
  send_email?: boolean;
  /** Los precios de Medusa incluyen IVA (netUnitValue = precio / (1+tax_rate)). Default true. */
  prices_include_tax?: boolean;
  /** Tasa de IVA para calcular el neto. Default 0.19. */
  tax_rate?: number;
};

/**
 * Settings del adapter Zeus ERP (Argentina). Los códigos (sucursal, depósito,
 * condición de venta, tarjetas, categorías de IVA) salen de la cuenta: ver
 * `docs/recipes/erp-zeus.md` para cómo encontrarlos vía API.
 */
export type ErpZeusSettings = {
  /** Base de la API; default https://api.zeuserp.tech/api-ecommerce. */
  base_url?: string;
  /** Identificador del ecommerce en Zeus (query `ecommerce` de /pedidos y /clientes). */
  ecommerce_id?: string | null;
  /** Sucursal del pedido (código de /sucursales). */
  sucursal?: number | null;
  /** Depósito del pedido; también filtra el stock a ese depósito (código de /depositos). */
  deposito_id?: number | null;
  /** Punto de venta del pedido. */
  pto_vta?: number | null;
  /** Lista de precios del pedido/cliente. */
  cod_lista?: number | null;
  /** Condición de venta (código de /condiciones-ventas). */
  cond_venta?: string | null;
  /** Tipo de comprobante del pedido (según la cuenta Zeus). */
  tipo_comp?: string | null;
  /** Vendedor asignado al pedido (código de /vendedores). */
  codigo_de_vendedor?: string | null;
  /** Cliente genérico ("Consumidor Final") para órdenes sin documento fiscal. */
  default_client_code?: string | null;
  /** Crear el cliente en Zeus cuando no existe (search por doc/email). Default true. */
  create_clients?: boolean;
  /** Categoría de IVA al crear clientes (de /categorias-iva). Default 5 (Consumidor Final). */
  default_codigo_iva?: number | null;
  /** Código de un artículo "envío" para incluir el costo como ítem del pedido. */
  shipping_item_code?: string | null;
  /** Informar el medio de pago en el pedido (requiere tipo_pago). Default true. */
  send_payments?: boolean;
  /** Tipo de pago del pedido según la cuenta Zeus (sin esto no se informan pagos). */
  tipo_pago?: string | null;
  /** Código de tarjeta (de /tarjetas) cuando el tipo de pago lo requiere. */
  tarjeta_code?: string | null;
  /**
   * Limitar el sync a artículos publicables en ecommerce. Se filtra EN CÓDIGO
   * sobre `activo` + `publica_en_ecommerce`: el query param `eshop` de Zeus es
   * ignorado por la API (verificado — devuelve la respuesta byte-idéntica).
   * Default false.
   */
  eshop_only?: boolean;
  /** Disponible = stock − comprometido (reservas de Zeus). Default true. */
  subtract_committed?: boolean;
  /** Los precios de Medusa incluyen IVA (neto = precio / (1+tax_rate)). Default true. */
  prices_include_tax?: boolean;
  /**
   * Alícuota de FALLBACK para calcular netos al notificar una venta. Default 0.21.
   * La alícuota real es POR ARTÍCULO (el catálogo del cliente tiene 3428 al 21% y
   * 10 al 10.5%): el catalog sync la guarda en `variant.metadata.zeus_por_iva` y
   * `notifySale` la usa por línea, cayendo a este valor solo si falta.
   */
  tax_rate?: number;
};

/**
 * Sistema tintométrico (entonado de bases en el storefront).
 *
 * Arranca APAGADO: sin `enabled` las rutas store responden como si la feature no
 * existiera, así que se puede mergear todo antes de que el cliente cargue la
 * carta de colores y las fórmulas.
 */
export type ErpTintingSettings = {
  /** Master switch. Default false. */
  enabled?: boolean;
  /** Carta que ofrece el storefront cuando la base no define una. */
  default_collection?: string | null;
  /**
   * El `total` de `formulaTintometrico` ya incluye IVA. Default true, y está
   * MEDIDO: cotizando la misma fórmula sobre los tres tamaños de una línea, el
   * sobreprecio por litro sólo es constante tratando `total` como bruto (ver el
   * detalle en `tinting/normalize-quote.ts`). El flag queda para el caso de que
   * otra instalación de Zeus esté configurada al revés.
   */
  total_includes_tax?: boolean;
  /** TTL de la caché de cotizaciones, en segundos. Default 900. */
  price_cache_ttl_s?: number;
  /**
   * Generación de la caché. Se incrementa para invalidar en masa (el módulo de
   * caché no tiene borrado por prefijo): las claves viejas quedan inalcanzables
   * y expiran solas.
   */
  price_cache_gen?: number;
  /** Tope de envases que acepta la ruta pública de cotización. Default 12. */
  max_quantity?: number;
};

export const DEFAULT_TINTING_SETTINGS = {
  enabled: false,
  total_includes_tax: true,
  price_cache_ttl_s: 900,
  price_cache_gen: 0,
  max_quantity: 12,
} as const;

/**
 * Settings del adapter Odoo (self-hosted / cloud). El uid y la API Key salen
 * de la cuenta: ver `docs/recipes/erp-odoo.md` para el flujo de generación
 * (Preferences → Account Security → New API Key).
 *
 * v1 usa `execute_kw` sobre modelos base de `stock` + `product` — no requiere
 * módulos comerciales (`sale_management`, `account`). Los IDs de compañía son
 * INTs de Odoo (no external ids); vacío = usar la compañía activa del user.
 */
export type ErpOdooSettings = {
  /** Base absoluta de la instancia; ej. `http://localhost:8069`. Sin trailing slash. */
  base_url?: string;
  /** Nombre de la base de datos Odoo; ej. `mercatto-dev`. */
  db?: string;
  /** ID numérico del usuario (`res.users.id`) que ejecuta las llamadas. */
  uid?: number;
  /**
   * Multi-empresa: se manda como `context.allowed_company_ids`. Vacío o
   * ausente = Odoo usa la compañía activa del usuario.
   */
  allowed_company_ids?: number[];
  /** Timeout por request en ms; default 30000. */
  timeout_ms?: number;
  /**
   * SKU (`product.product.default_code`) del artículo Odoo usado para facturar
   * el envío como una línea extra en el `sale.order`. Vacío/ausente = el
   * costo de envío queda como nota en el pedido (no aparece como ítem).
   *
   * Se usa SKU (no ID) porque los IDs de Odoo cambian entre instancias
   * (dev/prod), y el SKU es lo que un administrador de Odoo puede leer sin
   * abrir la base.
   */
  shipping_item_code?: string | null;
  /**
   * Auto-confirmar el `sale.order` (pasa de "quotation" a "sales order"
   * ejecutando `action_confirm`). Default true — es el comportamiento
   * esperado cuando la venta ya fue cobrada en Medusa y no requiere revisión
   * manual en Odoo. `false` deja la orden en estado `draft` (quotation) para
   * que un operador la confirme desde Odoo.
   */
  auto_confirm?: boolean;
  /**
   * Solo trae `product.template` con `is_published=true` (flag del módulo
   * `website_sale`, marca publicación en el storefront de Odoo eCommerce).
   * Default `false` — sin filtro, se sincroniza todo template con
   * `sale_ok=true`.
   *
   * Prender en clientes que ya operan Odoo eCommerce: el catálogo real es
   * el subset publicado, y el resto tiende a ser data interna con
   * `list_price=1` (default de Odoo). Requiere `website_sale` instalado; si
   * no está, la query falla con "Field is_published does not exist".
   */
  only_published?: boolean;
};

export type ErpConfigSettings = {
  /** Stock location destino del sync; si falta se usa la más antigua (con warning si hay varias). */
  stock_location_id?: string | null;
  stock_sync?: ErpStockSyncSettings;
  catalog_sync?: ErpCatalogSyncSettings;
  outbox?: ErpOutboxSettings;
  sales_notify?: ErpSalesNotifySettings;
  contabilium?: ErpContabiliumSettings;
  bsale?: ErpBsaleSettings;
  zeus?: ErpZeusSettings;
  odoo?: ErpOdooSettings;
  tinting?: ErpTintingSettings;
};

/** Documento fiscal del comprador según la capa país. */
export type ErpFiscalDocument = {
  type: string | null;
  number: string | null;
};

/**
 * Payload de venta que se persiste en la outbox y recibe el adapter.
 * Construido por ALLOWLIST desde la orden: acá nunca entran tokens ni
 * `payment.data` del provider.
 */
export type ErpSalePayload = {
  event_key: string;
  order_id: string;
  /**
   * Depósito facturador de ESTA orden, resuelto al encolar. Gana sobre el
   * depósito de la config del provider (en Zeus, `zeus.deposito_id`).
   *
   * `null`/ausente = usar el de la config (es lo que pasa con el trigger
   * `payment_captured`, donde no hay confirmación de depósito).
   */
  billing_deposito?: string | null;
  display_id: number | null;
  created_at: string | null;
  country_code: string;
  currency_code: string;
  customer: {
    id: string | null;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    document: ErpFiscalDocument;
  };
  items: Array<{
    sku: string | null;
    title: string | null;
    quantity: number;
    unit_price: number;
    total: number;
    /**
     * Alícuota de IVA del artículo en PORCENTAJE (21, 10.5), tomada de
     * `variant.metadata.zeus_por_iva` cuando el catalog sync la dejó. `null` →
     * el adapter cae a su `tax_rate` global.
     */
    tax_rate?: number | null;
    /**
     * Preparación tintométrica de la línea, tomada de `metadata.tint` del line
     * item. `null`/ausente = línea normal. Opcional a propósito: los adapters
     * que no entienden tintometría (bsale, contabilium) la ignoran y su payload
     * queda idéntico.
     */
    tint?: {
      /** `codigo_base` del `ComprobanteItemDto`. */
      cod_base: string;
      /** `codigo_formula` del `ComprobanteItemDto` (como lo muestra Gestión). */
      cod_formula: string;
      color_code?: string | null;
      color_name?: string | null;
    } | null;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
  };
  payment: {
    provider_id: string | null;
    captured_amount: number | null;
    currency_code: string | null;
  };
  shipping: {
    method: string | null;
    address: {
      street: string | null;
      city: string | null;
      province: string | null;
      postal_code: string | null;
      country_code: string | null;
    };
  };
  /**
   * Escuela/institución dueña de la tienda desde la que se hizo la compra.
   * Presente sólo cuando el `sales_channel_id` de la orden mapea a un
   * `demo_store` con `policy.recipients.enabled` (chequeo real: existe snapshot
   * en `site_checkout_snapshot` vía `order_cart`). Ausente/`null` en la tienda
   * principal — mismo payload que hoy para adapters que no lo consumen.
   *
   * `external_ref` es hoy el `slug` del `demo_store`. Si el negocio necesita
   * renombrar el slug sin romper la trazabilidad en el ERP, agregar una columna
   * dedicada `demo_store.external_ref` inmutable y cambiar la fuente acá.
   */
  school?: {
    external_ref: string;
    name: string;
    source_site_id: string;
  } | null;
  /**
   * Asignación de productos a alumnos, agrupada por SKU y con `quantity` por
   * destinatario para preservar la split del checkout (ej. 2 unidades del kit
   * de robótica → 1 para Juan, 1 para Martina). El `schema_version` es explícito
   * para poder evolucionar el contrato sin romper la persistencia en Odoo.
   *
   * Presente sólo cuando hay snapshot; los ítems sin destinatario (líneas que
   * el step Alumnos no cubre) NO se listan acá — el ERP los ve como líneas
   * comunes sin recipients.
   *
   * `external_id` es el id que nuestro storefront genera con `crypto.randomUUID()`
   * al alta del alumno. NO usar `document` como identidad: puede venir vacío y
   * puede repetirse entre alumnos en carritos distintos.
   */
  student_assignments?: {
    schema_version: '1.0';
    items: Array<{
      sku: string;
      quantity: number;
      recipients: Array<{
        external_id: string;
        first_name: string;
        last_name: string;
        document: string | null;
        grade: string | null;
        quantity: number;
      }>;
    }>;
  } | null;
};
