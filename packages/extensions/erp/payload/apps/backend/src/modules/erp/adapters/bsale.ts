import type { ErpBsaleSettings, ErpSalePayload } from '../types';
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
 * Adapter Bsale (ERP/POS chileno, api.bsale.io). Portado de la integración en
 * producción de aec-chile-backend:
 *
 * - Auth: header `access-token` (credencial `access_token`, write-only).
 * - Stock: `GET /v1/stocks.json` — por `code=<sku>` cuando son pocos SKUs, o
 *   barrido paginado con `expand=[variant]` para el catálogo completo (una
 *   pasada en vez de N requests). `quantityAvailable` es la cantidad neta;
 *   con `office_id` configurada se filtra por sucursal, si no se SUMA el
 *   stock de todas.
 * - Venta: `POST /v1/documents.json` — emite el documento configurado en
 *   `settings.bsale.document_type_id` (boleta electrónica / nota de venta),
 *   con líneas a precio NETO (precio / 1.19 si los precios incluyen IVA),
 *   envío como línea extra, cliente por RUT si la orden lo trae (sin RUT →
 *   consumidor final) y pago opcional. Setup completo: docs/recipes/erp-bsale.md.
 *
 * Gotchas heredados del código fuente: SKUs sanitizados (\r\n), respuesta
 * paginada `{count, limit, offset, items}` con máximo 50 por página, y montos
 * CLP sin decimales en payments.
 */

const DEFAULT_BASE_URL = 'https://api.bsale.io';
const PAGE_LIMIT = 50;
/** Hasta acá conviene consultar SKU por SKU; de ahí en más, barrido paginado. */
const PER_CODE_THRESHOLD = 10;
/** Tope duro del barrido (filas de stock), por si count viene roto. */
const SWEEP_MAX_ROWS = 200_000;
const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_TAX_IDS = [1];
const DEFAULT_TAX_RATE = 0.19;

type BsalePage<T> = {
  count?: number;
  limit?: number;
  offset?: number;
  items?: T[];
};

type BsaleStockItem = {
  quantity?: number;
  quantityReserved?: number;
  quantityAvailable?: number;
  variant?: { id?: number; code?: string | null };
  office?: { id?: number | string };
};

type BsaleDocumentResponse = {
  id?: number;
  number?: number;
  urlPublicView?: string;
  urlPdf?: string;
  informedSii?: number;
  totalAmount?: number;
};

