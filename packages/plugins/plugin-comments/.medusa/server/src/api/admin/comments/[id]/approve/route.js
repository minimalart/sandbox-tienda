"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const comments_1 = require("../../../../../modules/comments");
// POST /admin/comments/:id/approve
async function POST(req, res) {
    const id = req.params.id;
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    const comment = await service.approve(id);
    // Signal loyalty on manual approval (best-effort).
    try {
        await req.scope
            .resolve(utils_1.Modules.EVENT_BUS)
            .emit({ name: 'comment.approved', data: { id } });
    }
    catch {
        // loyalty accrual must never block moderation
    }
    res.status(200).json({ comment });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NvbW1lbnRzL1tpZF0vYXBwcm92ZS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQU1BLG9CQWtCQztBQXZCRCxxREFBb0Q7QUFDcEQsOERBQWtFO0FBR2xFLG1DQUFtQztBQUM1QixLQUFLLFVBQVUsSUFBSSxDQUN4QixHQUFrQixFQUNsQixHQUFtQjtJQUVuQixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQztJQUNuQyxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBd0IsMEJBQWUsQ0FBQyxDQUFDO0lBQzFFLE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUUxQyxtREFBbUQ7SUFDbkQsSUFBSSxDQUFDO1FBQ0gsTUFBTSxHQUFHLENBQUMsS0FBSzthQUNaLE9BQU8sQ0FBQyxlQUFPLENBQUMsU0FBUyxDQUFDO2FBQzFCLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDdEQsQ0FBQztJQUFDLE1BQU0sQ0FBQztRQUNQLDhDQUE4QztJQUNoRCxDQUFDO0lBRUQsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0FBQ3BDLENBQUMifQ==