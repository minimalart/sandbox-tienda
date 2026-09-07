/**
 * Andreani box packer (single-tenant port).
 *
 * Pure function that decides how to split an order's items into Andreani bultos
 * given a list of available boxes. Strategies:
 *   1. Single-box  — smallest active box whose volume + max_capacity fit the pack.
 *   2. Multi-box   — greedy split by volume; weight is distributed proportionally.
 *   3. Fallback    — when no boxes are configured, fall back to a built-in
 *                    default catalog (Caja Chica / Mediana / Grande).
 *
 * Kit branch: items whose title contains "kit" (case-insensitive) bypass box
 * fitting AND dimension validation entirely — the kit IS its own package.
 *
 * Strict mode (default): every non-kit item must have length / width / height
 * > 0. If any non-kit item is missing one of those, a
 * `MissingProductDimensionsError` is thrown listing every offender so the
 * caller can surface them at once and abort label creation.
 *
 * Fallback mode (opt-in): when `options.dimensionFallback` is provided, missing
 * dimensions/weight are filled with those defaults instead of throwing, and a
 * warning is logged per item. Use with care — Andreani prices and sizes the
 * bulto by real volume, so faking dimensions can produce a wrong cost/label.
 */

export interface PackerBox {
  name: string;
  height: number; // cm
  width: number; // cm
  deep: number; // cm (length)
  max_capacity: number; // kg, 0 = unlimited
}

export interface PackerItem {
  id: string;
  title: string;
  quantity: number;
  weight: number; // kg per unit
  length: number; // cm
  width: number; // cm
  height: number; // cm
}

export interface PackedBulto {
  name: string;
  largoCm: number;
  altoCm: number;
  anchoCm: number;
  volumenCm: number;
  kilos: number;
  isKit?: boolean;
}

export const KIT_BULTO_NAME = 'bulto';

export const KIT_FALLBACK_DIMENSIONS = Object.freeze({
  length: 30,
  width: 20,
  height: 15,
  weight: 0.1,
});

export type MissingDimensionField = 'weight' | 'length' | 'width' | 'height';

export interface MissingDimensionOffender {
  id: string;
  title: string;
  missing: MissingDimensionField[];
}

export class MissingProductDimensionsError extends Error {
  public readonly offenders: MissingDimensionOffender[];

  constructor(offenders: MissingDimensionOffender[]) {
    const summary = offenders
      .map((o) => `${o.title || o.id} [${o.missing.join(', ')}]`)
      .join('; ');
    super(
      `Cannot generate Andreani label — ${offenders.length} product(s) missing dimensions/weight: ${summary}`
    );
    this.name = 'MissingProductDimensionsError';
    this.offenders = offenders;
  }
}

export interface BoxPackerLogger {
  warn: (message: string) => void;
}

/**
 * Default dimensions/weight used to fill non-kit items missing physical data,
 * when fallback mode is enabled. Each field is applied only to the missing one.
 */
export interface DimensionFallback {
  length: number; // cm
  width: number; // cm
  height: number; // cm
  weight: number; // kg per unit
}

export interface PackIntoBoxesOptions {
  logger?: BoxPackerLogger;
  /** When set, missing dimensions/weight are filled instead of throwing. */
  dimensionFallback?: DimensionFallback;
}

export const DEFAULT_BOXES: ReadonlyArray<PackerBox> = Object.freeze([
  { name: 'Caja Chica', height: 24, width: 21, deep: 14.5, max_capacity: 0 },
  { name: 'Caja Mediana', height: 24, width: 29, deep: 21, max_capacity: 0 },
  { name: 'Caja Grande', height: 24, width: 43, deep: 14.5, max_capacity: 0 },
]);

const isKit = (item: PackerItem): boolean =>
  (item.title || '').toLowerCase().includes('kit');

const boxVolume = (b: PackerBox): number => b.height * b.width * b.deep;

export function packIntoBoxes(
  items: PackerItem[],
  boxes: PackerBox[] | undefined,
  options: PackIntoBoxesOptions = {}
): PackedBulto[] {
  if (!items?.length) {
    throw new Error('packIntoBoxes called with no items');
  }

  // Strict by default; fill missing dims only when a fallback is provided.
  let packItems: PackerItem[];
  if (options.dimensionFallback) {
    packItems = applyDimensionFallback(
      items,
      options.dimensionFallback,
      options.logger
    );
  } else {
    validateItemDimensions(items);
    packItems = items;
  }

  const activeBoxes = (boxes ?? []).filter((b) => boxVolume(b) > 0);
  let resolvedBoxes: PackerBox[];

  if (activeBoxes.length > 0) {
    resolvedBoxes = activeBoxes;
  } else {
    resolvedBoxes = DEFAULT_BOXES.map((b) => ({ ...b }));
    options.logger?.warn(
      '[andreani-box-packer] No active boxes configured — using built-in defaults (Caja Chica / Mediana / Grande)'
    );
  }

  const bultos: PackedBulto[] = [];
  const nonKitItems: PackerItem[] = [];

  for (const item of packItems) {
    if (!isKit(item)) {
      nonKitItems.push(item);
      continue;
    }

    const length =
      Number(item.length) > 0 ? item.length : KIT_FALLBACK_DIMENSIONS.length;
    const width =
      Number(item.width) > 0 ? item.width : KIT_FALLBACK_DIMENSIONS.width;
    const height =
      Number(item.height) > 0 ? item.height : KIT_FALLBACK_DIMENSIONS.height;
    const weight =
      Number(item.weight) > 0 ? item.weight : KIT_FALLBACK_DIMENSIONS.weight;

    for (let i = 0; i < item.quantity; i++) {
      bultos.push({
        name: KIT_BULTO_NAME,
        largoCm: length,
        altoCm: height,
        anchoCm: width,
        volumenCm: length * width * height,
        kilos: weight,
        isKit: true,
      });
    }
  }

  if (nonKitItems.length > 0) {
    bultos.push(...fitSubPack(nonKitItems, resolvedBoxes, options.logger));
  }

  return bultos;
}

