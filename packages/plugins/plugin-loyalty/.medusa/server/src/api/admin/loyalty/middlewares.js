"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminLoyaltyMiddlewares = void 0;
const http_1 = require("@medusajs/framework/http");
const validators_1 = require("./validators");
exports.adminLoyaltyMiddlewares = [
    {
        matcher: '/admin/loyalty/programs',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.CreateProgramSchema)],
    },
    {
        matcher: '/admin/loyalty/programs/:id',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.UpdateProgramSchema)],
    },
    {
        matcher: '/admin/loyalty/rules',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.CreateRuleSchema)],
    },
    {
        matcher: '/admin/loyalty/rules/:id',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.UpdateRuleSchema)],
    },
    {
        matcher: '/admin/loyalty/rewards',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.CreateRewardSchema)],
    },
    {
        matcher: '/admin/loyalty/rewards/:id',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.UpdateRewardSchema)],
    },
    {
        matcher: '/admin/loyalty/tiers',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.CreateTierSchema)],
    },
    {
        matcher: '/admin/loyalty/tiers/:id',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.UpdateTierSchema)],
    },
    {
        matcher: '/admin/loyalty/campaigns',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.CreateCampaignSchema)],
    },
    {
        matcher: '/admin/loyalty/campaigns/:id',
        method: ['POST'],
        middlewares: [(0, http_1.validateAndTransformBody)(validators_1.UpdateCampaignSchema)],
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlkZGxld2FyZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xveWFsdHkvbWlkZGxld2FyZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbURBQTBGO0FBQzFGLDZDQVdzQjtBQUVULFFBQUEsdUJBQXVCLEdBQXNCO0lBQ3hEO1FBQ0UsT0FBTyxFQUFFLHlCQUF5QjtRQUNsQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDaEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyxnQ0FBbUIsQ0FBQyxDQUFDO0tBQzdEO0lBQ0Q7UUFDRSxPQUFPLEVBQUUsNkJBQTZCO1FBQ3RDLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNoQixXQUFXLEVBQUUsQ0FBQyxJQUFBLCtCQUF3QixFQUFDLGdDQUFtQixDQUFDLENBQUM7S0FDN0Q7SUFDRDtRQUNFLE9BQU8sRUFBRSxzQkFBc0I7UUFDL0IsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2hCLFdBQVcsRUFBRSxDQUFDLElBQUEsK0JBQXdCLEVBQUMsNkJBQWdCLENBQUMsQ0FBQztLQUMxRDtJQUNEO1FBQ0UsT0FBTyxFQUFFLDBCQUEwQjtRQUNuQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDaEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyw2QkFBZ0IsQ0FBQyxDQUFDO0tBQzFEO0lBQ0Q7UUFDRSxPQUFPLEVBQUUsd0JBQXdCO1FBQ2pDLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNoQixXQUFXLEVBQUUsQ0FBQyxJQUFBLCtCQUF3QixFQUFDLCtCQUFrQixDQUFDLENBQUM7S0FDNUQ7SUFDRDtRQUNFLE9BQU8sRUFBRSw0QkFBNEI7UUFDckMsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2hCLFdBQVcsRUFBRSxDQUFDLElBQUEsK0JBQXdCLEVBQUMsK0JBQWtCLENBQUMsQ0FBQztLQUM1RDtJQUNEO1FBQ0UsT0FBTyxFQUFFLHNCQUFzQjtRQUMvQixNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDaEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyw2QkFBZ0IsQ0FBQyxDQUFDO0tBQzFEO0lBQ0Q7UUFDRSxPQUFPLEVBQUUsMEJBQTBCO1FBQ25DLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQztRQUNoQixXQUFXLEVBQUUsQ0FBQyxJQUFBLCtCQUF3QixFQUFDLDZCQUFnQixDQUFDLENBQUM7S0FDMUQ7SUFDRDtRQUNFLE9BQU8sRUFBRSwwQkFBMEI7UUFDbkMsTUFBTSxFQUFFLENBQUMsTUFBTSxDQUFDO1FBQ2hCLFdBQVcsRUFBRSxDQUFDLElBQUEsK0JBQXdCLEVBQUMsaUNBQW9CLENBQUMsQ0FBQztLQUM5RDtJQUNEO1FBQ0UsT0FBTyxFQUFFLDhCQUE4QjtRQUN2QyxNQUFNLEVBQUUsQ0FBQyxNQUFNLENBQUM7UUFDaEIsV0FBVyxFQUFFLENBQUMsSUFBQSwrQkFBd0IsRUFBQyxpQ0FBb0IsQ0FBQyxDQUFDO0tBQzlEO0NBQ0YsQ0FBQyJ9