import type { ErpSalePayload, ErpZeusSettings } from '../types';
import { checkBarcode } from '../barcode';
import { classifyTintingError } from '../tinting/classify-error';
import { normalizeFormulaCode } from '../tinting/formula-code';
import {
  ErpAuthError,
  ErpConnectionError,
  ErpNonRetryableError,
  type AdapterContext,
  type ErpAdapter,
  type ErpCapabilities,
  type ErpCatalogRow,
  type ErpCategoryNode,
  type ErpInvoicePdf,
  type ErpInvoiceStatus,
  type ErpProductImage,
  type ErpSaleResult,
  type ErpStockResult,
  type ErpTintingPriceQuery,
  type ErpTintingPriceRaw,
  type ErpValidationResult,
} from './types';

/**
 * Adapter Zeus ERP (ERP argentino, api.zeuserp.tech), implementado contra su
 * API Ecommerce (Swagger 2.0, /api-ecommerce/v2/api-docs, v2.85.x):
 *
 * - Auth: JWT estático que entrega Zeus por cuenta (no hay endpoint de login
 *   en esta API) → header `Authorization: Bearer <jwt>` en cada request.
 *   Credencial write-only: `jwt_token`. Validación vía
 *   `GET /health-check/api-zeus` (verifica api-zeus + usuario del JWT).
 * - Stock: `GET /articulos/getbyID?codigos_articulos=` con pocos SKUs
 *   (comma-separated) o barrido paginado de `GET /articulos/stock` para el
 *   catálogo completo. Ambos traen `stock` + `stock_por_deposito`
 *   (`{deposito, stock, comprometido, acopiado}`); disponible =
 *   stock − comprometido (configurable), filtrable por depósito.
 * - Catálogo: `GET /articulos?fechasincro=` trae producto + `precio0..9` +
 *   stock + `fechahoramodife` en UNA llamada (no hace falta
 *   `/articulos/precios`, que además no devuelve timestamp).
 * - Venta: `POST /pedidos?ecommerce=` con `[ComprobanteDto]` crea un PEDIDO
 *   de venta (Zeus factura internamente). `id_ecommerce = order_id` da
 *   idempotencia real: un reenvío responde 409 ("conflicto por datos ya
 *   existentes") → `duplicate`. El cliente se resuelve por documento/email
 *   (`GET /clientes/search`) y se crea si falta (`POST /clientes`).
 *
 * Comportamientos de la API verificados contra una cuenta real (no están en el
 * Swagger, y varios contradicen lo que uno asumiría):
 * - `page` es 1-based, el tamaño de página es fijo en 1000, y **`page=0`
 *   devuelve el catálogo completo** en una sola respuesta.
 * - `fechasincro` filtra por `fechahoramodife` y acepta
 *   `AAAA-MM-DD hh:mm:ss`. Las fechas son hora local del server (UTC-3) sin
 *   offset, así que el watermark se guarda tal cual viene.
 * - **`eshop=true` es IGNORADO** por la API (respuesta byte-idéntica): el filtro
 *   de publicables se hace en código sobre `publica_en_ecommerce` + `activo`.
 * - **`/articulos` devuelve precios FINALES**: con IVA incluido (la alícuota
 *   propia de cada artículo, `por_iva`) y ya convertidos a la moneda de la
 *   empresa. Contrastado contra `/articulos/search`, que devuelve el neto en la
 *   moneda del artículo: el ratio es exactamente `1 + por_iva/100`.
 * - `ival0..9` es 0 en todo el catálogo → no sirve para deducir el IVA.
 * - **`/health-check/api-zeus` responde 400 "URI is not absolute"** (bug del
 *   server), por eso la validación de credenciales usa `/empresas`.
 * - **Imágenes**: `GET /articulos/imagen?codigo=<codigo>&prioridad=` devuelve el
 *   BINARIO y exige el `Authorization: Bearer` (sin header responde 500), así que
 *   no es hotlinkeable desde el storefront. También acepta el JWT como query
 *   param (`?key=<jwt>`), pero eso pondría en URLs públicas un token que lee el
 *   catálogo, crea clientes y crea pedidos — por eso el sync descarga y re-sube
 *   al File module en vez de linkear.
 *
 * Tintometría (medido 2026-07-29 con la fórmula `00NN 16/000` = color COSMOS
 * sobre la base `113`, ALBACRYL BASE F 3,6 L):
 * - **El `codFormula` va SIN espacios.** Zeus Gestión MUESTRA `00NN 16/000` y
 *   con ese texto la API devuelve 409 "no existe"; `00NN16/000` devuelve 200 y en
 *   la respuesta el código vuelve CON el espacio. Es case-insensitive, pero los
 *   espacios (incluso al borde) rompen.
 * - `total` es el total de la LÍNEA (cantidad 1/2/3/4 → 66352.822 / 132705.645 /
 *   199058.467 / 265411.289) e INCLUYE el precio de la base (`precio1` del 113 es
 *   40585.52 ⇒ el entonado suma 25767.30) y el IVA (medido: la misma fórmula
 *   sobre los tres tamaños de la línea da un sobreprecio por litro constante sólo
 *   en base bruta — ver `tinting/normalize-quote.ts`).
 * - Las fórmulas son por LETRA de base: `00NN16/000` cotiza sobre las bases F
 *   (113 / 119 / 122) y devuelve 409 sobre la 114, que es BASE P.
 * - **`lista` es el mismo índice que `precioN`**: lista 1/2/3 → 66352.822 y
 *   lista 4 → 46446.975, el mismo ratio 0.70 que `precio4/precio1`. Las listas
 *   sin precio devuelven `total: 0.0` con HTTP 200, no un error.
 * - `cantidad` y `lista` son ENTEROS en los dos endpoints (el Swagger los tipa
 *   `string` en V1, pero `1.0` devuelve 400 `For input string: "1.0"`).
 * - Valida `codFormula` ANTES que `codBase`, así que una base inexistente no se
 *   entera si la fórmula tampoco existe.
 * - **`WSArticuloTintometricoV1` no se usa**: responde `"Datos incorrectos."` a
 *   todo (sin decir qué campo) y su `codColor` espera un código de COLOR, tabla
 *   que la API no expone. No hay endpoint que liste colores ni fórmulas: esa data
 *   maestra es nuestra (ver el módulo `tinting/`).
 *
 * Setup completo: docs/recipes/erp-zeus.md.
 */

const DEFAULT_BASE_URL = 'https://api.zeuserp.tech/api-ecommerce';
const PER_CODE_THRESHOLD = 10;
const SWEEP_MAX_PAGES = 2_000;
const REQUEST_TIMEOUT_MS = 30_000;
/** El catálogo completo son ~8 MB: más margen que el resto de las llamadas. */
const CATALOG_TIMEOUT_MS = 120_000;
/**
 * La cotización tintométrica está en el camino interactivo del PDP: 30 s de
 * espera no los tolera nadie. Si Zeus no contesta en 6 s, la UI degrada a "sin
 * precio de entonado" y ofrece la base sin color.
 */
