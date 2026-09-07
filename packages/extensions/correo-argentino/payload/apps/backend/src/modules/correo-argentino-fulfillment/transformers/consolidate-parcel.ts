/**
 * Consolidación de bulto de Correo Argentino — N ítems → UN bulto.
 *
 * ⚠️ POR QUÉ ESTO EXISTE Y POR QUÉ *NO* ES UN BOX-PACKER
 *
 * `POST /orders` **descarta todo `parcels[]` salvo el primer elemento**. Textual
 * del manual (pág. 15): *"IMPORTANTE: Solo tomará un producto, en caso de cargar
 * más de uno en este array solo se toma y transforma el primero recibido en el
 * array y se ignoran los siguientes."*
 *
 * Por eso `andreani-fulfillment/transformers/box-packer.ts` NO aplica acá y no
 * hay que imitarlo: parte el pedido en N cajas y, contra esta API, N-1 se
 * descartan EN SILENCIO — el envío viaja sub-declarado en peso y en valor, y el
 * sobrecosto lo factura Correo después. El plugin oficial de Correo para
 * WooCommerce manda el array completo y tiene exactamente ese bug. No copiarlo.
 *
 * Heurística de consolidación:
 *  - `productWeight`  = suma de pesos (peso real), en GRAMOS.
 *  - `dimensions`     = apilado: se suma el lado MENOR de cada ítem (el eje de
 *                       apilamiento) y se toma el MÁXIMO de los otros dos.
 *  - `declaredValue`  = subtotal del pedido (obligatorio, numérico).
 *  - peso facturado   = max(peso real, peso volumétrico), con
 *                       volumétrico = (alto × ancho × profundidad) / aforo.
 *
 * La validación de techos corre ACÁ, antes de pegarle a la API: `/rates` valida
 * 1–25000 g y ≤150 cm por lado, y el payload de `/orders` acepta 3 chars por
 * dimensión. Fallar temprano con un error tipado es mucho mejor que un 400
 * opaco a mitad del workflow.
 */

import type { CorreoWeightUnit } from '../types';

export interface ConsolidateParcelItem {
  id: string;
  title: string;
  quantity: number;
  /** En `weightUnit` (default `kg`), por unidad. */
  weight: number;
  length: number; // cm
  width: number; // cm
  height: number; // cm
  /** Para el `declaredValue` cuando el caller no lo pasa explícito. */
  unit_price?: number;
}

export interface ConsolidatedParcel {
  /** cm, enteros (el payload admite 3 chars por lado). */
  dimensions: {
    height: number;
    width: number;
    depth: number;
  };
  /** Peso REAL sumado, en gramos. Es el que va en `productWeight`. */
  productWeightG: number;
  /** (h × w × d) / aforo, en gramos. */
  volumetricWeightG: number;
  /** max(real, volumétrico), en gramos. Es el que Correo factura. */
  billedWeightG: number;
  declaredValue: number;
  /** Unidades totales consolidadas (no líneas de pedido). */
  itemCount: number;
}

export type CorreoMissingDimensionField = 'weight' | 'length' | 'width' | 'height';

export interface CorreoMissingDimensionOffender {
  id: string;
  title: string;
  missing: CorreoMissingDimensionField[];
}

/**
 * Faltan dimensiones/peso y el fallback está apagado. Lista TODOS los ofensores
 * de una para que el admin pueda cargarlos en una sola pasada (mismo criterio
 * que `MissingProductDimensionsError` del box-packer de Andreani).
 */
export class CorreoMissingProductDimensionsError extends Error {
  public readonly code: string;
  public readonly offenders: CorreoMissingDimensionOffender[];

  constructor(offenders: CorreoMissingDimensionOffender[]) {
    const summary = offenders
      .map((o) => `${o.title || o.id} [${o.missing.join(', ')}]`)
      .join('; ');
    super(
      `Cannot build Correo Argentino parcel — ${offenders.length} product(s) missing dimensions/weight: ${summary}`
    );
    this.name = 'CorreoMissingProductDimensionsError';
    this.code = 'CORREO_MISSING_PRODUCT_DIMENSIONS';
    this.offenders = offenders;
  }
}

export type CorreoParcelLimitField = 'weight' | 'height' | 'width' | 'depth';

/** El bulto consolidado excede un techo de peso o de dimensión. */
export class CorreoParcelLimitError extends Error {
  public readonly code: string;
  public readonly field: CorreoParcelLimitField;
  public readonly actual: number;
  public readonly limit: number;

  constructor(
    field: CorreoParcelLimitField,
    actual: number,
    limit: number,
    detail: string
  ) {
    super(detail);
    this.name = 'CorreoParcelLimitError';
    this.code = 'CORREO_PARCEL_LIMIT_EXCEEDED';
    this.field = field;
    this.actual = actual;
    this.limit = limit;
  }
}

