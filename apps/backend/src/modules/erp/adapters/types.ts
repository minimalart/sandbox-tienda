import type { Logger } from '@medusajs/framework/types';
import type { ErpSalePayload } from '../types';
import type { ErpConfigLookups } from './config-lookups';

export type {
  ErpConfigLookupKind,
  ErpConfigLookupOption,
  ErpConfigLookups,
} from './config-lookups';

/**
 * Contrato común de los adapters ERP. El core de la extensión pregunta por
 * capabilities en lugar de asumir métodos disponibles; cada adapter concentra
 * el "cómo hablar" con su ERP (auth, endpoints, rate limits, formatos).
 */

export type ErpCapabilities = {
  /** Puede leer stock por SKU (habilita el stock sync). */
  stock_pull: boolean;
  /** Puede recibir notificaciones de venta. */
  sale_notify: boolean;
  /** Máximo de SKUs por llamada a `getStockBySku`. */
  stock_batch_size: number;
  /** Puede leer el catálogo (productos + precios) — habilita el catalog sync. */
  catalog_pull: boolean;
  /**
   * Los precios que devuelve `getCatalogChanges` ya vienen con impuestos
   * incluidos y en la moneda de la tienda. Zeus: `true` (verificado — el ratio
   * contra el neto de `/articulos/search` es exactamente `1 + por_iva/100`, y
   * el FX de los artículos en USD ya viene aplicado). Un ERP que devuelva netos
   * declara `false` y el planner aplica `tax_rate` por fila.
   */
  catalog_prices_include_tax: boolean;
  /**
   * Puede leer el árbol de categorías del ERP — habilita el espejo de
   * categorías en `product_category`. Un ERP que solo expone el código de
   * categoría por artículo (sin nombres) declara `false`: crear el árbol con
   * códigos crudos llenaría el storefront de categorías ilegibles.
   */
  categories_pull: boolean;
  /**
   * Puede cotizar una preparación tintométrica (base + fórmula) — habilita el
   * flujo de entonado en el storefront. Zeus: `true`
   * (`GET /articulos/formulaTintometrico`). Los demás ERPs del registry no
   * tienen el concepto.
   */
  tinting_price: boolean;
  /**
   * Puede devolver la imagen de un artículo — habilita la fase de imágenes del
   * catalog sync. Zeus: `true` (`GET /articulos/imagen`, que EXIGE el Bearer:
   * sin header devuelve 500, así que no es hotlinkeable desde el storefront).
   */
  product_images: boolean;
  /**
   * Puede recuperar el comprobante que el ERP emitió por una venta — habilita
   * el poll `invoice_fetch` del outbox y la descarga del PDF.
   *
   * Es una capability aparte de `sale_notify` porque son dos cosas distintas:
   * `notifySale` inserta el pedido y devuelve una referencia, pero el ERP
   * factura DESPUÉS y por su cuenta. Zeus: `true`
   * (`GET /pedidos/pedidoFacturado` + `GET /imprimirComprobante`). Bsale y
   * Contabilium emiten el documento en la misma llamada de venta y no tienen
   * este flujo, así que declaran `false`.
   */
  invoice_fetch: boolean;
  /**
   * Puede listar las opciones válidas de los campos de configuración cuyo valor
   * es un código de la cuenta del ERP (sucursal, depósito, condición de venta,
   * vendedor, categoría de IVA, tarjeta) — habilita los selectores de la
   * pantalla de configuración en lugar de inputs de texto libre.
   *
   * Zeus: `true`. Los demás declaran `false` y su pantalla sigue igual que hoy:
   * la capability existe justamente para que un ERP sin estos listados no
   * quede con seis selectores vacíos.
   */
  config_lookups: boolean;
};

/** Contexto por llamada: credenciales ya descifradas + settings + país. Los adapters son stateless. */
export type AdapterContext = {
  credentials: Record<string, string>;
  settings: Record<string, unknown>;
  countryCode: string;
  logger: Logger;
};