const TINTING_TIMEOUT_MS = 6_000;
const DEFAULT_TAX_RATE = 0.21;
/** Categoría de IVA AFIP habitual para "Consumidor Final" al crear clientes. */
const DEFAULT_CODIGO_IVA = 5;
/** Cantidad de listas de precios que expone Zeus (`precio0`..`precio9`). */
const ZEUS_PRICE_LIST_COUNT = 10;
/**
 * Tope de profundidad al recorrer el árbol de categorías. Zeus usa 3 niveles;
 * esto es un cinturón anti-ciclo, no un límite de negocio.
 */
const MAX_CATEGORY_DEPTH = 6;
/**
 * Timeout de una imagen. Más generoso que una llamada JSON (son cientos de KB)
 * pero muy por debajo del catálogo: la fase baja miles y una sola colgada no
 * puede frenar la cola.
 */
const IMAGE_TIMEOUT_MS = 20_000;
/**
 * Tope por imagen. La corrida real promedió 128 KB (1669 imágenes, 213,8 MB);
 * esto es un cinturón contra una respuesta degenerada, no un límite de negocio.
 */
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
/** Un comprobante son una o dos páginas; más que esto es un error del ERP. */
const MAX_INVOICE_PDF_BYTES = 8 * 1024 * 1024;

type StockPorDeposito = {
  deposito?: number;
  stock?: number;
  comprometido?: number;
  acopiado?: number;
};

type ArticuloRow = {
  codigo?: string;
  stock?: number;
  comprometido?: number;
  stock_por_deposito?: StockPorDeposito[] | null;
};

/**
 * Disponible de un artículo: el total y el desglose por depósito. Se llevan los
 * dos porque el sync elige según cómo esté configurado — con mapeo de depósitos
 * usa el desglose, sin mapeo escribe el total en una sola location.
 */
type ZeusStockRow = {
  quantity: number;
  by_deposito: Record<string, number>;
};

/**
 * `ArticulosDto` de `GET /articulos`, con los campos que consume el catalog
 * sync. Los flags de publicación llegan como STRING ("1"/"0"), no como boolean,
 * y `activo` como número.
 */
type ArticuloCatalogRow = ArticuloRow & {
  descripcion?: string | null;
  descripcion_breve?: string | null;
  descripcion_adicional?: string | null;
  descripcion_ampliada?: string | null;
  por_iva?: number | null;
  activo?: number | null;
  publica_en_ecommerce?: string | number | null;
  categoria?: string | null;
  marca?: string | null;
  familia?: string | null;
  peso?: number | null;
  alto?: number | null;
  ancho?: number | null;
  largo?: number | null;
  codigo_fabrica?: string | null;
  /**
   * Nota de texto libre del artículo. El cliente definió usarla como código de
   * barras, así que se valida antes de escribirla (ver `checkBarcode`).
   *
   * OJO con el nombre: es `notas2` en PLURAL. Medido contra la cuenta real
   * (2026-07-31, 3438 artículos): 1879 tienen valor y 1869 de esos son GTIN
   * válidos (99.5%), así que es el campo correcto. Escrito `nota2` leía
   * `undefined` en el 100% del catálogo y el barcode quedaba siempre en null.
   */
  notas2?: string | number | null;
  fechahoramodife?: string | null;
  /** `precio0`..`precio9` llegan como claves sueltas, no como array. */
  [key: string]: unknown;
};

/**
 * Nodo de `GET /articulos/categorias`. El endpoint no está en el Swagger pero
 * existe y devuelve el árbol COMPLETO con nombres: `id` es el mismo código
 * jerárquico que trae `articulo.categoria` (prefijo de 2 caracteres por nivel,
 * `02` → `020B` → `020101`).
 */
type CategoriaRow = {
  id?: string | null;
  nombre?: string | null;
  foto?: string | null;
  categorias_hijas?: CategoriaRow[] | null;
};
type CategoriasResponse = { categorias?: CategoriaRow[] };

/**
 * `ArticulosTintometricoDto` de `GET /articulos/formulaTintometrico`. `ival` se
 * ignora a propósito: es 0 en la cuenta real, igual que `ival0..9` en los 3438
 * artículos, así que no sirve para deducir el IVA.
 */
type ArticuloTintometricoRow = {
  codigobase?: string | null;
  codigoformulaho?: string | null;
  total?: unknown;
  poriva?: unknown;
  ival?: unknown;
};

type EmpresaRow = { codigo_empresa?: number; descripcion_empresa?: string };
type EmpresasResponse = { status?: string; empresas?: EmpresaRow[] };

type ClienteRow = {
  codigo?: string;
  nombre?: string;
  activo?: boolean;
};

type ComprobanteResponse = {
  idtransac?: number;
  numero_comp?: number;
  sucursal?: number;
  id_ecommerce?: string;
};

/**
 * `CpediVtaComprobantePrincipalDTO` de `GET /pedidos/pedidoFacturado`.
 *
 * Los tipos son deliberadamente laxos (`unknown` en los flags y los numéricos):
 * esta API manda booleanos como string y números como string según el campo, así
 * que todo pasa por `isTruthyFlag` / `toNumberOrNull` antes de usarse.
 */
type ZeusFacturadoResponse = {
  idTransaccion?: unknown;
  numeroComp?: unknown;
  tipoComp?: unknown;
  sucursal?: unknown;
  puntoDeVenta?: unknown;
  letra?: unknown;
  fecha?: unknown;
  total?: unknown;
  isFacturado?: unknown;
  /** Documentos derivados del pedido (ahí puede estar la factura). */
  comprobanteResultado?: ZeusFacturadoResponse[] | null;
};

/** Marca interna del request helper para el 409 idempotente de /pedidos. */
const DUPLICATE = Symbol('zeus-duplicate');

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function sanitizeSku(sku: string): string {
  return sku.replace(/[\r\n]/g, '').trim();
}

/**
 * Zeus espera fechas "AAAA-MM-DD hh:mm:ss" (mismo formato que fechasincro).
 *
 * Los timestamps que devuelve Zeus (`fechahoramodife`) ya vienen en ese formato
 * y en hora local del server, SIN offset. Si el valor entra en ese formato se
 * pasa tal cual: convertirlo con `new Date()` lo interpretaría como hora local
 * del proceso y correría el watermark varias horas.
 */
function formatDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(value)) {
    return value.slice(0, 19).replace('T', ' ');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function toNumberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Los flags de publicación de Zeus llegan como "1"/"0" (string) o número. */
function isTruthyFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return value.trim() === '1' || value.trim().toLowerCase() === 'true';
  return false;
}

/** Número de comprobante de una fila de `pedidoFacturado`, o `null`. */
function numeroOf(row: { numeroComp?: unknown }): number | null {
  const n = toNumberOrNull(row.numeroComp);
  return n !== null && n > 0 ? n : null;
}

