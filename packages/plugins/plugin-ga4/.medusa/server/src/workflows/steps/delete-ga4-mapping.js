"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteGa4MappingStep = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const ga4_1 = require("../../modules/ga4");
exports.deleteGa4MappingStep = (0, workflows_sdk_1.createStep)('delete-ga4-mapping-step', async (input, { container }) => {
    const ga4Service = container.resolve(ga4_1.GA4_MODULE);
    // Snapshot before deletion so the compensation can recreate the row.
    const previous = await ga4Service.retrieveGa4EventMapping(input.id);
    await ga4Service.deleteGa4EventMappings(input.id);
    return new workflows_sdk_1.StepResponse({ id: input.id }, previous);
}, async (previous, { container }) => {
    if (!previous) {
        return;
    }
    const ga4Service = container.resolve(ga4_1.GA4_MODULE);
    await ga4Service.createGa4EventMappings({
        medusa_event: previous.medusa_event,
        ga4_event_name: previous.ga4_event_name,
        is_active: previous.is_active,
        description: previous.description,
        param_mappings: previous.param_mappings,
        metadata: previous.metadata,
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVsZXRlLWdhNC1tYXBwaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy9zdGVwcy9kZWxldGUtZ2E0LW1hcHBpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUVBQTZFO0FBQzdFLDJDQUErQztBQU9sQyxRQUFBLG9CQUFvQixHQUFHLElBQUEsMEJBQVUsRUFDNUMseUJBQXlCLEVBQ3pCLEtBQUssRUFBRSxLQUFnQyxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUN4RCxNQUFNLFVBQVUsR0FBcUIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxnQkFBVSxDQUFDLENBQUM7SUFFbkUscUVBQXFFO0lBQ3JFLE1BQU0sUUFBUSxHQUFHLE1BQU0sVUFBVSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUVwRSxNQUFNLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUM7SUFFbEQsT0FBTyxJQUFJLDRCQUFZLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ3RELENBQUMsRUFDRCxLQUFLLEVBQUUsUUFBUSxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUNoQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDZCxPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sVUFBVSxHQUFxQixTQUFTLENBQUMsT0FBTyxDQUFDLGdCQUFVLENBQUMsQ0FBQztJQUVuRSxNQUFNLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQztRQUN0QyxZQUFZLEVBQUUsUUFBUSxDQUFDLFlBQVk7UUFDbkMsY0FBYyxFQUFFLFFBQVEsQ0FBQyxjQUFjO1FBQ3ZDLFNBQVMsRUFBRSxRQUFRLENBQUMsU0FBUztRQUM3QixXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVc7UUFDakMsY0FBYyxFQUFFLFFBQVEsQ0FBQyxjQUFjO1FBQ3ZDLFFBQVEsRUFBRSxRQUFRLENBQUMsUUFBUTtLQUM1QixDQUFDLENBQUM7QUFDTCxDQUFDLENBQ0YsQ0FBQyJ9