import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../index';
import type ErpModuleService from '../service';
import type { AdapterContext, ErpAdapter } from '../adapters/types';

/**
 * Recuperación del comprobante que el ERP emitió por una venta.
 *
 * Existe como evento propio del outbox (`invoice_fetch`) y no como parte de
 * `notifySale` porque el ERP factura de forma ASINCRÓNICA: la venta se inserta
 * al instante y devuelve una referencia, pero el comprobante puede salir en un
 * lote horas después. Eso es un POLL, y el outbox ya tiene la máquina que un
 * poll necesita: claim con lock, backoff, dead letter y visibilidad en el
 * panel.
 *
 * La consecuencia de diseño más importante: **"todavía no facturado" es un
 * REINTENTO, no un error**. Con el presupuesto general del outbox (5 intentos,
 * tope 30 min) el poll se agotaría en ~1 h y mandaría a `dead_letter` una venta
 * perfectamente sana. Por eso `invoice_fetch` tiene su propio presupuesto
 * (`settings.outbox.invoice_fetch`, default ~20 h de ventana).
 */

/** Payload del evento `invoice_fetch`. */
export type InvoiceFetchPayload = {
  order_id: string;
  /** Referencia del pedido en el ERP (Zeus: `idtransac`). */
  external_ref: string;
  sucursal?: number | null;
};

export const INVOICE_FETCH_EVENT_TYPE = 'invoice_fetch';
/** Se emite cuando el comprobante quedó guardado (con o sin PDF). */
export const ERP_INVOICE_READY = 'erp.invoice_ready';

export function invoiceFetchEventKey(provider: string, orderId: string): string {
  return `${INVOICE_FETCH_EVENT_TYPE}:${provider}:${orderId}`;
}

export type InvoiceFetchOutcome =
  | { kind: 'sent'; external_ref: string; response: unknown }
  | { kind: 'retry'; reason: string };

/**
 * Procesa un evento `invoice_fetch`.
 *
 * Devuelve `retry` (en vez de lanzar) cuando el ERP todavía no facturó: usar una
 * excepción para el camino normal ensuciaría `last_error` de cada fila con un
 * mensaje que no es una falla, y en el panel se leería como si algo estuviera
 * roto.
 *
 * El PDF es un extra: si los datos fiscales llegaron pero el PDF todavía no, se
 * guarda igual el comprobante y se emite el evento. Es mejor mostrarle al
 * cliente "Factura B 0001-00012345" sin PDF que no mostrarle nada, y el número
 * ya no cambia.
 */
export async function processInvoiceFetch(
  container: MedusaContainer,
  opts: {
    adapter: ErpAdapter;
    adapterCtx: AdapterContext;
    provider: string;
    payload: InvoiceFetchPayload;
  }
): Promise<InvoiceFetchOutcome> {
  const { adapter, adapterCtx, provider, payload } = opts;
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<ErpModuleService>(ERP_MODULE);

  if (!adapter.fetchInvoiceStatus) {
    return { kind: 'retry', reason: `el adapter ${provider} no sabe recuperar comprobantes` };
  }
  if (!payload?.order_id || !payload?.external_ref) {
    return { kind: 'retry', reason: 'el evento no trae order_id/external_ref' };
  }

  const status = await adapter.fetchInvoiceStatus(
    { externalRef: payload.external_ref, sucursal: payload.sucursal ?? null },
    adapterCtx
  );

  if (!status.invoiced) {
    return { kind: 'retry', reason: 'el ERP todavía no facturó el pedido' };
  }

  // PDF: opcional y tolerante. Un fallo acá NO pierde los datos fiscales.
  let file: { id: string; url: string | null } | null = null;
  if (adapter.fetchInvoicePdf && status.tipo_comp) {
    try {
      const pdf = await adapter.fetchInvoicePdf(
        {
          externalRef: payload.external_ref,
          sucursal: status.sucursal ?? payload.sucursal ?? null,
          tipoComp: status.tipo_comp,
        },
        adapterCtx
      );
      if (pdf) file = await storeInvoicePdf(container, { payload, status, pdf });
    } catch (error) {
      logger.warn(
        `[erp] comprobante de la orden ${payload.order_id}: los datos llegaron pero el PDF no (${
          error instanceof Error ? error.message : String(error)
        }). Se guarda sin PDF.`
      );
    }
  }

  const invoice = await upsertInvoice(service, {
    provider,
    payload,
    status,
    file,
  });

  const eventBus = container.resolve(Modules.EVENT_BUS);
  await eventBus.emit({
    name: ERP_INVOICE_READY,
    data: {
      order_id: payload.order_id,
      invoice_id: invoice.id,
      numero_comp: status.numero_comp ?? null,
      tipo_comp: status.tipo_comp ?? null,
      letra: status.letra ?? null,
      has_pdf: Boolean(file?.id),
    },
  });

  logger.info(
    `[erp] comprobante de la orden ${payload.order_id}: ${status.tipo_comp ?? '?'} ${
      status.letra ?? ''
    } ${status.numero_comp ?? '?'}${file ? ' (con PDF)' : ' (sin PDF)'}.`
  );

  return {
    kind: 'sent',
    external_ref: String(status.numero_comp ?? payload.external_ref),
    response: {
      numero_comp: status.numero_comp ?? null,
      tipo_comp: status.tipo_comp ?? null,
      letra: status.letra ?? null,
      punto_de_venta: status.punto_de_venta ?? null,
      sucursal: status.sucursal ?? null,
      fecha: status.fecha ?? null,
      file_id: file?.id ?? null,
    },
  };
}

