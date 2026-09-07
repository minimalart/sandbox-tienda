"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductBrandLink = void 0;
const utils_1 = require("@medusajs/framework/utils");
const brand_1 = require("./brand");
exports.ProductBrandLink = utils_1.model
    .define('product_product_brand_brand', {
    id: utils_1.model
        .id({
        prefix: 'pbrnd',
    })
        .primaryKey(),
    product_id: utils_1.model.text(),
    brand: utils_1.model.belongsTo(() => brand_1.Brand, {
        mappedBy: 'product_links',
    }),
})
    .indexes([
    {
        on: ['product_id'],
        where: 'deleted_at IS NULL',
    },
    {
        on: ['brand_id'],
        where: 'deleted_at IS NULL',
    },
    {
        on: ['product_id', 'brand_id'],
        unique: true,
        where: 'deleted_at IS NULL',
    },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZHVjdC1icmFuZC1saW5rLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvYnJhbmQvbW9kZWxzL3Byb2R1Y3QtYnJhbmQtbGluay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFDbEQsbUNBQWdDO0FBRW5CLFFBQUEsZ0JBQWdCLEdBQUcsYUFBSztLQUNsQyxNQUFNLENBQUMsNkJBQTZCLEVBQUU7SUFDckMsRUFBRSxFQUFFLGFBQUs7U0FDTixFQUFFLENBQUM7UUFDRixNQUFNLEVBQUUsT0FBTztLQUNoQixDQUFDO1NBQ0QsVUFBVSxFQUFFO0lBQ2YsVUFBVSxFQUFFLGFBQUssQ0FBQyxJQUFJLEVBQUU7SUFDeEIsS0FBSyxFQUFFLGFBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsYUFBSyxFQUFFO1FBQ2xDLFFBQVEsRUFBRSxlQUFlO0tBQzFCLENBQUM7Q0FDSCxDQUFDO0tBQ0QsT0FBTyxDQUFDO0lBQ1A7UUFDRSxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUM7UUFDbEIsS0FBSyxFQUFFLG9CQUFvQjtLQUM1QjtJQUNEO1FBQ0UsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDO1FBQ2hCLEtBQUssRUFBRSxvQkFBb0I7S0FDNUI7SUFDRDtRQUNFLEVBQUUsRUFBRSxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUM7UUFDOUIsTUFBTSxFQUFFLElBQUk7UUFDWixLQUFLLEVBQUUsb0JBQW9CO0tBQzVCO0NBQ0YsQ0FBQyxDQUFDIn0=