"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLandingPageWorkflow = void 0;
const workflows_sdk_1 = require("@medusajs/framework/workflows-sdk");
const landing_page_1 = require("../modules/landing-page");
const service_1 = require("../modules/landing-page/service");
const createLandingPageStep = (0, workflows_sdk_1.createStep)('create-landing-page', async (input, { container }) => {
    const service = container.resolve(landing_page_1.LANDING_PAGE_MODULE);
    const baseSlug = input.slug || service.generateSlug(input.title);
    const slug = await service.ensureUniqueSlug(baseSlug);
    const willPublish = input.status === 'published';
    const created = await service.createLandingPages({
        title: input.title,
        slug,
        status: input.status || 'draft',
        description: input.description ?? null,
        seo: input.seo ?? null,
        puck_data: input.puck_data ?? service_1.EMPTY_PUCK_DATA,
        template: input.template ?? null,
        locale: input.locale ?? null,
        sales_channel_id: input.sales_channel_id ?? null,
        metadata: input.metadata ?? null,
        created_by: input.created_by ?? null,
        updated_by: input.created_by ?? null,
        published_at: willPublish ? new Date() : null,
    });
    return new workflows_sdk_1.StepResponse(created, created.id);
}, async (id, { container }) => {
    if (!id) {
        return;
    }
    const service = container.resolve(landing_page_1.LANDING_PAGE_MODULE);
    await service.deleteLandingPages(id);
});
exports.createLandingPageWorkflow = (0, workflows_sdk_1.createWorkflow)('create-landing-page', (input) => {
    const landing_page = createLandingPageStep(input);
    return new workflows_sdk_1.WorkflowResponse(landing_page);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY3JlYXRlLWxhbmRpbmctcGFnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NyYy93b3JrZmxvd3MvY3JlYXRlLWxhbmRpbmctcGFnZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxxRUFLMkM7QUFDM0MsMERBQThEO0FBRTlELDZEQUFrRTtBQUdsRSxNQUFNLHFCQUFxQixHQUFHLElBQUEsMEJBQVUsRUFDdEMscUJBQXFCLEVBQ3JCLEtBQUssRUFBRSxLQUE2QixFQUFFLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRTtJQUNyRCxNQUFNLE9BQU8sR0FBNkIsU0FBUyxDQUFDLE9BQU8sQ0FDekQsa0NBQW1CLENBQ3BCLENBQUM7SUFFRixNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsSUFBSSxJQUFJLE9BQU8sQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2pFLE1BQU0sSUFBSSxHQUFHLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RELE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxNQUFNLEtBQUssV0FBVyxDQUFDO0lBRWpELE1BQU0sT0FBTyxHQUFHLE1BQU8sT0FBZSxDQUFDLGtCQUFrQixDQUFDO1FBQ3hELEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSztRQUNsQixJQUFJO1FBQ0osTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNLElBQUksT0FBTztRQUMvQixXQUFXLEVBQUUsS0FBSyxDQUFDLFdBQVcsSUFBSSxJQUFJO1FBQ3RDLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRyxJQUFJLElBQUk7UUFDdEIsU0FBUyxFQUFFLEtBQUssQ0FBQyxTQUFTLElBQUkseUJBQWU7UUFDN0MsUUFBUSxFQUFFLEtBQUssQ0FBQyxRQUFRLElBQUksSUFBSTtRQUNoQyxNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU0sSUFBSSxJQUFJO1FBQzVCLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJO1FBQ2hELFFBQVEsRUFBRSxLQUFLLENBQUMsUUFBUSxJQUFJLElBQUk7UUFDaEMsVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVLElBQUksSUFBSTtRQUNwQyxVQUFVLEVBQUUsS0FBSyxDQUFDLFVBQVUsSUFBSSxJQUFJO1FBQ3BDLFlBQVksRUFBRSxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUk7S0FDOUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxJQUFJLDRCQUFZLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxFQUFZLENBQUMsQ0FBQztBQUN6RCxDQUFDLEVBQ0QsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUU7SUFDMUIsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ1IsT0FBTztJQUNULENBQUM7SUFDRCxNQUFNLE9BQU8sR0FBNkIsU0FBUyxDQUFDLE9BQU8sQ0FDekQsa0NBQW1CLENBQ3BCLENBQUM7SUFDRixNQUFPLE9BQWUsQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUNoRCxDQUFDLENBQ0YsQ0FBQztBQUVXLFFBQUEseUJBQXlCLEdBQUcsSUFBQSw4QkFBYyxFQUNyRCxxQkFBcUIsRUFDckIsQ0FBQyxLQUE2QixFQUFFLEVBQUU7SUFDaEMsTUFBTSxZQUFZLEdBQUcscUJBQXFCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDbEQsT0FBTyxJQUFJLGdDQUFnQixDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQzVDLENBQUMsQ0FDRixDQUFDIn0=