/** Resultado crudo del ERP por SKU. `quantity` se valida/normaliza en el sync, no acá. */
export type ErpStockResult = {
  found: boolean;
  /** Disponible TOTAL del artículo (suma de depósitos, según settings). */
  quantity?: unknown;
  /**
   * Disponible por depósito del ERP, indexado por su código como string.
   *
   * Permite mapear cada depósito a una stock location distinta de Medusa en vez
   * de colapsar todo en un número: sin esto, un negocio con sucursales pierde de
   * qué depósito es cada unidad, y escribir el total en varias locations
   * MULTIPLICARÍA el stock. Los adapters sin depósitos lo omiten y el sync cae al
   * total.
   */
  by_deposito?: Record<string, unknown>;
};

export type ErpValidationResult = {
  ok: boolean;
  message?: string;
};

export type ErpSaleResult = {
  status: 'sent' | 'duplicate';
  external_ref?: string;
  response?: unknown;
  /**
   * Sucursal emisora con la que se insertó el pedido. Hace falta para volver a
   * preguntar por el comprobante: en Zeus, `pedidoFacturado` e
   * `imprimirComprobante` piden `idtransac` + `sucursal`, y la sucursal podría
   * cambiar en la config entre la venta y el poll.
   */
  sucursal?: number | null;
};

/**
 * Estado de facturación de una venta en el ERP.
 *
 * `invoiced: false` NO es un error: significa "el ERP todavía no facturó". El
 * processor del outbox lo trata como reintento con el presupuesto largo de
 * `invoice_fetch` (ver `ErpOutboxSettings`).
 */
export type ErpInvoiceStatus = {
  invoiced: boolean;
  numero_comp?: number | null;
  tipo_comp?: string | null;
  letra?: string | null;
  punto_de_venta?: number | null;
  sucursal?: number | null;
  /** Tal cual lo informa el ERP; no se reinterpreta la zona horaria. */
  fecha?: string | null;
  total?: number | null;
  /** Respuesta cruda, para auditar sin volver a preguntar. */
  raw?: unknown;
};

/** PDF del comprobante, en BYTES (el endpoint del ERP exige auth: no es linkeable). */
export type ErpInvoicePdf = {
  content: Buffer;
  mime_type: string;
};

/**
 * Fila de catálogo NEUTRAL de ERP (producto + precios + metadatos). Cada adapter
 * traduce su DTO propio a esta forma para que el motor de sync no sepa nada de
 * Zeus/Contabilium/Bsale.
 *
 * `prices` está indexado por el número de lista del ERP (en Zeus: `precio0..9`),
 * porque el mapeo "qué lista del ERP es el precio base y cuáles son price lists"
 * es configuración del cliente, no del adapter.
 */
export type ErpCatalogRow = {
  /** Código del artículo en el ERP. Se matchea contra `variant.sku`. */
  code: string;
  title: string | null;
  description: string | null;
  /** Precio por índice de lista del ERP. `null`/0 = esa lista no aplica al artículo. */
  prices: Record<number, number | null>;
  /** Alícuota de IVA del artículo en porcentaje (21, 10.5). Por artículo, NO global. */
  tax_rate: number | null;
  /** El ERP lo marca publicable en ecommerce. */
  published: boolean;
  /** El ERP lo marca activo (un artículo dado de baja llega con `false`). */
  active: boolean;
  /** Código de categoría del ERP (en Zeus, jerárquico por prefijo). */
  category_code: string | null;
  brand: string | null;
  family: string | null;
  /**
   * Código de barras REAL (EAN/UPC/GTIN), el que se escanea. `null` cuando el ERP
   * no lo expone.
   *
   * OJO: no meter acá códigos internos de fábrica, proveedor o equivalencia. Este
   * valor va al campo `barcode` de la variante, que es lo que usa el checkout por
   * escáner: un código que no es de barras hace que el escáner matchee el producto
   * equivocado. Para esos códigos internos está `factory_code`.
   */
  barcode: string | null;
  /**
   * El ERP mandó algo en el campo de código de barras pero no era un GTIN válido,
   * con el motivo. `barcode` queda en `null` y el sync lo deja como warning en el
   * log: en varios ERPs el barcode vive en un campo de notas de texto libre, así
   * que "vino con basura" es un caso normal que hay que poder ver, no un error.
   */
  barcode_rejected?: string;
  /** Código interno de fábrica/referencia del ERP. Va a metadata, NUNCA a `barcode`. */
  factory_code: string | null;
  weight: number | null;
  length: number | null;
  height: number | null;
  width: number | null;
  /**
   * Última modificación según el ERP, tal cual la devuelve (Zeus: hora local
   * naive `AAAA-MM-DD hh:mm:ss.SSS`). Es la fuente del watermark, así que no se
   * reinterpreta acá.
   */
  modified_at: string | null;
};

