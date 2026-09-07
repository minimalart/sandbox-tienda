"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckoutLinkWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const checkout_link_1 = require("../modules/checkout-link");
const validateCheckoutLinkInputStep = (0, workflows_sdk_1.createStep)('validate-checkout-link-input', async (input) => {
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
    return new workflows_sdk_1.StepResponse(input);
});
const createCheckoutLinkStep = (0, workflows_sdk_1.createStep)('create-checkout-link', async (input, { container }) => {
    const service = container.resolve(checkout_link_1.CHECKOUT_LINK_MODULE);
    // Generate a unique token, retrying on the off chance of a collision.
    let token = service.generateToken();
    for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await service.listCheckoutLinks({ token });
        if (existing.length === 0)
            break;
        token = service.generateToken();
    }
    const link = await service.createCheckoutLinks({
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
    return new workflows_sdk_1.StepResponse(link, link.id);
}, async (linkId, { container }) => {
    if (!linkId)
        return;
    const service = container.resolve(checkout_link_1.CHECKOUT_LINK_MODULE);
    await service.deleteCheckoutLinks(linkId);
});
exports.createCheckoutLinkWorkflow = (0, workflows_sdk_1.createWorkflow)('create-checkout-link', function (input) {
    const validated = validateCheckoutLinkInputStep(input);
    const link = createCheckoutLinkStep(validated);
    return new workflows_sdk_1.WorkflowResponse(link);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWNoZWNrb3V0LWxpbmsuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvd29ya2Zsb3dzL2NyZWF0ZS1jaGVja291dC1saW5rLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFFQUsyQztBQUMzQyw0REFBZ0U7QUFJaEUsTUFBTSw2QkFBNkIsR0FBRyxJQUFBLDBCQUFVLEVBQzlDLDhCQUE4QixFQUM5QixLQUFLLEVBQUUsS0FBOEIsRUFBRSxFQUFFO0lBQ3ZDLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUM7UUFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDNUQsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO0lBQ25ELENBQUM7SUFDRCxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUMvQixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ3JCLE1BQU0sSUFBSSxLQUFLLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUNsRCxDQUFDO1FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN4QyxNQUFNLElBQUksS0FBSyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7UUFDOUQsQ0FBQztJQUNILENBQUM7SUFDRCxJQUFJLEtBQUssQ0FBQyxVQUFVLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLElBQUksSUFBSSxFQUFFLEVBQUUsQ0FBQztR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