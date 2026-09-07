"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertBrandThumbnailsStep = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const brand_1 = require("../../modules/brand");
exports.convertBrandThumbnailsStep = (0, workflows_sdk_1.createStep)('convert-brand-thumbnails-step', async (input, { container }) => {
    const brandService = container.resolve(brand_1.BRAND_MODULE);
    const existingThumbnails = await brandService.listBrandImages({
        type: 'thumbnail',
        brand_id: input.brand_ids,
    });
    if (existingThumbnails.length === 0) {
        return new workflows_sdk_1.StepResponse([], []);
    }
    const compensationData = existingThumbnails.map((t) => t.id);
    await brandService.updateBrandImages(existingThumbnails.map((t) => ({
        id: t.id,
        type: 'image',
    })));
    return new workflows_sdk_1.StepResponse(existingThumbnails, compensationData);
}, async (compensationData, { container }) => {
    if (!compensationData?.length) {
        return;
    }
    const brandService = container.resolve(brand_1.BRAND_MODULE);
    await brandService.updateBrandImages(compensationData.map((id) => ({
        id,
        type: 'thumbnail',
    })));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udmVydC1icmFuZC10aHVtYm5haWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy9zdGVwcy9jb252ZXJ0LWJyYW5kLXRodW1ibmFpbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUVBQTZFO0FBQzdFLCtDQUFtRDtBQU90QyxRQUFBLDBCQUEwQixHQUFHLElBQUEsMEJBQVUsRUFDbEQsK0JBQStCLEVBQy9CLEtBQUssRUFBRSxLQUFzQyxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUM5RCxNQUFNLFlBQVksR0FBdUIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxvQkFBWSxDQUFDLENBQUM7SUFFekUsTUFBTSxrQkFBa0IsR0FBRyxNQUFNLFlBQVksQ0FBQyxlQUFlLENBQUM7UUFDNUQsSUFBSSxFQUFFLFdBQVc7UUFDakIsUUFBUSxFQUFFLEtBQUssQ0FBQyxTQUFTO0tBQzFCLENBQUMsQ0FBQztJQUVILElBQUksa0JBQWtCLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1FBQ3BDLE9BQU8sSUFBSSw0QkFBWSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBRUQsTUFBTSxnQkFBZ0IsR0FBYSxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUV2RSxNQUFNLFlBQVksQ0FBQyxpQkFBaUIsQ0FDbEMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzdCLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRTtRQUNSLElBQUksRUFBRSxPQUFnQjtLQUN2QixDQUFDLENBQUMsQ0FDSixDQUFDO0lBRUYsT0FBTyxJQUFJLDRCQUFZLENBQUMsa0JBQWtCLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztBQUNoRSxDQUFDLEVBQ0QsS0FBSyxFQUFFLGdCQUFnQixFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUN4QyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsTUFBTSxFQUFFLENBQUM7UUFDOUIsT0FBTztJQUNULENBQUM7SUFFRCxNQUFNLFlBQVksR0FBdUIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxvQkFBWSxDQUFDLENBQUM7SUFFekUsTUFBTSxZQUFZLENBQUMsaUJBQWlCLENBQ2xDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM1QixFQUFFO1FBQ0YsSUFBSSxFQUFFLFdBQW9CO0tBQzNCLENBQUMsQ0FBQyxDQUNKLENBQUM7QUFDSixDQUFDLENBQ0YsQ0FBQyJ9