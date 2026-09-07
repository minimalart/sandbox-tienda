"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrandImagesWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const convert_brand_thumbnails_1 = require("./steps/convert-brand-thumbnails");
const create_brand_images_1 = require("./steps/create-brand-images");
exports.createBrandImagesWorkflow = (0, workflows_sdk_1.createWorkflow)('create-brand-images', (input) => {
    (0, workflows_sdk_1.when)(input, (data) => data.brand_images.some((img) => img.type === 'thumbnail')).then(() => {
        const brandIds = (0, workflows_sdk_1.transform)({
            input,
        }, (data) => {
            return data.input.brand_images
                .filter((img) => img.type === 'thumbnail')
                .map((img) => img.brand_id);
        });
        (0, convert_brand_thumbnails_1.convertBrandThumbnailsStep)({
            brand_ids: brandIds,
        });
    });
    const brandImages = (0, create_brand_images_1.createBrandImagesStep)({
        brand_images: input.brand_images,
    });
    return new workflows_sdk_1.WorkflowResponse(brandImages);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWJyYW5kLWltYWdlcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvY3JlYXRlLWJyYW5kLWltYWdlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFLMkM7QUFDM0MsK0VBQThFO0FBQzlFLHFFQUFvRTtBQVd2RCxRQUFBLHlCQUF5QixHQUFHLElBQUEsOEJBQWMsRUFDckQscUJBQXFCLEVBQ3JCLENBQUMsS0FBNkIsRUFBRSxFQUFFO0lBQ2hDLElBQUEsb0JBQUksRUFBQyxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsSUFBSSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtRQUN6RixNQUFNLFFBQVEsR0FBRyxJQUFBLHlCQUFTLEVBQ3hCO1lBQ0UsS0FBSztTQUNOLEVBQ0QsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUNQLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZO2lCQUMzQixNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEtBQUssV0FBVyxDQUFDO2lCQUN6QyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUNoQyxDQUFDLENBQ0YsQ0FBQztRQUVGLElBQUEscURBQTBCLEVBQUM7WUFDekIsU0FBUyxFQUFFLFFBQVE7U0FDcEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7SUFFSCxNQUFNLFdBQVcsR0FBRyxJQUFBLDJDQUFxQixFQUFDO1FBQ3hDLFlBQVksRUFBRSxLQUFLLENBQUMsWUFBWTtLQUNqQyxDQUFDLENBQUM7SUFFSCxPQUFPLElBQUksZ0NBQWdCLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDM0MsQ0FBQyxDQUNGLENBQUMifQ==