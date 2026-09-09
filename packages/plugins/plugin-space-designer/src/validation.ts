import { z } from 'zod';
import type { SpaceConfigV1, SpaceSnapshot, SpaceTemplate } from './types';

const identifier = z.string().trim().min(1).max(120);
const positive = z.number().finite().positive().max(100);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const url = z
  .string()
  .max(2048)
  .refine(
    (value) => /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value),
    'Usá una URL http(s) o una ruta absoluta.'
  );
const dimensions = z.object({ width: positive, depth: positive, height: positive });
export const RoomSchema = z.object({
  width: positive.min(1),
  depth: positive.min(1),
  height: positive.min(1),
  shape: z.literal('rectangle').default('rectangle'),
  floor_color: color.default('#E8E1D7'),
  wall_color: color.default('#F5F5F0'),
  background_url: url.optional(),
  floor_texture_url: url.optional(),
  wall_texture_url: url.optional(),
});
export const ObjectSchema = z.object({
  id: identifier,
  product_ref: identifier,
  x: z.number().finite().min(0).max(100),
  z: z.number().finite().min(0).max(100),
  rotation: z.number().finite().min(0).lt(360),
  locked: z.boolean().optional(),
  scale: z.number().finite().min(0.25).max(4).optional(),
});
export const IncludedSchema = z.object({
  product_ref: identifier,
  quantity: z.number().int().min(1).max(999),
});
export const SnapshotSchema = z.object({
  version: z.literal(1),
  room: RoomSchema,
  objects: z.array(ObjectSchema).max(300),
  included_items: z.array(IncludedSchema).max(100),
});
export const TemplateSchema = z.object({
  id: identifier,
  name: z.string().trim().min(1).max(150),
  description: z.string().max(2000).optional(),
  image_url: url.optional(),
  room: RoomSchema,
  objects: z.array(ObjectSchema).max(300),
  included_items: z.array(IncludedSchema).max(100),
  sort_order: z.number().int().min(0).max(10000).optional(),
});
export const ProductSchema = z
  .object({
    id: identifier,
    product_id: identifier,
    variant_id: identifier,
    placement: z.enum(['scene', 'included']),
    category: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(150).optional(),
    dimensions: dimensions.optional(),
    asset: z
      .object({
        kind: z.enum(['image', 'primitive', 'glb']),
        url: url.optional(),
        shape: z.enum(['box', 'cylinder']).optional(),
        color: color.optional(),
        model: z
          .enum([
            'table',
            'desk',
            'hex-table-set',
            'shelving',
            'cabinet',
            'chair',
            'computer',
            'projector',
            'robotics-kit',
          ])
          .optional(),
        accent_color: color.optional(),
        mount: z.enum(['floor', 'surface', 'wall', 'ceiling']).optional(),
        anchor_product_ref: identifier.optional(),
      })
      .optional(),
    allowed_rotations: z.array(z.number().finite().min(0).lt(360)).min(1).max(36).optional(),
  })
  .superRefine((product, ctx) => {
    if (product.placement === 'scene' && !product.dimensions)
      ctx.addIssue({
        code: 'custom',
        path: ['dimensions'],
        message: 'Los objetos del plano necesitan dimensiones.',
      });
    if (product.asset && product.asset.kind !== 'primitive' && !product.asset.url)
      ctx.addIssue({
        code: 'custom',
        path: ['asset', 'url'],
        message: 'La imagen o modelo necesita una URL.',
      });
  });

