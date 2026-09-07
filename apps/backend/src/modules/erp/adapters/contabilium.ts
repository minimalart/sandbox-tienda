import type { ErpContabiliumSettings, ErpSalePayload } from '../types';
import {
  ErpAuthError,
  ErpConnectionError,
  ErpNonRetryableError,
  type AdapterContext,
  type ErpAdapter,
  type ErpCapabilities,
  type ErpSaleResult,
  type ErpStockResult,
  type ErpValidationResult,
} from './types';

/**
 * Adapter Contabilium (ERP argentino, rest.contabilium.com), implementado
 * contra la documentación oficial (documenter.getpostman.com/view/17702437/2s93shz9yz):
 *
 * - Auth: OAuth2 client_credentials — `POST /token` (x-www-form-urlencoded,
 *   client_id = email de la cuenta, client_secret = API Key) → Bearer con
 *   expiración ~24h. El token se cachea por credencial y ante un 401 se
 *   renueva una vez y se reintenta.
 * - Stock: `GET /api/inventarios/getStockBySKU?codigo=` con pocos SKUs (trae
 *   total + desglose por depósito) o barrido paginado de
 *   `GET /api/inventarios/getStockByDeposito` (pageSize fijo 50, rate limit
 *   30 req/10s → se pacea) para el catálogo completo. Se usa
 *   `StockConReservas` (disponible = actual − reservado). Contabilium
 *   normaliza los SKUs a MAYÚSCULAS → matching case-insensitive.
 * - Venta: dos modos por `settings.contabilium.sale_mode`:
 *   `orden_venta` (default) crea una orden de venta SIN facturar
 *   (`POST /api/ordenesVenta`) — la respuesta del PRD a "registrar la venta
 *   sin emitir comprobante"; `factura_cobrada` emite factura electrónica
 *   cobrada (`POST /api/comprobantes/emitirFECobrada`, requiere punto de
 *   venta y FE habilitada). Ambos exigen resolver el cliente
 *   (GetClientByDoc → CreateCliente) y los conceptos por SKU (getByCodigo);
 *   las órdenes NO aceptan ítems de descripción libre.
 *
 * Setup completo: docs/recipes/erp-contabilium.md.
 */

const DEFAULT_BASE_URL = 'https://rest.contabilium.com';
/** pageSize fijo de getStockByDeposito según docs ("No modificable"). */
const SWEEP_PAGE_SIZE = 50;
const PER_CODE_THRESHOLD = 10;
const SWEEP_MAX_PAGES = 2_000;
/** Pausa entre páginas del barrido: el endpoint limita 30 req / 10 s por IP. */
const SWEEP_THROTTLE_MS = 350;
const REQUEST_TIMEOUT_MS = 30_000;
const TOKEN_EXPIRY_MARGIN_S = 60;
const DEFAULT_TAX_RATE = 0.21;

type DepositoRow = { Id: number; Nombre?: string; Activo?: boolean };

type StockBySkuResponse = {
  Id?: number;
  Codigo?: string;
  StockActual?: number;
  StockReservado?: number;
  StockConReservas?: number;
  stock?: Array<{
    Id?: number;
    Codigo?: string;
    StockActual?: number;
    StockReservado?: number;
    StockConReservas?: number;
  }> | null;
};

type StockByDepositoResponse = {
  Items?: Array<{ Id?: number; Codigo?: string; StockConReservas?: number }> | null;
};

type ConceptoResponse = { Id?: number; Codigo?: string; Nombre?: string };

type EmitirFeResponse = {
  idComprobante?: number;
  errores?: string;
  cae?: string;
  numero?: string;
  url?: string;
};

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function sanitizeSku(sku: string): string {
  return sku.replace(/[\r\n]/g, '').trim();
}

export class ContabiliumErpAdapter implements ErpAdapter {
  readonly provider = 'contabilium';

  /** Cache de tokens por credencial (expires_in ~86400s; margen de 60s). */
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();

  // Inyectable para tests; en runtime usa el fetch global de Node.
  constructor(private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch) {}

  getCapabilities(): ErpCapabilities {
    // batch_size gigante a propósito: el stock sync entrega TODO el catálogo en
    // una llamada y este adapter decide la estrategia (per-code vs barrido).
    return {
      stock_pull: true,
      sale_notify: true,
      stock_batch_size: 100_000,
      // Sin `getCatalogChanges` implementado: el motor de catálogo no lo llama.
      catalog_pull: false,
      catalog_prices_include_tax: false,
      categories_pull: false,
      tinting_price: false,
      product_images: false,
      invoice_fetch: false,
    };
  }