export interface CorreoParcelLogger {
  warn: (message: string) => void;
}

/** Mismos defaults que el fallback de Andreani, en la unidad de este módulo. */
export interface CorreoDimensionFallback {
  length: number; // cm
  width: number; // cm
  height: number; // cm
  weight: number; // en `weightUnit`, por unidad
}

export interface ConsolidateParcelOptions {
  logger?: CorreoParcelLogger;
  /** Cuando está seteado, rellena faltantes en vez de tirar el error tipado. */
  dimensionFallback?: CorreoDimensionFallback;
  /** Unidad de `item.weight`. Default `kg` (convención del proyecto). */
  weightUnit?: CorreoWeightUnit;
  /** Coeficiente de aforo. Default 4000, SIN VERIFICAR (ver README). */
  aforoDivisor?: number;
  /** Techo de peso facturado en gramos. Default 25000 (límite de `/rates`). */
  maxWeightG?: number;
  /** Techo por lado en cm. Default 150 (límite de `/rates`). */
  maxDimensionCm?: number;
  /** Reemplaza el subtotal calculado a partir de `unit_price`. */
  declaredValue?: number;
}

/** Límite duro de `/rates` (1 – 25000 g). Ver §3.5 del plan. */
export const CORREO_MAX_WEIGHT_G = 25000;
/** `/rates` rechaza cualquier lado > 150 cm. */
export const CORREO_MAX_DIMENSION_CM = 150;
/** `dimensions.*` del payload de orders admite 3 chars → 999 cm. */
export const CORREO_MAX_DIMENSION_PAYLOAD_CM = 999;
/** "Coeficiente de aforo" (cm³ → kg). ⚠️ Valor de comunidad, sin publicar. */
export const CORREO_DEFAULT_AFORO_DIVISOR = 4000;
/** `/rates` rechaza weight < 1 g. */
export const CORREO_MIN_WEIGHT_G = 1;

const GRAMS_PER_KG = 1000;

function toGrams(weight: number, unit: CorreoWeightUnit): number {
  return unit === 'g' ? weight : weight * GRAMS_PER_KG;
}

