import type { ErpFiscalCondition, ErpOdooSettings, ErpOdooTaxBehavior, ErpSalePayload } from '../types';
import { htmlToMarkdown } from './html-to-markdown';
import { OdooRpcClient, type OdooRpcConfig } from './odoo-rpc-client';
import {
  ErpAuthError,
  ErpNonRetryableError,
  type AdapterContext,
  type ErpAdapter,
  type ErpCapabilities,
  type ErpCatalogRow,
  type ErpCategoryNode,
  type ErpProductImage,
  type ErpSaleResult,
  type ErpStockResult,
  type ErpValidationResult,
} from './types';

/**
 * Adapter Odoo (self-hosted / cloud, Community 19). v1 usa los módulos base
 * `stock` + `product` (Inventory) y agrega `sale_management` para notificar
 * ventas — no depende de `account`.
 *
 * - Auth: `execute_kw` con `uid` + API Key (Preferences → Account Security).
 *   No hay flujo de login: el par (uid, api_key) es la credencial.
 * - Stock: `product.product.search_read` sobre `default_code`. Con pocos SKUs
 *   se usa `[["default_code", "in", <lista>]]`; con muchos se barre paginado.
 *   El disponible es `free_qty` (Odoo: qty_available - reservado). NO se usa
 *   `qty_available` (físico sin descontar) ni `virtual_available` (proyectado).
 * - Catálogo: `product.template.search_read` — el template es el nivel
 *   conceptual del producto, filtrado por `write_date > since` cuando hay
 *   watermark.
 * - Categorías: `product.category.search_read`, ya con `complete_name`.
 * - Imágenes: `product.product` → `image_1920` (base64 PNG re-encoded por Odoo).
 * - Ventas: `sale.order.create` + `action_confirm`. Idempotencia por
 *   `client_order_ref = order_id` (campo estándar de Odoo, indexado): antes de
 *   crear se hace `search_read` con ese ref; si existe se devuelve `duplicate`
 *   con el ID del `sale.order` que ya está. Partner se resuelve por VAT
 *   (`res.partner.vat`) y cae a email antes de crear.
 *
 * v1 NO IMPLEMENTA / caveats conocidos:
 * - `invoice_fetch`: requiere el módulo `account`.
 * - `tinting_price`: Odoo no tiene el concepto en su core.
 * - Impuestos en notifySale: se dejan los `taxes_id` que Odoo aplica por
 *   defecto sobre cada `product.product`. El `price_unit` de la línea es el
 *   bruto que cobró Medusa; si el impuesto default de Odoo suma IVA por
 *   encima, el total del `sale.order` puede diferir del total de Medusa. La
 *   alternativa (mandar `taxes_id: [[6, 0, []]]` para forzar sin impuestos)
 *   quiebra la contabilidad de Odoo, así que v1 acepta el desfase y lo
 *   resolveremos con un mapeo de impuestos por país en v1.1.
 * - `country_id` en el partner: v1 lo deja en null. Resolverlo requiere
 *   otro `search_read` sobre `res.country` por código ISO y no vale el
 *   round-trip por creación de partner nuevo; se agrega en v1.1.
 * - `shipping_item_code`: si se configura, TIENE que existir un producto en
 *   Odoo con ese `default_code`. Si no existe la venta falla con
 *   `ErpNonRetryableError` (no se puede facturar un envío sin producto).
 *   Vacío deja el flete como nota en el pedido.
 *
 * Setup completo: docs/recipes/erp-odoo.md.
 */

const PER_CODE_THRESHOLD = 10;
const STOCK_SWEEP_PAGE_SIZE = 200;
/** Cinturón anti-runaway: 25 páginas de 200 = 5000 productos por corrida. */
const STOCK_SWEEP_MAX_PRODUCTS = 5_000;
const CATALOG_PAGE_SIZE = 100;
/** Cinturón para v1: si el delta desborda, se corta y el log lo avisa. */
const CATALOG_MAX_PRODUCTS = 3_000;
const CATEGORY_LIMIT = 1_000;
/**
 * `stock_batch_size` que expone `getCapabilities()`. Deliberadamente altísimo
 * frente a `STOCK_SWEEP_MAX_PRODUCTS` (5k): el stock sync entrega TODO el
 * catálogo en una sola llamada y este adapter decide internamente si va
 * `in`-list (pocos SKUs) o barrido paginado.
 */
const STOCK_CAPABILITY_BATCH_SIZE = 100_000;
/** Índice del `list_price` de Odoo dentro del contrato `prices` de `ErpCatalogRow`. */
const ODOO_BASE_PRICE_LIST_INDEX = 0;

type OdooMany2One = [number, string] | false | null | undefined;

type ProductProductStockRow = {
  id: number;
  default_code: string | false | null;
  free_qty?: number;
  qty_available?: number;
};

type ProductTemplateCatalogRow = {
  id: number;
  default_code: string | false | null;
  name?: string | null;
  list_price?: number | null;
  categ_id?: OdooMany2One;
  image_1920?: string | false | null;
  write_date?: string | null;
  active?: boolean;
  sale_ok?: boolean;
  type?: string | null;
  /**
   * Del módulo `product_brand` (OCA). Many2one al `product.brand`. Ausente
   * (undefined) cuando el módulo no está instalado; `false` cuando el producto
   * no tiene marca asignada. En instancias sin el módulo el field ni se pide.
   */
  product_brand_id?: OdooMany2One;
  /**
   * Peso en la unidad configurada (Odoo default: kg). Campo standard de
   * `product.template`, siempre disponible. `0` = sin peso cargado.
   */
  weight?: number | null;
  /**
   * HTML del módulo `website_sale`/derivados. En la instancia de EducaBot
   * mostrada en el sample llega poblado en el 81% de los productos publicados
   * como copy comercial narrativo. Ausente (undefined) en instancias sin el
   * módulo — nunca se pide sin haberlo confirmado con la sonda.
   */
  description_ecommerce?: string | false | null;
};

type ProductCategoryRow = {
  id: number;
  name?: string | null;
  parent_id?: OdooMany2One;
  complete_name?: string | null;
};

type ProductProductImageRow = {
  id: number;
  product_tmpl_id?: OdooMany2One;
  image_1920?: string | false | null;
};

type ResUsersRow = {
  id: number;
  login?: string | null;
  name?: string | null;
};

type SaleOrderLookupRow = {
  id: number;
  name?: string | null;
};

type ResPartnerRow = {
  id: number;
  name?: string | null;
  email?: string | null;
  vat?: string | null;
};

type ProductProductLookupRow = {
  id: number;
  default_code: string | false | null;
};

/**
 * Comando "create" de Odoo para one2many/many2many anidados: `[0, 0, {campos}]`.
 * El primer 0 es el opcode "crear nuevo registro"; el segundo es un id temporal
 * que Odoo ignora en creates. Se tipa como tupla concreta para que el shape sea
 * evidente en `sale.order.order_line`.
 */
type OdooCreateCommand<T> = [0, 0, T];

type SaleOrderLinePayload = {
  product_id: number;
  product_uom_qty: number;
  price_unit: number;
  name: string;
  tax_id?: [[number, number, number[]]];
};

function sanitizeSku(sku: string): string {
  return sku.replace(/[\r\n]/g, '').trim();
}

/**
 * Normaliza el disponible: negativo (`free_qty < 0` = sobre-comprometido) → 0;
 * fraccional (unidad de medida que admite decimales) → piso, porque el stock
 * sync de Medusa opera en enteros.
 */
function normalizeQuantity(raw: number | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

/** Odoo many2one: `[id, display_name]` cuando está seteado, `false` cuando no. */
function many2oneId(value: OdooMany2One): number | null {
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'number') {
    return value[0];
  }
  return null;
}

