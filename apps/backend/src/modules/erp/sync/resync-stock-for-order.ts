import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { updateInventoryLevelsWorkflow } from '@medusajs/medusa/core-flows';
import { ERP_MODULE } from '../index';
import type ErpModuleService from '../service';
import type { ErpConfigRow } from '../service';
import { getErpAdapter } from '../adapters/registry';
import type { ErpStockResult } from '../adapters/types';
import { truncateError } from '../sanitize';
import { activeDepositoMappings } from '../billing-deposito';
import {
  planStockUpdate,
  quantityForTarget,
  type SkuCatalogEntry,
  type StockTarget,
} from './plan-stock-updates';

/**
 * Resincronización de stock ACOTADA a los SKUs de una orden.
 *
 * Para qué: cuando el ERP factura, ahí se descuenta el stock de verdad — y si el
 * operador consolidó la mercadería moviéndola entre depósitos, además cambió el
 * reparto entre depósitos. Medusa no reproduce esos movimientos (a propósito: no
 * queremos un motor de consolidación), así que vuelve a leer. El ERP mueve y
 * descuenta, Medusa relee, Medusa refleja.
 *
 * Por qué acotada y no un sync completo: son unos pocos SKUs. En Zeus, hasta 10
 * códigos van por `GET /articulos/getbyID` en una sola llamada, contra un barrido
 * paginado del catálogo entero. Sin esto habría que esperar el cron horario.
 *
 * Es BEST-EFFORT y no escribe sync_log: no es una corrida de sync, es un
 * refresco. Nunca lanza — si algo sale mal, el cron horario lo arrastra, y la
 * venta ya está facturada de cualquier manera.
 */

const LOCK_KEY = 'erp:stock-sync';
/** Un pedido con más líneas que esto ya no es "unos pocos SKUs": lo hace el cron. */
const MAX_SKUS = 40;

export type StockResyncResult = {
  status: 'applied' | 'skipped';
  reason?: string;
  updated?: number;
};

export async function requestStockResync(
  container: MedusaContainer,
  opts: { orderId: string; skus: string[]; reason: string }
): Promise<StockResyncResult> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<ErpModuleService>(ERP_MODULE);

  const skus = [...new Set(opts.skus.map((sku) => sku.trim()).filter(Boolean))];
  if (!skus.length) return { status: 'skipped', reason: 'la orden no tiene SKUs' };
  if (skus.length > MAX_SKUS) {
    logger.info(
      `[erp] orden ${opts.orderId}: ${skus.length} SKUs es demasiado para un refresco puntual; lo hace el sync completo.`
    );
    return { status: 'skipped', reason: 'demasiados SKUs' };
  }

  const config = await service.getActiveConfig();
  if (!config || !config.stock_sync_enabled) {
    return { status: 'skipped', reason: 'el sync de stock está apagado' };
  }
  const adapter = getErpAdapter(config.provider);
  if (!adapter.getCapabilities().stock_pull) {
    return { status: 'skipped', reason: 'el provider no lee stock' };
  }
  const credentials = service.getDecryptedCredentials(config);
  if (!credentials) return { status: 'skipped', reason: 'sin credenciales' };

  const job = async (): Promise<StockResyncResult> =>
    applyResync(container, { config, adapter, credentials, skus, orderId: opts.orderId, logger });

  // Si una corrida COMPLETA tiene el lock, este refresco se saltea. Competir por
  // el lock no vale la pena: el sync completo va a leer estos SKUs igual, y
  // esperarlo bloquearía el processor del outbox.
  let locking: {
    execute<T>(keys: string | string[], job: () => Promise<T>, args?: { timeout?: number }): Promise<T>;
  } | null = null;
  try {
    locking = container.resolve(Modules.LOCKING);
  } catch {
    locking = null;
  }
  if (!locking) return job();

  try {
    return await locking.execute(LOCK_KEY, job, { timeout: 1 });
  } catch (error) {
    if (error instanceof Error && /timed?[ -]?out|acquire/i.test(error.message)) {
      logger.info(
        `[erp] orden ${opts.orderId}: hay un sync de stock corriendo; el refresco lo cubre esa corrida.`
      );
      return { status: 'skipped', reason: 'sync de stock en curso' };
    }
    throw error;
  }
}

