import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../index';
import type ErpModuleService from '../service';
import { getErpAdapter } from '../adapters/registry';
import { ErpNonRetryableError } from '../adapters/types';
import { truncateError } from '../sanitize';
import { DEFAULT_INVOICE_FETCH_SETTINGS, type ErpRetryBudget, type ErpSalePayload } from '../types';
import { computeNextRetry } from './backoff';
import {
  INVOICE_FETCH_EVENT_TYPE,
  invoiceFetchEventKey,
  processInvoiceFetch,
  type InvoiceFetchPayload,
} from './invoice-fetch';
import { requestStockResync } from '../sync/resync-stock-for-order';

/**
 * Processor del outbox (corre por cron): toma los eventos vencidos, los envía
 * al adapter y aplica la máquina de estados sent/duplicate/failed(+backoff)/
 * dead_letter. Con la notificación deshabilitada los `pending` esperan (no se
 * marca nada). Todo el batch corre bajo el lock `erp:outbox`.
 *
 * ROUTEO POR `event_type`. Hay dos tipos y no comparten ni el adapter ni el
 * presupuesto de reintentos:
 *
 * - `sale_created` → `adapter.notifySale`. Presupuesto general
 *   (`settings.outbox`). Al quedar `sent` encadena dos cosas: el poll del
 *   comprobante y la resincronización de stock de la orden.
 * - `invoice_fetch` → poll del comprobante. Presupuesto propio, MUCHO más largo
 *   (`settings.outbox.invoice_fetch`): el ERP factura por lote y "todavía no
 *   facturado" es un reintento, no un error. Con el presupuesto general se
 *   agotaría en ~1 h y mandaría a `dead_letter` una venta sana.
 */

const CLAIM_BATCH = 20;
const STALE_PROCESSING_MS = 10 * 60 * 1000;
const LOCK_KEY = 'erp:outbox';

export async function processOutboxBatch(container: MedusaContainer): Promise<{ processed: number }> {
  const service = container.resolve<ErpModuleService>(ERP_MODULE);
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const config = await service.getActiveConfig();
  if (!config || !config.sales_notify_enabled) return { processed: 0 };

  const adapter = getErpAdapter(config.provider);
  if (!adapter.getCapabilities().sale_notify) return { processed: 0 };

  const credentials = service.getDecryptedCredentials(config);
  if (!credentials) {
    logger.warn('[erp] outbox: hay eventos por enviar pero no hay credenciales válidas guardadas.');
    return { processed: 0 };
  }

  let processed = 0;
  const job = async (): Promise<void> => {
    const swept = await service.sweepStaleProcessing(STALE_PROCESSING_MS);
    if (swept) {
      logger.warn(`[erp] outbox: ${swept} evento(s) processing huérfanos reencolados.`);
    }

    const events = await service.claimDueOutboxEvents(CLAIM_BATCH, config.provider);
    if (!events.length) return;

    const adapterCtx = {
      credentials,
      settings: (config.settings ?? {}) as Record<string, unknown>,
      countryCode: config.country_code,
      logger,
    };

    for (const event of events) {
      const isInvoiceFetch = event.event_type === INVOICE_FETCH_EVENT_TYPE;
      // El presupuesto se elige por tipo de evento, no por config global.
      const budget: ErpRetryBudget | null | undefined = isInvoiceFetch
        ? (config.settings?.outbox?.invoice_fetch ?? DEFAULT_INVOICE_FETCH_SETTINGS)
        : config.settings?.outbox;

      try {
        if (isInvoiceFetch) {
          const outcome = await processInvoiceFetch(container, {
            adapter,
            adapterCtx,
            provider: config.provider,
            payload: event.payload as InvoiceFetchPayload,
          });
          if (outcome.kind === 'retry') {
            // Camino NORMAL, no una falla: se reprograma sin ensuciar
            // `last_error` con algo que en el panel se leería como roto.
            const attempts = (event.attempts ?? 0) + 1;
            const nextRetry = computeNextRetry(attempts, budget);
            if (nextRetry) {
              await service.markOutboxWaiting(event.id, {
                attempts,
                next_retry_at: nextRetry,
                reason: outcome.reason,
              });
              logger.debug(
                `[erp] outbox ${event.id}: ${outcome.reason}; se vuelve a preguntar ${nextRetry.toISOString()}.`
              );
            } else {
              await service.markOutboxDeadLetter(event.id, {
                attempts,
                error: new Error(
                  `Se agotó la ventana esperando el comprobante: ${outcome.reason}. Verificá en el ERP si el pedido se facturó y reintentá el evento a mano.`
                ),
              });
              logger.error(
                `[erp] outbox ${event.id}: se agotó la ventana del comprobante (${outcome.reason}).`
              );
            }
            processed += 1;
            continue;
          }
          await service.markOutboxSent(event.id, {
            external_ref: outcome.external_ref,
            response: outcome.response,
          });
          logger.info(`[erp] outbox ${event.id} (${event.event_key}) → comprobante recuperado.`);
          processed += 1;
          continue;
        }

        const result = await adapter.notifySale(event.payload as ErpSalePayload, adapterCtx);
        await service.markOutboxSent(event.id, {
          external_ref: result.external_ref ?? null,
          response: result.response,
          request: result.request,
          duplicate: result.status === 'duplicate',
        });
        logger.info(
          `[erp] outbox ${event.id} (${event.event_key}) → ${result.status}${result.external_ref ? ` (${result.external_ref})` : ''}.`
        );

        // La venta entró: encadenar el comprobante y el stock.
        //
        // El try/catch propio NO es redundante con los de adentro: si algo acá
        // llegara al `catch` de abajo, ese catch marcaría `failed` un evento que
        // YA está `sent`, y el próximo tick reenviaría la venta. En Zeus eso
        // vuelve como 409 (`duplicate`), pero en un ERP sin idempotencia real
        // (Bsale, Contabilium) emitiría el comprobante DOS VECES. Un fallo del
        // encadenado no puede costar eso.
        try {
          await afterSaleSent(container, {
            service,
            logger,
            provider: config.provider,
            adapter,
            event,
            result,
          });
        } catch (error) {
          logger.warn(
            `[erp] la venta ${event.event_key} quedó enviada pero el encadenado (comprobante/stock) falló: ${truncateError(error, 300)}`
          );
        }
      } catch (error) {
        const attempts = (event.attempts ?? 0) + 1;
        // Payload/config inválidos (PRD §14): reintentar no lo arregla →
        // dead_letter directo; se corrige la causa y se reintenta a mano.
        const nextRetry =
          error instanceof ErpNonRetryableError ? null : computeNextRetry(attempts, budget);
        if (nextRetry) {
          await service.markOutboxRetry(event.id, { attempts, next_retry_at: nextRetry, error });
          logger.warn(
            `[erp] outbox ${event.id} falló (intento ${attempts}); reintento ${nextRetry.toISOString()}: ${truncateError(error, 300)}`
          );
        } else {
          await service.markOutboxDeadLetter(event.id, { attempts, error });
          logger.error(
            `[erp] outbox ${event.id} agotó los reintentos → dead_letter: ${truncateError(error, 300)}`
          );
        }
      }
      processed += 1;
    }
  };

  let locking: {
    execute<T>(keys: string | string[], job: () => Promise<T>, args?: { timeout?: number }): Promise<T>;
  } | null = null;
  try {
    locking = container.resolve(Modules.LOCKING);
  } catch {
    // Módulo de locking no disponible → correr sin lock (cron single-flight de facto).
    locking = null;
  }

  if (!locking) {
    await job();
    return { processed };
  }

  try {
    await locking.execute(LOCK_KEY, job, { timeout: 5 });
  } catch (error) {
    if (error instanceof Error && /timed?[ -]?out|acquire/i.test(error.message)) {
      // Otro processor tiene el lock: este tick no hace nada.
      return { processed };
    }
    throw error;
  }

  return { processed };
}

