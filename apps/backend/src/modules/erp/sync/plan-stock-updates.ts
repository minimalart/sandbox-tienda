import type { ErpStockResult } from '../adapters/types';
import type { ErpSyncLogItemStatus } from '../types';

/**
 * Clasificación PURA del resultado de stock por SKU (testeable sin container):
 * decide si se actualiza, con qué cantidad normalizada, o por qué se descarta.
 * Las reglas vienen del PRD §8.2: duplicados no se tocan, negativos se
 * normalizan a 0 con warning, cantidades no numéricas son inválidas.
 */

/** Un destino de escritura: qué depósito del ERP va a qué stock location. */
export type StockTarget = {
  /** `null` = modo sin mapeo: se escribe el total del ERP en una sola location. */
  deposito: string | null;
  location_id: string;
};

/**
 * Recorta el resultado del ERP a lo que le toca a UN destino.
 *
 * Es la pieza que evita el error más caro del multi-depósito: si un destino se
 * quedara con el TOTAL en vez de con la cantidad de SU depósito, cada location
 * escribiría el total y el stock quedaría multiplicado por la cantidad de
 * sucursales.
 *
 * Un artículo que existe en el ERP pero no tiene fila en ese depósito vale 0, no
 * `not_found`: existe, simplemente no hay stock ahí, y devolver `not_found`
 * dejaría el nivel viejo congelado en la sucursal que se quedó sin unidades.
 *
 * Si el adapter no expone desglose pero hay mapeo configurado, no se inventa
 * nada: devuelve `undefined` y el planner lo clasifica `not_found`.
 */
export function quantityForTarget(
  result: ErpStockResult | undefined,
  target: StockTarget
): ErpStockResult | undefined {
  if (!result || !result.found) return result;
  if (!target.deposito) return result;
  if (!result.by_deposito) return undefined;
  return { found: true, quantity: result.by_deposito[target.deposito] ?? 0 };
}

export type SkuCatalogEntry = {
  sku: string;
  /** IDs de variantes de Medusa con este SKU (>1 = catálogo roto). */
  variant_ids: string[];
  inventory_item_id: string | null;
};

export type LevelInfo = {
  stocked_quantity: number;
  reserved_quantity: number;
} | null;

export type StockUpdatePlan = {
  status: ErpSyncLogItemStatus;
  /** Presente solo cuando `status === 'updated'`. */
  update?: {
    inventory_item_id: string;
    stocked_quantity: number;
    /**
     * `true` = el nivel no existía en la location destino: hay que CREARLO
     * con `createInventoryLevelsWorkflow`, no actualizarlo. El core no crea
     * niveles faltantes desde el update; sin esta rama el sync se salteaba
     * en silencio y la sucursal quedaba en cero para siempre aunque el ERP
     * dijera otra cosa.
     */
    create?: boolean;
  };
  /** Se persiste sanitizado como `response_payload` del log item. */
  response_payload: Record<string, unknown>;
  error?: string;
};

export function planStockUpdate(input: {
  entry: SkuCatalogEntry;
  /** `undefined` = el adapter no devolvió el SKU (equivale a not_found). */
  erpResult: ErpStockResult | undefined;
  /** Nivel actual en la location destino, si existe. */
  level: LevelInfo;
}): StockUpdatePlan {
  const { entry, erpResult, level } = input;

  if (entry.variant_ids.length > 1) {
    return {
      status: 'duplicate_sku',
      error: `SKU repetido en ${entry.variant_ids.length} variantes de Medusa; no se actualiza.`,
      response_payload: { variant_ids: entry.variant_ids },
    };
  }

  if (!erpResult || !erpResult.found) {
    return {
      status: 'not_found',
      error: 'El ERP no conoce este SKU.',
      response_payload: {},
    };
  }

  if (!entry.inventory_item_id) {
    return {
      status: 'skipped',
      response_payload: { reason: 'no_inventory_item', erp_quantity: erpResult.quantity ?? null },
    };
  }

  const raw = erpResult.quantity;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return {
      status: 'invalid_quantity',
      error: `Cantidad inválida recibida del ERP: ${JSON.stringify(raw ?? null)}`,
      response_payload: { erp_quantity: raw ?? null },
    };
  }

  // Negativos → 0 con warning (regla MVP del PRD); fraccionales → piso.
  const flags: Record<string, unknown> = {};
  let normalized = raw;
  if (normalized < 0) {
    normalized = 0;
    flags.warning = 'negative_normalized_to_zero';
  }
  if (!Number.isInteger(normalized)) {
    normalized = Math.floor(normalized);
    flags.fractional_floored = true;
  }

  if (!level) {
    // Sin nivel en la location destino: se CREA con la cantidad del ERP,
    // no se saltea. El único motivo por el que un item existe sin nivel en
    // una location es que la location se agregó DESPUÉS del alta del
    // inventory_item (o el item se armó a mano); en ambos casos la sucursal
    // tiene que arrancar con lo que dice el ERP, no con un cero congelado
    // que sólo se destraba con una escritura manual.
    return {
      status: 'updated',
      update: {
        inventory_item_id: entry.inventory_item_id,
        stocked_quantity: normalized,
        create: true,
      },
      response_payload: {
        erp_quantity: raw,
        normalized_quantity: normalized,
        created_level: true,
        ...flags,
      },
    };
  }

  const payload: Record<string, unknown> = {
    erp_quantity: raw,
    normalized_quantity: normalized,
    previous_stocked: level.stocked_quantity,
    ...flags,
  };
  // Doble descuento posible cuando el ERP ya descontó una venta que Medusa
  // todavía reserva: se deja registrado por item (revisión en fase 2).
  if (level.reserved_quantity > 0) {
    payload.reserved_quantity = level.reserved_quantity;
    payload.effective_available = normalized - level.reserved_quantity;
  }

  if (level.stocked_quantity === normalized) {
    return {
      status: 'skipped',
      response_payload: { ...payload, reason: 'unchanged' },
    };
  }

  return {
    status: 'updated',
    update: { inventory_item_id: entry.inventory_item_id, stocked_quantity: normalized },
    response_payload: payload,
  };
}
