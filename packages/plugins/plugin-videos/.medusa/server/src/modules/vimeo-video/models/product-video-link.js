"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductVideoLink = void 0;
const utils_1 = require("@medusajs/framework/utils");
const vimeo_video_1 = require("./vimeo-video");
exports.ProductVideoLink = utils_1.model
    .define('product_video_link', {
    id: utils_1.model.id().primaryKey(),
    product_id: utils_1.model.text(),
    vimeo_video: utils_1.model.belongsTo(() => vimeo_video_1.VimeoVideo, {
        mappedBy: 'vimeo_video_id',
    }),
})
    .indexes([
    {
        on: ['product_id', 'vimeo_video_id'],
        unique: true,
    },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZHVjdC12aWRlby1saW5rLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvdmltZW8tdmlkZW8vbW9kZWxzL3Byb2R1Y3QtdmlkZW8tbGluay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFDbEQsK0NBQTJDO0FBRTlCLFFBQUEsZ0JBQWdCLEdBQUcsYUFBSztLQUNsQyxNQUFNLENBQUMsb0JBQW9CLEVBQUU7SUFDNUIsRUFBRSxFQUFFLGFBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQyxVQUFVLEVBQUU7SUFDM0IsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDeEIsV0FBVyxFQUFFLGFBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsd0JBQVUsRUFBRTtRQUM3QyxRQUFRLEVBQUUsZ0JBQWdCO0tBQzNCLENBQUM7Q0FDSCxDQUFDO0tBQ0QsT0FBTyxDQUFDO0lBQ1A7UUFDRSxFQUFFLEVBQUUsQ0FBQyxZQUFZLEVBQUUsZ0JBQWdCLENBQUM7UUFDcEMsTUFBTSxFQUFFLElBQUk7S0FDYjtDQUNGLENBQUMsQ0FBQyJ9