/**
 * Nodo de categoría NEUTRAL del ERP, ya APLANADO (los padres siempre aparecen
 * antes que sus hijos) y normalizado. Cada adapter traduce su forma propia
 * (Zeus: árbol anidado con `categorias_hijas`) a esta lista.
 */
export type ErpCategoryNode = {
  /** Código del ERP, MAYÚSCULAS. Matchea `ErpCatalogRow.category_code`. */
  code: string;
  name: string;
  /** `null` = raíz. El nodo padre siempre aparece antes en la lista. */
  parent_code: string | null;
  /** Posición entre hermanos según el ERP (0-based). */
  rank: number;
  /** Profundidad, 0 = raíz. */
  level: number;
  /** Imagen del nodo si el ERP la expone (Zeus: `foto`). Hoy solo informativa. */
  image_url: string | null;
};

/**
 * Imagen de un artículo tal cual la devuelve el ERP, en BYTES.
 *
 * Se lleva el binario y no una URL a propósito: el endpoint de imágenes de Zeus
 * exige el `Authorization: Bearer`, así que la URL no le sirve a nadie del lado
 * del navegador. El sync la sube al File module y usa la URL pública que sale de
 * ahí.
 */
export type ErpProductImage = {
  content: Buffer;
  /** MIME informado por el ERP, o inferido de los magic bytes. */
  mime_type: string;
  /** Extensión para el nombre de archivo, sin punto (`jpg`, `png`, `webp`). */
  extension: string;
};

/**
 * Consulta de precio tintométrico. Los cuatro campos son los parámetros de
 * `GET /articulos/formulaTintometrico`, con los tipos que la API REALMENTE
 * exige: `list_index` y `quantity` son ENTEROS (el Swagger los tipa `string` en
 * el endpoint V1, pero mandar `1.0` devuelve 400 `For input string: "1.0"`).
 */
export type ErpTintingPriceQuery = {
  /** `codBase`: código del artículo base en el ERP (= SKU en Medusa). */
  base_code: string;
  /** `codFormula`: código de fórmula. El adapter lo normaliza antes de mandarlo. */
  formula_code: string;
  /** `lista`: índice de lista de precios del ERP. En Zeus es el mismo N de `precioN`. */
  list_index: number;
  /** `cantidad`: envases de base. Entero ≥ 1. */
  quantity: number;
};

/**
 * Respuesta CRUDA del ERP, sin interpretar. La normalización (unitario vs total,
 * IVA, desglose del sobreprecio) vive en `tinting/normalize-quote.ts` para que la
 * semántica tenga un solo dueño y el adapter sólo hable HTTP.
 */
export type ErpTintingPriceRaw = {
  /** `codigobase` que devolvió el ERP (puede diferir en formato del que se mandó). */
  base_code: string;
  /** `codigoformulaho`: el código de fórmula como lo muestra el ERP (con espacios). */
  formula_code: string;
  /** `total`: total de la línea para `quantity` envases. */
  total: number;
  /** `poriva`: alícuota en porcentaje, o null si no vino. */
  tax_rate: number | null;
};

