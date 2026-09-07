"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const supported_events_1 = require("../../../../modules/ga4/lib/supported-events");
async function GET(_req, res) {
    res.status(200).json({
        events: supported_events_1.SUPPORTED_EVENTS,
        categories: supported_events_1.GA4_EVENT_CATEGORY_ORDER,
        managed: supported_events_1.MANAGED_GA4_EVENTS,
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2dhNC1tYXBwaW5ncy9ldmVudHMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFPQSxrQkFNQztBQVpELG1GQUlzRDtBQUUvQyxLQUFLLFVBQVUsR0FBRyxDQUFDLElBQW1CLEVBQUUsR0FBbUI7SUFDaEUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDbkIsTUFBTSxFQUFFLG1DQUFnQjtRQUN4QixVQUFVLEVBQUUsMkNBQXdCO1FBQ3BDLE9BQU8sRUFBRSxxQ0FBa0I7S0FDNUIsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyJ9