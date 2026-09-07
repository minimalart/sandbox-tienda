"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const blog_1 = require("../../../../../modules/blog");
/** POST /admin/blog-posts/:id/unpublish — revert to draft (keeps published_at). */
async function POST(req, res) {
    try {
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const blog_post = await service.updateBlogPosts({
            id: req.params.id,
            status: 'draft',
        });
        return res.status(200).json({ blog_post });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error unpublishing blog post';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jsb2ctcG9zdHMvW2lkXS91bnB1Ymxpc2gvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFLQSxvQkFhQztBQWpCRCxzREFBMEQ7QUFHMUQsbUZBQW1GO0FBQzVFLEtBQUssVUFBVSxJQUFJLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUNoRSxJQUFJLENBQUM7UUFDSCxNQUFNLE9BQU8sR0FBc0IsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsa0JBQVcsQ0FBQyxDQUFDO1FBQ2xFLE1BQU0sU0FBUyxHQUFHLE1BQU0sT0FBTyxDQUFDLGVBQWUsQ0FBQztZQUM5QyxFQUFFLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZO1lBQzNCLE1BQU0sRUFBRSxPQUFPO1NBQ2hCLENBQUMsQ0FBQztRQUNILE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsTUFBTSxPQUFPLEdBQ1gsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsOEJBQThCLENBQUM7UUFDMUUsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7SUFDM0MsQ0FBQztBQUNILENBQUMifQ==