/** Validate against the saved catalog, never dimensions or product IDs from a shopper. */
export function snapshotErrors(config: SpaceConfigV1, snapshot: SpaceSnapshot): string[] {
  const errors: string[] = [];
  const refs = new Map(config.products.map((product) => [product.id, product]));
  const ids = new Set<string>();
  for (const object of snapshot.objects) {
    if (ids.has(object.id)) errors.push(`El objeto ${object.id} está repetido.`);
    ids.add(object.id);
    const product = refs.get(object.product_ref);
    if (!product || product.placement !== 'scene' || !product.dimensions) {
      errors.push(`El objeto ${object.id} no corresponde a un producto del plano.`);
      continue;
    }
    const rotations = product.allowed_rotations ?? [0, 90, 180, 270];
    if (!rotations.includes(object.rotation))
      errors.push(`La rotación de ${object.id} no está permitida.`);
    const radians = (object.rotation * Math.PI) / 180;
    const scale = object.scale ?? 1;
    const halfWidth =
      ((Math.abs(Math.cos(radians)) * product.dimensions.width +
        Math.abs(Math.sin(radians)) * product.dimensions.depth) *
        scale) /
      2;
    const halfDepth =
      ((Math.abs(Math.sin(radians)) * product.dimensions.width +
        Math.abs(Math.cos(radians)) * product.dimensions.depth) *
        scale) /
      2;
    if (
      object.x - halfWidth < -0.001 ||
      object.x + halfWidth > snapshot.room.width + 0.001 ||
      object.z - halfDepth < -0.001 ||
      object.z + halfDepth > snapshot.room.depth + 0.001 ||
      product.dimensions.height * scale > snapshot.room.height + 0.001
    )
      errors.push(`El objeto ${object.id} queda fuera del espacio.`);
  }
  const included = new Set<string>();
  for (const item of snapshot.included_items) {
    if (included.has(item.product_ref))
      errors.push(`El producto incluido ${item.product_ref} está repetido.`);
    included.add(item.product_ref);
    if (refs.get(item.product_ref)?.placement !== 'included')
      errors.push(`El producto ${item.product_ref} no está habilitado como equipamiento incluido.`);
  }
  return errors;
}

const surface = z
  .array(z.object({ label: z.string().min(1).max(80), color, texture_url: url.optional() }))
  .max(30);
export const ConfigSchema = z
  .object({
    version: z.literal(1),
    description: z.string().max(4000).optional(),
    products: z.array(ProductSchema).max(500),
    templates: z.array(TemplateSchema).max(100),
    allow_custom: z.boolean().default(true),
    checkout_mode: z.enum(['cart', 'quote']).default('cart'),
    surface_options: z.object({ floors: surface.optional(), walls: surface.optional() }).optional(),
  })
  .superRefine((config, ctx) => {
    for (const field of ['products', 'templates'] as const) {
      const ids = new Set<string>();
      config[field].forEach((item, index) => {
        if (ids.has(item.id))
          ctx.addIssue({
            code: 'custom',
            path: [field, index, 'id'],
            message: 'El identificador está repetido.',
          });
        ids.add(item.id);
      });
    }
    config.products.forEach((product, index) => {
      const anchor = product.asset?.anchor_product_ref;
      if (
        anchor &&
        (anchor === product.id ||
          !config.products.some((entry) => entry.id === anchor && entry.placement === 'scene'))
      )
        ctx.addIssue({
          code: 'custom',
          path: ['products', index, 'asset', 'anchor_product_ref'],
          message: 'El anclaje debe referir a otro producto ubicable del configurador.',
        });
    });
    config.templates.forEach((template, index) =>
      snapshotErrors(config as SpaceConfigV1, { version: 1, ...template }).forEach((message) =>
        ctx.addIssue({ code: 'custom', path: ['templates', index], message })
      )
    );
  });
