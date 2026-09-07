"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGa4MappingStep = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const ga4_1 = require("../../modules/ga4");
exports.createGa4MappingStep = (0, workflows_sdk_1.createStep)('create-ga4-mapping-step', async (input, { container }) => {
    const ga4Service = container.resolve(ga4_1.GA4_MODULE);
    // param_mappings (array) va a una columna json() que el ORM tipa como
    // Record — casteamos solo ese campo en el borde de persistencia.
    const mapping = await ga4Service.createGa4EventMappings({
        ...input,
        param_mappings: input.param_mappings,
    });
    return new workflows_sdk_1.StepResponse(mapping, mapping);
}, async (compensationData, { container }) => {
    if (!compensationData) {
        return;
    }
    const ga4Service = container.resolve(ga4_1.GA4_MODULE);
    await ga4Service.deleteGa4EventMappings(compensationData.id);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWdhNC1tYXBwaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy9zdGVwcy9jcmVhdGUtZ2E0LW1hcHBpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUVBQTZFO0FBQzdFLDJDQUErQztBQTBCbEMsUUFBQSxvQkFBb0IsR0FBRyxJQUFBLDBCQUFVLEVBQzVDLHlCQUF5QixFQUN6QixLQUFLLEVBQUUsS0FBZ0MsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDeEQsTUFBTSxVQUFVLEdBQXFCLFNBQVMsQ0FBQyxPQUFPLENBQUMsZ0JBQVUsQ0FBQyxDQUFDO0lBRW5FLHNFQUFzRTtJQUN0RSxpRUFBaUU7SUFDakUsTUFBTSxPQUFPLEdBQUcsTUFBTSxVQUFVLENBQUMsc0JBQXNCLENBQUM7UUFDdEQsR0FBRyxLQUFLO1FBQ1IsY0FBYyxFQUFFLEtBQUssQ0FBQyxjQUFvRDtLQUMzRSxDQUFDLENBQUM7SUFFSCxPQUFPLElBQUksNEJBQVksQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDNUMsQ0FBQyxFQUNELEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDeEMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDdEIsT0FBTztJQUNULENBQUM7SUFFRCxNQUFNLFVBQVUsR0FBcUIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxnQkFBVSxDQUFDLENBQUM7SUFFbkUsTUFBTSxVQUFVLENBQUMsc0JBQXNCLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDL0QsQ0FBQyxDQUNGLENBQUMifQ==