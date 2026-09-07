"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Banner = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.Banner = utils_1.model
    .define('banner', {
    id: utils_1.model.id({ prefix: 'banr' }).primaryKey(),
    internal_name: utils_1.model.text().nullable(),
    handle: utils_1.model.text().nullable(),
    type: utils_1.model.text().nullable(),
    device_type: utils_1.model.text().nullable(),
    placement: utils_1.model.text(),
    status: utils_1.model.text().default('draft'),
    priority: utils_1.model.number().default(0),
    content: utils_1.model.json().nullable(),
    media: utils_1.model.json().nullable(),
    cta: utils_1.model.json().nullable(),
    rules: utils_1.model.json().nullable(),
    metadata: utils_1.model.json().nullable(),
    start_at: utils_1.model.dateTime().nullable(),
    end_at: utils_1.model.dateTime().nullable(),
})
    .indexes([
    { on: ['placement', 'status', 'priority'] },
    { on: ['start_at', 'end_at'] },
    { on: ['status'] },
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFubmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvYmFubmVyL21vZGVscy9iYW5uZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRXJDLFFBQUEsTUFBTSxHQUFHLGFBQUs7S0FDeEIsTUFBTSxDQUFDLFFBQVEsRUFBRTtJQUNoQixFQUFFLEVBQUUsYUFBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLFVBQVUsRUFBRTtJQUM3QyxhQUFhLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUN0QyxNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUMvQixJQUFJLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM3QixXQUFXLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNwQyxTQUFTLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRTtJQUN2QixNQUFNLEVBQUUsYUFBSyxDQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7SUFDckMsUUFBUSxFQUFFLGFBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0lBQ25DLE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2hDLEtBQUssRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzlCLEdBQUcsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzVCLEtBQUssRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzlCLFFBQVEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2pDLFFBQVEsRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3JDLE1BQU0sRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ3BDLENBQUM7S0FDRCxPQUFPLENBQUM7SUFDUCxFQUFFLEVBQUUsRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLEVBQUU7SUFDM0MsRUFBRSxFQUFFLEVBQUUsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLEVBQUU7SUFDOUIsRUFBRSxFQUFFLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRTtDQUNuQixDQUFDLENBQUMifQ==