/**
 * ¿El binario es un PDF? Se decide por MAGIC BYTES y no por `Content-Type`:
 * cuando el comprobante todavía no existe, esta API contesta 200 con un cuerpo
 * vacío o un JSON, así que el header miente (mismo problema medido con las
 * imágenes del catálogo).
 */
function isPdf(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer.subarray(0, 4).toString('latin1') === '%PDF';
}

/** Publicable = activo en Zeus Y marcado para ecommerce. */
function isPublishable(row: { activo?: unknown; publica_en_ecommerce?: unknown }): boolean {
  return Number(row.activo) === 1 && isTruthyFlag(row.publica_en_ecommerce);
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Único lugar canónico donde se normaliza un código de categoría de Zeus.
 * El catálogo real mezcla mayúsculas y minúsculas para el mismo código ("0A" y
 * "0a", "020D" y "020d"), y el artículo tiene que matchear con el nodo del
 * árbol: si las dos puntas no normalizan igual, la categoría no se asigna.
 */
export function normalizeCategoryCode(value: unknown): string | null {
  return trimOrNull(value)?.toUpperCase() ?? null;
}

/**
 * Descripción del artículo, o `null` si lo que hay no es una descripción.
 *
 * `descripcion_adicional` en el catálogo del cliente NO describe nada: trae el
 * código del fabricante (`"12406"`, `"15349  ex 5275540"`). Sin este filtro ese
 * número terminaba impreso como descripción en el PDP — pasó con las 117 bases
 * entonables, que no tienen `descripcion_ampliada`.
 *
 * Criterio: tiene que haber al menos una palabra de 3+ letras. Alcanza para
 * descartar códigos (incluido el `"N ex N"`, donde "ex" son 2 letras) sin
 * recortar ninguna descripción real: no se edita el texto del ERP, se acepta o se
 * descarta entero.
 */
export function descriptionOrNull(value: unknown): string | null {
  const text = trimOrNull(value);
  if (!text) return null;
  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/.test(text) ? text : null;
}

/**
 * Tipo de imagen por MAGIC BYTES, no por el `Content-Type` de la respuesta.
 *
 * Zeus contesta HTTP 200 con cuerpo vacío o con un JSON de error cuando el
 * artículo no tiene foto, y en varios casos manda `application/octet-stream`
 * para un JPEG perfectamente válido. La cabecera no es confiable; los primeros
 * bytes sí. Un binario que no matchea ningún formato conocido se descarta: subir
 * basura al File module y dejarla como `thumbnail` rompe el PLP entero.
 */
export function sniffImage(bytes: Buffer): { mimeType: string; extension: string } | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  if (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return { mimeType: 'image/gif', extension: 'gif' };
  }
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { mimeType: 'image/bmp', extension: 'bmp' };
  }
  return null;
}

/** `ArticulosDto` → fila neutral de catálogo. */
function toCatalogRow(code: string, row: ArticuloCatalogRow): ErpCatalogRow {
  const prices: Record<number, number | null> = {};
  for (let i = 0; i < ZEUS_PRICE_LIST_COUNT; i++) {
    const raw = toNumberOrNull(row[`precio${i}`]);
    // 0 en Zeus significa "esta lista no aplica al artículo", no "gratis".
    prices[i] = raw !== null && raw > 0 ? raw : null;
  }
  const barcode = checkBarcode(row.notas2);

  return {
    code,
    title: trimOrNull(row.descripcion),
    description:
      descriptionOrNull(row.descripcion_ampliada) ?? descriptionOrNull(row.descripcion_adicional),
    prices,
    tax_rate: toNumberOrNull(row.por_iva),
    published: isTruthyFlag(row.publica_en_ecommerce),
    active: Number(row.activo) === 1,
    category_code: normalizeCategoryCode(row.categoria),
    brand: trimOrNull(row.marca),
    family: trimOrNull(row.familia),
    // Zeus no tiene un campo propio de codigo de barras (no hay
    // barra/barcode/ean/gtin en todo el spec), asi que el cliente definio usar
    // `notas2` del servicio de articulos. Es un campo de NOTAS de texto libre, o
    // sea que puede traer un EAN, un comentario del vendedor o basura, y el
    // destino es `variant.barcode` = el campo que lee el escaner del checkout.
    //
    // Por eso se valida de verdad (largo GTIN + digito verificador GS1) y lo que
    // no pasa se descarta con motivo en lugar de copiarse: es el mismo error que
    // ya cometimos mapeando `codigo_fabrica` ("1.1.1.50.010") al barcode.
    barcode: barcode.value,
    ...(barcode.value === null && barcode.reason ? { barcode_rejected: barcode.reason } : {}),
    factory_code: trimOrNull(row.codigo_fabrica),
    weight: toNumberOrNull(row.peso),
    length: toNumberOrNull(row.largo),
    height: toNumberOrNull(row.alto),
    width: toNumberOrNull(row.ancho),
    modified_at: trimOrNull(row.fechahoramodife),
  };
}

export class ZeusErpAdapter implements ErpAdapter {
  readonly provider = 'zeus';

  // Inyectable para tests; en runtime usa el fetch global de Node.
  constructor(private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch) {}

  getCapabilities(): ErpCapabilities {
    // batch_size gigante a propósito: el stock sync entrega TODO el catálogo en
    // una llamada y este adapter decide la estrategia (per-code vs barrido).
    return {
      stock_pull: true,
      sale_notify: true,
      stock_batch_size: 100_000,
      catalog_pull: true,
      // Verificado contra la cuenta real: /articulos devuelve el precio final.
      catalog_prices_include_tax: true,
      categories_pull: true,
      tinting_price: true,
      product_images: true,
      invoice_fetch: true,
    };
  }