/** Segundo elemento del many2one (`display_name`), o `null` si no está o vino vacío. */
function many2oneName(value: OdooMany2One): string | null {
  if (Array.isArray(value) && value.length > 1 && typeof value[1] === 'string') {
    const trimmed = value[1].trim();
    return trimmed ? trimmed : null;
  }
  return null;
}

/** default_code puede venir `false` — lo tratamos igual que ausente. */
function codeOrNull(value: string | false | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Custom fields opcionales del módulo `Alumnos` en `sale.order`. Se envían solo
 * si el equipo Odoo ya los creó — sondeamos con `fields_get` antes de armar el
 * payload y filtramos silenciosamente los que faltan.
 *
 * Regla dura: el envío al ERP NUNCA se bloquea porque estos campos no existan.
 * Odoo rechaza el `create` con `Invalid field 'x_...' on model 'sale.order'`
 * ante nombres desconocidos, así que sin la sonda perdemos ventas cuando el
 * cliente todavía no configuró su Odoo. Con la sonda: sin campo, sin dato en
 * esa columna, orden creada igual.
 */
const OPTIONAL_SALE_ORDER_FIELDS = [
  'x_school_external_ref',
  'x_school_name',
  'x_source_site_id',
  'x_student_assignments',
] as const;

/**
 * Fields de `product.template` que aportan info al catálogo pero no existen en
 * TODA instancia Odoo — mismo patrón que `OPTIONAL_SALE_ORDER_FIELDS`. Se
 * sondean con `fields_get` una vez por instancia y solo se piden si están
 * presentes; los ausentes quedan como `null` en el `ErpCatalogRow` (compat).
 *
 * - `description_ecommerce`: HTML del módulo `website_sale`/OCA argentinos. En
 *   la instancia EducaBot es la fuente PRINCIPAL de descripción de catálogo
 *   (81% coverage sobre los 62 publicados, medido 2026-09-17).
 */
const OPTIONAL_PRODUCT_TEMPLATE_FIELDS = ['description_ecommerce'] as const;

/** 5min de cache: si el cliente crea los campos, la próxima ronda los recoge. */
const OPTIONAL_FIELDS_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Códigos AFIP (estándar, iguales en toda instancia con `l10n_ar` instalado):
 * - `l10n_ar.afip.responsibility.type.code` = "5" Consumidor Final, "1" IVA
 *   Responsable Inscripto, "6" Responsable Monotributo, "4" IVA Sujeto Exento.
 * - `l10n_latam.identification.type.l10n_ar_afip_code` = "80" CUIT, "96" DNI,
 *   "86" CUIL.
 *
 * Los IDs internos VARÍAN entre instancias (dependen del orden de instalación),
 * por eso se sondean con `search_read` filtrando por los códigos y se cachean
 * `baseUrl::db`. Los códigos SON el contrato.
 */
const AR_AFIP_RESPONSIBILITY_CODES: Record<ErpFiscalCondition, string> = {
  consumer_final: '5',
  responsable_inscripto: '1',
  monotributo: '6',
  exento: '4',
};

const AR_IDENTIFICATION_AFIP_CODES = {
  CUIT: '80',
  DNI: '96',
  CUIL: '86',
} as const;

type ArIdentificationType = keyof typeof AR_IDENTIFICATION_AFIP_CODES;

/**
 * Resultado del sondeo de IDs Odoo para AR. `null` en un slot significa "la
 * instancia no lo tiene definido" — el adapter no lo manda al `create`/`write`.
 * `null` en el objeto entero (cache) significa "la instancia no tiene la
 * localización AR instalada" y el adapter cae al comportamiento sin fiscal
 * data (compat legacy).
 */
type ArFiscalIds = {
  responsibility: Record<ErpFiscalCondition, number | null>;
  identification: Record<ArIdentificationType, number | null>;
  country_ar: number | null;
};

export class OdooErpAdapter implements ErpAdapter {
  readonly provider = 'odoo';

  /**
   * Cache por instancia Odoo (`baseUrl::db`) de qué custom fields opcionales
   * están definidos. Multi-tenant: si dos clientes distintos tienen su propia
   * Odoo, cada uno vive en su bucket — no comparten resultados.
   */
  private optionalFieldsCache = new Map<string, { at: number; fields: Set<string> }>();

  /**
   * Espeja `optionalFieldsCache` para el modelo `product.template`. Vive
   * separado del de `sale.order` para no re-sondear el modelo equivocado en
   * cada flujo (venta vs catálogo).
   */
  private productTemplateOptionalFieldsCache = new Map<
    string,
    { at: number; fields: Set<string> }
  >();

  /**
   * Cache separado del `sale.order fields_get`: se sondean 3 modelos distintos
   * (`l10n_ar.afip.responsibility.type`, `l10n_latam.identification.type`,
   * `res.country`) y el resultado agrupa IDs por código AFIP. `ids: null` = la
   * instancia no tiene la localización AR y no se re-sondea hasta el próximo
   * refresh.
   */
  private arFiscalIdsCache = new Map<string, { at: number; ids: ArFiscalIds | null }>();

  // Inyectable para tests; en runtime cada call construye su cliente con las
  // credenciales del context (los adapters son stateless por llamada).
  constructor(
    private readonly clientFactory: (config: OdooRpcConfig) => OdooRpcClient = (config) =>
      new OdooRpcClient(config)
  ) {}

  getCapabilities(): ErpCapabilities {
    return {
      stock_pull: true,
      // Requiere `sale_management` instalado en Odoo. El adapter no lo detecta
      // en runtime — si el módulo falta, `sale.order.create` devuelve un error
      // de modelo desconocido y `notifySale` lo mapea a ErpNonRetryableError.
      sale_notify: true,
      // batch_size gigante a propósito: el stock sync entrega TODO el catálogo
      // en una llamada y este adapter decide la estrategia (in-list vs sweep).
      stock_batch_size: STOCK_CAPABILITY_BATCH_SIZE,
      catalog_pull: true,
      // Odoo `list_price` es el precio de tarifa base sin impuestos: el planner
      // aplica `tax_rate` por fila.
      catalog_prices_include_tax: false,
      categories_pull: true,
      tinting_price: false,
      product_images: true,
      // v1: account no instalado → nada que consultar.
      invoice_fetch: false,
      // No expone listados de sus códigos de configuración: la pantalla
      // sigue con inputs de texto libre, igual que hasta ahora.
      config_lookups: false,
    };
  }

  private odooSettings(ctx: AdapterContext): ErpOdooSettings | null {
    const settings = ctx.settings as { odoo?: ErpOdooSettings } | null | undefined;
    return settings?.odoo ?? null;
  }

  /**
   * Sonda `sale.order.fields_get` para descubrir cuáles de los custom fields
   * opcionales existen en esta Odoo. Cachea por 5min por `baseUrl::db`.
   *
   * `fields_get(allfields=[...])` en Odoo devuelve un dict SOLO con los fields
   * que existen — los ausentes simplemente no aparecen. No lanza excepción por
   * nombres desconocidos (a diferencia de `create`), así que la sonda es segura.
   *
   * Si la sonda misma falla (red, permisos, timeout), asumimos "ninguno existe"
   * — nunca vamos a intentar mandarlos y perder la orden. Se cachea también el
   * negativo para no re-intentar en cada envío.
   */
  private async resolveAvailableOptionalFields(
    client: OdooRpcClient,
    ctx: AdapterContext
  ): Promise<Set<string>> {
    const settings = this.odooSettings(ctx);
    const cacheKey = `${settings?.base_url ?? ''}::${settings?.db ?? ''}`;
    const cached = this.optionalFieldsCache.get(cacheKey);
    if (cached && Date.now() - cached.at < OPTIONAL_FIELDS_CACHE_TTL_MS) {
      return cached.fields;
    }
    let present: Set<string>;
    try {
      const result = await client.executeKw<Record<string, unknown>>(
        'sale.order',
        'fields_get',
        [OPTIONAL_SALE_ORDER_FIELDS as unknown as string[]],
        { attributes: ['type'] }
      );
      present = new Set(Object.keys(result ?? {}));
      const missing = OPTIONAL_SALE_ORDER_FIELDS.filter((f) => !present.has(f));
      // Log de una línea por refresh de cache: da visibilidad sin llenar el log
      // (queda logeado ~cada 5min en el peor caso, no por cada orden).
      if (missing.length > 0) {
        // eslint-disable-next-line no-console
        console.info(
          `[erp:odoo] sale.order fields sonda (${cacheKey}) — presentes=${
            [...present].join(',') || '(ninguno)'
          } faltantes=${missing.join(',')} — se omiten los faltantes en el create.`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.warn(
        `[erp:odoo] fields_get sonda falló (${cacheKey}) — se envía sale.order SIN los custom fields opcionales: ${message}`
      );
      present = new Set();
    }
    this.optionalFieldsCache.set(cacheKey, { at: Date.now(), fields: present });
    return present;
  }

  /**
   * Sonda `product.template.fields_get` para descubrir qué campos opcionales
   * de la lista `OPTIONAL_PRODUCT_TEMPLATE_FIELDS` existen en esta instancia.
   * Mismo patrón que `resolveAvailableOptionalFields` sobre `sale.order`: si un
   * campo no está, se omite del `search_read` y el catalog row queda con `null`.
   *
   * Justificación: el módulo que expone `description_ecommerce` no está en
   * TODAS las Odoo (es un OCA argentino o un derivado de `website_sale`), así
   * que pedirlo a ciegas rompe `search_read` de instancias que no lo tienen.
   */
  private async resolveAvailableProductTemplateFields(
    client: OdooRpcClient,
    ctx: AdapterContext
  ): Promise<Set<string>> {
    const settings = this.odooSettings(ctx);
    const cacheKey = `${settings?.base_url ?? ''}::${settings?.db ?? ''}`;
    const cached = this.productTemplateOptionalFieldsCache.get(cacheKey);
    if (cached && Date.now() - cached.at < OPTIONAL_FIELDS_CACHE_TTL_MS) {
      return cached.fields;
    }
    let present: Set<string>;
    try {
      const result = await client.executeKw<Record<string, unknown>>(
        'product.template',
        'fields_get',
        [OPTIONAL_PRODUCT_TEMPLATE_FIELDS as unknown as string[]],
        { attributes: ['type'] }
      );
      present = new Set(Object.keys(result ?? {}));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.warn(
        `[erp:odoo] product.template fields_get sonda falló (${cacheKey}) — se pide el catálogo SIN los campos opcionales: ${message}`
      );
      present = new Set();
    }
    this.productTemplateOptionalFieldsCache.set(cacheKey, { at: Date.now(), fields: present });
    return present;
  }

  /**
   * Sonda los 3 modelos AFIP y devuelve los IDs indexados por código semántico.
   * Cache por `baseUrl::db` con el mismo TTL de las otras sondas.
   *
   * Devuelve `null` (cacheado) si CUALQUIER sondeo falla o si el modelo de
   * `l10n_ar` no existe — la instancia sin la localización AR instalada NO es
   * un error del pipeline: el adapter tiene que seguir creando el `sale.order`
   * como antes (sin fiscal data), y avisar por warn una vez cada 5min.
   *
   * IDs individualmente `null` (el modelo existe pero no está la fila con ese
   * código): el `buildArFiscalPatch` los omite del create/write. La orden pasa.
   */
  private async resolveArFiscalIds(
    client: OdooRpcClient,
    ctx: AdapterContext
  ): Promise<ArFiscalIds | null> {
    const settings = this.odooSettings(ctx);
    const cacheKey = `${settings?.base_url ?? ''}::${settings?.db ?? ''}`;
    const cached = this.arFiscalIdsCache.get(cacheKey);
    if (cached && Date.now() - cached.at < OPTIONAL_FIELDS_CACHE_TTL_MS) {
      return cached.ids;
    }
    let ids: ArFiscalIds | null;
    try {
      const responsibilityCodes = Object.values(AR_AFIP_RESPONSIBILITY_CODES);
      const identificationCodes = Object.values(AR_IDENTIFICATION_AFIP_CODES);
      const [respRows, identRows, countryRows] = await Promise.all([
        client.executeKw<Array<{ id: number; code?: string | null }>>(
          'l10n_ar.afip.responsibility.type',
          'search_read',
          [[['code', 'in', responsibilityCodes]]],
          { fields: ['id', 'code'], limit: responsibilityCodes.length }
        ),
        client.executeKw<Array<{ id: number; l10n_ar_afip_code?: string | null }>>(
          'l10n_latam.identification.type',
          'search_read',
          [[['l10n_ar_afip_code', 'in', identificationCodes]]],
          { fields: ['id', 'l10n_ar_afip_code'], limit: identificationCodes.length }
        ),
        client.executeKw<Array<{ id: number; code?: string | null }>>(
          'res.country',
          'search_read',
          [[['code', '=', 'AR']]],
          { fields: ['id', 'code'], limit: 1 }
        ),
      ]);

      const respByCode = new Map((respRows ?? []).map((r) => [String(r.code ?? ''), r.id]));
      const identByCode = new Map(
        (identRows ?? []).map((r) => [String(r.l10n_ar_afip_code ?? ''), r.id])
      );
      const countryId = countryRows?.[0]?.id ?? null;

      ids = {
        responsibility: {
          consumer_final: respByCode.get(AR_AFIP_RESPONSIBILITY_CODES.consumer_final) ?? null,
          responsable_inscripto:
            respByCode.get(AR_AFIP_RESPONSIBILITY_CODES.responsable_inscripto) ?? null,
          monotributo: respByCode.get(AR_AFIP_RESPONSIBILITY_CODES.monotributo) ?? null,
          exento: respByCode.get(AR_AFIP_RESPONSIBILITY_CODES.exento) ?? null,
        },
        identification: {
          CUIT: identByCode.get(AR_IDENTIFICATION_AFIP_CODES.CUIT) ?? null,
          DNI: identByCode.get(AR_IDENTIFICATION_AFIP_CODES.DNI) ?? null,
          CUIL: identByCode.get(AR_IDENTIFICATION_AFIP_CODES.CUIL) ?? null,
        },
        country_ar: typeof countryId === 'number' ? countryId : null,
      };

      const missingResp = (Object.keys(ids.responsibility) as ErpFiscalCondition[]).filter(
        (k) => ids!.responsibility[k] === null
      );
      const missingIdent = (Object.keys(ids.identification) as ArIdentificationType[]).filter(
        (k) => ids!.identification[k] === null
      );
      if (missingResp.length > 0 || missingIdent.length > 0 || ids.country_ar === null) {
        // eslint-disable-next-line no-console
        console.warn(
          `[erp:odoo] sondeo AR (${cacheKey}) — faltan responsibility=[${missingResp.join(',')}] identification=[${missingIdent.join(',')}] country_ar=${ids.country_ar ?? 'null'} — los ausentes se omiten del create/write.`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.warn(
        `[erp:odoo] sondeo AR (${cacheKey}) falló — instancia sin l10n_ar instalado o RPC roto; se cae al comportamiento sin fiscal data: ${message}`
      );
      ids = null;
    }
    this.arFiscalIdsCache.set(cacheKey, { at: Date.now(), ids });
    return ids;
  }

  /**
   * Arma el delta de campos fiscales AR a setear/parchar en el `res.partner`.
   *
   * - Create (`existing` undefined): incluye todos los campos que tengamos data.
   * - Patch (`existing` presente): solo incluye campos donde el partner Odoo
   *   tiene `false`/vacío/ausente Y nosotros tenemos data — nunca pisa data
   *   existente. Es la regla dura: partner con CUIT viejo se preserva; solo
   *   completamos huecos.
   *
   * `name` gana con `legal_name` solo para condiciones que facturan A (responsable
   * inscripto, exento, monotributo). Para consumer_final NO se toca el `name`
   * (el ERP arma el name como first_name + last_name — sigue el flujo default).
   */
  private buildArFiscalPatch(
    fiscalIds: ArFiscalIds,
    payload: ErpSalePayload,
    existing?: {
      vat?: unknown;
      country_id?: unknown;
      l10n_ar_afip_responsibility_type_id?: unknown;
      l10n_latam_identification_type_id?: unknown;
    }
  ): Record<string, unknown> {
    const patch: Record<string, unknown> = {};
    const isCreate = existing === undefined;

    const isEmpty = (v: unknown): boolean =>
      v === undefined || v === null || v === false || v === '' ||
      (Array.isArray(v) && v.length === 0);

    const condition = payload.customer.fiscal_condition ?? null;
    const docType = payload.customer.document.type as ArIdentificationType | null;
    const docNumber = payload.customer.document.number
      ? payload.customer.document.number.replace(/\s+/g, '').trim()
      : '';

    if (fiscalIds.country_ar !== null && (isCreate || isEmpty(existing?.country_id))) {
      patch.country_id = fiscalIds.country_ar;
    }

    if (condition && fiscalIds.responsibility[condition] !== null) {
      if (isCreate || isEmpty(existing?.l10n_ar_afip_responsibility_type_id)) {
        patch.l10n_ar_afip_responsibility_type_id = fiscalIds.responsibility[condition];
      }
    }

    if (docType && (docType === 'CUIT' || docType === 'DNI' || docType === 'CUIL')) {
      const identId = fiscalIds.identification[docType];
      if (identId !== null && (isCreate || isEmpty(existing?.l10n_latam_identification_type_id))) {
        patch.l10n_latam_identification_type_id = identId;
      }
      if (docNumber && (isCreate || isEmpty(existing?.vat))) {
        // Odoo AR permite guardar DNI/CUIL como VAT (el l10n valida el shape
        // según l10n_latam_identification_type_id, no exige CUIT).
        patch.vat = docNumber;
      }
    }

    // Razón social gana sobre first_name+last_name en comprobante A / exento /
    // monotributo. Consumer final no toca `name` (queda el compuesto del
    // partner o el que decida el flujo de create legacy).
    if (
      payload.customer.legal_name &&
      condition &&
      condition !== 'consumer_final' &&
      isCreate
    ) {
      patch.name = payload.customer.legal_name;
    }

    return patch;
  }

  /**
   * Arma el cliente RPC a partir del context. Las credenciales sensibles
   * (`api_key`) viajan por `ctx.credentials`; el resto vive en settings.
   */
  private buildClient(ctx: AdapterContext): OdooRpcClient {
    const settings = this.odooSettings(ctx);
    if (!settings) {
      throw new ErpAuthError(
        'Odoo: falta la configuración del adapter (settings.odoo) — cargá base_url, db y uid.'
      );
    }
    if (!settings.base_url) {
      throw new ErpAuthError('Odoo: falta `settings.odoo.base_url`.');
    }
    if (!settings.db) {
      throw new ErpAuthError('Odoo: falta `settings.odoo.db` (nombre de la base Odoo).');
    }
    const uid = settings.uid;
    if (typeof uid !== 'number' || !Number.isInteger(uid) || uid <= 0) {
      throw new ErpAuthError('Odoo: `settings.odoo.uid` tiene que ser un entero > 0.');
    }
    const apiKey = ctx.credentials?.api_key?.trim();
    if (!apiKey) {
      throw new ErpAuthError(
        "Odoo: falta la credencial 'api_key' (Preferences → Account Security → New API Key)."
      );
    }
    return this.clientFactory({
      baseUrl: settings.base_url,
      db: settings.db,
      uid,
      apiKey,
      allowedCompanyIds: settings.allowed_company_ids,
      timeoutMs: settings.timeout_ms,
    });
  }

  async validateCredentials(ctx: AdapterContext): Promise<ErpValidationResult> {
    let client: OdooRpcClient;
    try {
      client = this.buildClient(ctx);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
    try {
      const uid = this.odooSettings(ctx)?.uid ?? 0;
      const rows = await client.executeKw<ResUsersRow[]>('res.users', 'read', [[uid], ['login', 'name']]);
      const row = Array.isArray(rows) ? rows[0] : undefined;
      if (!row) {
        return { ok: false, message: `Odoo: el uid ${uid} no existe o no es visible con esta API Key.` };
      }
      const name = row.name ?? 'sin nombre';
      const login = row.login ?? 'sin login';
      return { ok: true, message: `Odoo: conexión OK — autenticado como ${name} (${login}).` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async getStockBySku(skus: string[], ctx: AdapterContext): Promise<Map<string, ErpStockResult>> {
    const client = this.buildClient(ctx);
    const requested = skus.map((sku) => ({ raw: sku, clean: sanitizeSku(sku) }));
    const uniqueClean = Array.from(new Set(requested.map((r) => r.clean).filter(Boolean)));

    const available =
      uniqueClean.length === 0
        ? new Map<string, number>()
        : uniqueClean.length <= PER_CODE_THRESHOLD
          ? await this.stockByCode(client, uniqueClean)
          : await this.stockBySweep(client, ctx);

    const results = new Map<string, ErpStockResult>();
    for (const { raw, clean } of requested) {
      if (!clean) {
        results.set(raw, { found: false });
        continue;
      }
      const qty = available.get(clean);
      results.set(raw, qty === undefined ? { found: false } : { found: true, quantity: qty });
    }
    return results;
  }

  /** Pocos SKUs: una sola llamada con `default_code in [...]`. */
  private async stockByCode(client: OdooRpcClient, codes: string[]): Promise<Map<string, number>> {
    const rows = await client.executeKw<ProductProductStockRow[]>(
      'product.product',
      'search_read',
      [[['default_code', 'in', codes]]],
      { fields: ['default_code', 'free_qty', 'qty_available'], limit: codes.length }
    );
    const out = new Map<string, number>();
    for (const row of rows ?? []) {
      const code = codeOrNull(row.default_code);
      if (!code) continue;
      out.set(code, normalizeQuantity(row.free_qty));
    }
    return out;
  }

  /**
   * Muchos SKUs: barrido paginado por `id asc`. Se corta en
   * `STOCK_SWEEP_MAX_PRODUCTS` y el logger lo avisa: v1 asume que un catálogo
   * de 5000+ productos exige revisar la estrategia (o ampliar el cinturón).
   */
  private async stockBySweep(client: OdooRpcClient, ctx: AdapterContext): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    let offset = 0;
    while (offset < STOCK_SWEEP_MAX_PRODUCTS) {
      const rows = await client.executeKw<ProductProductStockRow[]>(
        'product.product',
        'search_read',
        [[['default_code', '!=', false]]],
        {
          fields: ['default_code', 'free_qty', 'qty_available'],
          limit: STOCK_SWEEP_PAGE_SIZE,
          offset,
          order: 'id asc',
        }
      );
      const batch = rows ?? [];
      if (batch.length === 0) return out;
      for (const row of batch) {
        const code = codeOrNull(row.default_code);
        if (!code) continue;
        out.set(code, normalizeQuantity(row.free_qty));
      }
      if (batch.length < STOCK_SWEEP_PAGE_SIZE) return out;
      offset += batch.length;
    }
    ctx.logger?.warn?.(
      `Odoo: barrido de stock cortado en ${STOCK_SWEEP_MAX_PRODUCTS} productos (tope de v1). Ampliá el cinturón si el catálogo real es mayor.`
    );
    return out;
  }

  /**
   * Resuelve el SKU (`default_code`) de un `product.product` por su ID interno.
   *
   * Nace del webhook `POST /webhooks/erp-odoo/stock`: los server actions
   * nativos de tipo `webhook` mandan `product_id` como entero (el id de
   * `product.product`), no como SKU. Este método hace el hop de resolución
   * usando la misma auth que el resto del adapter — el endpoint no necesita
   * conocer credenciales ni armar clientes RPC.
   *
   * Devuelve `null` si el producto fue borrado o si su `default_code` es
   * vacío/`false`. Silencia errores de red devolviendo `null` también: el
   * caller decide si abortar o loguear. Un webhook que no puede resolver el
   * SKU no debe reventar; el cron `stock_sync` reconcilia después.
   */
  async lookupSkuByProductId(
    productId: number,
    ctx: AdapterContext
  ): Promise<string | null> {
    if (!Number.isInteger(productId) || productId <= 0) return null;
    const client = this.buildClient(ctx);
    try {
      const rows = await client.executeKw<ProductProductLookupRow[]>(
        'product.product',
        'read',
        [[productId], ['default_code']]
      );
      const row = rows?.[0];
      return row ? codeOrNull(row.default_code) : null;
    } catch (error) {
      ctx.logger?.warn?.(
        `Odoo lookupSkuByProductId(${productId}) falló: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /**
   * Resuelve el `complete_name` (`WH/Stock`, `My Co/Stock/Shelf A`) de un
   * `stock.location` por su id numérico. Contraparte de
   * `lookupSkuByProductId` para el otro campo que el webhook nativo de Odoo
   * envía como int scalar (many2one → id) sin poder navegar la relación.
   *
   * El `complete_name` es la clave que usa `settings.stock_sync.deposito_map`
   * para mapear un depósito del ERP a una `stock_location` de Medusa —
   * elegimos ese en vez del id porque es lo que ve el operador en el admin de
   * Odoo, más estable frente a re-instalaciones que renumeran ids y consistente
   * con lo que ya usan los otros adapters (Zeus, Bsale) cuando llenan
   * `by_deposito` con nombres.
   *
   * Devuelve `null` si el location no existe o el nombre está vacío. Silencia
   * errores de red por el mismo motivo que `lookupSkuByProductId`: el webhook
   * no debe reventar por un lookup fallido; el cron reconcilia después.
   */
  async lookupLocationCompleteName(
    locationId: number,
    ctx: AdapterContext
  ): Promise<string | null> {
    if (!Number.isInteger(locationId) || locationId <= 0) return null;
    const client = this.buildClient(ctx);
    try {
      const rows = await client.executeKw<Array<{ id: number; complete_name?: string | null }>>(
        'stock.location',
        'read',
        [[locationId], ['complete_name']]
      );
      const row = rows?.[0];
      if (!row) return null;
      const name = typeof row.complete_name === 'string' ? row.complete_name.trim() : '';
      return name.length > 0 ? name : null;
    } catch (error) {
      ctx.logger?.warn?.(
        `Odoo lookupLocationCompleteName(${locationId}) falló: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  async getCatalogChanges(since: string | null, ctx: AdapterContext): Promise<ErpCatalogRow[]> {
    const client = this.buildClient(ctx);
    const domain: unknown[] = since ? [['write_date', '>', since]] : [];
    // Filtro opcional para clientes con `website_sale`: sincroniza solo los
    // templates marcados como publicados en el storefront de Odoo. Sin este
    // filtro se traen TODOS los `product.template` con `sale_ok=true`, que
    // incluye items internos / migraciones viejas con `list_price=1`.
    // Field `is_published` viene de `website_sale`; si el módulo no está
    // instalado, Odoo tira "Field is_published does not exist" — clear signal
    // para que el operador ponga `only_published=false` en la config.
    if (this.odooSettings(ctx)?.only_published === true) {
      domain.push(['is_published', '=', true]);
    }

    // Sonda una vez por instancia (5 min de cache): qué campos opcionales del
    // template están presentes. Se resuelve ANTES del loop para no repetir el
    // `fields_get` en cada página.
    const optionalTemplateFields = await this.resolveAvailableProductTemplateFields(client, ctx);

    // Base: campos standard que siempre existen. Los opcionales se agregan
    // solo si la sonda los confirmó — pedir un campo inexistente hace fallar
    // el `search_read` entero.
    const baseFields: string[] = [
      'id',
      'default_code',
      'name',
      'list_price',
      'categ_id',
      'write_date',
      'active',
      'sale_ok',
      'type',
      // `weight` es standard de Odoo core (`product.template.weight`, float en
      // kg por default). No requiere sonda.
      'weight',
      // `product_brand_id` viene del módulo `product_brand` (OCA); si el
      // módulo no está instalado, Odoo devuelve el field como `undefined`
      // en la respuesta (no falla el read).
      'product_brand_id',
    ];
    const requestedFields = [
      ...baseFields,
      ...OPTIONAL_PRODUCT_TEMPLATE_FIELDS.filter((f) => optionalTemplateFields.has(f)),
    ];

    const out: ErpCatalogRow[] = [];
    let offset = 0;
    while (offset < CATALOG_MAX_PRODUCTS) {
      const rows = await client.executeKw<ProductTemplateCatalogRow[]>(
        'product.template',
        'search_read',
        [domain],
        {
          // NO se pide `image_1920` a propósito: en Odoo son base64 de 1-3 MB
          // por producto y matan el payload (Cloudflare corta la conexión con
          // 61+ productos). Las imágenes se traen por SKU vía
          // `fetchProductImage`, que es fase separada del sync.
          fields: requestedFields,
          limit: CATALOG_PAGE_SIZE,
          offset,
          order: 'id asc',
        }
      );
      const batch = rows ?? [];
      if (batch.length === 0) break;
      for (const row of batch) {
        const code = codeOrNull(row.default_code);
        if (!code) continue;
        out.push(this.toCatalogRow(code, row));
      }
      if (batch.length < CATALOG_PAGE_SIZE) break;
      offset += batch.length;
    }
    if (offset >= CATALOG_MAX_PRODUCTS) {
      ctx.logger?.warn?.(
        `Odoo: barrido de catálogo cortado en ${CATALOG_MAX_PRODUCTS} productos (tope de v1). Ampliá el cinturón o acotá el watermark.`
      );
    }
    return out;
  }

  private toCatalogRow(code: string, row: ProductTemplateCatalogRow): ErpCatalogRow {
    const categoryId = many2oneId(row.categ_id);
    const listPrice =
      typeof row.list_price === 'number' && Number.isFinite(row.list_price) && row.list_price > 0
        ? row.list_price
        : null;
    // Odoo maneja el precio base en `list_price` (una sola tarifa a nivel
    // template). Se expone en `ODOO_BASE_PRICE_LIST_INDEX` para respetar el
    // contrato de `prices: Record<number, number | null>` — el planner mapea
    // listas por índice y v1 solo trae la base.
    const prices: Record<number, number | null> = { [ODOO_BASE_PRICE_LIST_INDEX]: listPrice };

    // `description_ecommerce` es HTML del builder de Odoo. Se convierte a
    // Markdown para guardarlo en `product.description` (text plain de Medusa)
    // preservando énfasis, listas y encabezados sin exponer al storefront a
    // sanitizar HTML crudo. Si el campo no está presente en la instancia (ver
    // `resolveAvailableProductTemplateFields`), llega como `undefined` y el
    // helper devuelve `null` → misma semántica que antes del cambio.
    const description =
      typeof row.description_ecommerce === 'string'
        ? htmlToMarkdown(row.description_ecommerce)
        : null;

    // `weight` en Odoo llega como float en la UoM configurada (default kg).
    // Rechazamos 0, negativos y valores no finitos; el planner interpreta
    // `null` como "sin peso cargado" y no dispara diff, evitando updates
    // masivos inútiles cuando el ERP no lo tiene poblado.
    const weight =
      typeof row.weight === 'number' && Number.isFinite(row.weight) && row.weight > 0
        ? row.weight
        : null;

    return {
      code,
      title: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : null,
      description,
      prices,
      // El template no expone `tax_rate` directo — vive en `taxes_id` (many2many)
      // y requiere resolver el impuesto. v1 lo deja en null: el planner cae al
      // fallback global.
      tax_rate: null,
      published: Boolean(row.active) && Boolean(row.sale_ok),
      active: Boolean(row.active),
      // Odoo usa IDs numéricos para `product.category`; se prefija con el
      // provider para distinguir del category_code de Zeus/otros ERPs.
      // Prefijo UPPERCASE por convención del planner (`plan-category-assignments.ts`
      // normaliza con `.toUpperCase()` antes de buscar en el árbol). Emitir en
      // minúscula deja los códigos como `unknown_codes` y NO linkea productos.
      category_code: categoryId !== null ? `ODOO:${categoryId}` : null,
      brand: many2oneName(row.product_brand_id),
      family: null,
      barcode: null,
      factory_code: null,
      weight,
      length: null,
      height: null,
      width: null,
      modified_at: typeof row.write_date === 'string' && row.write_date.trim() ? row.write_date.trim() : null,
    };
  }

  async fetchCategories(ctx: AdapterContext): Promise<ErpCategoryNode[]> {
    const client = this.buildClient(ctx);
    const rows = await client.executeKw<ProductCategoryRow[]>(
      'product.category',
      'search_read',
      [[]],
      {
        fields: ['id', 'name', 'parent_id', 'complete_name'],
        limit: CATEGORY_LIMIT,
        order: 'parent_id asc, id asc',
      }
    );

    // Se aplana en dos pasadas: primero se indexan por id → nodo intermedio,
    // luego se emite en orden padres-antes-que-hijos con rank por hermano y
    // level calculado siguiendo la cadena de padres.
    const byId = new Map<number, { row: ProductCategoryRow; parentId: number | null }>();
    for (const row of rows ?? []) {
      byId.set(row.id, { row, parentId: many2oneId(row.parent_id) });
    }

    // Ordenamiento topológico simple: se agrupan hijos por parentId y se
    // recorre por niveles empezando por las raíces.
    const childrenOf = new Map<number | null, ProductCategoryRow[]>();
    for (const { row, parentId } of byId.values()) {
      const bucket = childrenOf.get(parentId) ?? [];
      bucket.push(row);
      childrenOf.set(parentId, bucket);
    }
    // Estabilidad: ordenar por id dentro del mismo padre (Odoo no expone `rank`
    // explícito en el maestro de categorías).
    for (const bucket of childrenOf.values()) {
      bucket.sort((a, b) => a.id - b.id);
    }

    const out: ErpCategoryNode[] = [];
    const seen = new Set<number>();
    const walk = (parentId: number | null, level: number): void => {
      const bucket = childrenOf.get(parentId) ?? [];
      let rank = 0;
      for (const row of bucket) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        const name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : null;
        if (!name) continue;
        // Prefijo UPPERCASE por convención del planner: el árbol siempre está
        // en mayúsculas y `toCatalogRow` emite `ODOO:<id>` como category_code.
        const code = `ODOO:${row.id}`;
        const parentCode = parentId !== null ? `ODOO:${parentId}` : null;
        out.push({
          code,
          name,
          parent_code: parentCode,
          rank: rank++,
          level,
          image_url: null,
        });
        walk(row.id, level + 1);
      }
    };
    walk(null, 0);
    return out;
  }

  async fetchProductImage(code: string, ctx: AdapterContext): Promise<ErpProductImage | null> {
    const cleanCode = sanitizeSku(code);
    if (!cleanCode) return null;
    const client = this.buildClient(ctx);
    const rows = await client.executeKw<ProductProductImageRow[]>(
      'product.product',
      'search_read',
      [[['default_code', '=', cleanCode]]],
      { fields: ['product_tmpl_id', 'image_1920'], limit: 1 }
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) return null;
    const base64 = row.image_1920;
    if (typeof base64 !== 'string' || !base64) return null;

    // Odoo siempre re-encodea la imagen a PNG internamente antes de guardarla
    // en `image_1920`, así que asumir image/png es correcto — no hace falta
    // sniff por magic bytes.
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.byteLength === 0) return null;
    return { content: buffer, mime_type: 'image/png', extension: 'png' };
  }

  /**
   * Notifica una venta a Odoo creando (y opcionalmente confirmando) un
   * `sale.order`.
   *
   * Flujo:
   *  1. **Idempotencia por `client_order_ref`**. Se busca un `sale.order`
   *     existente con `client_order_ref = payload.order_id`. Si aparece, se
   *     devuelve `duplicate` con el ID como `external_ref` y NO se crea nada.
   *     `name` NO sirve como llave: Odoo lo genera del secuenciador `SO/…` y
   *     no lo controlamos.
   *  2. **Partner**. Se resuelve por `vat` (CUIT/DNI) cuando el payload lo
   *     trae; fallback a `email`. Si no aparece se crea con
   *     `res.partner.create`. `country_id` queda null en v1 (ver caveats
   *     arriba).
   *  3. **Líneas**. Para cada ítem se resuelve el ID de `product.product` por
   *     `default_code = sku`. SKU faltante o no resoluble → `ErpNonRetryableError`
   *     (fail fast: reintentar no lo arregla). Se manda `price_unit` explícito
   *     con el bruto que cobró Medusa; los impuestos los aplica Odoo con los
   *     `taxes_id` default de cada producto (ver caveat en el JSDoc de la clase).
   *  4. **Envío**. Si `settings.odoo.shipping_item_code` está seteado y
   *     `payload.totals.shipping > 0`, se agrega una línea extra con
   *     ese SKU (buscando el producto por `default_code`). SKU no existe →
   *     `ErpNonRetryableError` con mensaje específico.
   *  5. **Confirmación**. Por default se llama `action_confirm` sobre el ID
   *     creado (pasa a "sales order"); `settings.odoo.auto_confirm = false`
   *     deja la orden como quotation (`draft`).
   */
  async notifySale(payload: ErpSalePayload, ctx: AdapterContext): Promise<ErpSaleResult> {
    const client = this.buildClient(ctx);

    // Fail fast: cada línea necesita SKU. Sin SKU no hay `product_id` posible
    // y reintentar no lo arregla — se corrige la orden en Medusa o el mapeo.
    const missingSku = payload.items.filter((item) => !item.sku?.trim());
    if (missingSku.length) {
      throw new ErpNonRetryableError(
        `Odoo: ${missingSku.length} ítem(s) de la orden no tienen SKU y el pedido exige código de artículo por línea (${missingSku
          .map((item) => item.title ?? 's/título')
          .join(', ')}).`
      );
    }

    // Idempotencia ANTES de tocar partners o productos: si el pedido ya
    // existe, no queremos ni crear un partner extra ni resolver productos.
    const duplicate = await this.findExistingSaleOrder(client, payload.order_id);
    if (duplicate !== null) {
      return { status: 'duplicate', external_ref: String(duplicate) };
    }

    const partnerId = await this.resolvePartner(client, payload, ctx);
    const productIds = await this.resolveProductIds(
      client,
      payload.items.map((item) => sanitizeSku(item.sku!))
    );

    const settings = this.odooSettings(ctx);

    const orderLines: OdooCreateCommand<SaleOrderLinePayload>[] = payload.items.map((item) => {
      const cleanSku = sanitizeSku(item.sku!);
      const productId = productIds.get(cleanSku);
      // Los productos faltantes se validaron dentro de resolveProductIds; este
      // guard es un cinturón por si el mapa se corrompe entremedio.
      if (productId === undefined) {
        throw new ErpNonRetryableError(
          `Odoo: no se encontró el producto con default_code '${cleanSku}' al armar las líneas.`
        );
      }
      const tax = this.applyTaxBehavior(item.unit_price, payload, settings?.tax_behavior);
      return [
        0,
        0,
        {
          product_id: productId,
          product_uom_qty: item.quantity,
          // Bruto tal cual lo cobró Medusa: Odoo aplica los impuestos default
          // del producto sobre este precio (ver caveat en el JSDoc de la clase).
          price_unit: tax.price_unit ?? item.unit_price,
          name: item.title ?? cleanSku,
          ...(tax.tax_id ? { tax_id: tax.tax_id } : {}),
        },
      ];
    });

    const shippingCode = settings?.shipping_item_code?.trim() || null;
    const shippingAmount = payload.totals.shipping;

    if (shippingCode && shippingAmount > 0) {
      const shippingProductId = await this.resolveShippingProductId(client, shippingCode);
      const tax = this.applyTaxBehavior(shippingAmount, payload, settings?.tax_behavior);
      orderLines.push([
        0,
        0,
        {
          product_id: shippingProductId,
          product_uom_qty: 1,
          price_unit: tax.price_unit ?? shippingAmount,
          name: payload.shipping.method
            ? `Costo de envío (${payload.shipping.method})`
            : 'Costo de envío',
          ...(tax.tax_id ? { tax_id: tax.tax_id } : {}),
        },
      ]);
    }

    // Si no hay artículo de envío configurado, el flete queda como nota del
    // pedido — mismo criterio que Zeus para mantener trazabilidad.
    const noteLines: string[] = [];
    if (!shippingCode && shippingAmount > 0) {
      noteLines.push(
        `Envío: ${shippingAmount} ${payload.currency_code.toUpperCase()} (sin artículo de envío configurado, no incluido como ítem).`
      );
    }

    const orderPayload: Record<string, unknown> = {
      partner_id: partnerId,
      client_order_ref: payload.order_id,
      order_line: orderLines,
    };
    if (noteLines.length > 0) {
      orderPayload.note = noteLines.join('\n');
    }

    const pricelistId = await this.resolvePricelistId(client, partnerId, settings);
    if (pricelistId !== null) {
      orderPayload.pricelist_id = pricelistId;
    }

    // Custom fields opcionales (escuela + asignación de alumnos). Se agregan
    // SOLO si Odoo ya los tiene definidos — `resolveAvailableOptionalFields`
    // hace la sonda. Sin campos, la orden se crea igual sin esa data: el
    // envío al ERP NUNCA se bloquea porque el cliente no configuró su Odoo.
    if (payload.school || payload.student_assignments) {
      const available = await this.resolveAvailableOptionalFields(client, ctx);
      if (payload.school) {
        if (available.has('x_school_external_ref')) {
          orderPayload.x_school_external_ref = payload.school.external_ref;
        }
        if (available.has('x_school_name')) {
          orderPayload.x_school_name = payload.school.name;
        }
        if (available.has('x_source_site_id')) {
          orderPayload.x_source_site_id = payload.school.source_site_id;
        }
      }
      if (payload.student_assignments && available.has('x_student_assignments')) {
        // Serializado como string: en Odoo 15/16 el custom field default es
        // `Text` y acepta directo. En Odoo 17+ con `Jsonb`, `JSON.parse` en el
        // ORM al persistir es trivial. Mandar como string cubre ambos casos
        // sin tener que sondear el `type` del campo.
        orderPayload.x_student_assignments = JSON.stringify(payload.student_assignments);
      }
    }

    const created = await client.executeKw<number>('sale.order', 'create', [orderPayload]);
    if (!Number.isInteger(created) || created <= 0) {
      throw new ErpNonRetryableError(
        `Odoo: la creación del sale.order no devolvió un ID válido (recibido ${JSON.stringify(created)}).`
      );
    }

    // Default: confirmar. `auto_confirm: false` deja la orden como quotation
    // para revisión manual desde Odoo.
    if (settings?.auto_confirm !== false) {
      await client.executeKw<boolean>('sale.order', 'action_confirm', [[created]]);
    }

    return {
      status: 'sent',
      external_ref: String(created),
      response: { id: created, confirmed: settings?.auto_confirm !== false },
    };
  }

  /**
   * Idempotencia: busca un `sale.order` por `client_order_ref`. Devuelve el ID
   * si existe, null si no. Se hace ANTES de resolver partner/productos para no
   * generar side effects en reintentos.
   */
  private async findExistingSaleOrder(
    client: OdooRpcClient,
    orderId: string
  ): Promise<number | null> {
    const rows = await client.executeKw<SaleOrderLookupRow[]>(
      'sale.order',
      'search_read',
      [[['client_order_ref', '=', orderId]]],
      { fields: ['id', 'name'], limit: 1 }
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    return row?.id ?? null;
  }

  /**
   * Busca el partner por VAT (cuando hay documento fiscal) y cae a email si no
   * aparece. Si tampoco existe por email, lo crea. Para `country_code === 'AR'`
   * y localización `l10n_ar` presente, además:
   *
   * - En el CREATE agrega los IDs fiscales (responsibility AFIP, tipo de
   *   documento LATAM, country_id AR) y usa `legal_name` como `name` cuando la
   *   condición es responsable inscripto / exento / monotributo.
   * - En el MATCH POR EMAIL lee el partner con los mismos campos fiscales y
   *   parcha SOLO los que están vacíos en Odoo — regla conservadora, nunca
   *   pisamos data existente porque no sabemos qué configuró el equipo del ERP
   *   a mano.
   * - En el MATCH POR VAT NO parcha: si el partner ya tiene VAT probablemente
   *   está fiscal-complete, y arriesgar un write ahí introduce cambios silentes
   *   sobre partners históricos.
   */
  private async resolvePartner(
    client: OdooRpcClient,
    payload: ErpSalePayload,
    ctx: AdapterContext
  ): Promise<number> {
    const doc = payload.customer.document;
    const vat = doc.number ? doc.number.replace(/\s+/g, '').trim() : '';
    const email = payload.customer.email?.trim() ?? '';

    const isAr = payload.country_code === 'AR';
    const arFiscalIds = isAr ? await this.resolveArFiscalIds(client, ctx) : null;

    if (vat) {
      const byVat = await client.executeKw<ResPartnerRow[]>(
        'res.partner',
        'search_read',
        [[['vat', '=', vat]]],
        { fields: ['id', 'name', 'email', 'vat'], limit: 1 }
      );
      const row = Array.isArray(byVat) ? byVat[0] : undefined;
      if (row?.id) return row.id;
    }

    if (email) {
      const byEmail = await client.executeKw<ResPartnerRow[]>(
        'res.partner',
        'search_read',
        [[['email', '=', email]]],
        { fields: ['id', 'name', 'email', 'vat'], limit: 1 }
      );
      const row = Array.isArray(byEmail) ? byEmail[0] : undefined;
      if (row?.id) {
        // Match por email → intentamos completar fiscal data ausente. NO pisamos
        // valores existentes (buildArFiscalPatch se ocupa del filtrado).
        if (arFiscalIds) {
          const existingRows = await client.executeKw<
            Array<{
              id: number;
              vat?: unknown;
              country_id?: unknown;
              l10n_ar_afip_responsibility_type_id?: unknown;
              l10n_latam_identification_type_id?: unknown;
            }>
          >(
            'res.partner',
            'read',
            [[row.id]],
            {
              fields: [
                'vat',
                'country_id',
                'l10n_ar_afip_responsibility_type_id',
                'l10n_latam_identification_type_id',
              ],
            }
          );
          const existing = existingRows?.[0];
          if (existing) {
            const patch = this.buildArFiscalPatch(arFiscalIds, payload, existing);
            if (Object.keys(patch).length > 0) {
              await client.executeKw<boolean>('res.partner', 'write', [[row.id], patch]);
            }
          }
        }
        return row.id;
      }
    }

    // Crear partner: el nombre es lo único requerido por Odoo; el resto es
    // best-effort desde el payload.
    const name =
      [payload.customer.first_name, payload.customer.last_name].filter(Boolean).join(' ').trim() ||
      email ||
      (vat ? `Cliente ${vat}` : `Cliente orden ${payload.order_id}`);

    const partnerBody: Record<string, unknown> = { name };
    if (email) partnerBody.email = email;
    if (payload.customer.phone) partnerBody.phone = payload.customer.phone;
    if (vat) partnerBody.vat = vat;
    if (payload.shipping.address.street) partnerBody.street = payload.shipping.address.street;
    if (payload.shipping.address.city) partnerBody.city = payload.shipping.address.city;
    if (payload.shipping.address.postal_code) partnerBody.zip = payload.shipping.address.postal_code;

    // Fiscal data AR: el patch include `name = legal_name` cuando corresponde
    // (responsable inscripto / exento / monotributo). Merge después del body
    // base para que gane sobre el `name` computed arriba.
    if (arFiscalIds) {
      const arPatch = this.buildArFiscalPatch(arFiscalIds, payload);
      Object.assign(partnerBody, arPatch);
    }

    const createdId = await client.executeKw<number>('res.partner', 'create', [partnerBody]);
    if (!Number.isInteger(createdId) || createdId <= 0) {
      throw new ErpNonRetryableError(
        `Odoo: la creación del partner no devolvió un ID válido (recibido ${JSON.stringify(createdId)}).`
      );
    }
    return createdId;
  }

  /**
   * Traduce SKUs a `product.product.id` en UNA sola llamada con
   * `[["default_code", "in", <lista>]]`. Un SKU que no existe en Odoo es un
   * error de datos: se falla la venta entera con `ErpNonRetryableError` para
   * que el outbox lo mande a `dead_letter` (reintentar no lo arregla — hay
   * que crear el producto en Odoo o corregir el SKU).
   */
  private async resolveProductIds(
    client: OdooRpcClient,
    skus: string[]
  ): Promise<Map<string, number>> {
    const unique = Array.from(new Set(skus.filter(Boolean)));
    if (unique.length === 0) return new Map();

    const rows = await client.executeKw<ProductProductLookupRow[]>(
      'product.product',
      'search_read',
      [[['default_code', 'in', unique]]],
      { fields: ['id', 'default_code'], limit: unique.length }
    );

    const out = new Map<string, number>();
    for (const row of rows ?? []) {
      const code = codeOrNull(row.default_code);
      if (code) out.set(code, row.id);
    }

    const missing = unique.filter((sku) => !out.has(sku));
    if (missing.length > 0) {
      throw new ErpNonRetryableError(
        `Odoo: no existen productos con default_code ${missing
          .map((sku) => `'${sku}'`)
          .join(', ')} — crealos en Odoo (product.product) o corregí el SKU de las variantes en Medusa.`
      );
    }
    return out;
  }

  /**
   * Resuelve el `product.product.id` del artículo "envío" configurado en
   * `settings.odoo.shipping_item_code`. Se separa de `resolveProductIds` a
   * propósito: el error apunta al setting, no al catálogo de la orden.
   */
  private async resolveShippingProductId(
    client: OdooRpcClient,
    shippingCode: string
  ): Promise<number> {
    const rows = await client.executeKw<ProductProductLookupRow[]>(
      'product.product',
      'search_read',
      [[['default_code', '=', shippingCode]]],
      { fields: ['id', 'default_code'], limit: 1 }
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row?.id) {
      throw new ErpNonRetryableError(
        `Odoo: no se encontró el producto de envío con default_code '${shippingCode}' — configurá el SKU correcto en settings.odoo.shipping_item_code o creá el producto en Odoo.`
      );
    }
    return row.id;
  }

  /**
   * `sale.order.create` por RPC no dispara el onchange `_onchange_partner_id`,
   * así que el pricelist heredado del partner no se aplica y Odoo cae al default
   * global de la instancia — que puede ser en moneda distinta a la esperada.
   * Por eso el ordering: setting explícito primero, luego el del partner leído
   * a mano, y como último recurso dejar que Odoo elija (compat con lo previo).
   */
  private async resolvePricelistId(
    client: OdooRpcClient,
    partnerId: number,
    settings: ErpOdooSettings | null
  ): Promise<number | null> {
    if (settings?.pricelist_id) return settings.pricelist_id;
    const rows = await client.executeKw<Array<{ id: number; property_product_pricelist?: OdooMany2One }>>(
      'res.partner',
      'read',
      [[partnerId]],
      { fields: ['property_product_pricelist'] }
    );
    // Odoo many2one vacío viene como `false`; poblado, como `[id, name]`.
    const pl = rows?.[0]?.property_product_pricelist;
    if (Array.isArray(pl) && typeof pl[0] === 'number') return pl[0];
    return null;
  }

  /**
   * Aplica el `tax_behavior` configurado a la line del `sale.order.create`.
   *
   * Devuelve un objeto con posibles overrides:
   * - `price_unit`: si el modo es `backcalc_from_gross` y hubo match, viene
   *   el neto ya calculado; sino, `undefined`.
   * - `tax_id`: si el modo es `override_tax_ids`, viene el comando m2m
   *   `[[6, 0, tax_ids]]`; sino, `undefined`.
   *
   * Modo `default` o sin match en `backcalc_from_gross` -> devuelve todo
   * `undefined` para no tocar la line.
   */
  private applyTaxBehavior(
    originalPriceUnit: number,
    payload: ErpSalePayload,
    behavior: ErpOdooTaxBehavior | undefined
  ): { price_unit?: number; tax_id?: [[number, number, number[]]] } {
    if (!behavior || behavior.mode === 'default') return {};

    if (behavior.mode === 'override_tax_ids') {
      return { tax_id: [[6, 0, behavior.tax_ids]] };
    }

    const country = payload.country_code;
    const currency = payload.currency_code?.toUpperCase();
    const rate = behavior.rates.find((r) => {
      if (r.match.country_code) return r.match.country_code === country;
      if (r.match.currency_code) return r.match.currency_code.toUpperCase() === currency;
      return false;
    });
    if (!rate) {
      // eslint-disable-next-line no-console
      console.warn(
        `[erp:odoo] backcalc: no rate match for country=${country ?? '?'} currency=${currency ?? '?'} - falling back to default (no back-calc).`
      );
      return {};
    }
    const netto = Math.round((originalPriceUnit / (1 + rate.rate_percent / 100)) * 100) / 100;
    return { price_unit: netto };
  }
}
