"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const publish_landing_page_1 = require("../../../../../workflows/publish-landing-page");
/** POST /admin/landing-pages/:id/unpublish — back to draft. */
async function POST(req, res) {
    try {
        const { result } = await (0, publish_landing_page_1.publishLandingPageWorkflow)(req.scope).run({
            input: { id: req.params.id, publish: false },
        });
        return res.status(200).json({ landing_page: result });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : 'Error unpublishing landing page';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2xhbmRpbmctcGFnZXMvW2lkXS91bnB1Ymxpc2gvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFJQSxvQkFhQztBQWhCRCx3RkFBMkY7QUFFM0YsK0RBQStEO0FBQ3hELEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxJQUFJLENBQUM7UUFDSCxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxJQUFBLGlEQUEwQixFQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUM7WUFDakUsS0FBSyxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBWSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUU7U0FDdkQsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ3hELENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxPQUFPLEdBQ1gsS0FBSyxZQUFZLEtBQUs7WUFDcEIsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPO1lBQ2YsQ0FBQyxDQUFDLGlDQUFpQyxDQUFDO1FBQ3hDLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7QUFDSCxDQUFDIn0=