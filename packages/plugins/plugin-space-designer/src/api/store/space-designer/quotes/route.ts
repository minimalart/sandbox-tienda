import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import type { SpaceQuoteItem } from '../../../../types';
import { QuoteSchema } from '../../../../validation';
import {
  configuratorById,
  customerOf,
  invalid,
  parse,
  serviceOf,
  storeChannels,
  validateSelection,
  variantsFor,
} from '../../../shared';

/**
 * A quote request never prices or reserves anything: it stores what the shopper
 * designed plus how to reach them. Availability and price are deliberately NOT
 * required — the whole point of the mode is asking about products the store
 * cannot sell self-service.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const input = parse(QuoteSchema, req.body);
  const configurator = await configuratorById(req, input.configurator_id, true);
  if (configurator.config.checkout_mode !== 'quote')
    return invalid('Este espacio se compra directamente desde el carrito.');
  validateSelection(configurator.config, input.snapshot, input.template_id);

  const quantities = new Map<string, number>();
  for (const item of [
    ...input.snapshot.objects.map((object) => ({ product_ref: object.product_ref, quantity: 1 })),
    ...input.snapshot.included_items,
  ])
    quantities.set(item.product_ref, (quantities.get(item.product_ref) ?? 0) + item.quantity);

  const products = new Map(configurator.config.products.map((product) => [product.id, product]));
  const variants = new Map(
    (
      await variantsFor(
        req,
        [...quantities.keys()].map((ref) => products.get(ref)?.variant_id ?? '').filter(Boolean)
      )
    ).map((variant) => [variant.id, variant])
  );
  const items: SpaceQuoteItem[] = [...quantities].map(([ref, quantity]) => {
    const product = products.get(ref);
    const variant = product ? variants.get(product.variant_id) : undefined;
    return {
      product_ref: ref,
      variant_id: product?.variant_id ?? '',
      title: product?.label || variant?.product?.title || ref,
      sku: variant?.sku ?? null,
      quantity,
    };
  });

  const quote = await serviceOf(req).createSpaceQuotes({
    configurator_id: configurator.id,
    configurator_title: configurator.title,
    sales_channel_id: configurator.sales_channel_id ?? storeChannels(req)[0],
    customer_id: customerOf(req),
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    message: input.message || null,
    template_id: input.template_id ?? null,
    template_name:
      configurator.config.templates.find((template) => template.id === input.template_id)?.name ??
      null,
    snapshot: input.snapshot,
    items,
    status: 'new',
  } as any);
  res.status(201).json({ quote: { id: (quote as { id: string }).id }, requested: true });
}
