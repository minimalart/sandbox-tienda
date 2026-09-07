"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteGa4MappingWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const delete_ga4_mapping_1 = require("./steps/delete-ga4-mapping");
exports.deleteGa4MappingWorkflow = (0, workflows_sdk_1.createWorkflow)('delete-ga4-mapping', (input) => {
    const result = (0, delete_ga4_mapping_1.deleteGa4MappingStep)(input);
    return new workflows_sdk_1.WorkflowResponse(result);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVsZXRlLWdhNC1tYXBwaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy9kZWxldGUtZ2E0LW1hcHBpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUVBQXFGO0FBQ3JGLG1FQUE2RjtBQUloRixRQUFBLHdCQUF3QixHQUFHLElBQUEsOEJBQWMsRUFDcEQsb0JBQW9CLEVBQ3BCLENBQUMsS0FBNEIsRUFBRSxFQUFFO0lBQy9CLE1BQU0sTUFBTSxHQUFHLElBQUEseUNBQW9CLEVBQUMsS0FBSyxDQUFDLENBQUM7SUFFM0MsT0FBTyxJQUFJLGdDQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3RDLENBQUMsQ0FDRixDQUFDIn0=