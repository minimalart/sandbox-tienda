/**
 * transport-condition — resolución de la condición de transporte (cadena de frío)
 * de un line item / orden en el storefront.
 *
 * PRINCIPIO (espejo del backend, ver apps/backend/src/modules/delivery/order-context.ts):
 * la temperatura se LEE del metadata NATIVO de Medusa
 * (variant.metadata.temperature, fallback product.metadata.temperature). NUNCA
 * se modela como atributo, tabla o categoría custom. Esta es una réplica mínima
 * porque el módulo del backend no es importable desde la app del storefront.
 *
 * Severidad de frío: frozen > refrigerated > ambient.
 */

export type TemperatureMode = "ambient" | "refrigerated" | "frozen";

export const TEMPERATURE_MODES: TemperatureMode[] = [
  "ambient",
  "refrigerated",
  "frozen",
];

export const TEMPERATURE_SEVERITY: Record<TemperatureMode, number> = {
  ambient: 0,
  refrigerated: 1,
  frozen: 2,
};

/** Modos que requieren transporte especial (todo lo que no es ambient). */
export type SpecialTemperatureMode = Exclude<TemperatureMode, "ambient">;

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const isValidTemperatureMode = (v: unknown): v is TemperatureMode =>
  typeof v === "string" && (TEMPERATURE_MODES as string[]).includes(v);

/** Lee el TemperatureMode del metadata de una variante/producto, o null. */
const readTemperatureFromMetadata = (
  source: unknown,
): TemperatureMode | null => {
  if (!isRecord(source)) return null;
  const meta = isRecord(source.metadata) ? source.metadata : undefined;
  const raw = meta?.temperature;
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  const normalized = raw.trim().toLowerCase();
  return isValidTemperatureMode(normalized) ? normalized : null;
};

/**
 * Temperatura de UN item. Cubre las dos formas de line item del storefront:
 *  - cart: el producto cuelga de item.variant.product
 *  - order: además trae item.product
 * Orden: variant.metadata → variant.product.metadata → product.metadata → 'ambient'.
 */
export const resolveItemTemperature = (item: unknown): TemperatureMode => {
  if (!isRecord(item)) return "ambient";
  const variant = isRecord(item.variant) ? item.variant : undefined;
  const variantProduct =
    variant && isRecord(variant.product) ? variant.product : undefined;
  const product = isRecord(item.product) ? item.product : undefined;
  return (
    readTemperatureFromMetadata(variant) ??
    readTemperatureFromMetadata(variantProduct) ??
    readTemperatureFromMetadata(product) ??
    "ambient"
  );
};

/** ¿Este item requiere transporte especial (refrigerado/congelado)? */
export const itemRequiresSpecialTransport = (item: unknown): boolean =>
  resolveItemTemperature(item) !== "ambient";

/**
 * Requerimiento de temperatura de un conjunto de items = el MÁXIMO de frío.
 * Lista vacía → 'ambient'.
 */
export const resolveOrderTemperature = (items: unknown[]): TemperatureMode => {
  let max: TemperatureMode = "ambient";
  for (const item of items) {
    const t = resolveItemTemperature(item);
    if (TEMPERATURE_SEVERITY[t] > TEMPERATURE_SEVERITY[max]) max = t;
  }
  return max;
};

/**
 * Modos especiales presentes en un conjunto de items, únicos y ordenados por
 * severidad ascendente (refrigerated antes que frozen). Vacío si todo es ambient.
 * Alimenta la nota consolidada del carrito / orden.
 */
export const getSpecialTemperatures = (
  items: unknown[],
): SpecialTemperatureMode[] => {
  const present = new Set<TemperatureMode>();
  for (const item of items) present.add(resolveItemTemperature(item));
  return (["refrigerated", "frozen"] as SpecialTemperatureMode[]).filter((m) =>
    present.has(m),
  );
};

export type TransportConditionDisplay = {
  /** Etiqueta corta para el badge. */
  label: string;
  /** Texto descriptivo de cómo se transporta. */
  description: string;
  /** Clases del badge (pill). */
  badgeClassName: string;
};

/**
 * Config de presentación por modo especial. 'ambient' no se señaliza (sin badge
 * ni nota). Acá viven los textos en español.
 */
export const TRANSPORT_CONDITION_CONFIG: Record<
  SpecialTemperatureMode,
  TransportConditionDisplay
> = {
  refrigerated: {
    label: "Refrigerado",
    description:
      "Viaja en transporte refrigerado para mantener la cadena de frío.",
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
  },
  frozen: {
    label: "Congelado",
    description: "Viaja en transporte congelado para mantener la cadena de frío.",
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
  },
};

/** Config de display de un item, o null si es ambient. */
export const getItemTransportDisplay = (
  item: unknown,
): TransportConditionDisplay | null => {
  const temp = resolveItemTemperature(item);
  return temp === "ambient" ? null : TRANSPORT_CONDITION_CONFIG[temp];
};
