"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishBannerWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const banner_1 = require("../modules/banner");
const publishBannerStep = (0, workflows_sdk_1.createStep)('publish-banner', async (input, { container }) => {
    const bannerService = container.resolve(banner_1.BANNER_MODULE);
    const banners = await bannerService.listBanners({ id: input.id });
    const banner = banners[0];
    if (!banner) {
        throw new Error(`Banner with id "${input.id}" not found`);
    }
    const previousStatus = banner.status;
    const updatedBanner = await bannerService.updateBanners({
        id: input.id,
        status: 'published',
    });
    await bannerService.createAuditEntry(input.id, 'published', input.user_id, { status: 'published' }, banner);
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
exports.publishBannerWorkflow = (0, workflows_sdk_1.createWorkflow)('publish-banner', function (input) {
    const result = publishBannerStep(input);
    return new workflows_sdk_1.WorkflowResponse(result);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVibGlzaC1iYW5uZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvd29ya2Zsb3dzL3B1Ymxpc2gtYmFubmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFFQUsyQztBQUMzQyw4Q0FBa0Q7QUFRbEQsTUFBTSxpQkFBaUIsR0FBRyxJQUFBLDBCQUFVLEVBQ2xDLGdCQUFnQixFQUNoQixLQUFLLEVBQUUsS0FBaUMsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDekQsTUFBTSxhQUFhLEdBQXdCLFNBQVMsQ0FBQyxPQUFPLENBQUMsc0JBQWEsQ0FBQyxDQUFDO0lBRTVFLE1BQU0sT0FBTyxHQUFHLE1BQU0sYUFBYSxDQUFDLFdBQVcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNsRSxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDMUIsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsS0FBSyxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVELE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFFckMsTUFBTSxhQUFhLEdBQUcsTUFBTyxhQUFxQixDQUFDLGFBQWEsQ0FBQztRQUMvRCxFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUU7UUFDWixNQUFNLEVBQUUsV0FBVztLQUNwQixDQUFDLENBQUM7SUFFSCxNQUFNLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FDbEMsS0FBSyxDQUFDLEVBQUUsRUFDUixXQUFXLEVBQ1gsS0FBSyxDQUFDLE9BQU8sRUFDYixFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFDdkIsTUFBNEMsQ0FDN0MsQ0FBQztJQUVGLE9BQU8sSUFBSSw0QkFBWSxDQUFDLGFBQWEsRUFBRSxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLGNBQWMsRUFBRSxDQUFDLENBQUM7QUFDM0UsQ0FBQyxFQUNELEtBQUssRUFBRSxPQUEyRCxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUNuRixJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUU7UUFBRSxPQUFPO0lBRXpCLE1BQU0sYUFBYSxHQUF3QixTQUFTLENBQUMsT0FBTyxDQUFDLHNCQUFhLENBQUMsQ0FBQztJQUM1RSxNQUFPLGFBQXFCLENBQUMsYUFBYSxDQUFDO1FBQ3pDLEVBQUUsRUFBRSxPQUFPLENBQUMsRUFBRTtRQUNkLE1BQU0sRUFBRSxPQUFPLENBQUMsY0FBYztLQUMvQixDQUFDLENBQUM7QUFDTCxDQUFDLENBQ0YsQ0FBQztBQUVXLFFBQUEscUJBQXFCLEdBQUcsSUFBQSw4QkFBYyxFQUNqRCxnQkFBZ0IsRUFDaEIsVUFBVSxLQUFpQztJQUN6QyxNQUFNLE1BQU0sR0FBRyxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN4QyxPQUFPLElBQUksZ0NBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDdEMsQ0FBQyxDQUNGLENBQUMifQ==