  /**
   * Precio de una preparación tintométrica: base + fórmula, en una lista, por N
   * envases. Verificado contra la cuenta real con la fórmula `00NN 16/000`
   * (COSMOS) sobre la base `113`:
   *
   *   lista 1, cantidad 1 → {"codigoformulaho":"00NN 16/000","codigobase":"113",
   *                          "total":66352.822,"ival":0,"poriva":21.0}
   *
   * Se usa `formulaTintometrico` y NO `WSArticuloTintometricoV1`: el V1 responde
   * `"Datos incorrectos."` ante cualquier problema (sin decir qué campo), y
   * además espera un código de COLOR, que es otra tabla que la API no expone.
   */
  async getTintingPrice(
    query: ErpTintingPriceQuery,
    ctx: AdapterContext
  ): Promise<ErpTintingPriceRaw> {
    const baseCode = sanitizeSku(query.base_code ?? '');
    const formulaCode = normalizeFormulaCode(query.formula_code ?? '');

    // Validación LOCAL antes de gastar la llamada: la API exige Integer en
    // `lista` y `cantidad` (medido: `1.0` → 400 "For input string") y valida la
    // fórmula ANTES que la base, así que un parámetro mal armado devuelve un
    // error que no dice nada del parámetro real.
    if (!baseCode) {
      throw new ErpNonRetryableError('Zeus tintométrico: falta el código de la base (codBase).');
    }
    if (!formulaCode) {
      throw new ErpNonRetryableError('Zeus tintométrico: falta el código de fórmula (codFormula).');
    }
    if (!Number.isInteger(query.quantity) || query.quantity < 1) {
      throw new ErpNonRetryableError(
        `Zeus tintométrico: 'cantidad' tiene que ser un entero ≥ 1 (recibido ${query.quantity}); la API cotiza por envases, no por litros.`
      );
    }
    if (!Number.isInteger(query.list_index) || query.list_index < 0) {
      throw new ErpNonRetryableError(
        `Zeus tintométrico: 'lista' tiene que ser un entero ≥ 0 (recibido ${query.list_index}).`
      );
    }

    let dto: ArticuloTintometricoRow | null;
    try {
      dto = (await this.request<ArticuloTintometricoRow>(ctx, 'GET', '/articulos/formulaTintometrico', {
        query: {
          codBase: baseCode,
          codFormula: formulaCode,
          lista: query.list_index,
          cantidad: query.quantity,
        },
        timeoutMs: TINTING_TIMEOUT_MS,
      })) as ArticuloTintometricoRow | null;
    } catch (error) {
      throw classifyTintingError(error, { base_code: baseCode, formula_code: query.formula_code });
    }

    const total = toNumberOrNull(dto?.total);
    if (!dto || total === null) {
      throw new ErpNonRetryableError(
        `Zeus tintométrico: la cotización de ${baseCode} + ${query.formula_code} no devolvió 'total'.`
      );
    }

    return {
      base_code: trimOrNull(dto.codigobase) ?? baseCode,
      // El ERP devuelve el código CON el espacio que la búsqueda no acepta: se
      // guarda tal cual para mostrarlo.
      formula_code: trimOrNull(dto.codigoformulaho) ?? query.formula_code,
      total,
      tax_rate: toNumberOrNull(dto.poriva),
    };
  }

  /**
   * Imagen principal del artículo. `null` cuando Zeus no tiene ninguna cargada
   * — que es el caso de 878 de los 2.547 artículos de la cuenta real, así que es
   * un resultado normal y no un error.
   *
   * `prioridad` va VACÍO a propósito: así el endpoint devuelve la imagen
   * principal. Con un número devuelve esa posición del carrusel.
   */
  async fetchProductImage(code: string, ctx: AdapterContext): Promise<ErpProductImage | null> {
    const cleanCode = sanitizeSku(code ?? '');
    if (!cleanCode) return null;

    const bytes = await this.requestBinary(ctx, '/articulos/imagen', {
      codigo: cleanCode,
      prioridad: '',
    });
    if (!bytes) return null;

    // Zeus contesta 200 con cuerpo JSON/vacío cuando no hay imagen, así que el
    // content-type no alcanza: se decide por los magic bytes del binario.
    const sniffed = sniffImage(bytes);
    if (!sniffed) return null;

    return { content: bytes, mime_type: sniffed.mimeType, extension: sniffed.extension };
  }