async function applyResync(
  container: MedusaContainer,
  args: {
    config: ErpConfigRow;
    adapter: ReturnType<typeof getErpAdapter>;
    credentials: Record<string, string>;
    skus: string[];
    orderId: string;
    logger: Logger;
  }
): Promise<StockResyncResult> {
  const { config, adapter, credentials, skus, orderId, logger } = args;
  const settings = config.settings ?? {};
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  // ── Destinos: mismo criterio que el sync completo ─────────────────────────
  // Con `deposito_map`, cada depósito escribe SU cantidad en SU location. Sin
  // mapeo, el total en una sola location. Escribir el total en varias
  // MULTIPLICARÍA el stock, así que acá no se improvisa nada.
  const mappings = activeDepositoMappings(settings);
  const targets: StockTarget[] = mappings.length
    ? mappings.map((row) => ({
        deposito: row.deposito.toString().trim(),
        location_id: row.stock_location_id,
      }))
    : settings.stock_location_id
      ? [{ deposito: null, location_id: settings.stock_location_id }]
      : [];
  if (!targets.length) {
    return { status: 'skipped', reason: 'sin depósitos mapeados ni stock location configurada' };
  }

  // ── Catálogo local de esos SKUs ───────────────────────────────────────────
  type VariantRow = {
    id: string;
    sku: string | null;
    inventory_items?: Array<{ inventory_item_id: string | null } | null> | null;
  };
  const { data: variants } = (await query.graph({
    entity: 'product_variant',
    fields: ['id', 'sku', 'inventory_items.inventory_item_id'],
    filters: { sku: skus },
  })) as { data: VariantRow[] };

  const catalog = new Map<string, SkuCatalogEntry>();
  for (const variant of variants) {
    const sku = variant.sku?.trim();
    if (!sku) continue;
    const inventoryItemId =
      variant.inventory_items?.find((item) => item?.inventory_item_id)?.inventory_item_id ?? null;
    const entry = catalog.get(sku);
    if (entry) entry.variant_ids.push(variant.id);
    else catalog.set(sku, { sku, variant_ids: [variant.id], inventory_item_id: inventoryItemId });
  }
  if (!catalog.size) return { status: 'skipped', reason: 'ningún SKU de la orden existe en Medusa' };

  // ── Stock del ERP ─────────────────────────────────────────────────────────
  const adapterCtx = {
    credentials,
    settings: settings as Record<string, unknown>,
    countryCode: config.country_code,
    logger,
  };
  const erpStock = new Map<string, ErpStockResult>();
  const batchSize = Math.max(adapter.getCapabilities().stock_batch_size, 1);
  const known = [...catalog.keys()];
  for (let i = 0; i < known.length; i += batchSize) {
    const results = await adapter.getStockBySku(known.slice(i, i + batchSize), adapterCtx);
    for (const [sku, result] of results) erpStock.set(sku, result);
  }

  // ── Niveles actuales ──────────────────────────────────────────────────────
  const inventoryItemIds = [...catalog.values()]
    .map((entry) => entry.inventory_item_id)
    .filter((id): id is string => Boolean(id));
  const locationIds = [...new Set(targets.map((target) => target.location_id))];
  const levelByKey = new Map<string, { stocked_quantity: number; reserved_quantity: number }>();
  if (inventoryItemIds.length) {
    const { data: levels } = (await query.graph({
      entity: 'inventory_level',
      fields: ['inventory_item_id', 'location_id', 'stocked_quantity', 'reserved_quantity'],
      filters: { inventory_item_id: inventoryItemIds, location_id: locationIds },
    })) as {
      data: Array<{
        inventory_item_id: string;
        location_id: string;
        stocked_quantity?: unknown;
        reserved_quantity?: unknown;
      }>;
    };
    for (const level of levels) {
      levelByKey.set(`${level.inventory_item_id}::${level.location_id}`, {
        stocked_quantity: Number(level.stocked_quantity) || 0,
        reserved_quantity: Number(level.reserved_quantity) || 0,
      });
    }
  }

  // ── Plan y aplicación (mismo planner puro que el sync completo) ────────────
  const updates: Array<{
    inventory_item_id: string;
    location_id: string;
    stocked_quantity: number;
  }> = [];
  for (const entry of catalog.values()) {
    for (const target of targets) {
      const plan = planStockUpdate({
        entry,
        erpResult: quantityForTarget(erpStock.get(entry.sku), target),
        level: entry.inventory_item_id
          ? (levelByKey.get(`${entry.inventory_item_id}::${target.location_id}`) ?? null)
          : null,
      });
      if (plan.status === 'updated' && plan.update) {
        updates.push({
          inventory_item_id: plan.update.inventory_item_id,
          location_id: target.location_id,
          stocked_quantity: plan.update.stocked_quantity,
        });
      }
    }
  }

  if (!updates.length) return { status: 'applied', updated: 0 };

  try {
    await updateInventoryLevelsWorkflow(container).run({ input: { updates } });
  } catch (error) {
    logger.warn(
      `[erp] el refresco de stock de la orden ${orderId} no se pudo aplicar (lo arrastra el cron): ${truncateError(error, 200)}`
    );
    return { status: 'skipped', reason: 'falló el update de niveles' };
  }

  logger.info(
    `[erp] stock refrescado tras facturar la orden ${orderId}: ${updates.length} nivel(es) en ${targets.length} destino(s).`
  );
  return { status: 'applied', updated: updates.length };
}
