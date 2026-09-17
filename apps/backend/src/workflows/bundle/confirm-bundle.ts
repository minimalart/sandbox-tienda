import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils';
import { addToCartWorkflow } from '@medusajs/core-flows';
import type { RemoteQueryFunction } from '@medusajs/framework/types';
import { randomUUID } from 'node:crypto';
import { BUNDLE_MODULE } from '../../modules/bundle';
import { isBundleAvailableInStore } from '../../modules/bundle/link-helpers';

/**
 * confirmBundleWorkflow — server-authoritative confirmation of a bundle
 * configuration.
 *
 * Contract (PRD §19, §49-50):
 *   1. Bundle exists and is `published`.
 *   2. Bundle belongs to the cart's Store.
 *   3. Every BundleItem has a selection.
 *   4. Every selected variant belongs to its item's Product.
 *   5. quantity comes from BundleItem (never from client).
 *   6. Prices recalculated in the Store's pricing context.
 *   7. Atomic add-to-cart: rollback all line items on any failure.
 *
 * Metadata every created line item carries:
 *   bundle_id, bundle_instance_id (uuid v4), bundle_item_id, bundle_title,
 *   bundle_handle, bundle_auto_resolved.
 */

export interface ConfirmBundleWorkflowInput {
  bundle_id: string;
  cart_id: string;
  selections: { bundle_item_id: string; variant_id: string }[];
  /**
   * When present, the workflow reuses this instance id instead of generating
   * a new UUID. Used by the reconfigure path so the edited cart line items
   * keep the same grouping id as the ones they replace (PRD §53).
   */
  bundle_instance_id?: string;
}

export interface ConfirmBundleWorkflowResult {
  bundle_instance_id: string;
  cart_id: string;
  added_line_item_ids: string[];
}

interface ResolvedItem {
  bundle_item_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  title: string;
  /**
   * El producto tenía una sola variante, así que el comprador no eligió nada
   * acá. Viaja a la metadata del line item para que el resumen compacto del
   * carrito muestre SOLO sus decisiones (PRD V2 §18).
   */
  auto_resolved: boolean;
}

interface ValidatedContext extends ConfirmBundleWorkflowInput {
  bundle: {
    id: string;
    title: string;
    handle: string;
    status: string;
  };
  cart: {
    id: string;
    sales_channel_id: string | null;
    demo_store_id: string | null;
  };
  items: ResolvedItem[];
}

type LockingService = {
  execute<T>(keys: string | string[], job: () => Promise<T>, args?: { timeout?: number }): Promise<T>;
};

/**
 * Step 1 — resolve bundle + cart + active Store, then assert bundle
 * availability in the cart's Store.
 *
 * Cart Store is derived from the cart's `sales_channel_id` by finding the
 * `demo_store` whose `sales_channel_id` matches it. When the demo_store
 * module is not registered the bundle is treated as global (§5.2).
 */
const resolveAndValidateBundleStep = createStep(
  'confirm-bundle-resolve-validate',
  async (input: ConfirmBundleWorkflowInput, { container }) => {
    const service: any = container.resolve(BUNDLE_MODULE);
    const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(
      ContainerRegistrationKeys.QUERY,
    );

    const bundle = await service.retrieveBundle(input.bundle_id).catch(() => null);
    if (!bundle) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Bundle not found');
    }
    if (bundle.status !== 'published') {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Bundle is not published');
    }

    const { data: cartRows } = await query.graph({
      entity: 'cart',
      fields: ['id', 'sales_channel_id'],
      filters: { id: input.cart_id },
    });
    const cart = cartRows?.[0] as { id: string; sales_channel_id?: string } | undefined;
    if (!cart) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Cart not found');
    }

    let demoStoreId: string | null = null;
    if (cart.sales_channel_id) {
      try {
        const { data: stores } = await query.graph({
          entity: 'demo_store',
          fields: ['id', 'sales_channel_id'],
          filters: { sales_channel_id: cart.sales_channel_id },
        });
        demoStoreId = ((stores?.[0] as { id?: string } | undefined)?.id) ?? null;
      } catch {
        demoStoreId = null;
      }
    }

    const available = await isBundleAvailableInStore(container, bundle.id, demoStoreId);
    if (!available) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        'Bundle is not available in this store',
      );
    }

    return new StepResponse({
      input,
      bundle: {
        id: bundle.id,
        title: bundle.title,
        handle: bundle.handle,
        status: bundle.status,
      },
      cart: {
        id: cart.id,
        sales_channel_id: cart.sales_channel_id ?? null,
        demo_store_id: demoStoreId,
      },
    });
  },
);

