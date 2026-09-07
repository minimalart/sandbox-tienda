import type { SpaceObject, SpaceProduct, SpaceSnapshot } from '../../../lib/space-designer/types';

export type IncludedPlacement = {
  id: string;
  product_ref: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
};
export type SupportSurface = {
  height: number;
  width: number;
  depth: number;
  x: number;
  z: number;
  rotation?: number;
};
export type SupportSurfaces = Map<string, SupportSurface[]>;

export const dimensionsOf = (product: SpaceProduct) =>
  product.dimensions ?? { width: 0.6, depth: 0.6, height: 0.6 };

/** The plan uses clockwise degrees on x/z; Three uses the opposite Y rotation. */
export const threeRotation = (degrees: number) => (-degrees * Math.PI) / 180;

export function sceneObjectElevation(
  object: SpaceObject,
  product: SpaceProduct,
  snapshot: SpaceSnapshot,
  products: SpaceProduct[],
  surfaces?: SupportSurfaces
) {
  const height = dimensionsOf(product).height * (object.scale ?? 1);
  if (product.asset?.mount === 'ceiling') return Math.max(0, snapshot.room.height - height - 0.1);
  if (product.asset?.mount === 'wall') return Math.max(0, (snapshot.room.height - height) / 2);
  if (product.asset?.mount !== 'surface') return 0;
  const anchor = snapshot.objects
    .filter(
      (entry) => entry.id !== object.id && entry.product_ref === product.asset?.anchor_product_ref
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - object.x, a.z - object.z) - Math.hypot(b.x - object.x, b.z - object.z)
    )[0];
  const definition = products.find((entry) => entry.id === anchor?.product_ref);
  return anchor && definition
    ? (surfaces?.get(definition.id)?.[0]?.height ?? dimensionsOf(definition).height) *
        (anchor.scale ?? 1)
    : 0;
}