function positive(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Consolida los ítems del pedido en UN bulto listo para `POST /orders`.
 *
 * Tira `CorreoMissingProductDimensionsError` (estricto, sin fallback) o
 * `CorreoParcelLimitError` (excede techos) antes de cualquier llamada HTTP.
 */
export function consolidateParcel(
  items: ConsolidateParcelItem[],
  options: ConsolidateParcelOptions = {}
): ConsolidatedParcel {
  if (!items?.length) {
    throw new Error('consolidateParcel called with no items');
  }

  const weightUnit = options.weightUnit ?? 'kg';
  const aforoDivisor = positive(options.aforoDivisor) || CORREO_DEFAULT_AFORO_DIVISOR;
  const maxWeightG = positive(options.maxWeightG) || CORREO_MAX_WEIGHT_G;
  // El techo efectivo es el más chico entre el comercial/config y el que
  // soporta el payload (3 chars). Un maxDimensionCm de 200 no sirve si el campo
  // solo acepta hasta 999 — y al revés, 150 manda sobre 999.
  const maxDimensionCm = Math.min(
    positive(options.maxDimensionCm) || CORREO_MAX_DIMENSION_CM,
    CORREO_MAX_DIMENSION_PAYLOAD_CM
  );

  const resolved = options.dimensionFallback
    ? applyDimensionFallback(items, options.dimensionFallback, options.logger)
    : validateItemDimensions(items);

  let stackedDepth = 0;
  let maxMid = 0;
  let maxLong = 0;
  let productWeightG = 0;
  let declaredFromItems = 0;
  let itemCount = 0;

  for (const item of resolved) {
    const quantity = Math.max(Math.trunc(positive(item.quantity)) || 1, 1);
    itemCount += quantity;

    // Apilado: el lado menor es el eje sobre el que se acumulan las unidades;
    // los otros dos definen la cara del bulto y se toman por máximo.
    const [small = 0, mid = 0, long = 0] = [
      positive(item.length),
      positive(item.width),
      positive(item.height),
    ].sort((a, b) => a - b);

    stackedDepth += small * quantity;
    maxMid = Math.max(maxMid, mid);
    maxLong = Math.max(maxLong, long);

    productWeightG += toGrams(positive(item.weight), weightUnit) * quantity;
    declaredFromItems += positive(item.unit_price) * quantity;
  }

  const dimensions = {
    // Los tres se redondean HACIA ARRIBA: el payload solo admite enteros y
    // declarar de menos es exactamente el sobrecosto que queremos evitar.
    depth: Math.ceil(stackedDepth),
    width: Math.ceil(maxMid),
    height: Math.ceil(maxLong),
  };

  const volumeCm3 = dimensions.height * dimensions.width * dimensions.depth;
  const volumetricWeightG = Math.ceil((volumeCm3 / aforoDivisor) * GRAMS_PER_KG);
  const roundedWeightG = Math.ceil(productWeightG);
  const billedWeightG = Math.max(roundedWeightG, volumetricWeightG);

  assertWithinLimits(dimensions, billedWeightG, maxDimensionCm, maxWeightG);

  // `declaredValue` es obligatorio y numérico: nunca 0.
  const declaredValue = Math.max(
    Math.round(positive(options.declaredValue) || declaredFromItems),
    1
  );

  return {
    dimensions,
    productWeightG: roundedWeightG,
    volumetricWeightG,
    billedWeightG,
    declaredValue,
    itemCount,
  };
}

function assertWithinLimits(
  dimensions: ConsolidatedParcel['dimensions'],
  billedWeightG: number,
  maxDimensionCm: number,
  maxWeightG: number
): void {
  const sides: Array<[CorreoParcelLimitField, number]> = [
    ['height', dimensions.height],
    ['width', dimensions.width],
    ['depth', dimensions.depth],
  ];

  for (const [field, value] of sides) {
    if (value > maxDimensionCm) {
      throw new CorreoParcelLimitError(
        field,
        value,
        maxDimensionCm,
        `Correo Argentino parcel ${field} ${value}cm exceeds the ${maxDimensionCm}cm limit`
      );
    }
  }

  if (billedWeightG > maxWeightG) {
    throw new CorreoParcelLimitError(
      'weight',
      billedWeightG,
      maxWeightG,
      `Correo Argentino parcel billed weight ${billedWeightG}g exceeds the ${maxWeightG}g limit`
    );
  }

  if (billedWeightG < CORREO_MIN_WEIGHT_G) {
    throw new CorreoParcelLimitError(
      'weight',
      billedWeightG,
      CORREO_MIN_WEIGHT_G,
      `Correo Argentino parcel billed weight ${billedWeightG}g is below the ${CORREO_MIN_WEIGHT_G}g minimum accepted by /rates`
    );
  }
}

/**
 * Estricto por default: `weight` entra en la validación (a diferencia del
 * box-packer de Andreani, que solo valida las tres dimensiones) porque
 * `productWeight` es obligatorio en el payload y `/rates` rechaza weight < 1 g.
 */
function validateItemDimensions(
  items: ConsolidateParcelItem[]
): ConsolidateParcelItem[] {
  const offenders: CorreoMissingDimensionOffender[] = [];

  for (const item of items) {
    const missing: CorreoMissingDimensionField[] = [];

    if (!(positive(item.weight) > 0)) missing.push('weight');
    if (!(positive(item.length) > 0)) missing.push('length');
    if (!(positive(item.width) > 0)) missing.push('width');
    if (!(positive(item.height) > 0)) missing.push('height');

    if (missing.length > 0) {
      offenders.push({ id: item.id, title: item.title, missing });
    }
  }

  if (offenders.length > 0) {
    throw new CorreoMissingProductDimensionsError(offenders);
  }

  return items;
}

/**
 * Rellena dimensiones/peso faltantes con el fallback configurado y loguea cada
 * relleno. OJO: Correo cotiza y factura por peso facturado real — medidas
 * truchas producen costo incorrecto. Preferí cargar las reales en el producto.
 */
function applyDimensionFallback(
  items: ConsolidateParcelItem[],
  fallback: CorreoDimensionFallback,
  logger?: CorreoParcelLogger
): ConsolidateParcelItem[] {
  return items.map((item) => {
    const missing: CorreoMissingDimensionField[] = [];
    let { length, width, height, weight } = item;

    if (!(positive(length) > 0)) {
      missing.push('length');
      length = fallback.length;
    }
    if (!(positive(width) > 0)) {
      missing.push('width');
      width = fallback.width;
    }
    if (!(positive(height) > 0)) {
      missing.push('height');
      height = fallback.height;
    }
    if (!(positive(weight) > 0)) {
      missing.push('weight');
      weight = fallback.weight;
    }

    if (missing.length === 0) return item;

    logger?.warn(
      `[correo-consolidate-parcel] "${item.title || item.id}" missing [${missing.join(', ')}] — ` +
        `applying fallback (${length}x${width}x${height}cm, ${weight}/u). ` +
        `Shipping cost may be inaccurate; load real values on the product.`
    );

    return { ...item, length, width, height, weight };
  });
}
