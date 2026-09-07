"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGa4MappingWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const create_ga4_mapping_1 = require("./steps/create-ga4-mapping");
exports.createGa4MappingWorkflow = (0, workflows_sdk_1.createWorkflow)('create-ga4-mapping', (input) => {
    const mapping = (0, create_ga4_mapping_1.createGa4MappingStep)(input);
    return new workflows_sdk_1.WorkflowResponse(mapping);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWdhNC1tYXBwaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy9jcmVhdGUtZ2E0LW1hcHBpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUVBQXFGO0FBQ3JGLG1FQUE2RjtBQUloRixRQUFBLHdCQUF3QixHQUFHLElBQUEsOEJBQWMsRUFDcEQsb0JBQW9CLEVBQ3BCLENBQUMsS0FBNEIsRUFBRSxFQUFFO0lBQy9CLE1BQU0sT0FBTyxHQUFHLElBQUEseUNBQW9CLEVBQUMsS0FBSyxDQUFDLENBQUM7SUFFNUMsT0FBTyxJQUFJLGdDQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ3ZDLENBQUMsQ0FDRixDQUFDIn0=