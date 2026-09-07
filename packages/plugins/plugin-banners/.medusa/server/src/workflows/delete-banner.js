"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBannerWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const banner_1 = require("../modules/banner");
const deleteBannerStep = (0, workflows_sdk_1.createStep)('delete-banner', async (input, { container }) => {
    const bannerService = container.resolve(banner_1.BANNER_MODULE);
    const banners = await bannerService.listBanners({ id: input.id });
    if (!banners || banners.length === 0) {
        throw new Error(`Banner with id "${input.id}" not found`);
    }
    const banner = banners[0];
    await bannerService.createAuditEntry(input.id, 'deleted', input.user_id, undefined, banner);
    await bannerService.deleteBanners(input.id);
    return new workflows_sdk_1.StepResponse({ id: input.id, object: 'banner', deleted: true }, banner);
}, async (banner, { container }) => {
    if (!banner)
        return;
    const bannerService = container.resolve(banner_1.BANNER_MODULE);
    await bannerService.createBanners(banner);
});
exports.deleteBannerWorkflow = (0, workflows_sdk_1.createWorkflow)('delete-banner', function (input) {
    const result = deleteBannerStep(input);
    return new workflows_sdk_1.WorkflowResponse(result);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVsZXRlLWJhbm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvZGVsZXRlLWJhbm5lci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFLMkM7QUFDM0MsOENBQWtEO0FBUWxELE1BQU0sZ0JBQWdCLEdBQUcsSUFBQSwwQkFBVSxFQUNqQyxlQUFlLEVBQ2YsS0FBSyxFQUFFLEtBQWdDLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFO0lBQ3hELE1BQU0sYUFBYSxHQUF3QixTQUFTLENBQUMsT0FBTyxDQUFDLHNCQUFhLENBQUMsQ0FBQztJQUU1RSxNQUFNLE9BQU8sR0FBRyxNQUFNLGFBQWEsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDbEUsSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ3JDLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLEtBQUssQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzVELENBQUM7SUFFRCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFMUIsTUFBTSxhQUFhLENBQUMsZ0JBQWdCLENBQ2xDLEtBQUssQ0FBQyxFQUFFLEVBQ1IsU0FBUyxFQUNULEtBQUssQ0FBQyxPQUFPLEVBQ2IsU0FBUyxFQUNULE1BQTRDLENBQzdDLENBQUM7SUFFRixNQUFPLGFBQXFCLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUVyRCxPQUFPLElBQUksNEJBQVksQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3JGLENBQUMsRUFDRCxLQUFLLEVBQUUsTUFBVyxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUNuQyxJQUFJLENBQUMsTUFBTTtRQUFFLE9BQU87SUFFcEIsTUFBTSxhQUFhLEdBQXdCLFNBQVMsQ0FBQyxPQUFPLENBQUMsc0JBQWEsQ0FBQyxDQUFDO0lBQzVFLE1BQU8sYUFBcUIsQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDckQsQ0FBQyxDQUNGLENBQUM7QUFFVyxRQUFBLG9CQUFvQixHQUFHLElBQUEsOEJBQWMsRUFDaEQsZUFBZSxFQUNmLFVBQVUsS0FBZ0M7SUFDeEMsTUFBTSxNQUFNLEdBQUcsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDdkMsT0FBTyxJQUFJLGdDQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUMsQ0FDRixDQUFDIn0=