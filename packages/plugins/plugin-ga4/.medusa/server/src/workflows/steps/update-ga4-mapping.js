"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateGa4MappingStep = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const ga4_1 = require("../../modules/ga4");
exports.updateGa4MappingStep = (0, workflows_sdk_1.createStep)('update-ga4-mapping-step', async (input, { container }) => {
    const ga4Service = container.resolve(ga4_1.GA4_MODULE);
    // Snapshot the current row so the compensation can restore it on failure.
    const previous = await ga4Service.retrieveGa4EventMapping(input.id);
    // param_mappings (array) va a una columna json() que el ORM tipa como
    // Record — casteamos solo ese campo en el borde de persistencia.
    const mapping = await ga4Service.updateGa4EventMappings({
        ...input,
        param_mappings: input.param_mappings,
    });
    return new workflows_sdk_1.StepResponse(mapping, previous);
}, async (previous, { container }) => {
    if (!previous) {
        return;
    }
    const ga4Service = container.resolve(ga4_1.GA4_MODULE);
    await ga4Service.updateGa4EventMappings({
        id: previous.id,
        medusa_event: previous.medusa_event,
        ga4_event_name: previous.ga4_event_name,
        is_active: previous.is_active,
        description: previous.description,
        param_mappings: previous.param_mappings,
        metadata: previous.metadata,
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLWdhNC1tYXBwaW5nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL3dvcmtmbG93cy9zdGVwcy91cGRhdGUtZ2E0LW1hcHBpbmcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUVBQTZFO0FBQzdFLDJDQUErQztBQWNsQyxRQUFBLG9CQUFvQixHQUFHLElBQUEsMEJBQVUsRUFDNUMseUJBQXlCLEVBQ3pCLEtBQUssRUFBRSxLQUFnQyxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUN4RCxNQUFNLFVBQVUsR0FBcUIsU0FBUyxDQUFDLE9BQU8sQ0FBQyxnQkFBVSxDQUFDLENBQUM7SUFFbkUsMEVBQTBFO0lBQzFFLE1BQU0sUUFBUSxHQUFHLE1BQU0sVUFBVSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUVwRSxzRUFBc0U7SUFDdEUsaUVBQWlFO0lBQ2pFLE1BQU0sT0FBTyxHQUFHLE1BQU0sVUFBVSxDQUFDLHNCQUFzQixDQUFDO1FBQ3RELEdBQUcsS0FBSztRQUNSLGNBQWMsRUFBRSxLQUFLLENBQUMsY0FBb0Q7S0FDM0UsQ0FBQyxDQUFDO0lBRUgsT0FBTyxJQUFJLDRCQUFZLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQzdDLENBQUMsRUFDRCxLQUFLLEVBQUUsUUFBUSxFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUNoQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDZCxPQUFPO0lBQ1QsQ0FBQztJQUVELE1BQU0sVUFBVSxHQUFxQixTQUFTLENBQUMsT0FBTyxDQUFDLGdCQUFVLENBQUMsQ0FBQztJQUVuRSxNQUFNLFVBQVUsQ0FBQyxzQkFBc0IsQ0FBQztRQUN0QyxFQUFFLEVBQUUsUUFBUSxDQUFDLEVBQUU7UUFDZixZQUFZLEVBQUUsUUFBUSxDQUFDLFlBQVk7UUFDbkMsY0FBYyxFQUFFLFFBQVEsQ0FBQyxjQUFjO1FBQ3ZDLFNBQVMsRUFBRSxRQUFRLENBQUMsU0FBUztRQUM3QixXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVc7UUFDakMsY0FBYyxFQUFFLFFBQVEsQ0FBQyxjQUFjO1FBQ3ZDLFFBQVEsRUFBRSxRQUFRLENBQUMsUUFBUTtLQUM1QixDQUFDLENBQUM7QUFDTCxDQUFDLENBQ0YsQ0FBQyJ9