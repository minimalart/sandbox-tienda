"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateGa4MappingWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const update_ga4_mapping_1 = require("./steps/update-ga4-mapping");
exports.updateGa4MappingWorkflow = (0, workflows_sdk_1.createWorkflow)('update-ga4-mapping', (input) => {
    const mapping = (0, update_ga4_mapping_1.updateGa4MappingStep)(input);
    return new workflows_sdk_1.WorkflowResponse(mapping);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLWdhNC1tYXBwaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy91cGRhdGUtZ2E0LW1hcHBpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUVBQXFGO0FBQ3JGLG1FQUE2RjtBQUloRixRQUFBLHdCQUF3QixHQUFHLElBQUEsOEJBQWMsRUFDcEQsb0JBQW9CLEVBQ3BCLENBQUMsS0FBNEIsRUFBRSxFQUFFO0lBQy9CLE1BQU0sT0FBTyxHQUFHLElBQUEseUNBQW9CLEVBQUMsS0FBSyxDQUFDLENBQUM7SUFFNUMsT0FBTyxJQUFJLGdDQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ3ZDLENBQUMsQ0FDRixDQUFDIn0=