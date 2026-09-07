"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLandingPageWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const landing_page_1 = require("../modules/landing-page");
const updateLandingPageStep = (0, workflows_sdk_1.createStep)('update-landing-page', async (input, { container }) => {
    const service = container.resolve(landing_page_1.LANDING_PAGE_MODULE);
    const { id, slug, status, ...rest } = input;
    const data = { id, ...rest };
    if (slug !== undefined) {
        data.slug = await service.ensureUniqueSlug(slug, id);
    }
    if (status !== undefined) {
        data.status = status;
        // Stamp/clear published_at to keep it consistent with the new status.
        if (status === 'published') {
            data.published_at = new Date();
        }
        else if (status === 'draft' || status === 'archived') {
            data.published_at = null;
        }
    }
    const updated = await service.updateLandingPages(data);
    return new workflows_sdk_1.StepResponse(Array.isArray(updated) ? updated[0] : updated);
});
exports.updateLandingPageWorkflow = (0, workflows_sdk_1.createWorkflow)('update-landing-page', (input) => {
    const landing_page = updateLandingPageStep(input);
    return new workflows_sdk_1.WorkflowResponse(landing_page);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXBkYXRlLWxhbmRpbmctcGFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvdXBkYXRlLWxhbmRpbmctcGFnZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFLMkM7QUFDM0MsMERBQThEO0FBUTlELE1BQU0scUJBQXFCLEdBQUcsSUFBQSwwQkFBVSxFQUN0QyxxQkFBcUIsRUFDckIsS0FBSyxFQUFFLEtBQXFDLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFO0lBQzdELE1BQU0sT0FBTyxHQUE2QixTQUFTLENBQUMsT0FBTyxDQUN6RCxrQ0FBbUIsQ0FDcEIsQ0FBQztJQUVGLE1BQU0sRUFBRSxFQUFFLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxHQUFHLElBQUksRUFBRSxHQUFHLEtBQUssQ0FBQztJQUU1QyxNQUFNLElBQUksR0FBNEIsRUFBRSxFQUFFLEVBQUUsR0FBRyxJQUFJLEVBQUUsQ0FBQztJQUN0RCxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsSUFBSSxHQUFHLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBQ0QsSUFBSSxNQUFNLEtBQUssU0FBUyxFQUFFLENBQUM7UUFDekIsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsc0VBQXNFO1FBQ3RFLElBQUksTUFBTSxLQUFLLFdBQVcsRUFBRSxDQUFDO1lBQzNCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUNqQyxDQUFDO2FBQU0sSUFBSSxNQUFNLEtBQUssT0FBTyxJQUFJLE1BQU0sS0FBSyxVQUFVLEVBQUUsQ0FBQztZQUN2RCxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQztRQUMzQixDQUFDO0lBQ0gsQ0FBQztJQUVELE1BQU0sT0FBTyxHQUFHLE1BQU8sT0FBZSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hFLE9BQU8sSUFBSSw0QkFBWSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDekUsQ0FBQyxDQUNGLENBQUM7QUFFVyxRQUFBLHlCQUF5QixHQUFHLElBQUEsOEJBQWMsRUFDckQscUJBQXFCLEVBQ3JCLENBQUMsS0FBcUMsRUFBRSxFQUFFO0lBQ3hDLE1BQU0sWUFBWSxHQUFHLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2xELE9BQU8sSUFBSSxnQ0FBZ0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUM1QyxDQUFDLENBQ0YsQ0FBQyJ9