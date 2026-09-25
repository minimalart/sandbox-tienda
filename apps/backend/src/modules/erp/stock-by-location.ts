import { pendingQuantity, type CoverageOrderItem } from './fulfillment-coverage';

/**
 * ¿Desde qué sucursal se puede despachar ESTE pedido?
 *
 * El gate de fulfillment exige que un despacho cubra la orden COMPLETA desde
 * UNA sola ubicación (el ERP emite una factura por pedido). Eso convierte una
 * pregunta operativa —"¿dónde hay stock?"— en una pregunta binaria por
 * sucursal: **cubre todo, o no sirve**.
 *
 * Mostrar sólo un número por artículo obligaría al operador a hacer esa cuenta
 * en la cabeza, artículo por artículo, y a descubrir el faltante recién cuando
 * el gate le rechaza el fulfillment con la mercadería ya juntada.
 *
 * Todo lo de acá es puro: quien junta los niveles de inventario es
 * `api/admin/erp/orders/[id]/stock-by-location/route.ts`.
 */

/** Un artículo del pedido con lo que falta despachar y lo que hay en cada ubicación. */
export type StockLine = {
  item_id: string;
  title: string;
  sku: string | null;
  /** Lo que todavía no se despachó. Es contra esto que se mide la cobertura. */
  pending: number;
  /** Disponible por `stock_location_id`. Ausente = esa ubicación no lo tiene. */
  available: Record<string, number>;
};

export type LocationGap = { item_id: string; title: string; pending: number; available: number };

export type LocationCoverage = {
  stock_location_id: string;
  stock_location_name: string | null;
  deposito: string;
  /** Puede despachar el pedido entero. Es lo único que el gate acepta. */
  covers_all: boolean;
  /** Cuántos artículos cubre, para ordenar las que no cubren todo. */
  covered_lines: number;
  /** Qué le falta. Vacío si cubre todo. */
  gaps: LocationGap[];
};

/** Disponible de un artículo en una ubicación. Nunca negativo. */
export function availableAt(line: StockLine, stockLocationId: string): number {
  const value = line.available[stockLocationId];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Pendiente por despachar de un ítem de orden.
 *
 * Reexporta `pendingQuantity` del módulo de cobertura A PROPÓSITO: si esta
 * pantalla contara el pendiente distinto del gate, le mostraría al operador una
 * sucursal en verde que después el gate rechaza. Es la misma cuenta o es una
 * mentira.
 */
export const pendingOf = (item: CoverageOrderItem): number => pendingQuantity(item);

/**
 * Cobertura de cada ubicación mapeada, ordenada: primero las que cubren todo,
 * después las que cubren más.
 *
 * Una línea con `pending: 0` (ya despachada) no cuenta para nada: ni suma
 * cobertura ni puede generar faltante.
 */
export function buildLocationCoverage(
  lines: StockLine[],
  locations: Array<{ stock_location_id: string; stock_location_name: string | null; deposito: string }>
): LocationCoverage[] {
  const pendientes = lines.filter((line) => line.pending > 0);

  const coverage = locations.map((location) => {
    const gaps: LocationGap[] = [];
    let covered = 0;

    for (const line of pendientes) {
      const available = availableAt(line, location.stock_location_id);
      if (available >= line.pending) covered += 1;
      else {
        gaps.push({
          item_id: line.item_id,
          title: line.title,
          pending: line.pending,
          available,
        });
      }
    }

    return {
      stock_location_id: location.stock_location_id,
      stock_location_name: location.stock_location_name,
      deposito: location.deposito,
      // Un pedido sin nada pendiente no lo "cubre" nadie: no hay nada que despachar.
      covers_all: pendientes.length > 0 && gaps.length === 0,
      covered_lines: covered,
      gaps,
    };
  });

  return coverage.sort((a, b) => {
    if (a.covers_all !== b.covers_all) return a.covers_all ? -1 : 1;
    if (a.covered_lines !== b.covered_lines) return b.covered_lines - a.covered_lines;
    return (a.stock_location_name ?? a.deposito).localeCompare(b.stock_location_name ?? b.deposito);
  });
}