  /**
   * Variante binaria de `request`. Existe aparte porque `request` hace
   * `response.text()` + `JSON.parse`, y pasar bytes de imagen por un string de
   * JS los corrompe (UTF-8 reemplaza cada secuencia inválida por U+FFFD).
   *
   * Devuelve `null` en 404 y en cuerpo vacío: para el motor son lo mismo — el
   * ERP no tiene imagen de ese artículo.
   */
  private async requestBinary(
    ctx: AdapterContext,
    path: string,
    query: Record<string, string | number>,
    opts: { label?: string; maxBytes?: number } = {}
  ): Promise<Buffer | null> {
    const label = opts.label ?? 'la imagen';
    const maxBytes = opts.maxBytes ?? MAX_IMAGE_BYTES;
    const url = new URL(`${this.baseUrl(ctx)}${path}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));

    const jwt = this.jwt(ctx);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${jwt}` },
        signal: controller.signal,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ErpConnectionError(`Zeus: no se pudo bajar ${label} (${reason}).`);
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 404) return null;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ErpAuthError(
          `Zeus: acceso rechazado al bajar ${label}, revisar el JWT (HTTP ${response.status}).`
        );
      }
      if (response.status >= 500) {
        throw new ErpConnectionError(`Zeus: error del servidor al bajar ${label} (HTTP ${response.status}).`);
      }
      throw new ErpNonRetryableError(
        `Zeus: la API rechazó el pedido de ${label} (HTTP ${response.status}).`
      );
    }

    const buffer = await response.arrayBuffer().catch(() => null);
    if (!buffer || buffer.byteLength === 0) return null;
    if (buffer.byteLength > maxBytes) {
      throw new ErpNonRetryableError(
        `Zeus: ${label} pesa ${Math.round(buffer.byteLength / 1024)} KB, por encima del tope de ` +
          `${Math.round(maxBytes / 1024 / 1024)} MB.`
      );
    }
    return Buffer.from(buffer);
  }

  private zeusSettings(ctx: AdapterContext): ErpZeusSettings {
    const settings = ctx.settings as { zeus?: ErpZeusSettings } | null | undefined;
    return settings?.zeus ?? {};
  }

  private baseUrl(ctx: AdapterContext): string {
    return (this.zeusSettings(ctx).base_url ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  private jwt(ctx: AdapterContext): string {
    const jwt = ctx.credentials?.jwt_token?.trim();
    if (!jwt) {
      throw new ErpAuthError("Zeus: falta la credencial 'jwt_token' (el JWT que entrega Zeus para la API Ecommerce).");
    }
    return jwt;
  }

  /**
   * Request autenticado con mapeo de errores a la taxonomía del módulo.
   * `allow404: true` devuelve null en vez de lanzar (lookups).
   * `duplicateOn409: true` devuelve el símbolo DUPLICATE (idempotencia de /pedidos).
   */
  private async request<T>(
    ctx: AdapterContext,
    method: 'GET' | 'POST',
    path: string,
    opts: {
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      allow404?: boolean;
      duplicateOn409?: boolean;
      timeoutMs?: number;
    } = {}
  ): Promise<T | typeof DUPLICATE | null> {
    const url = new URL(`${this.baseUrl(ctx)}${path}`);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const jwt = this.jwt(ctx);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ErpConnectionError(`Zeus: no se pudo conectar (${reason}).`);
    } finally {
      clearTimeout(timeout);
    }

    const raw = await response.text().catch(() => '');
    if (response.ok) {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return (raw as unknown) as T;
      }
    }

    if (response.status === 404 && opts.allow404) return null;
    if (response.status === 409 && opts.duplicateOn409) return DUPLICATE;
    const detail = raw ? ` — ${raw.slice(0, 300)}` : '';
    if (response.status === 401 || response.status === 403) {
      throw new ErpAuthError(`Zeus: acceso rechazado, revisar el JWT (HTTP ${response.status})${detail}`);
    }
    if (response.status >= 500) {
      throw new ErpConnectionError(`Zeus: error del servidor (HTTP ${response.status})${detail}`);
    }
    throw new ErpNonRetryableError(`Zeus: la API rechazó la operación (HTTP ${response.status})${detail}`);
  }

  /**
   * Valida el JWT contra `GET /empresas`, que además informa a qué empresa(s)
   * da acceso el token — útil porque una cuenta Zeus puede tener varias.
   *
   * NO se usa `/health-check/api-zeus` (que sería el endpoint natural): en la
   * cuenta real responde `400 {"status":"BAD_REQUEST", "message":"URI is not
   * absolute"}` incluso con un JWT válido, así que la validación siempre fallaba.
   */
  async validateCredentials(ctx: AdapterContext): Promise<ErpValidationResult> {
    try {
      const data = (await this.request<EmpresasResponse | EmpresaRow[]>(ctx, 'GET', '/empresas')) as
        | EmpresasResponse
        | EmpresaRow[]
        | null;
      const empresas = Array.isArray(data) ? data : (data?.empresas ?? []);
      if (!empresas.length) {
        return {
          ok: false,
          message: 'Zeus: el JWT es válido pero no da acceso a ninguna empresa; revisar el usuario en Zeus.',
        };
      }
      const nombres = empresas
        .map((empresa) => empresa.descripcion_empresa?.trim())
        .filter((nombre): nombre is string => Boolean(nombre));
      const detalle = nombres.length ? `: ${nombres.join(', ')}` : '';
      return {
        ok: true,
        message: `Zeus: conexión OK — ${empresas.length} empresa(s)${detalle}.`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async getStockBySku(skus: string[], ctx: AdapterContext): Promise<Map<string, ErpStockResult>> {
    const requested = skus.map((sku) => ({ raw: sku, clean: sanitizeSku(sku) }));

    const available =
      requested.length <= PER_CODE_THRESHOLD
        ? await this.stockByCode(ctx, requested.map((r) => r.clean))
        : await this.stockBySweep(ctx);

    const results = new Map<string, ErpStockResult>();
    for (const { raw, clean } of requested) {
      const row = available.get(clean);
      results.set(
        raw,
        row === undefined
          ? { found: false }
          : { found: true, quantity: row.quantity, by_deposito: row.by_deposito }
      );
    }
    return results;
  }

  /**
   * Disponible según settings: `stock − comprometido` (default) o el stock
   * crudo. Con depósito configurado usa solo la fila de ese depósito (SKU sin
   * fila = 0, no not_found: el artículo existe). El ArticulosDto de getbyID no
   * trae `comprometido` a nivel raíz → en ese caso se suma el desglose.
   */
  private availableQuantity(ctx: AdapterContext, row: ArticuloRow): number {
    const settings = this.zeusSettings(ctx);
    const subtract = settings.subtract_committed ?? true;
    const depositoId = settings.deposito_id ?? undefined;
    const porDeposito = row.stock_por_deposito ?? [];
    const availableOf = (stock: number | undefined, comprometido: number | undefined) =>
      (Number(stock) || 0) - (subtract ? Number(comprometido) || 0 : 0);

    if (depositoId) {
      const deposito = porDeposito.find((entry) => entry.deposito === depositoId);
      return deposito ? availableOf(deposito.stock, deposito.comprometido) : 0;
    }
    if (subtract && row.comprometido === undefined && porDeposito.length) {
      return porDeposito.reduce((sum, entry) => sum + availableOf(entry.stock, entry.comprometido), 0);
    }
    return availableOf(row.stock, row.comprometido);
  }

  /**
   * Disponible POR DEPÓSITO, con la misma regla de `subtract_committed` que el
   * total. Habilita el mapeo depósito → stock location: el sync escribe la
   * cantidad de cada depósito en la location que le corresponde en vez de
   * colapsar todo (o peor, repetir el total en varias locations).
   *
   * Se ignora `deposito_id`: ese setting acota el TOTAL a un depósito y acá lo
   * que se quiere es el desglose completo, que el sync filtra con su propio mapeo.
   */
  private availableByDeposito(ctx: AdapterContext, row: ArticuloRow): Record<string, number> {
    const subtract = this.zeusSettings(ctx).subtract_committed ?? true;
    const byDeposito: Record<string, number> = {};
    for (const entry of row.stock_por_deposito ?? []) {
      if (entry?.deposito === undefined || entry.deposito === null) continue;
      const key = String(entry.deposito);
      const available =
        (Number(entry.stock) || 0) - (subtract ? Number(entry.comprometido) || 0 : 0);
      // Un artículo puede repetir depósito por lote/partida: se acumula.
      byDeposito[key] = (byDeposito[key] ?? 0) + available;
    }
    return byDeposito;
  }

  /** Pocos SKUs: getbyID por códigos (comma-separated). */
  private async stockByCode(ctx: AdapterContext, skus: string[]): Promise<Map<string, ZeusStockRow>> {
    const codes = skus.filter(Boolean);
    const available = new Map<string, ZeusStockRow>();
    if (!codes.length) return available;

    const rows =
      ((await this.request<ArticuloRow[]>(ctx, 'GET', '/articulos/getbyID', {
        query: { codigos_articulos: codes.join(',') },
        allow404: true,
      })) as ArticuloRow[] | null) ?? [];

    for (const row of rows) {
      const code = row.codigo ? sanitizeSku(row.codigo) : '';
      if (!code) continue;
      available.set(code, {
        quantity: this.availableQuantity(ctx, row),
        by_deposito: this.availableByDeposito(ctx, row),
      });
    }
    return available;
  }

  /**
   * Catálogo completo: barrido paginado. `page` es 1-based y el server corta en
   * 1000 filas; se corta ante página vacía o repetida (por si ignora el param).
   *
   * Con `eshop_only` se barre `/articulos` en lugar de `/articulos/stock`: el
   * query param `eshop` es ignorado por la API y `/articulos/stock` no devuelve
   * los flags de publicación, así que la única forma de honrar el setting es
   * pedir el feed completo (que también trae `stock` y `stock_por_deposito`) y
   * filtrar acá.
   */
  private async stockBySweep(ctx: AdapterContext): Promise<Map<string, ZeusStockRow>> {
    const settings = this.zeusSettings(ctx);
    const onlyPublished = Boolean(settings.eshop_only);
    const path = onlyPublished ? '/articulos' : '/articulos/stock';
    const available = new Map<string, ZeusStockRow>();
    let previousSignature = '';

    for (let page = 1; page <= SWEEP_MAX_PAGES; page++) {
      const rows =
        ((await this.request<ArticuloCatalogRow[]>(ctx, 'GET', path, {
          query: { page, activo: true },
          timeoutMs: onlyPublished ? CATALOG_TIMEOUT_MS : undefined,
        })) as ArticuloCatalogRow[] | null) ?? [];
      if (!rows.length) break;

      const signature = `${rows.length}|${rows[0]?.codigo ?? ''}|${rows[rows.length - 1]?.codigo ?? ''}`;
      if (signature === previousSignature) break;
      previousSignature = signature;

      for (const row of rows) {
        const code = row.codigo ? sanitizeSku(row.codigo) : '';
        if (!code) continue;
        if (onlyPublished && !isPublishable(row)) continue;
        available.set(code, {
        quantity: this.availableQuantity(ctx, row),
        by_deposito: this.availableByDeposito(ctx, row),
      });
      }
    }
    return available;
  }

  /**
   * Catálogo (producto + precios) modificado desde `since`. Una sola llamada a
   * `/articulos` alcanza: trae descripción, `precio0..9`, `por_iva`, flags de
   * publicación y `fechahoramodife` (el watermark).
   *
   * Con `since` se usa `fechasincro` (que filtra por `fechahoramodife`); sin él
   * se pide el catálogo completo con `page=0`, que el server devuelve entero en
   * una respuesta. El delta también entra por `page=0` porque es más chico que
   * el completo y así no se pagina un dataset que está mutando.
   */
  async getCatalogChanges(since: string | null, ctx: AdapterContext): Promise<ErpCatalogRow[]> {
    const rows =
      ((await this.request<ArticuloCatalogRow[]>(ctx, 'GET', '/articulos', {
        query: { page: 0, ...(since ? { fechasincro: formatDate(since) } : {}) },
        timeoutMs: CATALOG_TIMEOUT_MS,
      })) as ArticuloCatalogRow[] | null) ?? [];

    const out: ErpCatalogRow[] = [];
    for (const row of rows) {
      const code = row.codigo ? sanitizeSku(row.codigo) : '';
      if (!code) continue;
      out.push(toCatalogRow(code, row));
    }
    return out;
  }

  /**
   * Árbol de categorías del ERP, aplanado (padres antes que hijos).
   *
   * `GET /articulos/categorias` NO está en el Swagger pero existe y devuelve el
   * árbol completo CON nombres, que es lo que permite espejarlo en
   * `product_category` sin un mapeo manual código→categoría.
   *
   * Los nodos sin `id` o sin `nombre` se saltean: el nombre es el valor del
   * nodo (el código "020B" no sirve como categoría de storefront) y sin código
   * no hay forma de matchear los artículos.
   */
  async fetchCategories(ctx: AdapterContext): Promise<ErpCategoryNode[]> {
    const data = (await this.request<CategoriaRow[] | CategoriasResponse>(
      ctx,
      'GET',
      '/articulos/categorias',
      { timeoutMs: CATALOG_TIMEOUT_MS }
    )) as CategoriaRow[] | CategoriasResponse | null;

    const roots = Array.isArray(data) ? data : (data?.categorias ?? []);
    const out: ErpCategoryNode[] = [];
    const seen = new Set<string>();

    const walk = (nodes: CategoriaRow[], parentCode: string | null, level: number): void => {
      if (level >= MAX_CATEGORY_DEPTH) return;
      let rank = 0;
      for (const node of nodes) {
        const code = normalizeCategoryCode(node?.id);
        const name = trimOrNull(node?.nombre);
        if (!code || !name || seen.has(code)) continue;
        seen.add(code);
        out.push({
          code,
          name,
          parent_code: parentCode,
          rank: rank++,
          level,
          image_url: trimOrNull(node.foto),
        });
        const children = node.categorias_hijas;
        if (Array.isArray(children) && children.length) walk(children, code, level + 1);
      }
    };

    walk(Array.isArray(roots) ? roots : [], null, 0);
    return out;
  }

  /**
   * Resuelve el `codigo_cliente` del pedido: busca por documento (o email),
   * crea el cliente si falta y hay `create_clients`, y sin documento cae al
   * cliente genérico `default_client_code` ("Consumidor Final" creado en Zeus).
   */
  private async resolveClientCode(payload: ErpSalePayload, ctx: AdapterContext): Promise<string> {
    const settings = this.zeusSettings(ctx);
    const doc = payload.customer.document;
    const docDigits = doc.number ? doc.number.replace(/\D/g, '') : '';

    if (!doc.type || !docDigits) {
      if (settings.default_client_code) return settings.default_client_code;
      throw new ErpNonRetryableError(
        'Zeus: la orden no tiene documento fiscal y no hay zeus.default_client_code configurado (creá un cliente "Consumidor Final" en Zeus y cargá su código).'
      );
    }

    const isCuit = doc.type === 'CUIT' || doc.type === 'CUIL';
    const found = await this.searchClient(ctx, {
      ...(isCuit ? { cuit: docDigits } : { numero_de_documento: docDigits }),
    });
    if (found) return found;

    if (payload.customer.email) {
      const byEmail = await this.searchClient(ctx, { email: payload.customer.email });
      if (byEmail) return byEmail;
    }

    if (!(settings.create_clients ?? true)) {
      if (settings.default_client_code) return settings.default_client_code;
      throw new ErpNonRetryableError(
        `Zeus: el cliente con documento ${docDigits} no existe y la creación está deshabilitada (zeus.create_clients=false sin default_client_code).`
      );
    }

    const fullName = [payload.customer.first_name, payload.customer.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    const created = (await this.request<ClienteRow>(ctx, 'POST', '/clientes', {
      query: settings.ecommerce_id ? { ecommerce: settings.ecommerce_id } : undefined,
      body: {
        razon_social: fullName || payload.customer.email || `Cliente ${docDigits}`,
        dni_cuit: Number(docDigits),
        numero_de_documento: docDigits,
        email: payload.customer.email ?? '',
        telefono: payload.customer.phone ?? '',
        direccion: payload.shipping.address.street ?? '',
        localidad: payload.shipping.address.city ?? '',
        codigo_iva: settings.default_codigo_iva ?? DEFAULT_CODIGO_IVA,
        ...(settings.cond_venta ? { codigo_condicion_de_venta: settings.cond_venta } : {}),
        ...(settings.cod_lista ? { lista_precios: settings.cod_lista } : {}),
        ...(settings.sucursal ? { sucursal: String(settings.sucursal) } : {}),
      },
    })) as ClienteRow | null;
    if (created?.codigo) return created.codigo;

    // "Ya registrado" o respuesta sin código: re-buscar una vez (carrera o
    // normalización distinta del documento del lado de Zeus).
    const raced = await this.searchClient(ctx, {
      ...(isCuit ? { cuit: docDigits } : { numero_de_documento: docDigits }),
    }).catch(() => null);
    if (raced) return raced;
    throw new ErpConnectionError('Zeus: la creación del cliente no devolvió un código.');
  }

  private async searchClient(
    ctx: AdapterContext,
    query: { email?: string; cuit?: string; numero_de_documento?: string }
  ): Promise<string | null> {
    const data = await this.request<ClienteRow[]>(ctx, 'GET', '/clientes/search', {
      query,
      allow404: true,
    });
    const rows = Array.isArray(data) ? data : [];
    for (const row of rows) {
      if (row.activo === false) continue;
      if (row.codigo) return row.codigo;
    }
    return null;
  }

  async notifySale(payload: ErpSalePayload, ctx: AdapterContext): Promise<ErpSaleResult> {
    const settings = this.zeusSettings(ctx);

    const missingSku = payload.items.filter((item) => !item.sku?.trim());
    if (missingSku.length) {
      throw new ErpNonRetryableError(
        `Zeus: ${missingSku.length} ítem(s) de la orden no tienen SKU y el pedido exige código de artículo por línea (${missingSku
          .map((item) => item.title ?? 's/título')
          .join(', ')}).`
      );
    }

    const fallbackTaxRate = settings.tax_rate ?? DEFAULT_TAX_RATE;
    const pricesIncludeTax = settings.prices_include_tax ?? true;
    /**
     * Alícuota por línea: el catálogo del cliente NO es uniforme (hay artículos
     * al 21% y al 10.5%), así que usar una sola tasa informaba netos mal. El
     * catalog sync deja `por_iva` en `variant.metadata.zeus_por_iva` y llega acá
     * como `item.tax_rate` (en porcentaje); sin ese dato se cae al global.
     */
    const rateOf = (item: { tax_rate?: number | null }): number => {
      const pct = item.tax_rate;
      return typeof pct === 'number' && Number.isFinite(pct) && pct >= 0 ? pct / 100 : fallbackTaxRate;
    };
    const netOf = (gross: number, rate: number) => round4(pricesIncludeTax ? gross / (1 + rate) : gross);
    /** Para envío y totales, donde no hay artículo del que sacar la alícuota. */
    const net = (gross: number) => netOf(gross, fallbackTaxRate);
    const reference = `Venta web #${payload.display_id ?? payload.order_id}`;
    const docDigits = payload.customer.document.number
      ? payload.customer.document.number.replace(/\D/g, '')
      : '';

    const codigoCliente = await this.resolveClientCode(payload, ctx);

    const items = payload.items.map((item, index) => {
      const rate = rateOf(item);
      const unitNet = netOf(item.unit_price, rate);
      const tint = item.tint;
      return {
        linea: index + 1,
        // `codigo` sigue siendo el artículo BASE incluso entonado: es lo que
        // existe en el maestro de Zeus y lo que descuenta de stock (el consumo de
        // colorante lo resuelve Gestión con la fórmula). Un "artículo por color"
        // no existe: los 3438 artículos tienen los campos de color vacíos.
        codigo: sanitizeSku(item.sku!),
        // El color va también en la descripción a propósito: si esta versión de
        // Zeus ignorara `codigo_formula`, el remito y la factura igual dicen qué
        // hay que preparar.
        descripcion: tint
          ? `${item.title ?? item.sku} — Color ${tint.color_name ?? tint.color_code ?? tint.cod_formula}`
          : (item.title ?? item.sku),
        cantidad: item.quantity,
        precio: unitNet,
        dto_linea: 0,
        por_iva: round4(rate * 100),
        total: round4(unitNet * item.quantity),
        // Spread condicional: las líneas sin entonar quedan byte-idénticas a lo
        // que se venía mandando.
        ...(tint
          ? {
              codigo_base: sanitizeSku(tint.cod_base),
              codigo_formula: tint.cod_formula,
            }
          : {}),
      };
    });

    let observaciones = reference;
    if (payload.totals.shipping > 0) {
      if (settings.shipping_item_code) {
        items.push({
          linea: items.length + 1,
          codigo: settings.shipping_item_code,
          descripcion: 'Costo de envío',
          cantidad: 1,
          precio: net(payload.totals.shipping),
          dto_linea: 0,
          // El envío no es un artículo del catálogo: va con la alícuota global.
          por_iva: round4(fallbackTaxRate * 100),
          total: net(payload.totals.shipping),
        });
      } else {
        // Sin un artículo de envío configurado, el costo queda como observación.
        observaciones += ` — Envío: $${payload.totals.shipping} (sin artículo de envío configurado, no incluido como ítem)`;
      }
    }

    // Neto = suma de los netos de línea, no `total / (1 + tasa_global)`: con
    // alícuotas mixtas en la misma orden esa división daba un neto que no
    // cerraba contra los ítems que se envían.
    const itemsNet = items.reduce((sum, item) => sum + item.total, 0);
    const shippingNotItemized =
      payload.totals.shipping > 0 && !settings.shipping_item_code ? net(payload.totals.shipping) : 0;
    const netoGravado = round4(itemsNet + shippingNotItemized);

    // Depósito FACTURADOR: el que confirmó un humano al crear el fulfillment
    // gana sobre el de la config. Zeus espera un int32 en `deposito`, mientras
    // que el mapeo de depósitos guarda el código como string (es el mismo
    // espacio de códigos que `stock_por_deposito[].deposito`), así que hay que
    // convertir. Un código no numérico es un error de DATOS, no de red: mandar
    // el comprobante con el depósito de la config emitiría la factura desde el
    // depósito equivocado en silencio, que es exactamente lo que esta feature
    // existe para evitar.
    let depositoId = settings.deposito_id ?? null;
    if (payload.billing_deposito) {
      const parsed = Number(payload.billing_deposito);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ErpNonRetryableError(
          `Zeus: el depósito facturador "${payload.billing_deposito}" no es un código numérico válido. Revisá el mapeo de depósitos en la configuración del ERP.`
        );
      }
      depositoId = parsed;
    }

    const comprobante: Record<string, unknown> = {
      id_ecommerce: payload.order_id,
      codigo_cliente: codigoCliente,
      fecha_emitido: formatDate(payload.created_at ?? new Date().toISOString()),
      descripcion: reference,
      observaciones1: observaciones,
      items,
      neto_gravado: netoGravado,
      iva: round4(payload.totals.total - netoGravado),
      total: payload.totals.total,
      descuento: 0,
      recargo: 0,
      ...(docDigits && (payload.customer.document.type === 'CUIT' || payload.customer.document.type === 'CUIL')
        ? { cuit: Number(docDigits) }
        : {}),
      ...(docDigits ? { numero_de_documento: docDigits } : {}),
      ...(settings.sucursal ? { sucursal: settings.sucursal } : {}),
      ...(depositoId ? { deposito: depositoId } : {}),
      ...(settings.pto_vta ? { pto_vta: settings.pto_vta } : {}),
      ...(settings.cod_lista ? { cod_lista: settings.cod_lista } : {}),
      ...(settings.cond_venta ? { cond_venta: settings.cond_venta } : {}),
      ...(settings.tipo_comp ? { tipo_comp: settings.tipo_comp } : {}),
      ...(settings.codigo_de_vendedor ? { codigo_de_vendedor: settings.codigo_de_vendedor } : {}),
    };

    // El trigger del outbox ya garantiza pago capturado; el medio de pago solo
    // se informa si hay un tipo_pago mapeado en la cuenta Zeus.
    if ((settings.send_payments ?? true) && settings.tipo_pago) {
      comprobante.medios_pago = [
        {
          tipo_pago: settings.tipo_pago,
          importe: payload.totals.total,
          ...(settings.tarjeta_code ? { codigo_tarjeta: settings.tarjeta_code } : {}),
          comentario: reference,
        },
      ];
    }

    const result = await this.request<ComprobanteResponse[]>(ctx, 'POST', '/pedidos', {
      query: settings.ecommerce_id ? { ecommerce: settings.ecommerce_id } : undefined,
      body: [comprobante],
      duplicateOn409: true,
    });

    if (result === DUPLICATE) {
      // 409 = "conflicto por datos ya existentes": el pedido con este
      // id_ecommerce ya está en Zeus (reintento de un envío que sí entró).
      return { status: 'duplicate' };
    }

    const first = Array.isArray(result) ? result[0] : null;
    const idtransac = Number(first?.idtransac);
    if (!Number.isFinite(idtransac) || idtransac <= 0) {
      throw new ErpConnectionError(
        `Zeus: la inserción del pedido no devolvió idtransac (${JSON.stringify(result).slice(0, 120)}).`
      );
    }
    const sucursal = Number(first?.sucursal ?? settings.sucursal ?? 0) || null;
    return {
      status: 'sent',
      external_ref: String(idtransac),
      // Se devuelve aparte de `response` porque el poll del comprobante lo
      // necesita como dato tipado: `pedidoFacturado` e `imprimirComprobante`
      // piden `idtransac` + `sucursal`, y la sucursal de la config puede cambiar
      // entre la venta y el poll.
      sucursal,
      response: {
        idtransac,
        numero_comp: first?.numero_comp ?? null,
        sucursal,
        codigo_cliente: codigoCliente,
      },
    };
  }

  // ── Comprobante ───────────────────────────────────────────────────────────

  /**
   * ¿Zeus ya facturó este pedido?
   *
   * `GET /pedidos/pedidoFacturado?id_Transaccion=&Sucursal=` devuelve
   * `CpediVtaComprobantePrincipalDTO[]`. Zeus factura por su cuenta y a su
   * ritmo, así que `{ invoiced: false }` es la respuesta NORMAL durante un buen
   * rato y NO es un error.
   *
   * Dos cosas medidas en la API y no en el Swagger, que valen para cualquier
   * campo nuevo que se lea de acá:
   * - Los flags booleanos llegan como STRING (`"1"`/`"0"`/`"true"`), igual que
   *   `publica_en_ecommerce` del catálogo. Por eso `isFacturado` se interpreta
   *   con `isTruthyFlag` y no con `Boolean()` — `Boolean("0")` es `true`.
   * - Las fechas vienen en hora local del server (UTC-3) SIN offset. Se guardan
   *   tal cual: reinterpretarlas con `new Date()` las corre tres horas.
   *
   * El comprobante puede venir en el objeto raíz o dentro de
   * `comprobanteResultado[]` (Zeus arma ahí los documentos derivados del
   * pedido); se prefiere el primero que declare estar facturado.
   */
  async fetchInvoiceStatus(
    args: { externalRef: string; sucursal?: number | null },
    ctx: AdapterContext
  ): Promise<ErpInvoiceStatus> {
    const settings = this.zeusSettings(ctx);
    const idtransac = Number(args.externalRef);
    if (!Number.isInteger(idtransac) || idtransac <= 0) {
      throw new ErpNonRetryableError(
        `Zeus: "${args.externalRef}" no es un idtransac válido para consultar el comprobante.`
      );
    }
    const sucursal = args.sucursal ?? settings.sucursal ?? null;
    if (sucursal === null) {
      throw new ErpNonRetryableError(
        'Zeus: falta la sucursal para consultar el comprobante. Configurala en ERP → Configuración.'
      );
    }

    const result = await this.request<ZeusFacturadoResponse[]>(
      ctx,
      'GET',
      '/pedidos/pedidoFacturado',
      { query: { id_Transaccion: idtransac, Sucursal: sucursal }, allow404: true }
    );
    if (!result || result === DUPLICATE || !Array.isArray(result) || result.length === 0) {
      return { invoiced: false, sucursal, raw: result === DUPLICATE ? null : result };
    }

    const candidates: ZeusFacturadoResponse[] = [];
    for (const row of result) {
      if (!row || typeof row !== 'object') continue;
      candidates.push(row);
      for (const derived of row.comprobanteResultado ?? []) {
        if (derived && typeof derived === 'object') candidates.push(derived);
      }
    }

    const invoiced = candidates.find((row) => isTruthyFlag(row.isFacturado) && numeroOf(row) !== null);
    if (!invoiced) return { invoiced: false, sucursal, raw: result };

    return {
      invoiced: true,
      numero_comp: numeroOf(invoiced),
      tipo_comp: typeof invoiced.tipoComp === 'string' ? invoiced.tipoComp : null,
      letra: typeof invoiced.letra === 'string' ? invoiced.letra : null,
      punto_de_venta: Number.isFinite(Number(invoiced.puntoDeVenta))
        ? Number(invoiced.puntoDeVenta)
        : null,
      sucursal: Number.isFinite(Number(invoiced.sucursal)) ? Number(invoiced.sucursal) : sucursal,
      // Sin reinterpretar: hora local del server, sin offset.
      fecha: typeof invoiced.fecha === 'string' ? invoiced.fecha : null,
      total: Number.isFinite(Number(invoiced.total)) ? Number(invoiced.total) : null,
      raw: result,
    };
  }

  /**
   * PDF del comprobante: `GET /imprimirComprobante?idtransac=&sucursal=&tipoComprobante=`.
   *
   * Devuelve `null` cuando Zeus contesta vacío o algo que no es un PDF (mismo
   * patrón que las imágenes: el `Content-Type` de esta API no es confiable, así
   * que se decide por MAGIC BYTES). Eso se trata como "todavía no está", no como
   * error.
   *
   * OJO: este endpoint también acepta el JWT como `?key=`, o sea que se podría
   * linkear directo desde el storefront. NO se hace: ese token lee el catálogo,
   * crea clientes y crea pedidos, y una URL de storefront es pública. Es el
   * mismo criterio ya tomado para las imágenes del catálogo.
   */
  async fetchInvoicePdf(
    args: { externalRef: string; sucursal?: number | null; tipoComp: string },
    ctx: AdapterContext
  ): Promise<ErpInvoicePdf | null> {
    const settings = this.zeusSettings(ctx);
    const idtransac = Number(args.externalRef);
    if (!Number.isInteger(idtransac) || idtransac <= 0) return null;
    const sucursal = args.sucursal ?? settings.sucursal ?? null;
    if (sucursal === null || !args.tipoComp) return null;

    const buffer = await this.requestBinary(
      ctx,
      '/imprimirComprobante',
      { idtransac, sucursal, tipoComprobante: args.tipoComp },
      { label: 'el PDF del comprobante', maxBytes: MAX_INVOICE_PDF_BYTES }
    );
    if (!buffer || !isPdf(buffer)) return null;
    return { content: buffer, mime_type: 'application/pdf' };
  }
}