  private cblSettings(ctx: AdapterContext): ErpContabiliumSettings {
    const settings = ctx.settings as { contabilium?: ErpContabiliumSettings } | null | undefined;
    return settings?.contabilium ?? {};
  }

  private baseUrl(ctx: AdapterContext): string {
    return (this.cblSettings(ctx).base_url ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  private async getToken(ctx: AdapterContext, force = false): Promise<string> {
    const clientId = ctx.credentials?.client_id?.trim();
    const clientSecret = ctx.credentials?.client_secret?.trim();
    if (!clientId || !clientSecret) {
      throw new ErpAuthError(
        "Contabilium: faltan credenciales 'client_id' (email de la cuenta) y 'client_secret' (API Key)."
      );
    }

    const cacheKey = `${this.baseUrl(ctx)}|${clientId}|${clientSecret}`;
    const cached = this.tokenCache.get(cacheKey);
    if (!force && cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl(ctx)}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
        signal: controller.signal,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ErpConnectionError(`Contabilium: no se pudo conectar al obtener el token (${reason}).`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const text = (await response.text().catch(() => '')).slice(0, 300);
      if (response.status >= 500) {
        throw new ErpConnectionError(`Contabilium: error del servidor al obtener el token (HTTP ${response.status}).`);
      }
      throw new ErpAuthError(
        `Contabilium: credenciales rechazadas al obtener el token (HTTP ${response.status})${text ? ` — ${text}` : ''}`
      );
    }

    const data = (await response.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
    } | null;
    if (!data?.access_token) {
      throw new ErpConnectionError('Contabilium: la respuesta del token no trajo access_token.');
    }
    const ttlS = Math.max((data.expires_in ?? 3600) - TOKEN_EXPIRY_MARGIN_S, 60);
    this.tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + ttlS * 1000 });
    return data.access_token;
  }

  /**
   * Request autenticado con mapeo de errores a la taxonomía del módulo.
   * Contabilium responde a veces texto/número plano (ej: CreateCliente
   * devuelve el Id pelado) → se parsea como JSON con fallback a texto.
   * `allow404: true` devuelve null en vez de lanzar (lookups por código/doc).
   */
  private async request<T>(
    ctx: AdapterContext,
    method: 'GET' | 'POST',
    path: string,
    opts: {
      query?: Record<string, string | number | undefined>;
      body?: unknown;
      allow404?: boolean;
      retryOn401?: boolean;
    } = {}
  ): Promise<T | null> {
    const url = new URL(`${this.baseUrl(ctx)}${path}`);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const token = await this.getToken(ctx);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ErpConnectionError(`Contabilium: no se pudo conectar (${reason}).`);
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 && (opts.retryOn401 ?? true)) {
      // Token vencido/revocado: renovar una vez y reintentar.
      await this.getToken(ctx, true);
      return this.request<T>(ctx, method, path, { ...opts, retryOn401: false });
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
    const detail = raw ? ` — ${raw.slice(0, 300)}` : '';
    if (response.status === 401 || response.status === 403) {
      throw new ErpAuthError(`Contabilium: acceso rechazado (HTTP ${response.status})${detail}`);
    }
    if (response.status >= 500) {
      throw new ErpConnectionError(`Contabilium: error del servidor (HTTP ${response.status})${detail}`);
    }
    throw new ErpNonRetryableError(`Contabilium: la API rechazó la operación (HTTP ${response.status})${detail}`);
  }

