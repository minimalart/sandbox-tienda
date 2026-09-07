"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BannerAnalytics = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.BannerAnalytics = utils_1.model.define('banner_analytics', {
    id: utils_1.model.id({ prefix: 'bana' }).primaryKey(),
    banner_id: utils_1.model.text(),
    impressions: utils_1.model.number().default(0),
    clicks: utils_1.model.number().default(0),
    last_impression_at: utils_1.model.dateTime().nullable(),
    last_click_at: utils_1.model.dateTime().nullable(),
});
exports.default = exports.BannerAnalytics;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFubmVyLWFuYWx5dGljcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2Jhbm5lci9tb2RlbHMvYmFubmVyLWFuYWx5dGljcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxREFBa0Q7QUFFckMsUUFBQSxlQUFlLEdBQUcsYUFBSyxDQUFDLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRTtJQUM5RCxFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM3QyxTQUFTLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUN2QixXQUFXLEVBQUUsYUFBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFDdEMsTUFBTSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLGtCQUFrQixFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDL0MsYUFBYSxFQUFFLGFBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEVBQUU7Q0FDM0MsQ0FBQyxDQUFDO0FBRUgsa0JBQWUsdUJBQWUsQ0FBQyJ9