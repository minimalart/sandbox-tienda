"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBannerWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const banner_1 = require("../modules/banner");
const validateBannerInputStep = (0, workflows_sdk_1.createStep)('validate-banner-input', async (input) => {
    if (!input.internal_name?.trim()) {
        throw new Error('internal_name is required');
    }
    if (!input.placement) {
        throw new Error('placement is required');
    }
    if (input.start_at && input.end_at) {
        const start = new Date(input.start_at);
        const end = new Date(input.end_at);
        if (start >= end) {
            throw new Error('start_at must be before end_at');
        }
    }
    return new workflows_sdk_1.StepResponse(input);
});
const createBannerStep = (0, workflows_sdk_1.createStep)('create-banner', async (input, { container }) => {
    const bannerService = container.resolve(banner_1.BANNER_MODULE);
    const handle = input.handle || bannerService.generateHandle(input.internal_name);
    const existing = await bannerService.listBanners({ handle });
    if (existing.length > 0) {
        throw new Error(`Banner with handle "${handle}" already exists`);
    }
    const banner = await bannerService.createBanners({
        internal_name: input.internal_name,
        handle,
        type: input.type || 'hero',
        device_type: input.device_type || 'all',
        placement: input.placement,
        status: input.status || 'draft',
        priority: input.priority ?? 0,
        content: input.content ?? null,
        media: input.media ?? null,
        cta: input.cta ?? null,
        start_at: input.start_at ? new Date(input.start_at) : null,
        end_at: input.end_at ? new Date(input.end_at) : null,
        rules: input.rules ?? null,
        metadata: input.metadata ?? null,
    });
    await bannerService.createAuditEntry(banner.id, 'created', input.user_id, undefined, banner);
    return new workflows_sdk_1.StepResponse(banner, banner.id);
}, async (bannerId, { container }) => {
    if (!bannerId)
        return;
    const bannerService = container.resolve(banner_1.BANNER_MODULE);
    await bannerService.deleteBanners(bannerId);
});
exports.createBannerWorkflow = (0, workflows_sdk_1.createWorkflow)('create-banner', function (input) {
    const validated = validateBannerInputStep(input);
    const banner = createBannerStep(validated);
    return new workflows_sdk_1.WorkflowResponse(banner);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWJhbm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvY3JlYXRlLWJhbm5lci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFLMkM7QUFDM0MsOENBQWtEO0FBTWxELE1BQU0sdUJBQXVCLEdBQUcsSUFBQSwwQkFBVSxFQUN4Qyx1QkFBdUIsRUFDdkIsS0FBSyxFQUFFLEtBQWdDLEVBQUUsRUFBRTtJQUN6QyxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDO1FBQ2pDLE1BQU0sSUFBSSxLQUFLLENBQUMsMkJBQTJCLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBQ0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUVELElBQUksS0FBSyxDQUFDLFFBQVEsSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDbkMsTUFBTSxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3ZDLE1BQU0sR0FBRyxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNuQyxJQUFJLEtBQUssSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7UUFDcEQsQ0FBQztJQUNILENBQUM7SUFFRCxPQUFPLElBQUksNEJBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNqQyxDQUFDLENBQ0YsQ0FBQztBQUVGLE1BQU0sZ0JBQWdCLEdBQUcsSUFBQSwwQkFBVSxFQUNqQyxlQUFlLEVBQ2YsS0FBSyxFQUFFLEtBQWdDLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFO0lBQ3hELE1BQU0sYUFBYSxHQUF3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