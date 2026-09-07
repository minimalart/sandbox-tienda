"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unpublishBannerWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const banner_1 = require("../modules/banner");
const unpublishBannerStep = (0, workflows_sdk_1.createStep)('unpublish-banner', async (input, { container }) => {
    const bannerService = container.resolve(banner_1.BANNER_MODULE);
    const banners = await bannerService.listBanners({ id: input.id });
    const banner = banners[0];
    if (!banner) {
        throw new Error(`Banner with id "${input.id}" not found`);
    }
    const previousStatus = banner.status;
    const updatedBanner = await bannerService.updateBanners({
        id: input.id,
        status: 'draft',
    });
    await bannerService.createAuditEntry(input.id, 'unpublished', input.user_id, { status: 'draft' }, banner);
    return new workflows_sdk_1.StepResponse(updatedBanner, { id: input.id, previousStatus });
}, async (context, { container }) => {
    if (!context?.id)
        return;
    const bannerService = container.resolve(banner_1.BANNER_MODULE);
    await bannerService.updateBanners({
        id: context.id,
        status: context.previousStatus,
    });
});
exports.unpublishBannerWorkflow = (0, workflows_sdk_1.createWorkflow)('unpublish-banner', function (input) {
    const result = unpublishBannerStep(input);
    return new workflows_sdk_1.WorkflowResponse(result);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidW5wdWJsaXNoLWJhbm5lci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvdW5wdWJsaXNoLWJhbm5lci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFLMkM7QUFDM0MsOENBQWtEO0FBUWxELE1BQU0sbUJBQW1CLEdBQUcsSUFBQSwwQkFBVSxFQUNwQyxrQkFBa0IsRUFDbEIsS0FBSyxFQUFFLEtBQW1DLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFO0lBQzNELE1BQU0sYUFBYSxHQUF3QixTQUFTLENBQUMsT0FBTyxDQUFDLHNCQUFhLENBQUMsQ0FBQztJQUU1RSxNQUFNLE9BQU8sR0FBRyxNQUFNLGFBQWEsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDbEUsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzFCLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsbUJBQW1CLEtBQUssQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzVELENBQUM7SUFFRCxNQUFNLGNBQWMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBRXJDLE1BQU0sYUFBYSxHQUFHLE1BQU8sYUFBcUIsQ0FBQyxhQUFhLENBQUM7UUFDL0QsRUFBRSxFQUFFLEtBQUssQ0FBQyxFQUFFO1FBQ1osTUFBTSxFQUFFLE9BQU87S0FDaEIsQ0FBQyxDQUFDO0lBRUgsTUFBTSxhQUFhLENBQUMsZ0JBQWdCLENBQ2xDLEtBQUssQ0FBQyxFQUFFLEVBQ1IsYUFBYSxFQUNiLEtBQUssQ0FBQyxPQUFPLEVBQ2IsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLEVBQ25CLE1BQTRDLENBQzdDLENBQUM7SUFFRixPQUFPLElBQUksNEJBQVksQ0FBQyxhQUFhLEVBQUUsRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxjQUFjLEVBQUUsQ0FBQyxDQUFDO0FBQzNFLENBQUMsRUFDRCxLQUFLLEVBQUUsT0FBMkQsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDbkYsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFO1FBQUUsT0FBTztJQUV6QixNQUFNLGFBQWEsR0FBd0IsU0FBUyxDQUFDLE9BQU8sQ0FBQyxzQkFBYSxDQUFDLENBQUM7SUFDNUUsTUFBTyxhQUFxQixDQUFDLGFBQWEsQ0FBQztRQUN6QyxFQUFFLEVBQUUsT0FBTyxDQUFDLEVBQUU7UUFDZCxNQUFNLEVBQUUsT0FBTyxDQUFDLGNBQWM7S0FDL0IsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUNGLENBQUM7QUFFVyxRQUFBLHVCQUF1QixHQUFHLElBQUEsOEJBQWMsRUFDbkQsa0JBQWtCLEVBQ2xCLFVBQVUsS0FBbUM7SUFDM0MsTUFBTSxNQUFNLEdBQUcsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDMUMsT0FBTyxJQUFJLGdDQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUMsQ0FDRixDQUFDIn0=