"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const BrandImage = utils_1.model
    .define('brand_image', {
    id: utils_1.model.id().primaryKey(),
    url: utils_1.model.text(),
    file_id: utils_1.model.text(),
    type: utils_1.model.enum(['thumbnail', 'image']),
    brand_id: utils_1.model.text(),
})
    .indexes([
    {
        on: ['brand_id', 'type'],
        where: "type = 'thumbnail'",
        unique: true,
        name: 'unique_thumbnail_per_brand',
    },
]);
exports.default = BrandImage;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJhbmQtaW1hZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9icmFuZC9tb2RlbHMvYnJhbmQtaW1hZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxxREFBa0Q7QUFFbEQsTUFBTSxVQUFVLEdBQUcsYUFBSztLQUNyQixNQUFNLENBQUMsYUFBYSxFQUFFO0lBQ3JCLEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxFQUFFLENBQUMsVUFBVSxFQUFFO0lBQzNCLEdBQUcsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ2pCLE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ3JCLElBQUksRUFBRSxhQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3hDLFFBQVEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0NBQ3ZCLENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUDtRQUNFLEVBQUUsRUFBRSxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUM7UUFDeEIsS0FBSyxFQUFFLG9CQUFvQjtRQUMzQixNQUFNLEVBQUUsSUFBSTtRQUNaLElBQUksRUFBRSw0QkFBNEI7S0FDbkM7Q0FDRixDQUFDLENBQUM7QUFFTCxrQkFBZSxVQUFVLENBQUMifQ==