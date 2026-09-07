"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPdfCatalogWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const create_pdf_catalog_1 = require("./steps/create-pdf-catalog");
exports.createPdfCatalogWorkflow = (0, workflows_sdk_1.createWorkflow)('create-pdf-catalog', (input) => {
    const catalog = (0, create_pdf_catalog_1.createPdfCatalogStep)(input);
    return new workflows_sdk_1.WorkflowResponse(catalog);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLXBkZi1jYXRhbG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy9jcmVhdGUtcGRmLWNhdGFsb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUVBQXFGO0FBQ3JGLG1FQUdvQztBQUl2QixRQUFBLHdCQUF3QixHQUFHLElBQUEsOEJBQWMsRUFDcEQsb0JBQW9CLEVBQ3BCLENBQUMsS0FBNEIsRUFBRSxFQUFFO0lBQy9CLE1BQU0sT0FBTyxHQUFHLElBQUEseUNBQW9CLEVBQUMsS0FBSyxDQUFDLENBQUM7SUFFNUMsT0FBTyxJQUFJLGdDQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ3ZDLENBQUMsQ0FDRixDQUFDIn0=