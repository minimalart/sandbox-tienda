"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const comments_1 = require("../../../../../modules/comments");
// POST /admin/comments/:id/hide
async function POST(req, res) {
    const id = req.params.id;
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    const comment = await service.hide(id);
    res.status(200).json({ comment });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NvbW1lbnRzL1tpZF0vaGlkZS9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUtBLG9CQVFDO0FBWkQsOERBQWtFO0FBR2xFLGdDQUFnQztBQUN6QixLQUFLLFVBQVUsSUFBSSxDQUN4QixHQUFrQixFQUNsQixHQUFtQjtJQUVuQixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQztJQUNuQyxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBd0IsMEJBQWUsQ0FBQyxDQUFDO0lBQzFFLE1BQU0sT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN2QyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDcEMsQ0FBQyJ9