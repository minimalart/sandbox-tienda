"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const blog_1 = require("../../../../../modules/blog");
/** POST /admin/blog-posts/:id/duplicate — clone as a fresh draft (incl. products). */
async function POST(req, res) {
    const service = req.scope.resolve(blog_1.BLOG_MODULE);
    try {
        const id = req.params.id;
        const original = (await service.retrieveBlogPost(id));
        const slug = await service.ensureUniquePostSlug(`${original.slug}-copy`);
        const blog_post = await service.createBlogPosts({
            title: `Copia de ${original.title}`,
            slug,
            excerpt: original.excerpt ?? null,
            cover_image: original.cover_image ?? null,
            content: original.content ?? null,
            status: 'draft',
            category_id: original.category_id ?? null,
            seo_title: original.seo_title ?? null,
            seo_description: original.seo_description ?? null,
            metadata: original.metadata ?? null,
            published_at: null,
        });
        const productIds = await service.getPostProductIds(id);
        if (productIds.length) {
            await service.setPostProducts(blog_post.id, productIds);
        }
        return res.status(201).json({ blog_post });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error duplicating blog post';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jsb2ctcG9zdHMvW2lkXS9kdXBsaWNhdGUvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFLQSxvQkFvQ0M7QUF4Q0Qsc0RBQTBEO0FBRzFELHNGQUFzRjtBQUMvRSxLQUFLLFVBQVUsSUFBSSxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDaEUsTUFBTSxPQUFPLEdBQXNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFXLENBQUMsQ0FBQztJQUNsRSxJQUFJLENBQUM7UUFDSCxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQVksQ0FBQztRQUNuQyxNQUFNLFFBQVEsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxDQUF3QixDQUFDO1FBRTdFLE1BQU0sSUFBSSxHQUFHLE1BQU0sT0FBTyxDQUFDLG9CQUFvQixDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksT0FBTyxDQUFDLENBQUM7UUFFekUsTUFBTSxTQUFTLEdBQUcsTUFBTSxPQUFPLENBQUMsZUFBZSxDQUFDO1lBQzlDLEtBQUssRUFBRSxZQUFZLFFBQVEsQ0FBQyxLQUFLLEVBQUU7WUFDbkMsSUFBSTtZQUNKLE9BQU8sRUFBRSxRQUFRLENBQUMsT0FBTyxJQUFJLElBQUk7WUFDakMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLElBQUksSUFBSTtZQUN6QyxPQUFPLEVBQUUsUUFBUSxDQUFDLE9BQU8sSUFBSSxJQUFJO1lBQ2pDLE1BQU0sRUFBRSxPQUFPO1lBQ2YsV0FBVyxFQUFFLFFBQVEsQ0FBQyxXQUFXLElBQUksSUFBSTtZQUN6QyxTQUFTLEVBQUUsUUFBUSxDQUFDLFNBQVMsSUFBSSxJQUFJO1lBQ3JDLGVBQWUsRUFBRSxRQUFRLENBQUMsZUFBZSxJQUFJLElBQUk7WUFDakQsUUFBUSxFQUFFLFFBQVEsQ0FBQyxRQUFRLElBQUksSUFBSTtZQUNuQyxZQUFZLEVBQUUsSUFBSTtTQUNuQixDQUFDLENBQUM7UUFFSCxNQUFNLFVBQVUsR0FBRyxNQUFNLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN2RCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN0QixNQUFNLE9BQU8sQ0FBQyxlQUFlLENBQzFCLFNBQTRCLENBQUMsRUFBRSxFQUNoQyxVQUFVLENBQ1gsQ0FBQztRQUNKLENBQUM7UUFFRCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUM3QyxDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNmLE1BQU0sT0FBTyxHQUNYLEtBQUssWUFBWSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLDZCQUE2QixDQUFDO1FBQ3pFLE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7QUFDSCxDQUFDIn0=