import type {
  SpaceObject,
  SpaceProduct,
  SpacePublicConfigurator,
  SpaceRoom,
  SpaceSnapshot,
  SpaceTemplate,
} from './types';

export const snapshotFromTemplate = (template: SpaceTemplate): SpaceSnapshot => ({
  version: 1,
  room: { ...template.room },
  objects: template.objects.map((object) => ({ ...object })),
  included_items: template.included_items.map((item) => ({ ...item })),
});

export function objectFootprint(product: SpaceProduct, rotation = 0, scale = 1) {
  const radians = (rotation * Math.PI) / 180;
  const width = (product.dimensions?.width ?? 0.6) * scale;
  const depth = (product.dimensions?.depth ?? 0.6) * scale;
  return {
    width: Math.abs(width * Math.cos(radians)) + Math.abs(depth * Math.sin(radians)),
    depth: Math.abs(width * Math.sin(radians)) + Math.abs(depth * Math.cos(radians)),
  };
}

/** Keep the entire rotated footprint inside the room, not only its centre. */
export function fitObject(
  object: SpaceObject,
  product: SpaceProduct,
  room: SpaceRoom
): SpaceObject | null {
  const footprint = objectFootprint(product, object.rotation, object.scale ?? 1);
  if (
    footprint.width > room.width + 0.0001 ||
    footprint.depth > room.depth + 0.0001 ||
    (product.dimensions?.height ?? 0.6) * (object.scale ?? 1) > room.height + 0.0001
  )
    return null;
  return {
    ...object,
    x:
      Math.round(
        Math.min(room.width - footprint.width / 2, Math.max(footprint.width / 2, object.x)) * 1000
      ) / 1000,
    z:
      Math.round(
        Math.min(room.depth - footprint.depth / 2, Math.max(footprint.depth / 2, object.z)) * 1000
      ) / 1000,
  };
}

export function resizeRoom(
  snapshot: SpaceSnapshot,
  products: SpaceProduct[],
  room: SpaceRoom
): SpaceSnapshot | null {
  if (
    ![room.width, room.depth, room.height].every(
      (value) => Number.isFinite(value) && value >= 1 && value <= 100
    )
  )
    return null;
  const objects: SpaceObject[] = [];
  for (const object of snapshot.objects) {
    const product = products.find((entry) => entry.id === object.product_ref);
    if (!product) return null;
    const fitted = fitObject(object, product, room);
    if (!fitted || (object.locked && (fitted.x !== object.x || fitted.z !== object.z))) return null;
    objects.push(fitted);
  }
  return { ...snapshot, room, objects };
}

/** Preserve product references for display, aggregate by variant only at checkout. */
export function summarizeDesign(snapshot: SpaceSnapshot, configurator: SpacePublicConfigurator) {
  const counts = new Map<string, number>();
  for (const object of snapshot.objects)
    counts.set(object.product_ref, (counts.get(object.product_ref) ?? 0) + 1);
  for (const item of snapshot.included_items)
    counts.set(item.product_ref, (counts.get(item.product_ref) ?? 0) + item.quantity);
  return Array.from(counts, ([ref, quantity]) => {
    const definition = configurator.config.products.find((product) => product.id === ref);
    const product = configurator.catalog.find((entry) => entry.id === definition?.product_id);
    const variant = product?.variants.find((entry) => entry.id === definition?.variant_id);
    return {
      ref,
      quantity,
      definition,
      product,
      variant,
      title: definition?.label || product?.title || 'Producto no disponible',
    };
  });
}

export type SavedSpaceDesign = {
  configurator_id: string;
  template_id: string;
  saved_at: string;
  snapshot: SpaceSnapshot;
};

/** Browser drafts can outlive a template/catalogue change; reject incompatible data. */
export function readSavedDesign(
  raw: string,
  configurator: SpacePublicConfigurator
): SavedSpaceDesign | null {
  try {
    const data = JSON.parse(raw) as SavedSpaceDesign;
    if (data.configurator_id !== configurator.id || typeof data.saved_at !== 'string') return null;
    const template = configurator.config.templates.find((entry) => entry.id === data.template_id);
    const snapshot = data.snapshot;
    if (
      !template ||
      snapshot?.version !== 1 ||
      !Array.isArray(snapshot.objects) ||
      !Array.isArray(snapshot.included_items)
    )
      return null;
    if (snapshot.objects.length > 300 || snapshot.included_items.length > 100) return null;
    if (
      !snapshot.room ||
      ![snapshot.room.width, snapshot.room.depth, snapshot.room.height].every(
        (value) => Number.isFinite(value) && value >= 1 && value <= 100
      )
    )
      return null;
    if (
      snapshot.room.shape !== 'rectangle' ||
      !/^#[0-9a-f]{6}$/i.test(snapshot.room.floor_color) ||
      !/^#[0-9a-f]{6}$/i.test(snapshot.room.wall_color)
    )
      return null;
    const ids = new Set<string>();
    if (
      snapshot.objects.some((object) => {
        const product = configurator.config.products.find(
          (entry) => entry.id === object.product_ref && entry.placement === 'scene'
        );
        if (
          !product ||
          typeof object.id !== 'string' ||
          ids.has(object.id) ||
          ![object.x, object.z, object.rotation].every(Number.isFinite)
        )
          return true;
        if (
          object.scale !== undefined &&
          (!Number.isFinite(object.scale) || object.scale < 0.25 || object.scale > 4)
        )
          return true;
        if (!(product.allowed_rotations ?? [0, 90, 180, 270]).includes(object.rotation))
          return true;
        const fitted = fitObject(object, product, snapshot.room);
        ids.add(object.id);
        return (
          !fitted || Math.abs(fitted.x - object.x) > 0.001 || Math.abs(fitted.z - object.z) > 0.001
        );
      })
    )
      return null;
    if (
      snapshot.included_items.some(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 999 ||
          !configurator.config.products.some(
            (product) => product.id === item.product_ref && product.placement === 'included'
          )
      )
    )
      return null;
    for (const locked of template.objects.filter((object) => object.locked)) {
      if (
        !snapshot.objects.some(
          (object) => object.id === locked.id && JSON.stringify(object) === JSON.stringify(locked)
        )
      )
        return null;
    }
    if (
      !configurator.config.allow_custom &&
      JSON.stringify(snapshot) !== JSON.stringify(snapshotFromTemplate(template))
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
