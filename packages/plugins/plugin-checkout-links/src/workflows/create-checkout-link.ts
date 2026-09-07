import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { CHECKOUT_LINK_MODULE } from '../modules/checkout-link';
import type CheckoutLinkModuleService from '../modules/checkout-link/service';
import type { CreateCheckoutLinkInput } from '../modules/checkout-link/types';

const validateCheckoutLinkInputStep = createStep(
  'validate-checkout-link-input',
  async (input: CreateCheckoutLinkInput) => {
    if (!input.country_code?.trim()) {
      throw new Error('country_code is required');
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error('At least one item is required');
    }
    for (const item of input.items) {
      if (!item.variant_id) {
        throw new Error('Each item needs a variant_id');
      }
      if (!item.quantity || item.quantity < 1) {
        throw new Error('Each item needs a quantity of at least 1');
      }
    }
    if (input.expires_at && new Date(input.expires_at) <= new Date()) {
      throw new Error('expires_at must be in the future');
    }

    return new StepResponse(input);
  },
);

const createCheckoutLinkStep = createStep(
  'create-checkout-link',
  async (input: CreateCheckoutLinkInput, { container }) => {
    const service: CheckoutLinkModuleService =
      container.resolve(CHECKOUT_LINK_MODULE);

    // Generate a unique token, retrying on the off chance of a collision.
    let token = service.generateToken();
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await service.listCheckoutLinks({ token } as any);
      if (existing.length === 0) break;
      token = service.generateToken();
    }

    const link = await (service as any).createCheckoutLinks({
      token,
      internal_name: input.internal_name ?? null,
      items: input.items,
      country_code: input.country_code,
      region_id: input.region_id ?? null,
      sales_channel_id: input.sales_channel_id ?? null,
      email: input.email ?? null,
      customer_id: input.customer_id ?? null,
      shipping_address: input.shipping_address ?? null,
      promo_codes: input.promo_codes ?? null,
      status: 'active',
      single_use: input.single_use ?? false,
      used_count: 0,
      expires_at: input.expires_at ? new Date(input.expires_at) : null,
      created_by: input.created_by ?? null,
      metadata: input.metadata ?? null,
    });

    return new StepResponse(link, link.id);
  },
  async (linkId: string | undefined, { container }) => {
    if (!linkId) return;
    const service: CheckoutLinkModuleService =
      container.resolve(CHECKOUT_LINK_MODULE);
    await (service as any).deleteCheckoutLinks(linkId);
  },
);

export const createCheckoutLinkWorkflow = createWorkflow(
  'create-checkout-link',
  function (input: CreateCheckoutLinkInput) {
    const validated = validateCheckoutLinkInputStep(input);
    const link = createCheckoutLinkStep(validated);
    return new WorkflowResponse(link);
  },
);
