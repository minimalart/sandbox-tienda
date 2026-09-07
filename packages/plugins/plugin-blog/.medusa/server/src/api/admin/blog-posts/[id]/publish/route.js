"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const blog_1 = require("../../../../../modules/blog");
/** POST /admin/blog-posts/:id/publish — set status=published + stamp published_at. */
async function POST(req, res) {
    try {
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const id = req.params.id;
        const current = await service.retrieveBlogPost(id);
        const blog_post = await service.updateBlogPosts({
            id,
            status: 'published',
            published_at: current.published_at ?? new Date(),
        });
        return res.status(200).json({ blog_post });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error publishing blog post';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jsb2ctcG9zdHMvW2lkXS9wdWJsaXNoL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBS0Esb0JBaUJDO0FBckJELHNEQUEwRDtBQUcxRCxzRkFBc0Y7QUFDL0UsS0FBSyxVQUFVLElBQUksQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQ2hFLElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUFzQixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxrQkFBVyxDQUFDLENBQUM7UUFDbEUsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFZLENBQUM7UUFDbkMsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDbkQsTUFBTSxTQUFTLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUFDO1lBQzlDLEVBQUU7WUFDRixNQUFNLEVBQUUsV0FBVztZQUNuQixZQUFZLEVBQ1QsT0FBbUMsQ0FBQyxZQUFZLElBQUksSUFBSSxJQUFJLEVBQUU7U0FDbEUsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7UUFDZixNQUFNLE9BQU8sR0FDWCxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyw0QkFBNEIsQ0FBQztRQUN4RSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUMzQyxDQUFDO0FBQ0gsQ0FBQyJ9