/**
 * Sube el PDF al File module como archivo PRIVADO.
 *
 * Privado a propósito: el endpoint del ERP que lo emite acepta el JWT como
 * query param, y ese token lee el catálogo, crea clientes y crea pedidos — así
 * que ni el PDF ni su origen pueden quedar en una URL pública. La descarga va
 * por proxy autenticado (`/admin/erp/invoices/:id/download` y su gemelo de
 * store, scopeado al dueño de la orden).
 */
async function storeInvoicePdf(
  container: MedusaContainer,
  opts: {
    payload: InvoiceFetchPayload;
    status: { numero_comp?: number | null; tipo_comp?: string | null };
    pdf: { content: Buffer; mime_type: string };
  }
): Promise<{ id: string; url: string | null } | null> {
  const fileModule = container.resolve(Modules.FILE);
  const parts = [
    'comprobante',
    opts.status.tipo_comp ?? null,
    opts.status.numero_comp !== null && opts.status.numero_comp !== undefined
      ? String(opts.status.numero_comp)
      : opts.payload.external_ref,
  ].filter(Boolean);
  const filename = `${parts.join('-').replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf`;

  // `base64` y no `binary`: es la forma con la que el File module de este repo
  // ya sube PDFs (`api/admin/fiscal-documents/route.ts`), y pasar bytes por un
  // string no-base64 los corrompe.
  const [uploaded] = await fileModule.createFiles([
    {
      filename,
      mimeType: opts.pdf.mime_type,
      content: opts.pdf.content.toString('base64'),
    },
  ]);
  if (!uploaded?.id) return null;
  return { id: uploaded.id, url: uploaded.url ?? null };
}

/**
 * Upsert por (provider, order_id). Idempotente a propósito: el evento puede
 * reprocesarse (reintento manual desde el panel, `processing` huérfano
 * reencolado) y no puede dejar dos comprobantes para la misma orden.
 */
async function upsertInvoice(
  service: ErpModuleService,
  opts: {
    provider: string;
    payload: InvoiceFetchPayload;
    status: {
      numero_comp?: number | null;
      tipo_comp?: string | null;
      letra?: string | null;
      punto_de_venta?: number | null;
      sucursal?: number | null;
      fecha?: string | null;
      total?: number | null;
      raw?: unknown;
    };
    file: { id: string; url: string | null } | null;
  }
): Promise<{ id: string }> {
  const { provider, payload, status, file } = opts;
  const data = {
    order_id: payload.order_id,
    provider,
    external_ref: payload.external_ref,
    sucursal: status.sucursal ?? payload.sucursal ?? null,
    numero_comp: status.numero_comp ?? null,
    tipo_comp: status.tipo_comp ?? null,
    letra: status.letra ?? null,
    punto_de_venta: status.punto_de_venta ?? null,
    fecha: status.fecha ?? null,
    total: status.total ?? null,
    raw: (status.raw ?? null) as Record<string, unknown> | null,
  };

  const existing = await service.findInvoiceByOrder(provider, payload.order_id);
  if (existing) {
    await service.updateErpInvoices({
      id: existing.id,
      ...data,
      // Un PDF ya guardado no se pisa con `null`: si esta corrida no lo pudo
      // bajar, el que estaba sigue sirviendo.
      ...(file ? { file_id: file.id, file_url: file.url } : {}),
    });
    return { id: existing.id };
  }

  const created = await service.createErpInvoices({
    ...data,
    file_id: file?.id ?? null,
    file_url: file?.url ?? null,
  });
  return { id: (created as unknown as { id: string }).id };
}
