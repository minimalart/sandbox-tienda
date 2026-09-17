import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';
import type { RemoteQueryFunction } from '@medusajs/framework/types';
import { updateLineItemInCartWorkflow } from '@medusajs/core-flows';
import { confirmBundleWorkflow } from './confirm-bundle';

/**
 * reconfigureBundleWorkflow — replace the line items of an existing bundle
 * instance with a new set of selections.
 *
 * Semantics (PRD §53):
 *  - the new selections are added first with the SAME bundle_instance_id;
 *  - only if the add succeeds are the old line items deleted;
 *  - a failure in the add leaves the original bundle intact (no data loss);
 *  - a failure in the delete leaves duplicated items in the cart, tagged
 *    with a warning so the caller can surface it. This is a soft edge case
 *    the customer can fix by removing the duplicates.
 *
 * The workflow does NOT try to be smart about "only variants that changed":
 *  a full replace is simpler and matches the wizard flow, which always
 *  resends the whole configuration.
 */

export interface ReconfigureBundleWorkflowInput {
  bundle_id: string;
  cart_id: string;
  bundle_instance_id: string;
  selections: { bundle_item_id: string; variant_id: string }[];
}

export interface ReconfigureBundleWorkflowResult {
  cart_id: string;
  bundle_instance_id: string;
  added_line_item_ids: string[];
  removed_line_item_ids: string[];
  warnings: string[];
}

type LockingService = {
  execute<T>(keys: string | string[], job: () => Promise<T>, args?: { timeout?: number }): Promise<T>;
};

/**
 * Step 1 — snapshot the current line items of the instance so step 3 can
 * delete them and the compensation (if any downstream step throws) knows
 * what NOT to delete.
 */
const snapshotOldLineItemsStep = createStep(
  'reconfigure-bundle-snapshot',
  async (input: ReconfigureBundleWorkflowInput, { container }) => {
    const query = container.resolve<Omit<RemoteQueryFunction, symbol>>(
      ContainerRegistrationKeys.QUERY,
    );
    const { data } = await query.graph({
      entity: 'cart',
      fields: ['id', 'items.id', 'items.metadata'],
      filters: { id: input.cart_id },
    });
    const cart = data?.[0] as
      | { items?: Array<{ id: string; metadata?: Record<string, unknown> | null }> }
      | undefined;
    if (!cart) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Cart not found');
    }
    const oldLineItemIds = (cart.items ?? [])
      .filter(
        (it) =>
          it.metadata &&
          (it.metadata as any).bundle_instance_id === input.bundle_instance_id,
      )
      .map((it) => it.id);
    if (!oldLineItemIds.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No line items found for bundle_instance_id ${input.bundle_instance_id}`,
      );
    }
    return new StepResponse({ input, oldLineItemIds });
  },
);

/**
 * Step 2 — run the confirm workflow with the SAME bundle_instance_id so the
 * new line items join the existing group.
 */
const runConfirmStep = createStep(
  'reconfigure-bundle-confirm',
  async (payload: { input: ReconfigureBundleWorkflowInput; oldLineItemIds: string[] }, { container }) => {
    const { result } = await confirmBundleWorkflow(container).run({
      input: {
        bundle_id: payload.input.bundle_id,
        cart_id: payload.input.cart_id,
        selections: payload.input.selections,
        bundle_instance_id: payload.input.bundle_instance_id,
      },
    });
    return new StepResponse({ ...payload, added: result });
  },
);

/**
 * Step 3 — delete the old line items. Wrapped by the same cart lock as the
 * confirm workflow to avoid a concurrent `addToCartWorkflow` racing with the
 * deletes and reviving the old items.
 */
const deleteOldLineItemsStep = createStep(
  'reconfigure-bundle-delete-old',
  async (
    payload: {
      input: ReconfigureBundleWorkflowInput;
      oldLineItemIds: string[];
      added: { cart_id: string; bundle_instance_id: string; added_line_item_ids: string[] };
    },
    { container },
  ) => {
    const locking = container.resolve<LockingService>(Modules.LOCKING);
    const warnings: string[] = [];
    const removed = await locking.execute(
      [`cart:${payload.input.cart_id}`],
      async () => {
        const removedIds: string[] = [];
        for (const itemId of payload.oldLineItemIds) {
          try {
            await updateLineItemInCartWorkflow(container).run({
              input: {
                cart_id: payload.input.cart_id,
                item_id: itemId,
                update: { quantity: 0 } as any,
              },
            });
            removedIds.push(itemId);
          } catch (err) {
            warnings.push(
              `Could not remove old line item ${itemId}: ${(err as Error).message}`,
            );
          }
        }
        return removedIds;
      },
      { timeout: 15 },
    );

    return new StepResponse({
      cart_id: payload.added.cart_id,
      bundle_instance_id: payload.added.bundle_instance_id,
      added_line_item_ids: payload.added.added_line_item_ids,
      removed_line_item_ids: removed,
      warnings,
    });
  },
);

export const reconfigureBundleWorkflow = createWorkflow(
  'reconfigure-bundle',
  function (input: ReconfigureBundleWorkflowInput) {
    const snap = snapshotOldLineItemsStep(input);
    const added = runConfirmStep(snap);
    const done = deleteOldLineItemsStep(added);
    return new WorkflowResponse(done);
  },
);