export const ConfiguratorSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(1).max(200),
    status: z.enum(['draft', 'published']).default('draft'),
    sales_channel_id: identifier.nullable().default(null),
    config: ConfigSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.status === 'published' &&
      (!value.config.templates.length ||
        value.config.templates.some((template) => !template.objects.length))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['config', 'templates'],
        message:
          'Publicá al menos una predefinida con sus muebles ya ubicados; ninguna predefinida puede estar vacía.',
      });
  });

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  q: z.string().trim().max(150).optional(),
  sales_channel_id: identifier.optional(),
});
export const SelectionSchema = z.object({
  configurator_id: identifier,
  template_id: identifier.optional(),
  snapshot: SnapshotSchema,
});
export const LineItemsSchema = SelectionSchema.extend({ cart_id: identifier });
export const DesignSchema = SelectionSchema.extend({ name: z.string().trim().min(1).max(150) });
export const QuoteSchema = SelectionSchema.extend({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(60).optional(),
  message: z.string().trim().max(2000).optional(),
});
export const QuoteListSchema = PaginationSchema.extend({
  status: z.enum(['new', 'contacted', 'closed']).optional(),
});
export const QuoteUpdateSchema = z.object({ status: z.enum(['new', 'contacted', 'closed']) });

const canonicalSnapshot = (snapshot: SpaceSnapshot) =>
  JSON.stringify({
    // PostgreSQL jsonb reorders object keys. Compare explicit semantic fields,
    // never the insertion order of data returned by the database.
    room: {
      width: snapshot.room.width,
      depth: snapshot.room.depth,
      height: snapshot.room.height,
      shape: snapshot.room.shape,
      floor_color: snapshot.room.floor_color,
      wall_color: snapshot.room.wall_color,
      background_url: snapshot.room.background_url ?? null,
      floor_texture_url: snapshot.room.floor_texture_url ?? null,
      wall_texture_url: snapshot.room.wall_texture_url ?? null,
    },
    objects: snapshot.objects
      .map((object) => ({
        id: object.id,
        product_ref: object.product_ref,
        x: object.x,
        z: object.z,
        rotation: object.rotation,
        scale: object.scale ?? 1,
        locked: object.locked ?? false,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    included_items: snapshot.included_items
      .map((item) => ({ product_ref: item.product_ref, quantity: item.quantity }))
      .sort((a, b) => a.product_ref.localeCompare(b.product_ref)),
  });
export function selectionErrors(
  config: SpaceConfigV1,
  snapshot: SpaceSnapshot,
  templateId?: string
): string[] {
  const errors = snapshotErrors(config, snapshot);
  const template = templateId ? config.templates.find((row) => row.id === templateId) : undefined;
  if (templateId && !template) errors.push('La predefinida ya no está disponible.');
  if (
    !config.allow_custom &&
    (!template || canonicalSnapshot(snapshot) !== canonicalSnapshot({ version: 1, ...template }))
  )
    errors.push('Este configurador permite usar únicamente las predefinidas publicadas.');
  if (template && config.allow_custom) {
    for (const locked of template.objects.filter((object) => object.locked)) {
      const object = snapshot.objects.find((row) => row.id === locked.id);
      if (
        !object ||
        object.product_ref !== locked.product_ref ||
        object.x !== locked.x ||
        object.z !== locked.z ||
        object.rotation !== locked.rotation ||
        (object.scale ?? 1) !== (locked.scale ?? 1)
      )
        errors.push(`El objeto fijo ${locked.id} no se puede modificar.`);
    }
  }
  if (!snapshot.objects.length && !snapshot.included_items.length)
    errors.push('El diseño está vacío.');
  return errors;
}
export function selectionQuantities(
  config: SpaceConfigV1,
  snapshot: SpaceSnapshot
): Map<string, number> {
  const products = new Map(config.products.map((product) => [product.id, product]));
  const quantities = new Map<string, number>();
  for (const item of [
    ...snapshot.objects.map((object) => ({ product_ref: object.product_ref, quantity: 1 })),
    ...snapshot.included_items,
  ]) {
    const product = products.get(item.product_ref);
    if (!product) throw new Error('Producto desconocido.');
    const quantity = (quantities.get(product.variant_id) ?? 0) + item.quantity;
    if (quantity > 999) throw new Error('La cantidad máxima por variante es 999.');
    quantities.set(product.variant_id, quantity);
  }
  return quantities;
}
