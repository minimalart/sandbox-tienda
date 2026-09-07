"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const landing_page_1 = require("../../../../../modules/landing-page");
const create_landing_page_1 = require("../../../../../workflows/create-landing-page");
/** POST /admin/landing-pages/:id/duplicate — clone as a fresh draft. */
async function POST(req, res) {
    const service = req.scope.resolve(landing_page_1.LANDING_PAGE_MODULE);
    try {
        const original = (await service.retrieveLandingPage(req.params.id));
        const { result } = await (0, create_landing_page_1.createLandingPageWorkflow)(req.scope).run({
            input: {
                title: `Copy of ${original.title}`,
                status: 'draft',
                description: original.description ?? null,
                seo: original.seo ?? null,
                puck_data: original.puck_data ?? null,
                template: original.template ?? null,
                locale: original.locale ?? null,
                sales_channel_id: original.sales_channel_id ?? null,
                metadata: original.metadata ?? null,
            },
        });
        return res.status(201).json({ landing_page: result });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error duplicating landing page';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xhbmRpbmctcGFnZXMvW2lkXS9kdXBsaWNhdGUvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFPQSxvQkE2QkM7QUFuQ0Qsc0VBQTBFO0FBRzFFLHNGQUF5RjtBQUV6Rix3RUFBd0U7QUFDakUsS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLE1BQU0sT0FBTyxHQUE2QixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FDekQsa0NBQW1CLENBQ3BCLENBQUM7SUFDRixJQUFJLENBQUM7UUFDSCxNQUFNLFFBQVEsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLG1CQUFtQixDQUNoRCxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQWEsQ0FDMUIsQ0FBd0IsQ0FBQztRQUUxQixNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFBLCtDQUF5QixFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUM7WUFDaEUsS0FBSyxFQUFFO2dCQUNMLEtBQUssRUFBRSxXQUFXLFFBQVEsQ0FBQyxLQUFLLEVBQUU7Z0JBQ2xDLE1BQU0sRUFBRSxPQUFPO2dCQUNmLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVyxJQUFJLElBQUk7Z0JBQ3pDLEdBQUcsRUFBRSxRQUFRLENBQUMsR0FBRyxJQUFJLElBQUk7Z0JBQ3pCLFNBQVMsRUFBRSxRQUFRLENBQUMsU0FBUyxJQUFJLElBQUk7Z0JBQ3JDLFFBQVEsRUFBRSxRQUFRLENBQUMsUUFBUSxJQUFJLElBQUk7Z0JBQ25DLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTSxJQUFJLElBQUk7Z0JBQy9CLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJO2dCQUNuRCxRQUFRLEVBQUUsUUFBUSxDQUFDLFFBQVEsSUFBSSxJQUFJO2FBQ0M7U0FDdkMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxPQUFPLEdBQ1gsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsZ0NBQWdDLENBQUM7UUFDNUUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDM0MsQ0FBQztBQUNILENBQUMifQ==