/**
 * Step 2 — Validate selections against the persisted BundleItems + Product
 * variants. Rejects payload-controlled quantities (PRD §20) and variants
 * that don't belong to the item's Product.
 */
const validateSelectionsStep = createStep(
  'confirm-bundle-validate-selections',
  async (
    payload: {
      input: ConfirmBundleWorkflowInput;
      bundle: ValidatedContext['bundle'];
      cart: ValidatedContext['cart'];
    },
    { container },
  ) => {
    const service: any = container.resolve(BUNDLE_MODULE);
    const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(
      ContainerRegistrationKeys.QUERY,
    );

    const items = (await service.listBundleItems(
      { bundle_id: payload.bundle.id },
      { order: { position: 'ASC' } },
    )) as Array<{ id: string; product_id: string; quantity: number }>;

    const selectionByItem = new Map(
      payload.input.selections.map((s) => [s.bundle_item_id, s.variant_id]),
    );

    // Every item must have a selection and every selection must map to a real item.
    const missing = items.filter((it) => !selectionByItem.has(it.id));
    if (missing.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Missing selection for bundle items: ${missing.map((m) => m.id).join(', ')}`,
      );
    }
    const stray = payload.input.selections.filter(
      (s) => !items.some((it) => it.id === s.bundle_item_id),
    );
    if (stray.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown bundle_item_id(s): ${stray.map((s) => s.bundle_item_id).join(', ')}`,
      );
    }

    // Resolve every selected variant + parent product in ONE query graph call.
    const variantIds = Array.from(new Set(payload.input.selections.map((s) => s.variant_id)));
    const { data: variantRows } = await query.graph({
      entity: 'variant',
      fields: [
        'id',
        'title',
        'product_id',
        'product.title',
        'product.handle',
        // Cuántas variantes tiene el producto: con una sola, el ítem se
        // auto-resolvió y no representa una decisión del comprador.
        'product.variants.id',
        'sales_channels.id',
      ],
      filters: { id: variantIds },
    });
    const variantsById = new Map(
      ((variantRows ?? []) as Array<{
        id: string;
        title: string | null;
        product_id: string;
        product?: { title: string; handle: string; variants?: Array<{ id: string }> };
        sales_channels?: Array<{ id: string }>;
      }>).map((v) => [v.id, v]),
    );

    const resolved: ResolvedItem[] = [];
    for (const item of items) {
      const variantId = selectionByItem.get(item.id)!;
      const variant = variantsById.get(variantId);
      if (!variant) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Variant ${variantId} not found`,
        );
      }
      if (variant.product_id !== item.product_id) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Variant ${variantId} does not belong to product ${item.product_id}`,
        );
      }
      // If the cart has a sales channel, require the variant to be scoped to it.
      // A cart WITHOUT a sales_channel_id is a legitimate transient state (e.g.
      // guest cart before region selection), and we don't block those.
      if (payload.cart.sales_channel_id) {
        const channels = (variant.sales_channels ?? []).map((c) => c.id);
        if (channels.length && !channels.includes(payload.cart.sales_channel_id)) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Variant ${variantId} is not available in the cart's sales channel`,
          );
        }
      }
      const productTitle = variant.product?.title ?? 'Product';
      const variantSuffix = variant.title ? ` (${variant.title})` : '';
      resolved.push({
        bundle_item_id: item.id,
        product_id: item.product_id,
        variant_id: variantId,
        quantity: item.quantity, // server-authoritative
        title: `${productTitle}${variantSuffix}`,
        auto_resolved: (variant.product?.variants?.length ?? 1) <= 1,
      });
    }

    const ctx: ValidatedContext = {
      ...payload.input,
      bundle: payload.bundle,
      cart: payload.cart,
      items: resolved,
    };
    return new StepResponse(ctx);
  },
);

