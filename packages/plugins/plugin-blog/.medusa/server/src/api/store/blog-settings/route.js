"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const blog_1 = require("../../../modules/blog");
/** GET /store/blog-settings — public presentation config for the blog section. */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const s = (await service.getSettings());
        return res.status(200).json({
            blog_settings: {
                section_name: s.section_name ?? 'Blog',
                show_search: s.show_search ?? true,
                show_categories: s.show_categories ?? true,
                posts_per_page: s.posts_per_page ?? 12,
                default_seo_title: s.default_seo_title ?? null,
                default_seo_description: s.default_seo_description ?? null,
            },
        });
    }
    catch (error) {
        console.error('[Store BlogSettings] Error:', error);
        return res.status(200).json({
            blog_settings: {
                section_name: 'Blog',
                show_search: true,
                show_categories: true,
                posts_per_page: 12,
                default_seo_title: null,
                default_seo_description: null,
            },
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2Jsb2ctc2V0dGluZ3Mvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFLQSxrQkEyQkM7QUEvQkQsZ0RBQW9EO0FBR3BELGtGQUFrRjtBQUMzRSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQXNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFXLENBQUMsQ0FBQztRQUNsRSxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sT0FBTyxDQUFDLFdBQVcsRUFBRSxDQUF3QixDQUFDO1FBQy9ELE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDMUIsYUFBYSxFQUFFO2dCQUNiLFlBQVksRUFBRSxDQUFDLENBQUMsWUFBWSxJQUFJLE1BQU07Z0JBQ3RDLFdBQVcsRUFBRSxDQUFDLENBQUMsV0FBVyxJQUFJLElBQUk7Z0JBQ2xDLGVBQWUsRUFBRSxDQUFDLENBQUMsZUFBZSxJQUFJLElBQUk7Z0JBQzFDLGNBQWMsRUFBRSxDQUFDLENBQUMsY0FBYyxJQUFJLEVBQUU7Z0JBQ3RDLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxpQkFBaUIsSUFBSSxJQUFJO2dCQUM5Qyx1QkFBdUIsRUFBRSxDQUFDLENBQUMsdUJBQXVCLElBQUksSUFBSTthQUMzRDtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyw2QkFBNkIsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNwRCxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQzFCLGFBQWEsRUFBRTtnQkFDYixZQUFZLEVBQUUsTUFBTTtnQkFDcEIsV0FBVyxFQUFFLElBQUk7Z0JBQ2pCLGVBQWUsRUFBRSxJQUFJO2dCQUNyQixjQUFjLEVBQUUsRUFBRTtnQkFDbEIsaUJBQWlCLEVBQUUsSUFBSTtnQkFDdkIsdUJBQXVCLEVBQUUsSUFBSTthQUM5QjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7QUFDSCxDQUFDIn0=