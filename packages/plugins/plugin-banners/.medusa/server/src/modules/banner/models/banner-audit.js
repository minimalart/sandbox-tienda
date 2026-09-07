"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BannerAudit = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.BannerAudit = utils_1.model.define('banner_audit', {
    id: utils_1.model.id({ prefix: 'baud' }).primaryKey(),
    banner_id: utils_1.model.text(),
    action: utils_1.model.text(),
    user_id: utils_1.model.text().nullable(),
    changes: utils_1.model.json().nullable(),
    snapshot: utils_1.model.json().nullable(),
});
exports.default = exports.BannerAudit;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFubmVyLWF1ZGl0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvYmFubmVyL21vZGVscy9iYW5uZXItYXVkaXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRXJDLFFBQUEsV0FBVyxHQUFHLGFBQUssQ0FBQyxNQUFNLENBQUMsY0FBYyxFQUFFO0lBQ3RELEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxDQUFDLENBQUMsVUFBVSxFQUFFO0lBQzdDLFNBQVMsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ3ZCLE1BQU0sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ3BCLE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2hDLE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2hDLFFBQVEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ2xDLENBQUMsQ0FBQztBQUVILGtCQUFlLG1CQUFXLENBQUMifQ==