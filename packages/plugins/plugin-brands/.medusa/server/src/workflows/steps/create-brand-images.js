"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrandImagesStep = void 0;
const utils_1 = require("@medusajs/framework/utils");
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const brand_1 = require("../../modules/brand");
exports.createBrandImagesStep = (0, workflows_sdk_1.createStep)('create-brand-images-step', async (input, { container }) => {
    const brandService = container.resolve(brand_1.BRAND_MODULE);
    const imagesByBrand = input.brand_images.reduce((acc, img) => {
        const brandImages = acc[img.brand_id] ?? [];
        brandImages.push(img);
        acc[img.brand_id] = brandImages;
        return acc;
    }, {});
    for (const [_, images] of Object.entries(imagesByBrand)) {
        const thumbnailImages = images.filter((img) => img.type === 'thumbnail');
        if (thumbnailImages.length > 1) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, 'Only one thumbnail is allowed per brand');
        }
    }
    const createdImages = await brandService.createBrandImages(Object.values(imagesByBrand).flat());
    return new workflows_sdk_1.StepResponse(createdImages, createdImages);
}, async (compensationData, { container }) => {
    if (!compensationData?.length) {
        return;
    }
    const brandService = container.resolve(brand_1.BRAND_MODULE);
    await brandService.deleteBrandImages(compensationData);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWJyYW5kLWltYWdlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3Mvc3RlcHMvY3JlYXRlLWJyYW5kLWltYWdlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBd0Q7QUFDeEQscUVBQTZFO0FBQzdFLCtDQUFtRDtBQVl0QyxRQUFBLHFCQUFxQixHQUFHLElBQUEsMEJBQVUsRUFDN0MsMEJBQTBCLEVBQzFCLEtBQUssRUFBRSxLQUFpQyxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUN6RCxNQUFNLFlBQVksR0FBdUIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxvQkFBWSxDQUFDLENBQUM7SUFFekUsTUFBTSxhQUFhLEdBQUcsS0FBSyxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQzdDLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFO1FBQ1gsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDNUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN0QixHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLFdBQVcsQ0FBQztRQUNoQyxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUMsRUFDRCxFQUFFLENBQ0gsQ0FBQztJQUVGLEtBQUssTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7UUFDeEQsTUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksS0FBSyxXQUFXLENBQUMsQ0FBQztRQUV6RSxJQUFJLGVBQWUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDL0IsTUFBTSxJQUFJLG1CQUFXLENBQ25CLG1CQUFXLENBQUMsS0FBSyxDQUFDLFlBQVksRUFDOUIseUNBQXlDLENBQzFDLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztJQUVELE1BQU0sYUFBYSxHQUFHLE1BQU0sWUFBWSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUVoRyxPQUFPLElBQUksNEJBQVksQ0FBQyxhQUFhLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFDeEQsQ0FBQyxFQUNELEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDeEMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLE1BQU0sRUFBRSxDQUFDO1FBQzlCLE9BQU87SUFDVCxDQUFDO0lBRUQsTUFBTSxZQUFZLEdBQXVCLFNBQVMsQ0FBQyxPQUFPLENBQUMsb0JBQVksQ0FBQyxDQUFDO0lBRXpFLE1BQU0sWUFBWSxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFDekQsQ0FBQyxDQUNGLENBQUMifQ==