  async validateCredentials(ctx: AdapterContext): Promise<ErpValidationResult> {
    try {
      const info = await this.request<{ RazonSocial?: string; CUIT?: string }>(
        ctx,
        'GET',
        '/api/usuarios/obtenerinfo'
      );
      let depositoNote = '';
      const depositoId = this.cblSettings(ctx).deposito_id;
      if (depositoId) {
        const depositos = await this.request<DepositoRow[]>(ctx, 'GET', '/api/inventarios/getDepositos');
        if (!(depositos ?? []).some((d) => d.Id === depositoId)) {
          return {
            ok: false,
            message: `Contabilium: el depósito ${depositoId} no existe en la cuenta (ver /api/inventarios/getDepositos).`,
          };
        }
        depositoNote = `, depósito ${depositoId} verificado`;
      }
      const who = info?.RazonSocial ?? 'cuenta';
      const cuit = info?.CUIT ? ` (CUIT ${info.CUIT})` : '';
      return { ok: true, message: `Contabilium: conexión OK — ${who}${cuit}${depositoNote}.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async getStockBySku(skus: string[], ctx: AdapterContext): Promise<Map<string, ErpStockResult>> {
    const depositoId = this.cblSettings(ctx).deposito_id ?? undefined;
    const requested = skus.map((sku) => ({ raw: sku, clean: sanitizeSku(sku).toUpperCase() }));

    const available =
      requested.length <= PER_CODE_THRESHOLD
        ? await this.stockByCode(ctx, requested.map((r) => r.clean), depositoId)
        : await this.stockBySweep(ctx, depositoId);

    const results = new Map<string, ErpStockResult>();
    for (const { raw, clean } of requested) {
      const quantity = available.get(clean);
      results.set(raw, quantity === undefined ? { found: false } : { found: true, quantity });
    }
    return results;
  }

  /** Pocos SKUs: getStockBySKU trae el total y el desglose por depósito. */
  private async stockByCode(
    ctx: AdapterContext,
    skus: string[],
    depositoId: number | undefined
  ): Promise<Map<string, number>> {
    const available = new Map<string, number>();
    for (const sku of skus) {
      if (!sku) continue;
      let data: StockBySkuResponse | null;
      try {
        data = await this.request<StockBySkuResponse>(ctx, 'GET', '/api/inventarios/getStockBySKU', {
          query: { codigo: sku },
          allow404: true,
        });
      } catch (error) {
        // Un 4xx puntual en el lookup de UN código = ese SKU no resolvible →
        // not_found visible en el log del sync. Auth/conexión sí abortan.
        if (error instanceof ErpNonRetryableError) continue;
        throw error;
      }
      if (!data || data.Id === undefined) continue;
      if (depositoId) {
        const row = (data.stock ?? []).find((entry) => entry.Id === depositoId);
        available.set(sku, Number(row?.StockConReservas) || 0);
      } else {
        available.set(sku, Number(data.StockConReservas) || 0);
      }
    }
    return available;
  }

  /**
   * Catálogo completo: barrido paginado de getStockByDeposito (50 fijo por
   * página, paceado por el rate limit). Sin depósito configurado barre todos
   * los activos y suma por código.
   */
  private async stockBySweep(
    ctx: AdapterContext,
    depositoId: number | undefined
  ): Promise<Map<string, number>> {
    let depositoIds: number[];
    if (depositoId) {
      depositoIds = [depositoId];
    } else {
      const depositos = (await this.request<DepositoRow[]>(ctx, 'GET', '/api/inventarios/getDepositos')) ?? [];
      depositoIds = depositos.filter((d) => d.Activo !== false).map((d) => d.Id);
    }

    const available = new Map<string, number>();
    for (const id of depositoIds) {
      for (let page = 0; page < SWEEP_MAX_PAGES; page++) {
        const data = await this.request<StockByDepositoResponse>(
          ctx,
          'GET',
          '/api/inventarios/getStockByDeposito',
          { query: { id, page, pageSize: SWEEP_PAGE_SIZE } }
        );
        const items = data?.Items ?? [];
        for (const item of items) {
          const code = item.Codigo ? sanitizeSku(item.Codigo).toUpperCase() : '';
          if (!code) continue;
          available.set(code, (available.get(code) ?? 0) + (Number(item.StockConReservas) || 0));
        }
        if (items.length < SWEEP_PAGE_SIZE) break;
        await new Promise((resolve) => setTimeout(resolve, SWEEP_THROTTLE_MS));
      }
    }
    return available;
  }

  /** Resuelve el Id de concepto por SKU (getByCodigo); las ventas lo exigen. */
  private async resolveConceptoId(
    ctx: AdapterContext,
    sku: string,
    cache: Map<string, number>
  ): Promise<number> {
    const clean = sanitizeSku(sku);
    const cached = cache.get(clean.toUpperCase());
    if (cached !== undefined) return cached;
    const concepto = await this.request<ConceptoResponse>(ctx, 'GET', '/api/conceptos/getByCodigo', {
      query: { codigo: clean },
      allow404: true,
    });
    if (!concepto?.Id) {
      throw new ErpNonRetryableError(
        `Contabilium: el SKU "${clean}" no existe como concepto (crearlo en Contabilium o corregir el SKU en Medusa).`
      );
    }
    cache.set(clean.toUpperCase(), concepto.Id);
    return concepto.Id;
  }

  /**
   * Resuelve el cliente de la venta: busca por documento (GetClientByDoc) y
   * si no existe lo crea. Sin documento usa `default_client_id` (cliente
   * genérico Consumidor Final creado en Contabilium).
   */
  private async resolveClientId(payload: ErpSalePayload, ctx: AdapterContext): Promise<number> {
    const settings = this.cblSettings(ctx);
    const doc = payload.customer.document;
    if (!doc.type || !doc.number) {
      if (settings.default_client_id) return settings.default_client_id;
      throw new ErpNonRetryableError(
        'Contabilium: la orden no tiene documento fiscal y no hay contabilium.default_client_id configurado (creá un cliente "Consumidor Final" en Contabilium y cargá su ID).'
      );
    }

    const found = await this.searchClientByDoc(ctx, doc.type, doc.number);
    if (found) return found;

    const fullName = [payload.customer.first_name, payload.customer.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    const body = {
      Id: 0,
      RazonSocial: fullName || payload.customer.email || `Cliente ${doc.number}`,
      NombreFantasia: '',
      CondicionIva: 'CF',
      TipoDoc: doc.type,
      NroDoc: doc.number,
      Pais: 'Argentina',
      Domicilio: payload.shipping.address.street ?? '',
      Ciudad: payload.shipping.address.city ?? '',
      Cp: payload.shipping.address.postal_code ?? '',
      Telefono: payload.customer.phone ?? '',
      Email: payload.customer.email ?? '',
      Codigo: null,
      Personeria: doc.type === 'CUIT' ? 'J' : 'F',
    };
    try {
      const created = await this.request<number | string>(ctx, 'POST', '/api/clientes', { body });
      const id = Number(created);
      if (Number.isFinite(id) && id > 0) return id;
      throw new ErpConnectionError(`Contabilium: CreateCliente no devolvió un Id (${String(created).slice(0, 120)}).`);
    } catch (error) {
      // "El cliente ya se encuentra registrado" llega como 500 → re-buscar
      // una vez (carrera o normalización distinta del documento).
      const raced = await this.searchClientByDoc(ctx, doc.type, doc.number).catch(() => null);
      if (raced) return raced;
      throw error;
    }
  }

  private async searchClientByDoc(
    ctx: AdapterContext,
    tipoDoc: string,
    nroDoc: string
  ): Promise<number | null> {
    const data = await this.request<unknown>(ctx, 'GET', '/api/clientes/GetClientByDoc', {
      query: { tipoDoc, nroDoc },
      allow404: true,
    });
    // La forma exacta no está documentada: puede ser un array de clientes o un
    // objeto {Items}. Se toma el primer Id que aparezca.
    const list = Array.isArray(data)
      ? data
      : data && typeof data === 'object' && Array.isArray((data as { Items?: unknown[] }).Items)
        ? ((data as { Items: unknown[] }).Items)
        : data && typeof data === 'object'
          ? [data]
          : [];
    for (const entry of list) {
      const id = Number((entry as { Id?: unknown })?.Id);
      if (Number.isFinite(id) && id > 0) return id;
    }
    return null;
  }

  async notifySale(payload: ErpSalePayload, ctx: AdapterContext): Promise<ErpSaleResult> {
    const settings = this.cblSettings(ctx);
    if (!settings.deposito_id) {
      throw new ErpNonRetryableError(
        'Contabilium: configurá settings.contabilium.deposito_id (inventario/depósito de la venta) antes de notificar ventas.'
      );
    }
    const mode = settings.sale_mode ?? 'orden_venta';
    if (mode === 'factura_cobrada' && !settings.punto_venta_id) {
      throw new ErpNonRetryableError(
        'Contabilium: el modo factura_cobrada requiere settings.contabilium.punto_venta_id.'
      );
    }

    const missingSku = payload.items.filter((item) => !item.sku?.trim());
    if (missingSku.length) {
      throw new ErpNonRetryableError(
        `Contabilium: ${missingSku.length} ítem(s) de la orden no tienen SKU y las ventas exigen concepto por línea (${missingSku
          .map((item) => item.title ?? 's/título')
          .join(', ')}).`
      );
    }

    const taxRate = settings.tax_rate ?? DEFAULT_TAX_RATE;
    const divisor = (settings.prices_include_tax ?? true) ? 1 + taxRate : 1;
    const net = (gross: number) => round4(gross / divisor);
    const emissionIso = payload.created_at ?? new Date().toISOString();
    const reference = `Venta web #${payload.display_id ?? payload.order_id}`;

    const idCliente = await this.resolveClientId(payload, ctx);
    const conceptoCache = new Map<string, number>();

    if (mode === 'orden_venta') {
      const items: Array<Record<string, unknown>> = [];
      for (const item of payload.items) {
        items.push({
          idConcepto: await this.resolveConceptoId(ctx, item.sku!, conceptoCache),
          cantidad: item.quantity,
          precioUnitario: net(item.unit_price),
        });
      }
      let observaciones = reference;
      if (payload.totals.shipping > 0) {
        if (settings.shipping_concept_sku) {
          items.push({
            idConcepto: await this.resolveConceptoId(ctx, settings.shipping_concept_sku, conceptoCache),
            cantidad: 1,
            precioUnitario: net(payload.totals.shipping),
          });
        } else {
          // Las órdenes de venta no aceptan ítems libres: sin un concepto de
          // envío configurado, el costo queda como observación.
          observaciones += ` — Envío: $${payload.totals.shipping} (sin concepto de envío configurado, no incluido como ítem)`;
        }
      }
      const orden = await this.request<number | { Id?: number } | string>(ctx, 'POST', '/api/ordenesVenta', {
        body: {
          idCliente,
          fechaEmision: emissionIso,
          observaciones,
          IDInventario: settings.deposito_id,
          origen: 'ecommerce',
          items,
        },
      });
      const ordenId = Number(typeof orden === 'object' && orden !== null ? (orden as { Id?: number }).Id : orden);
      if (!Number.isFinite(ordenId) || ordenId <= 0) {
        throw new ErpConnectionError(
          `Contabilium: la creación de la orden de venta no devolvió un Id (${String(orden).slice(0, 120)}).`
        );
      }
      return {
        status: 'sent',
        external_ref: String(ordenId),
        response: { mode: 'orden_venta', id: ordenId, id_cliente: idCliente },
      };
    }

    // factura_cobrada — emitirFECobrada: factura electrónica + cobro en un paso.
    const items: Array<Record<string, unknown>> = [];
    for (const item of payload.items) {
      items.push({
        IdConcepto: await this.resolveConceptoId(ctx, item.sku!, conceptoCache),
        Concepto: item.title ?? item.sku,
        Cantidad: item.quantity,
        PrecioUnitario: net(item.unit_price),
        Iva: taxRate * 100,
        Bonificacion: 0,
      });
    }
    if (payload.totals.shipping > 0) {
      // Los comprobantes SÍ aceptan ítems libres (a diferencia de las órdenes).
      items.push({
        ...(settings.shipping_concept_sku
          ? { IdConcepto: await this.resolveConceptoId(ctx, settings.shipping_concept_sku, conceptoCache) }
          : {}),
        Concepto: 'Costo de envío',
        Cantidad: 1,
        PrecioUnitario: net(payload.totals.shipping),
        Iva: taxRate * 100,
        Bonificacion: 0,
      });
    }

    const factura = await this.request<EmitirFeResponse>(ctx, 'POST', '/api/comprobantes/emitirFECobrada', {
      body: {
        IdComprobanteAsociado: null,
        IdCliente: idCliente,
        FechaEmision: emissionIso,
        TipoFc: settings.tipo_fc ?? 'FCB',
        Modo: 'E',
        PuntoVenta: settings.punto_venta_id,
        Inventario: settings.deposito_id,
        CondicionVenta: settings.condicion_venta ?? 'Contado',
        FechaVencimiento: emissionIso,
        Items: items,
        Tributos: null,
        Observaciones: reference,
        Canal: 'ecommerce',
        TipoConcepto: 1,
        Pagos: null,
        Descuento: '0',
        Recargo: '0',
        fceMiPYME: false,
        RefExterna: payload.order_id,
      },
    });

    if (factura?.errores) {
      // Rechazo de validación (AFIP/datos): reintentar no lo arregla.
      throw new ErpNonRetryableError(`Contabilium: la factura fue rechazada — ${factura.errores}`);
    }
    if (!factura?.idComprobante) {
      throw new ErpConnectionError('Contabilium: emitirFECobrada no devolvió idComprobante.');
    }
    return {
      status: 'sent',
      external_ref: factura.numero ?? String(factura.idComprobante),
      response: {
        mode: 'factura_cobrada',
        idComprobante: factura.idComprobante,
        numero: factura.numero ?? null,
        cae: factura.cae ?? null,
        url: factura.url ?? null,
        id_cliente: idCliente,
      },
    };
  }
}
