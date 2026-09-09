import type { ErpOdooSettings, ErpSalePayload } from '../types';
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

export class OdooErpAdapter implements ErpAdapter {
  readonly provider = 'odoo';

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
          fields: [
            'id',
            'default_code',
            'name',
            'list_price',
            'categ_id',
            'write_date',
            'active',
            'sale_ok',
            'type',
            // `product_brand_id` viene del módulo `product_brand` (OCA); si el
            // módulo no está instalado, Odoo devuelve el field como `undefined`
            // en la respuesta (no falla el read).
            'product_brand_id',
          ],
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

    return {
      code,
      title: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : null,
      description: null,
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
      weight: null,
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

    const partnerId = await this.resolvePartner(client, payload);
    const productIds = await this.resolveProductIds(
      client,
      payload.items.map((item) => sanitizeSku(item.sku!))
    );

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
      return [
        0,
        0,
        {
          product_id: productId,
          product_uom_qty: item.quantity,
          // Bruto tal cual lo cobró Medusa: Odoo aplica los impuestos default
          // del producto sobre este precio (ver caveat en el JSDoc de la clase).
          price_unit: item.unit_price,
          name: item.title ?? cleanSku,
        },
      ];
    });

    const settings = this.odooSettings(ctx);
    const shippingCode = settings?.shipping_item_code?.trim() || null;
    const shippingAmount = payload.totals.shipping;

    if (shippingCode && shippingAmount > 0) {
      const shippingProductId = await this.resolveShippingProductId(client, shippingCode);
      orderLines.push([
        0,
        0,
        {
          product_id: shippingProductId,
          product_uom_qty: 1,
          price_unit: shippingAmount,
          name: payload.shipping.method
            ? `Costo de envío (${payload.shipping.method})`
            : 'Costo de envío',
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
   * aparece. Si tampoco existe por email, lo crea. `country_id` queda null en
   * v1 (ver caveat de la clase).
   */
  private async resolvePartner(
    client: OdooRpcClient,
    payload: ErpSalePayload
  ): Promise<number> {
    const doc = payload.customer.document;
    const vat = doc.number ? doc.number.replace(/\s+/g, '').trim() : '';
    const email = payload.customer.email?.trim() ?? '';

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
      if (row?.id) return row.id;
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
    // `country_id` se deja fuera en v1: requiere resolver el `res.country` por
    // código ISO en otro request y no vale el round-trip para el alta.

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
}