/** Visual instances only: these never become scene objects or extra cart quantities. */
export function includedPlacements(
  snapshot: SpaceSnapshot,
  products: SpaceProduct[],
  surfaces?: SupportSurfaces
): IncludedPlacement[] {
  const result: IncludedPlacement[] = [];
  const surfaceGroups = new Map<
    string,
    { anchor: SpaceObject; products: { product: SpaceProduct; id: string }[] }
  >();
  let floorIndex = 0;
  let ceilingIndex = 0;
  let wallIndex = 0;
  for (const item of snapshot.included_items) {
    const product = products.find((entry) => entry.id === item.product_ref);
    if (!product) continue;
    const size = dimensionsOf(product);
    const asset = product.asset;
    const anchors = snapshot.objects.filter((object) => {
      if (asset?.anchor_product_ref) return object.product_ref === asset.anchor_product_ref;
      const definition = products.find((entry) => entry.id === object.product_ref);
      return (
        definition && ['table', 'desk', 'hex-table-set'].includes(definition.asset?.model ?? '')
      );
    });
    for (let index = 0; index < item.quantity; index++) {
      const id = `included:${item.product_ref}:${index}`;
      if (asset?.mount === 'surface' && anchors.length) {
        const anchor = anchors[index % anchors.length]!;
        const group = surfaceGroups.get(anchor.id) ?? { anchor, products: [] };
        group.products.push({ product, id });
        surfaceGroups.set(anchor.id, group);
        continue;
      }
      if (asset?.mount === 'ceiling') {
        const offset = ceilingIndex++;
        const columns = Math.max(
          1,
          Math.floor(snapshot.room.width / Math.max(size.width + 0.6, 1.4))
        );
        result.push({
          id,
          product_ref: product.id,
          x: Math.min(
            snapshot.room.width - size.width / 2,
            (((offset % columns) + 0.5) * snapshot.room.width) / columns
          ),
          z: Math.min(
            snapshot.room.depth - size.depth / 2,
            snapshot.room.depth * 0.5 + Math.floor(offset / columns) * (size.depth + 0.3)
          ),
          y: Math.max(0, snapshot.room.height - size.height - 0.16),
          rotation: 0,
        });
        continue;
      }
      if (asset?.mount === 'wall') {
        const offset = wallIndex++;
        const columns = Math.max(1, Math.floor(snapshot.room.width / (size.width + 0.12)));
        result.push({
          id,
          product_ref: product.id,
          x: (((offset % columns) + 0.5) * snapshot.room.width) / columns,
          y: Math.max(
            0,
            Math.min(
              snapshot.room.height - size.height,
              snapshot.room.height * 0.4 + Math.floor(offset / columns) * (size.height + 0.1)
            )
          ),
          z: size.depth / 2 + 0.05,
          rotation: 0,
        });
        continue;
      }
      const offset = floorIndex++;
      const columns = Math.max(1, Math.floor((snapshot.room.width - 0.3) / (size.width + 0.12)));
      const rows = Math.max(1, Math.floor((snapshot.room.depth - 0.3) / (size.depth + 0.12)));
      result.push({
        id,
        product_ref: product.id,
        x: Math.min(
          snapshot.room.width - size.width / 2,
          (((offset % columns) + 0.5) * snapshot.room.width) / columns
        ),
        z: Math.max(
          size.depth / 2,
          snapshot.room.depth -
            0.15 -
            size.depth / 2 -
            (Math.floor(offset / columns) % rows) * (size.depth + 0.12)
        ),
        y: Math.floor(offset / (columns * rows)) * (size.height + 0.025),
        rotation: 0,
      });
    }
  }
  for (const { anchor, products: equipment } of Array.from(surfaceGroups.values())) {
    const definition = products.find((entry) => entry.id === anchor.product_ref)!;
    const anchorSize = dimensionsOf(definition);
    const scale = anchor.scale ?? 1;
    const supports = surfaces?.get(definition.id) ?? [
      { height: anchorSize.height, width: anchorSize.width, depth: anchorSize.depth, x: 0, z: 0 },
    ];
    supports.forEach((support, surfaceIndex) => {
      const items = equipment.filter((_, index) => index % supports.length === surfaceIndex);
      if (!items.length) return;
      const width = support.width * scale;
      const depth = support.depth * scale;
      const slotWidth = Math.max(...items.map(({ product }) => dimensionsOf(product).width)) + 0.04;
      const slotDepth = Math.max(...items.map(({ product }) => dimensionsOf(product).depth)) + 0.04;
      const slotHeight =
        Math.max(...items.map(({ product }) => dimensionsOf(product).height)) + 0.025;
      const columns = Math.max(1, Math.floor(width / slotWidth));
      const rows = Math.max(1, Math.floor(depth / slotDepth));
      const radians = (anchor.rotation * Math.PI) / 180;
      const surfaceRadians = ((support.rotation ?? 0) * Math.PI) / 180;
      items.forEach(({ product, id }, index) => {
        const rowCount = Math.min(rows, Math.ceil(items.length / columns));
        const slotX = ((index % columns) - (Math.min(columns, items.length) - 1) / 2) * slotWidth;
        const slotZ = ((Math.floor(index / columns) % rows) - (rowCount - 1) / 2) * slotDepth;
        const localX =
          support.x * scale + slotX * Math.cos(surfaceRadians) - slotZ * Math.sin(surfaceRadians);
        const localZ =
          support.z * scale + slotX * Math.sin(surfaceRadians) + slotZ * Math.cos(surfaceRadians);
        result.push({
          id,
          product_ref: product.id,
          x: anchor.x + localX * Math.cos(radians) - localZ * Math.sin(radians),
          z: anchor.z + localX * Math.sin(radians) + localZ * Math.cos(radians),
          y: support.height * scale + Math.floor(index / (columns * rows)) * slotHeight + 0.005,
          rotation: anchor.rotation + (support.rotation ?? 0),
        });
      });
    });
  }
  return result;
}
