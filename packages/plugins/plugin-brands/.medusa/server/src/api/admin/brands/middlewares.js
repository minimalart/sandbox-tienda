"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminBrandsMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const zod_1 = require("zod");
const route_1 = require("./[brand_id]/images/route");
const route_2 = require("./[brand_id]/route");
const route_3 = require("./route");
const BulkBrandSchema = zod_1.z.object({
    items: zod_1.z
        .array(zod_1.z.object({
        product_handle: zod_1.z.string().optional().default(''),
        variant_sku: zod_1.z.string().optional().default(''),
        brand_handle: zod_1.z.string().min(1, 'Brand handle is required'),
    }))
        .min(1, 'At least one item is required'),
});
const LinkProductsSchema = zod_1.z.object({
    product_ids: zod_1.z.array(zod_1.z.string()).min(1, 'At least one product ID is required'),
});
const UnlinkProductsSchema = zod_1.z.object({
    product_ids: zod_1.z.array(zod_1.z.string()).min(1, 'At least one product ID is required'),
});
exports.adminBrandsMiddlewares = [
    {
        matcher: '/admin/brands/bulk',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(BulkBrandSchema)],
    },
    {
        matcher: '/admin/brands',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_3.CreateBrandSchema)],
    },
    {
        matcher: '/admin/brands/:brand_id',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_2.UpdateBrandSchema)],
    },
    {
        matcher: '/admin/brands/:brand_id/images',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(route_1.CreateBrandImagesSchema)],
    },
    {
        matcher: '/admin/brands/:brand_id/products',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(LinkProductsSchema)],
    },
    {
        matcher: '/admin/brands/:brand_id/products',
        method: ['DELETE'],
        middlewares: [(0, http_1.validateAndTransformBody)(UnlinkProductsSchema)],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2JyYW5kcy9taWRkbGV3YXJlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtREFBcUY7QUFDckYsNkJBQXdCO0FBQ3hCLHFEQUFvRTtBQUNwRSw4Q0FBdUQ7QUFDdkQsbUNBQTRDO0FBRTVDLE1BQU0sZUFBZSxHQUFHLE9BQUMsQ0FBQyxNQUFNLENBQUM7SUFDL0IsS0FBSyxFQUFFLE9BQUM7U0FDTCxLQUFLLENBQ0osT0FBQyxDQUFDLE1BQU0sQ0FBQztRQUNQLGNBQWMsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUNqRCxXQUFXLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDOUMsWUFBWSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLDBCQUEwQixDQUFDO0tBQzVELENBQUMsQ0FDSDtTQUNBLEdBQUcsQ0FBQyxDQUFDLEVBQUUsK0JBQStCLENBQUM7Q0FDM0MsQ0FBQyxDQUFDO0FBRUgsTUFBTSxrQkFBa0IsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQ2xDLFdBQVcsRUFBRSxPQUFDLENBQUMsS0FBSyxDQUFDLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUscUNBQXFDLENBQUM7Q0FDL0UsQ0FBQyxDQUFDO0FBRUgsTUFBTSxvQkFBb0IsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQ3BDLFdBQVcsRUFBRSxPQUFDLENBQUMsS0FBSyxDQUFDLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUscUNBQXFDLENBQUM7Q0FDL0UsQ0FBQyxDQUFDO0FBRVUsUUFBQSxzQkFBc0IsR0FBc0I7SUFDdkQ7UUFDRSxPQUFPLEVBQUUsb0JBQW9CO1FBQzdCLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNoQixXQUFXLEVBQUUsQ0FBQyxJQUFBLCtCQUF3QixFQUFDLGVBQWUsQ0FBQyxDQUFDO0tBQ3pEO0lBQ0Q7UUFDRSxPQUFPLEVBQUUsZUFBZTtRQUN4QixNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDaEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyx5QkFBaUIsQ0FBQyxDQUFDO0tBQzNEO0lBQ0Q7UUFDRSxPQUFPLEVBQUUseUJBQXlCO1FBQ2xDLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNoQixXQUFXLEVBQUUsQ0FBQyxJQUFBLCtCQUF3QixFQUFDLHlCQUFpQixDQUFDLENBQUM7S0FDM0Q7SUFDRDtRQUNFLE9BQU8sRUFBRSxnQ0FBZ0M7UUFDekMsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2hCLFdBQVcsRUFBRSxDQUFDLElBQUEsK0JBQXdCLEVBQUMsK0JBQXVCLENBQUMsQ0FBQztLQUNqRTtJQUNEO1FBQ0UsT0FBTyxFQUFFLGtDQUFrQztRQUMzQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDaEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyxrQkFBa0IsQ0FBQyxDQUFDO0tBQzVEO0lBQ0Q7UUFDRSxPQUFPLEVBQUUsa0NBQWtDO1FBQzNDLE1BQU0sRUFBRSxDQUFDLFFBQVEsQ0FBQztRQUNsQixXQUFXLEVBQUUsQ0FBQyxJQUFBLCtCQUF3QixFQUFDLG9CQUFvQixDQUFDLENBQUM7S0FDOUQ7Q0FDRixDQUFDIn0=