/**
 * Encadenado post-venta: el poll del comprobante y la resincronización de stock.
 *
 * Los dos son best-effort y NUNCA pueden revertir una venta que el ERP ya
 * aceptó: cualquier error se loguea y se sigue. Si el poll no se pudo encolar,
 * el comprobante se puede recuperar reintentando el evento a mano; si el resync
 * no salió, el cron horario de stock lo arrastra.
 */
async function afterSaleSent(
  container: MedusaContainer,
  opts: {
    service: ErpModuleService;
    logger: Logger;
    provider: string;
    adapter: ReturnType<typeof getErpAdapter>;
    event: { id: string; aggregate_id: string; payload: unknown };
    result: { status: 'sent' | 'duplicate'; external_ref?: string; sucursal?: number | null };
  }
): Promise<void> {
  const { service, logger, provider, adapter, event, result } = opts;
  const orderId = event.aggregate_id;

  // 1) Poll del comprobante.
  //
  // Sólo con `sent`: un `duplicate` es un 409 del ERP y NO trae la referencia
  // del pedido, así que no hay con qué preguntar. Ese caso se resuelve a mano
  // (el pedido ya existe en el ERP y su comprobante se busca ahí).
  if (
    result.status === 'sent' &&
    result.external_ref &&
    adapter.getCapabilities().invoice_fetch
  ) {
    try {
      await service.enqueueOutboxEvent({
        event_type: INVOICE_FETCH_EVENT_TYPE,
        event_key: invoiceFetchEventKey(provider, orderId),
        aggregate_type: 'order',
        aggregate_id: orderId,
        provider,
        payload: {
          order_id: orderId,
          external_ref: result.external_ref,
          sucursal: result.sucursal ?? null,
        } satisfies InvoiceFetchPayload,
        status: 'pending',
      });
    } catch (error) {
      logger.warn(
        `[erp] no se pudo encolar la recuperación del comprobante de la orden ${orderId}: ${truncateError(error, 200)}`
      );
    }
  } else if (result.status === 'duplicate') {
    logger.info(
      `[erp] orden ${orderId}: el ERP respondió que la venta ya existía, así que no hay referencia para pedir el comprobante. Buscalo en el ERP por el id de la orden.`
    );
  }

  // 2) Resync de stock de los SKUs de la orden.
  try {
    await requestStockResync(container, {
      orderId,
      skus: skusOf(event.payload),
      reason: 'venta notificada al ERP',
    });
  } catch (error) {
    logger.warn(
      `[erp] no se pudo resincronizar el stock de la orden ${orderId} (lo arrastra el cron): ${truncateError(error, 200)}`
    );
  }
}

/** SKUs del payload de venta, sin repetir y sin vacíos. */
function skusOf(payload: unknown): string[] {
  const items = (payload as ErpSalePayload | null)?.items;
  if (!Array.isArray(items)) return [];
  const out = new Set<string>();
  for (const item of items) {
    if (typeof item?.sku === 'string' && item.sku.trim()) out.add(item.sku.trim());
  }
  return [...out];
}
