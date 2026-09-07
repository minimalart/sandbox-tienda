/**
 * order-context — derivación PURA del contexto de una orden para el motor de
 * reglas y (a futuro) el service de elegibilidad de recursos.
 *
 * Funciones sin DB ni container: reciben los items YA traídos por query.graph y
 * devuelven el agregado. Esto permite reusar la misma lógica desde el workflow
 * create-delivery-execution (refineWithRulesStep) y desde cualquier service que
 * necesite el mismo agregado, sin duplicar la sumatoria de peso / conteo / SKUs
 * ni la resolución de temperatura.
 *
 * PRINCIPIO NO NEGOCIABLE: la temperatura del producto se LEE del metadata
 * NATIVO de Medusa (variant.metadata.temperature, fallback
 * product.metadata.temperature). NUNCA se crea atributo/tabla/categoría custom.
 */

import {
  TEMPERATURE_SEVERITY,
  isValidTemperatureMode,
  type TemperatureMode,
} from './types';

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const getString = (source: unknown, key: string): string | undefined => {
  if (!isRecord(source)) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
};

/**
 * Lee el TemperatureMode declarado en el metadata de una variante/producto.
 * Devuelve null si no hay un valor válido (el caller aplica el default).
 */
const readTemperatureFromMetadata = (
  source: unknown,
): TemperatureMode | null => {
  if (!isRecord(source)) return null;
  const meta = isRecord(source.metadata) ? source.metadata : undefined;
  const raw = getString(meta, 'temperature');
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  return isValidTemperatureMode(normalized) ? normalized : null;
};

/**
 * Temperatura de UN item: variant.metadata.temperature, fallback
 * product.metadata.temperature, default 'ambient'.
 */
export const resolveItemTemperature = (item: unknown): TemperatureMode => {
  if (!isRecord(item)) return 'ambient';
  const variant = isRecord(item.variant) ? item.variant : undefined;
  const product = isRecord(item.product) ? item.product : undefined;
  return (
    readTemperatureFromMetadata(variant) ??
    readTemperatureFromMetadata(product) ??
    'ambient'
  );
};

/**
 * Requerimiento de temperatura de un conjunto de items = el MÁXIMO de frío
 * (frozen > refrigerated > ambient). Función pura. Lista vacía → 'ambient'.
 */
export const resolveTemperatureRequirement = (
  items: unknown[],
): TemperatureMode => {
  let max: TemperatureMode = 'ambient';
  for (const item of items) {
    const t = resolveItemTemperature(item);
    if (TEMPERATURE_SEVERITY[t] > TEMPERATURE_SEVERITY[max]) {
      max = t;
    }
  }
  return max;
};

/**
 * Agregado de los items de una orden, derivado de los items que devuelve
 * query.graph. Reutilizable por el motor de reglas y el service de elegibilidad.
 *
 *  - weight_kg: suma de (peso unitario × cantidad). Peso unitario =
 *    variant.weight, fallback product.weight, fallback item.weight. null si 0.
 *  - item_count: suma de cantidades.
 *  - skus: SKUs presentes (item.variant_sku, fallback variant.sku).
 *  - temperature: máximo de frío de la orden (ver resolveTemperatureRequirement).
 */
export interface OrderItemsAggregate {
  weight_kg: number | null;
  item_count: number;
  skus: string[];
  temperature: TemperatureMode;
}

// extractLatLng vive en ./geo (módulo SIN dependencias de valores, para que sea
// importable desde tests con node --test sin arrastrar la cadena de imports de
// ./types). Se reexporta acá por conveniencia del workflow que ya importa de
// order-context.
export { extractLatLng } from './geo';

/**
 * Construye el agregado a partir de los items YA traídos por query.graph. Para
 * que `temperature` y `weight_kg` se resuelvan, el query debe incluir los fields
 * 'items.variant.weight', 'items.product.weight', 'items.variant.metadata',
 * 'items.product.metadata' además de quantity y los SKUs.
 */
export const buildOrderItemsAggregate = (
  items: unknown[],
): OrderItemsAggregate => {
  let weightKg = 0;
  let itemCount = 0;
  const skus: string[] = [];

  for (const item of items) {
    if (!isRecord(item)) continue;
    const qty = Number(item.quantity) || 1;
    itemCount += qty;

    const variant = isRecord(item.variant) ? item.variant : undefined;
    const product = isRecord(item.product) ? item.product : undefined;
    const w =
      Number(variant?.weight) ||
      Number(product?.weight) ||
      Number(item.weight) ||
      0;
    weightKg += (Number.isFinite(w) ? w : 0) * qty;

    const sku = getString(item, 'variant_sku') ?? getString(variant, 'sku');
    if (sku) skus.push(sku);
  }

  return {
    weight_kg: weightKg > 0 ? weightKg : null,
    item_count: itemCount,
    skus,
    temperature: resolveTemperatureRequirement(items),
  };
};