/**
 * Step 3 — Atomic add-to-cart. The underlying `addToCartWorkflow` accepts an
 * array of items and adds them as a single transactional unit, so we pass
 * every resolved selection at once. If it fails, no line items are created.
 *
 * On success we snapshot the newly created line items by matching the
 * `bundle_instance_id` we just stamped in metadata, so the compensation
 * (a workflow-level rollback triggered by any later step failure) can find
 * and remove them.
 */
const addBundleLineItemsStep = createStep(
  'confirm-bundle-add-line-items',
  async (ctx: ValidatedContext, { container }) => {
    const bundle_instance_id = ctx.bundle_instance_id ?? randomUUID();

    const items = ctx.items.map((it) => ({
      variant_id: it.variant_id,
      quantity: it.quantity,
      title: it.title,
      metadata: {
        bundle_id: ctx.bundle.id,
        bundle_instance_id,
        bundle_item_id: it.bundle_item_id,
        bundle_title: ctx.bundle.title,
        bundle_auto_resolved: it.auto_resolved,
        // Storefront usa el handle para linkear al wizard desde el cart
        // (la ruta es /bundles/[handle], no /bundles/[id]). Guardarlo en
        // metadata evita un round-trip al backend para resolver id → handle
        // al renderizar "Editar configuración".
        bundle_handle: ctx.bundle.handle,
      },
    }));

    // Use the LOCKING module (Redis-backed in prod) to serialise concurrent
    // confirmations against the same cart. Without this two parallel confirms
    // could interleave add-to-cart calls and produce duplicate line items
    // sharing the same bundle_instance_id.
    const locking = container.resolve<LockingService>(Modules.LOCKING);
    const addedLineItemIds: string[] = await locking.execute(
      [`cart:${ctx.cart_id}`],
      async () => {
        await addToCartWorkflow(container).run({
          input: { cart_id: ctx.cart_id, items },
        });

        // Fetch the newly created line items via Query and filter by the
        // metadata we just stamped. Safer than trusting whatever
        // `addToCartWorkflow` returns because Medusa's contract on that shape
        // varies by version.
        const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(
          ContainerRegistrationKeys.QUERY,
        );
        const { data } = await query.graph({
          entity: 'cart',
          fields: ['id', 'items.id', 'items.metadata'],
          filters: { id: ctx.cart_id },
        });
        const cart = data?.[0] as
          | { items?: Array<{ id: string; metadata?: Record<string, unknown> | null }> }
          | undefined;
        return (cart?.items ?? [])
          .filter((it) => it.metadata && (it.metadata as any).bundle_instance_id === bundle_instance_id)
          .map((it) => it.id);
      },
      { timeout: 15 },
    );

    return new StepResponse(
      {
        cart_id: ctx.cart_id,
        bundle_instance_id,
        added_line_item_ids: addedLineItemIds,
      },
      // Compensation payload: everything the rollback needs to remove the
      // created line items.
      { cart_id: ctx.cart_id, added_line_item_ids: addedLineItemIds },
    );
  },
  async (rollback, { container }) => {
    if (!rollback?.added_line_item_ids?.length) return;
    // Compensate by setting each line item's quantity to 0 via Medusa's
    // dedicated workflow. Loaded lazily to keep the top-level import list
    // small.
    const { updateLineItemInCartWorkflow } = await import('@medusajs/core-flows');
    for (const itemId of rollback.added_line_item_ids) {
      await updateLineItemInCartWorkflow(container)
        .run({
          input: {
            cart_id: rollback.cart_id,
            item_id: itemId,
            update: { quantity: 0 } as any,
          },
        })
        .catch(() => {
          /* best-effort compensation */
        });
    }
  },
);

export const confirmBundleWorkflow = createWorkflow(
  'confirm-bundle',
  function (input: ConfirmBundleWorkflowInput) {
    const step1 = resolveAndValidateBundleStep(input);
    const validated = validateSelectionsStep(step1);
    const added = addBundleLineItemsStep(validated);
    return new WorkflowResponse(added);
  },
);
