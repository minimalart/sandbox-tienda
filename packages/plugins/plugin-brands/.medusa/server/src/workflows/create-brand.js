"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBrandWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const create_brand_1 = require("./steps/create-brand");
exports.createBrandWorkflow = (0, workflows_sdk_1.createWorkflow)('create-brand', (input) => {
    const brand = (0, create_brand_1.createBrandStep)(input);
    return new workflows_sdk_1.WorkflowResponse(brand);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWJyYW5kLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy9jcmVhdGUtYnJhbmQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUVBQXFGO0FBQ3JGLHVEQUE2RTtBQUloRSxRQUFBLG1CQUFtQixHQUFHLElBQUEsOEJBQWMsRUFBQyxjQUFjLEVBQUUsQ0FBQyxLQUF1QixFQUFFLEVBQUU7SUFDNUYsTUFBTSxLQUFLLEdBQUcsSUFBQSw4QkFBZSxFQUFDLEtBQUssQ0FBQyxDQUFDO0lBRXJDLE9BQU8sSUFBSSxnQ0FBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNyQyxDQUFDLENBQUMsQ0FBQyJ9