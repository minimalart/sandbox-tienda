import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../../../../../../modules/erp';
import type ErpModuleService from '../../../../../../modules/erp/service';
import { activeDepositoMappings } from '../../../../../../modules/erp/billing-deposito';
import {
  buildLocationCoverage,
  pendingOf,
  type StockLine,
} from '../../../../../../modules/erp/stock-by-location';
import type { CoverageOrderItem } from '../../../../../../modules/erp/fulfillment-coverage';

/**
 * GET /admin/erp/orders/:id/stock-by-location — desde qué sucursal se puede
 * despachar este pedido.
 *
 * La pantalla de fulfillment es NATIVA de Medusa: lista las ubicaciones, pero
 * no dice cuál tiene la mercadería. Con el gate exigiendo cobertura total desde
 * UNA ubicación, el operador se enteraba del faltante recién cuando le
 * rechazaban el fulfillment — con la mercadería ya juntada. Esto responde la
 * pregunta ANTES, en el detalle de la orden.
 *
 * Sólo mira las ubicaciones MAPEADAS a un depósito del ERP: desde las otras no
 * se puede facturar, así que ofrecerlas sería ofrecer un camino cortado.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const orderId = req.params.id as string;

  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getActiveConfig();
  if (!config) {
    res.status(200).json({ enabled: false, lines: [], coverage: [] });
    return;
  }

  const mappings = activeDepositoMappings(config.settings);
  if (!mappings.length) {
    // Sin mapeo no hay nada que mostrar, y no es un error: es una instalación
    // que todavía no configuró el mapeo de depósitos.
    res.status(200).json({ enabled: true, reason: 'no_mappings', lines: [], coverage: [] });
    return;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  type ItemRow = CoverageOrderItem & {
    title?: string | null;
    variant_sku?: string | null;
    variant_id?: string | null;
  };
  const { data: orders } = (await query.graph({
    entity: 'order',
    fields: [
      'id',
      'items.id',
      'items.title',
      'items.variant_sku',
      'items.variant_id',
      // `items.quantity` NO: esa columna se remapea contra la línea, donde no
      // existe, y devuelve undefined sin error. La cantidad vive en el detalle.
      'items.detail.quantity',
      'items.detail.fulfilled_quantity',
    ],
    filters: { id: orderId },
  })) as { data: Array<{ id: string; items?: ItemRow[] | null }> };

  const order = orders[0];
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Orden ${orderId} no encontrada.`);
  }

  const items = order.items ?? [];
  const locationIds = [...new Set(mappings.map((row) => row.stock_location_id as string))];

  // ── variante → inventory item ─────────────────────────────────────────────
  const variantIds = [...new Set(items.map((item) => item.variant_id).filter((id): id is string => Boolean(id)))];
  const inventoryItemByVariant = new Map<string, string>();
  if (variantIds.length) {
    const { data: variants } = (await query.graph({
      entity: 'product_variant',
      fields: ['id', 'inventory_items.inventory_item_id'],
      filters: { id: variantIds },
    })) as {
      data: Array<{ id: string; inventory_items?: Array<{ inventory_item_id?: string | null } | null> | null }>;
    };
    for (const variant of variants) {
      const inventoryItemId =
        variant.inventory_items?.find((row) => row?.inventory_item_id)?.inventory_item_id ?? null;
      if (inventoryItemId) inventoryItemByVariant.set(variant.id, inventoryItemId);
    }
  }

  // ── niveles en las ubicaciones mapeadas ───────────────────────────────────
  const inventoryItemIds = [...new Set(inventoryItemByVariant.values())];
  const availableByKey = new Map<string, number>();
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
      // Disponible = lo que hay MENOS lo reservado. Mostrar el stockeado a secas
      // prometería mercadería que ya tiene dueño en otro pedido.
      const available = (Number(level.stocked_quantity) || 0) - (Number(level.reserved_quantity) || 0);
      availableByKey.set(`${level.inventory_item_id}::${level.location_id}`, Math.max(available, 0));
    }
  }

  // ── nombres, para que el operador lea sucursales y no ids ─────────────────
  const names = new Map<string, string>();
  try {
    const { data: locations } = (await query.graph({
      entity: 'stock_location',
      fields: ['id', 'name'],
      filters: { id: locationIds },
    })) as { data: Array<{ id: string; name?: string | null }> };
    for (const location of locations) if (location.name) names.set(location.id, location.name);
  } catch {
    // Sin nombres se muestran los ids: degrada, no rompe.
  }

  const lines: StockLine[] = items.map((item) => {
    const inventoryItemId = item.variant_id ? inventoryItemByVariant.get(item.variant_id) : null;
    const available: Record<string, number> = {};
    if (inventoryItemId) {
      for (const locationId of locationIds) {
        available[locationId] = availableByKey.get(`${inventoryItemId}::${locationId}`) ?? 0;
      }
    }
    return {
      item_id: item.id,
      title: item.title ?? item.id,
      sku: item.variant_sku ?? null,
      pending: pendingOf(item),
      available,
    };
  });

  const coverage = buildLocationCoverage(
    lines,
    mappings.map((row) => ({
      stock_location_id: row.stock_location_id as string,
      stock_location_name: names.get(row.stock_location_id as string) ?? null,
      deposito: row.deposito,
    }))
  );

  res.status(200).json({ enabled: true, lines, coverage });
}
