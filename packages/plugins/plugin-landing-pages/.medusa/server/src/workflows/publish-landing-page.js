"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishLandingPageWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const landing_page_1 = require("../modules/landing-page");
const publishLandingPageStep = (0, workflows_sdk_1.createStep)('publish-landing-page', async (input, { container }) => {
    const service = container.resolve(landing_page_1.LANDING_PAGE_MODULE);
    const updated = await service.updateLandingPages({
        id: input.id,
        status: input.publish ? 'published' : 'draft',
        published_at: input.publish ? new Date() : null,
    });
    return new workflows_sdk_1.StepResponse(Array.isArray(updated) ? updated[0] : updated);
});
exports.publishLandingPageWorkflow = (0, workflows_sdk_1.createWorkflow)('publish-landing-page', (input) => {
    const landing_page = publishLandingPageStep(input);
    return new workflows_sdk_1.WorkflowResponse(landing_page);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVibGlzaC1sYW5kaW5nLXBhZ2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvd29ya2Zsb3dzL3B1Ymxpc2gtbGFuZGluZy1wYWdlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFFQUsyQztBQUMzQywwREFBOEQ7QUFROUQsTUFBTSxzQkFBc0IsR0FBRyxJQUFBLDBCQUFVLEVBQ3ZDLHNCQUFzQixFQUN0QixLQUFLLEVBQUUsS0FBc0MsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDOUQsTUFBTSxPQUFPLEdBQTZCLFNBQVMsQ0FBQyxPQUFPLENBQ3pELGtDQUFtQixDQUNwQixDQUFDO0lBRUYsTUFBTSxPQUFPLEdBQUcsTUFBTyxPQUFlLENBQUMsa0JBQWtCLENBQUM7UUFDeEQsRUFBRSxFQUFFLEtBQUssQ0FBQyxFQUFFO1FBQ1osTUFBTSxFQUFFLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsT0FBTztRQUM3QyxZQUFZLEVBQUUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSTtLQUNoRCxDQUFDLENBQUM7SUFFSCxPQUFPLElBQUksNEJBQVksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ3pFLENBQUMsQ0FDRixDQUFDO0FBRVcsUUFBQSwwQkFBMEIsR0FBRyxJQUFBLDhCQUFjLEVBQ3RELHNCQUFzQixFQUN0QixDQUFDLEtBQXNDLEVBQUUsRUFBRTtJQUN6QyxNQUFNLFlBQVksR0FBRyxzQkFBc0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNuRCxPQUFPLElBQUksZ0NBQWdCLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDNUMsQ0FBQyxDQUNGLENBQUMifQ==