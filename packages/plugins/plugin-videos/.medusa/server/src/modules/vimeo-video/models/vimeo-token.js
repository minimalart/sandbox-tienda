"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VimeoToken = void 0;
const utils_1 = require("@medusajs/framework/utils");
exports.VimeoToken = utils_1.model.define('vimeo_token', {
    id: utils_1.model.id().primaryKey(),
    access_token: utils_1.model.text(),
    refresh_token: utils_1.model.text().nullable(),
    token_type: utils_1.model.text(),
    scope: utils_1.model.text().nullable(),
    expires_at: utils_1.model.dateTime(),
    user_id: utils_1.model.text().nullable(),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmltZW8tdG9rZW4uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy92aW1lby12aWRlby9tb2RlbHMvdmltZW8tdG9rZW4udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscURBQWtEO0FBRXJDLFFBQUEsVUFBVSxHQUFHLGFBQUssQ0FBQyxNQUFNLENBQUMsYUFBYSxFQUFFO0lBQ3BELEVBQUUsRUFBRSxhQUFLLENBQUMsRUFBRSxFQUFFLENBQUMsVUFBVSxFQUFFO0lBQzNCLFlBQVksRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQzFCLGFBQWEsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3RDLFVBQVUsRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFO0lBQ3hCLEtBQUssRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzlCLFVBQVUsRUFBRSxhQUFLLENBQUMsUUFBUSxFQUFFO0lBQzVCLE9BQU8sRUFBRSxhQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsUUFBUSxFQUFFO0NBQ2pDLENBQUMsQ0FBQyJ9