export interface ErpAdapter {
  readonly provider: string;
  getCapabilities(): ErpCapabilities;
  validateCredentials(ctx: AdapterContext): Promise<ErpValidationResult>;
  getStockBySku(skus: string[], ctx: AdapterContext): Promise<Map<string, ErpStockResult>>;
  notifySale(payload: ErpSalePayload, ctx: AdapterContext): Promise<ErpSaleResult>;
  /**
   * Catálogo modificado desde `since` (null = todo). Opcional: los adapters que
   * no lo implementan declaran `catalog_pull: false` y el motor no los llama.
   */
  getCatalogChanges?(since: string | null, ctx: AdapterContext): Promise<ErpCatalogRow[]>;
  /**
   * Árbol completo de categorías del ERP, aplanado. Opcional: los adapters que
   * no lo implementan declaran `categories_pull: false`.
   */
  fetchCategories?(ctx: AdapterContext): Promise<ErpCategoryNode[]>;
  /**
   * Cotiza una preparación tintométrica. Opcional: los adapters que no lo
   * implementan declaran `tinting_price: false` y nadie los llama.
   *
   * Lanza `ErpTintingFormulaNotFoundError` cuando el ERP no conoce la
   * combinación (data maestra faltante, no falla del sistema).
   */
  getTintingPrice?(query: ErpTintingPriceQuery, ctx: AdapterContext): Promise<ErpTintingPriceRaw>;
  /**
   * Imagen principal de un artículo. Opcional: los adapters que no la
   * implementan declaran `product_images: false`.
   *
   * Devuelve `null` cuando el ERP simplemente NO tiene imagen para ese código
   * (en la cuenta real de Zeus son 878 de 2.547 artículos). Eso no es un error y
   * no debe contar como fallo: un ERP incompleto es el estado normal.
   */
  fetchProductImage?(code: string, ctx: AdapterContext): Promise<ErpProductImage | null>;
  /**
   * ¿El ERP ya facturó esta venta? Opcional: los adapters que no lo implementan
   * declaran `invoice_fetch: false`.
   *
   * Devolver `{ invoiced: false }` es una respuesta VÁLIDA y esperada — el ERP
   * puede facturar por lote horas después. Sólo se lanza si la consulta falla.
   */
  fetchInvoiceStatus?(
    args: { externalRef: string; sucursal?: number | null },
    ctx: AdapterContext
  ): Promise<ErpInvoiceStatus>;
  /** PDF del comprobante ya emitido. Opcional, va de la mano de `fetchInvoiceStatus`. */
  fetchInvoicePdf?(
    args: { externalRef: string; sucursal?: number | null; tipoComp: string },
    ctx: AdapterContext
  ): Promise<ErpInvoicePdf | null>;
  /**
   * Opciones válidas de los campos de configuración que son un código de la
   * cuenta del ERP. Opcional: los adapters que no lo implementan declaran
   * `config_lookups: false` y nadie los llama.
   *
   * **No lanza si un listado falla**: devuelve los que pudo y el motivo de cada
   * uno en `errors`. Un listado caído tiene que degradar SU campo a texto libre
   * —que es el estado actual— y no tumbar la pantalla de configuración entera,
   * que es desde donde se arregla el problema.
   */
  fetchConfigLookups?(ctx: AdapterContext): Promise<ErpConfigLookups>;
}

/** El ERP no respondió / red caída. El stock sync aborta sin escribir nada. */
export class ErpConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErpConnectionError';
  }
}

/** Credenciales inválidas/expiradas. Mismo tratamiento que conexión, con mensaje distinto. */
export class ErpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErpAuthError';
  }
}

/**
 * Error NO reintentable (PRD §14: payload inválido / 4xx de validación →
 * dead_letter directo). El processor del outbox lo manda a `dead_letter` sin
 * quemar reintentos: reintentar no lo va a arreglar — hay que corregir la
 * config o el payload y reintentar a mano.
 */
export class ErpNonRetryableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErpNonRetryableError';
  }
}

/**
 * El ERP no conoce la combinación base + fórmula tintométrica (Zeus: 409 "La
 * fórmula X no existe en Zeus Gestión."). Es data maestra faltante, no una falla
 * del sistema: la ruta store lo traduce a 422 y la UI ofrece la base sin
 * entonar. Subclase de `ErpNonRetryableError` para no cambiar el comportamiento
 * de nada que ya discrimine por esa clase (p.ej. el processor del outbox).
 */
export class ErpTintingFormulaNotFoundError extends ErpNonRetryableError {
  constructor(
    message: string,
    readonly formulaCode?: string,
    readonly baseCode?: string
  ) {
    super(message);
    this.name = 'ErpTintingFormulaNotFoundError';
  }
}
