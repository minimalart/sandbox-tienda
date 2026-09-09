import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules, MedusaError } from '@medusajs/framework/utils';
import { addToCartWorkflow, updateLineItemInCartWorkflow } from '@medusajs/core-flows';
import { z } from 'zod';
import {
  effectiveCommercial,
  presentationLine,
} from '../../../../../../lib/catalog/cart-validation';

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const parsed = z
    .object({
      variant_id: z.string().min(1),
      quantity: z.number().int().positive(),
      mode: z.enum(['unit', 'package']),
      replace: z.boolean().optional(),
    })
    .strict()
    .safeParse(req.body);
  if (!parsed.success)
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Revisá SKU, presentación y cantidad.');
  const cart = await (req.scope.resolve(Modules.CART) as any).retrieveCart(req.params.id, {
    relations: ['items'],
  });
  if (!req.auth_context?.actor_id || cart.customer_id !== req.auth_context.actor_id)
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Carrito no encontrado.');
  const allowedChannels = (req as any).publishable_key_context?.sales_channel_ids;
  if (!Array.isArray(allowedChannels) || !allowedChannels.includes(cart.sales_channel_id))
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'El carrito no pertenece al canal autorizado.'
    );
  const { data } = await (req.scope.resolve(ContainerRegistrationKeys.QUERY) as any).graph({
    entity: 'product_variant',
    fields: ['id', 'metadata', 'product.metadata', 'product.sales_channels.id'],
    filters: { id: parsed.data.variant_id },
  });
  const variant = data[0];
  if (!variant?.product?.sales_channels?.some((sc: any) => sc.id === cart.sales_channel_id))
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'SKU no disponible en este canal.');
  let line;
  try {
    line = presentationLine(
      variant,
      parsed.data.quantity,
      parsed.data.mode,
      await effectiveCommercial(req.scope, variant)
    );
  } catch (error) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, (error as Error).message);
  }
  const previous = cart.items?.find((item: any) => item.variant_id === variant.id);
  if (parsed.data.replace && previous) {
    await updateLineItemInCartWorkflow(req.scope).run({
      input: {
        cart_id: cart.id,
        item_id: previous.id,
        update: {
          quantity: line.quantity,
          metadata: {
            ...previous.metadata,
            catalog_presentation: line.metadata.catalog_presentation ?? null,
          },
        },
      },
    });
  } else await addToCartWorkflow(req.scope).run({ input: { cart_id: cart.id, items: [line] } });
  res.json({
    cart: await (req.scope.resolve(Modules.CART) as any).retrieveCart(cart.id, {
      relations: ['items'],
    }),
  });
}