/** Quita saltos de línea y espacios — SKUs con \r\n rompen el matching (gotcha aec). */
function sanitizeSku(sku: string): string {
  return sku.replace(/[\r\n]/g, '').trim();
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export class BsaleErpAdapter implements ErpAdapter {
  readonly provider = 'bsale';

  // Inyectable para tests; en runtime usa el fetch global de Node.
  constructor(private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch) {}

  getCapabilities(): ErpCapabilities {
    // batch_size gigante a propósito: el stock sync entrega TODO el catálogo en
    // una sola llamada y este adapter decide la estrategia (per-code vs barrido).
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
      // No expone listados de sus códigos de configuración: la pantalla
      // sigue con inputs de texto libre, igual que hasta ahora.
      config_lookups: false,
    };
  }

  private bsaleSettings(ctx: AdapterContext): ErpBsaleSettings {
    const settings = ctx.settings as { bsale?: ErpBsaleSettings } | null | undefined;
    return settings?.bsale ?? {};
  }

  private accessToken(ctx: AdapterContext): string {
    const token = ctx.credentials?.access_token?.trim();
    if (!token) {
      throw new ErpAuthError("Bsale: falta la credencial 'access_token'.");
    }
    return token;
  }

  private baseUrl(ctx: AdapterContext): string {
    return (this.bsaleSettings(ctx).base_url ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  /**
   * Request crudo a Bsale con mapeo de errores a la taxonomía del módulo:
   * red/timeout/5xx → ErpConnectionError (retryable), 401/403 → ErpAuthError,
   * otros 4xx → ErpNonRetryableError con el `error` que devuelve Bsale.
   */
  private async request<T>(
    ctx: AdapterContext,
    method: 'GET' | 'POST',
    path: string,
    opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl(ctx)}${path}`);
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          'access-token': this.accessToken(ctx),
          'Content-Type': 'application/json',
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof ErpAuthError) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new ErpConnectionError(`Bsale: no se pudo conectar (${reason}).`);
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) {
      return (await response.json().catch(() => ({}))) as T;
    }

    const errorBody = (await response.json().catch(() => null)) as {
      error?: string;
      errorCode?: string;
    } | null;
    const detail = errorBody?.error ? ` — ${errorBody.error}` : '';
    if (response.status === 401 || response.status === 403) {
      throw new ErpAuthError(`Bsale: credenciales inválidas (HTTP ${response.status})${detail}`);
    }
    if (response.status >= 500) {
      throw new ErpConnectionError(`Bsale: error del servidor (HTTP ${response.status})${detail}`);
    }
    throw new ErpNonRetryableError(
      `Bsale: la API rechazó la operación (HTTP ${response.status})${detail}`
    );
  }

  async validateCredentials(ctx: AdapterContext): Promise<ErpValidationResult> {
    try {
      const offices = await this.request<BsalePage<{ id: number; name?: string }>>(
        ctx,
        'GET',
        '/v1/offices.json',
        { query: { limit: 1 } }
      );
      const officeId = this.bsaleSettings(ctx).office_id;
      if (officeId) {
        // Valida también que la sucursal configurada exista.
        await this.request(ctx, 'GET', `/v1/offices/${officeId}.json`);
      }
      const total = offices.count ?? offices.items?.length ?? 0;
      return {
        ok: true,
        message: `Bsale: conexión OK (${total} sucursal${total === 1 ? '' : 'es'}${officeId ? `, office ${officeId} verificada` : ''}).`,
      };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async getStockBySku(skus: string[], ctx: AdapterContext): Promise<Map<string, ErpStockResult>> {
    const officeId = this.bsaleSettings(ctx).office_id ?? undefined;
    const requested = skus.map((sku) => ({ raw: sku, clean: sanitizeSku(sku) }));

    const available =
      requested.length <= PER_CODE_THRESHOLD
        ? await this.stockByCode(ctx, requested.map((r) => r.clean), officeId)
        : await this.stockBySweep(ctx, officeId);

    const results = new Map<string, ErpStockResult>();
    for (const { raw, clean } of requested) {
      const quantity = available.get(clean);
      results.set(raw, quantity === undefined ? { found: false } : { found: true, quantity });
    }
    return results;
  }

  /** Pocos SKUs: una consulta por code (filtrada por sucursal si corresponde). */
  private async stockByCode(
    ctx: AdapterContext,
    skus: string[],
    officeId: number | undefined
  ): Promise<Map<string, number>> {
    const available = new Map<string, number>();
    for (const sku of skus) {
      if (!sku) continue;
      const page = await this.request<BsalePage<BsaleStockItem>>(ctx, 'GET', '/v1/stocks.json', {
        query: { code: sku, officeid: officeId },
      });
      const items = page.items ?? [];
      if (!items.length) continue;
      const total = items.reduce((sum, item) => sum + (Number(item.quantityAvailable) || 0), 0);
      available.set(sku, total);
    }
    return available;
  }

  /**
   * Catálogo completo: barrido paginado de /v1/stocks.json con expand=[variant]
   * (una pasada de count/50 requests, en vez de una request por SKU). Suma
   * `quantityAvailable` por code — un mismo SKU puede aparecer en varias
   * sucursales cuando no hay `office_id`.
   */
  private async stockBySweep(
    ctx: AdapterContext,
    officeId: number | undefined
  ): Promise<Map<string, number>> {
    const available = new Map<string, number>();
    let offset = 0;
    for (;;) {
      const page = await this.request<BsalePage<BsaleStockItem>>(ctx, 'GET', '/v1/stocks.json', {
        query: { limit: PAGE_LIMIT, offset, expand: '[variant]', officeid: officeId },
      });
      const items = page.items ?? [];
      for (const item of items) {
        const code = item.variant?.code ? sanitizeSku(item.variant.code) : '';
        if (!code) continue;
        available.set(code, (available.get(code) ?? 0) + (Number(item.quantityAvailable) || 0));
      }
      offset += items.length;
      const total = Number.isFinite(page.count) ? Number(page.count) : Infinity;
      if (!items.length || items.length < PAGE_LIMIT || offset >= total || offset >= SWEEP_MAX_ROWS) {
        break;
      }
    }
    return available;
  }

  async notifySale(payload: ErpSalePayload, ctx: AdapterContext): Promise<ErpSaleResult> {
    const settings = this.bsaleSettings(ctx);
    if (!settings.document_type_id) {
      throw new ErpNonRetryableError(
        'Bsale: configurá settings.bsale.document_type_id (tipo de documento a emitir) antes de notificar ventas.'
      );
    }

    const taxRate = settings.tax_rate ?? DEFAULT_TAX_RATE;
    const divisor = (settings.prices_include_tax ?? true) ? 1 + taxRate : 1;
    const taxId = JSON.stringify(settings.tax_ids ?? DEFAULT_TAX_IDS);

    const missingSku = payload.items.filter((item) => !item.sku?.trim());
    if (missingSku.length) {
      throw new ErpNonRetryableError(
        `Bsale: ${missingSku.length} ítem(s) de la orden no tienen SKU y el documento exige code por línea (${missingSku
          .map((item) => item.title ?? 's/título')
          .join(', ')}).`
      );
    }

    const details: Array<Record<string, unknown>> = payload.items.map((item) => ({
      code: sanitizeSku(item.sku!),
      quantity: item.quantity,
      netUnitValue: round4(item.unit_price / divisor),
      taxId,
    }));
    if (payload.totals.shipping > 0) {
      details.push({
        netUnitValue: round4(payload.totals.shipping / divisor),
        quantity: 1,
        taxId,
        comment: 'Costo de envío',
      });
    }

    const emission = payload.created_at
      ? Math.floor(new Date(payload.created_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const body: Record<string, unknown> = {
      documentTypeId: settings.document_type_id,
      emissionDate: emission,
      expirationDate: emission,
      declareSii: settings.declare_sii ? 1 : 0,
      sendEmail: settings.send_email ? 1 : 0,
      details,
    };
    if (settings.office_id) body.officeId = settings.office_id;
    if (settings.price_list_id) body.priceListId = settings.price_list_id;
    if (settings.dispatch_stock) body.dispatch = 1;

    // Cliente solo con RUT válido (la capa CL ya lo normalizó a XXXXXXXX-D);
    // sin RUT la boleta sale a consumidor final.
    if (payload.customer.document.type === 'RUT' && payload.customer.document.number) {
      body.client = {
        code: payload.customer.document.number,
        firstName: payload.customer.first_name ?? '',
        lastName: payload.customer.last_name ?? '',
        email: payload.customer.email ?? undefined,
        address: payload.shipping.address.street ?? undefined,
        city: payload.shipping.address.city ?? undefined,
        municipality: payload.shipping.address.city ?? payload.shipping.address.province ?? undefined,
        companyOrPerson: 0,
      };
    }

    if (settings.payment_type_id) {
      body.payments = [
        {
          paymentTypeId: settings.payment_type_id,
          // CLP no tiene decimales.
          amount: Math.round(payload.totals.total),
          recordDate: emission,
        },
      ];
    }

    const document = await this.request<BsaleDocumentResponse>(ctx, 'POST', '/v1/documents.json', {
      body,
    });
    if (!document?.id) {
      throw new ErpConnectionError('Bsale: la creación del documento no devolvió un id.');
    }

    return {
      status: 'sent',
      external_ref: String(document.id),
      response: {
        id: document.id,
        number: document.number ?? null,
        urlPublicView: document.urlPublicView ?? null,
        urlPdf: document.urlPdf ?? null,
        informedSii: document.informedSii ?? null,
        totalAmount: document.totalAmount ?? null,
      },
    };
  }
}
