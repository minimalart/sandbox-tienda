import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules, MedusaError } from '@medusajs/framework/utils';
import {
  addToCartWorkflow,
  deleteLineItemsWorkflow,
  updateLineItemInCartWorkflow,
} from '@medusajs/core-flows';
import { z } from 'zod';
import {
  effectiveCommercial,
  presentationLine,
} from '../../../../../../lib/catalog/cart-validation';
import { getSalesModes, siteIdForCart } from '../../../../../../lib/multistore/sales-mode-store';
import { isSellableStandalone } from '../../../../../../lib/multistore/sales-mode';

const Body = z
  .object({
    lines: z
      .array(
        z
          .object({
            variant_id: z.string().min(1),
            quantity: z.number().int().positive(),
            presentation_mode: z.enum(['unit', 'package']).optional(),
          })
          .strict()
      )
      .max(500),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .strict();

type DesiredLine = { variant_id: string; quantity: number; metadata?: Record<string, unknown> };

/**
 * Deja las líneas del carrito B2B EXACTAMENTE como `lines`, en una sola request.
 *
 * El storefront lo hacía con una llamada por línea (`createLineItem` /
 * `updateLineItem` / `deleteLineItem`) más un `cart.update` para la metadata, y
 * cada una corre el workflow completo del carrito (precios, promociones,
 * impuestos, payment collection): con 8 líneas eran ~65 s. Acá las altas van
 * todas juntas en UN `addToCartWorkflow`, las bajas en UN `deleteLineItemsWorkflow`
 * y sólo los cambios de cantidad siguen siendo uno por línea (el core no tiene
 * un workflow de update en lote). La metadata de la empresa no afecta precios,
 * así que se escribe directo en el módulo y sólo si cambió.
 *
 * Mismos guards que `/presentations` y que el add-to-cart del core: carrito del
 * customer logueado, en un canal de la publishable key, SKUs de ese canal y
 * productos que la tienda no reserva para kits.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success)
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Revisá SKU, presentación y cantidad.');
  const cartModule = req.scope.resolve(Modules.CART) as any;
  const cart = await cartModule.retrieveCart(req.params.id, { relations: ['items'] });
  if (!req.auth_context?.actor_id || cart.customer_id !== req.auth_context.actor_id)
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Carrito no encontrado.');
  const allowedChannels = (req as any).publishable_key_context?.sales_channel_ids;
  if (!Array.isArray(allowedChannels) || !allowedChannels.includes(cart.sales_channel_id))
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'El carrito no pertenece al canal autorizado.'
    );

  const byVariant = new Map<string, z.infer<typeof Body>['lines'][number]>();
  for (const line of parsed.data.lines) byVariant.set(line.variant_id, line);
  const existing = new Map<string, any>();
  for (const item of cart.items ?? []) if (item.variant_id) existing.set(item.variant_id, item);

  const newVariantIds = [...byVariant.keys()].filter((id) => !existing.has(id));
  const needsVariants = [...byVariant.values()].filter(
    (l) => l.presentation_mode || !existing.has(l.variant_id)
  );
  const variants = new Map<string, any>();
  if (needsVariants.length) {
    const { data } = await (req.scope.resolve(ContainerRegistrationKeys.QUERY) as any).graph({
      entity: 'product_variant',
      fields: ['id', 'product_id', 'metadata', 'product.metadata', 'product.sales_channels.id'],
      filters: { id: needsVariants.map((l) => l.variant_id) },
    });
    for (const v of data) variants.set(v.id, v);
  }

  if (newVariantIds.length) {
    for (const id of newVariantIds) {
      const v = variants.get(id);
      if (!v?.product?.sales_channels?.some((sc: any) => sc.id === cart.sales_channel_id))
        throw new MedusaError(MedusaError.Types.NOT_FOUND, 'SKU no disponible en este canal.');
    }
    // Mismo guard que `rejectBundleOnlyLineItem` en POST /store/carts/:id/line-items.
    const siteId = await siteIdForCart(req.scope, cart.id);
    if (siteId) {
      const productIds = [...new Set(newVariantIds.map((id) => variants.get(id).product_id))];
      const modes = await getSalesModes(req.scope, siteId, productIds);
      if (productIds.some((id) => !isSellableStandalone(modes.get(id)!)))
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          'Este producto solo se vende como parte de un kit.'
        );
    }
  }

  const connections = new Map<string, Promise<any>>();
  const desired = new Map<string, DesiredLine>();
  for (const line of byVariant.values()) {
    if (!line.presentation_mode) {
      desired.set(line.variant_id, { variant_id: line.variant_id, quantity: line.quantity });
      continue;
    }
    const variant = variants.get(line.variant_id);
    try {
      desired.set(
        line.variant_id,
        presentationLine(
          variant,
          line.quantity,
          line.presentation_mode,
          await effectiveCommercial(req.scope, variant, connections)
        )
      );
    } catch (error) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, (error as Error).message);
    }
  }

  const toDelete = [...existing.entries()]
    .filter(([variantId]) => !desired.has(variantId))
    .map(([, item]) => item.id);
  if (toDelete.length)
    await deleteLineItemsWorkflow(req.scope).run({ input: { cart_id: cart.id, ids: toDelete } });

  const toAdd: DesiredLine[] = [];
  for (const line of desired.values()) {
    const previous = existing.get(line.variant_id);
    if (!previous) {
      toAdd.push(line);
      continue;
    }
    const presentation = line.metadata ? line.metadata.catalog_presentation ?? null : undefined;
    const presentationChanged =
      presentation !== undefined &&
      JSON.stringify(previous.metadata?.catalog_presentation ?? null) !==
        JSON.stringify(presentation);
    if (Number(previous.quantity) === line.quantity && !presentationChanged) continue;
    // eslint-disable-next-line no-await-in-loop
    await updateLineItemInCartWorkflow(req.scope).run({
      input: {
        cart_id: cart.id,
        item_id: previous.id,
        update: {
          quantity: line.quantity,
          ...(presentation !== undefined
            ? { metadata: { ...previous.metadata, catalog_presentation: presentation } }
            : {}),
        },
      },
    });
  }
  if (toAdd.length)
    await addToCartWorkflow(req.scope).run({ input: { cart_id: cart.id, items: toAdd } });

  const incoming = parsed.data.metadata;
  if (incoming && Object.entries(incoming).some(([k, v]) => cart.metadata?.[k] !== v))
    await cartModule.updateCarts(cart.id, { metadata: { ...cart.metadata, ...incoming } });

  res.json({ ok: true, cart_id: cart.id });
}
