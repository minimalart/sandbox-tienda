import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { addToCartWorkflow } from '@medusajs/core-flows';
import { LineItemsSchema, selectionQuantities } from '../../../../validation';
import {
  availableVariant,
  cartContext,
  configuratorById,
  invalid,
  parse,
  validateSelection,
  variantsFor,
} from '../../../shared';
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const input = parse(LineItemsSchema, req.body);
  const configurator = await configuratorById(req, input.configurator_id, true);
  // A quote-only space is never sold self-service, whatever the client posts.
  if (configurator.config.checkout_mode === 'quote')
    return invalid('Este espacio se cierra por cotización, no por carrito.');
  validateSelection(configurator.config, input.snapshot, input.template_id);
  const cart = await cartContext(req, input.cart_id);
  if (configurator.sales_channel_id && configurator.sales_channel_id !== cart.sales_channel_id)
    invalid('El configurador y el carrito deben pertenecer al mismo canal.');
  let quantities: Map<string, number>;
  try {
    quantities = selectionQuantities(configurator.config, input.snapshot);
  } catch (error) {
    return invalid(
      error instanceof Error ? error.message : 'Las cantidades del diseño no son válidas.'
    );
  }
  const variants = new Map(
    (await variantsFor(req, [...quantities.keys()], cart)).map((variant) => [variant.id, variant])
  );
  for (const variantId of quantities.keys()) {
    const variant = variants.get(variantId);
    const bindings = configurator.config.products.filter(
      (product) => product.variant_id === variantId
    );
    if (
      !variant ||
      variant.product?.status !== 'published' ||
      !bindings.every((product) => product.product_id === variant.product?.id) ||
      !variant.product?.sales_channels?.some((channel) => channel.id === cart.sales_channel_id)
    )
      return invalid(
        'Uno de los productos ya no está disponible en esta tienda. Actualizá el diseño.'
      );
    if (!availableVariant(variant) || variant.calculated_price?.calculated_amount == null)
      invalid('Uno de los productos ya no tiene stock o precio disponible. Actualizá el diseño.');
  }
  // One native workflow for all items: native prices, promotions and inventory validation.
  // Never accept unit_price from the client or reuse a historical quote.
  await addToCartWorkflow(req.scope).run({
    input: {
      cart_id: input.cart_id,
      items: [...quantities].map(([variant_id, quantity]) => ({
        variant_id,
        quantity,
        metadata: {
          space_designer: {
            configurator_id: configurator.id,
            configurator_title: configurator.title,
            template_id: input.template_id ?? null,
          },
        },
      })),
    },
  });
  res.json({ added: true, items_count: quantities.size });
}