function validateItemDimensions(items: PackerItem[]): void {
  const offenders: MissingDimensionOffender[] = [];

  for (const item of items) {
    if (isKit(item)) continue;

    const missing: MissingDimensionField[] = [];

    if (!(Number(item.length) > 0)) missing.push('length');
    if (!(Number(item.width) > 0)) missing.push('width');
    if (!(Number(item.height) > 0)) missing.push('height');

    if (missing.length > 0) {
      offenders.push({ id: item.id, title: item.title, missing });
    }
  }

  if (offenders.length > 0) {
    throw new MissingProductDimensionsError(offenders);
  }
}

/**
 * Returns a copy of `items` with any missing dimension/weight on non-kit items
 * filled from `fallback`. Each filled item is logged so the inaccuracy is
 * visible. Kit items are left untouched (they already have their own fallback).
 */
function applyDimensionFallback(
  items: PackerItem[],
  fallback: DimensionFallback,
  logger?: BoxPackerLogger
): PackerItem[] {
  return items.map((item) => {
    if (isKit(item)) return item;

    const missing: MissingDimensionField[] = [];
    let { length, width, height, weight } = item;

    if (!(Number(length) > 0)) {
      missing.push('length');
      length = fallback.length;
    }
    if (!(Number(width) > 0)) {
      missing.push('width');
      width = fallback.width;
    }
    if (!(Number(height) > 0)) {
      missing.push('height');
      height = fallback.height;
    }
    if (!(Number(weight) > 0)) {
      missing.push('weight');
      weight = fallback.weight;
    }

    if (missing.length === 0) return item;

    logger?.warn(
      `[andreani-box-packer] "${item.title || item.id}" missing [${missing.join(', ')}] — ` +
        `applying fallback (${length}x${width}x${height}cm, ${weight}kg/u). ` +
        `Shipping cost/box sizing may be inaccurate; load real values on the product.`
    );

    return { ...item, length, width, height, weight };
  });
}

function fitSubPack(
  items: PackerItem[],
  boxes: PackerBox[],
  logger?: BoxPackerLogger
): PackedBulto[] {
  const totalVolume = items.reduce(
    (sum, i) => sum + i.length * i.width * i.height * i.quantity,
    0
  );
  const totalWeight = items.reduce((sum, i) => sum + i.weight * i.quantity, 0);

  const sortedAsc = [...boxes].sort((a, b) => boxVolume(a) - boxVolume(b));
  const largest = [...sortedAsc].reverse()[0];
  if (!largest) {
    throw new Error('[andreani-box-packer] No boxes available for packing');
  }

  const fitsCapacity = (b: PackerBox, weight: number): boolean =>
    b.max_capacity === 0 || b.max_capacity >= weight;

  const singleBox = sortedAsc.find(
    (b) => boxVolume(b) >= totalVolume && fitsCapacity(b, totalWeight)
  );
  if (singleBox) {
    return [
      {
        name: singleBox.name,
        largoCm: singleBox.deep,
        altoCm: singleBox.height,
        anchoCm: singleBox.width,
        volumenCm: boxVolume(singleBox),
        kilos: totalWeight,
      },
    ];
  }

  const exceedsLargestVolume = boxVolume(largest) < totalVolume;
  const exceedsLargestWeight =
    largest.max_capacity > 0 && totalWeight > largest.max_capacity;

  if (exceedsLargestVolume || exceedsLargestWeight) {
    const itemsSummary = items
      .map(
        (i) =>
          `${i.title} x${i.quantity} (${i.length}x${i.width}x${i.height}cm, ${i.weight}kg ea.)`
      )
      .join('; ');
    logger?.warn(
      `[andreani-box-packer] Sub-pack exceeds the largest available box — ` +
        `volume=${totalVolume}cm³, weight=${totalWeight}kg; biggest=${largest.name} ` +
        `(${boxVolume(largest)}cm³, max_capacity=${largest.max_capacity}kg). ` +
        `Items: ${itemsSummary}. Splitting across multiple ${largest.name} bultos.`
    );
  }

  const results: PackedBulto[] = [];
  let remainingVolume = totalVolume;

  while (remainingVolume > 0) {
    const fit = sortedAsc.find((b) => boxVolume(b) >= remainingVolume);
    const chosen = fit ?? largest;
    const consumed = Math.min(boxVolume(chosen), remainingVolume);
    const proportion = totalVolume > 0 ? consumed / totalVolume : 1;
    const kilos = totalWeight * proportion;

    if (chosen.max_capacity > 0 && kilos > chosen.max_capacity) {
      throw new Error(
        `[andreani-box-packer] Box "${chosen.name}" would exceed its max_capacity ` +
          `(${chosen.max_capacity}kg) with a proportional weight of ${kilos.toFixed(2)}kg`
      );
    }

    results.push({
      name: chosen.name,
      largoCm: chosen.deep,
      altoCm: chosen.height,
      anchoCm: chosen.width,
      volumenCm: boxVolume(chosen),
      kilos,
    });

    remainingVolume -= boxVolume(chosen);
  }

  return results;
}
