"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const blog_1 = require("../../../modules/blog");
const validators_1 = require("./validators");
const request_1 = require("../../../lib/multistore/request");
const scope_1 = require("../../../lib/multistore/scope");
const site_scope_1 = require("../../../modules/blog/site-scope");
/** GET /admin/blog-categories — list ordered by sort_order then name. */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const limit = req.query.limit ? Number(req.query.limit) : 100;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const filters = {};
        if (q) {
            filters.$or = [
                { name: { $ilike: `%${q}%` } },
                { slug: { $ilike: `%${q}%` } },
            ];
        }
        const resolution = await (0, request_1.siteFromRequest)(req);
        const siteWhere = await (0, scope_1.siteFilter)(req.scope, resolution, site_scope_1.BLOG_CATEGORY_SITE_SCOPE);
        const [blog_categories, count] = await service.listAndCountBlogCategories({ ...(filters), ...siteWhere }, { skip: offset, take: limit, order: { sort_order: 'ASC', name: 'ASC' } });
        return res.status(200).json({ blog_categories, count, limit, offset });
    }
    catch (error) {
        console.error('[Admin BlogCategories] Error listing categories:', error);
        return res.status(500).json({ message: 'Error fetching blog categories' });
    }
}
/** POST /admin/blog-categories — create. Slug generated from name when omitted. */
async function POST(req, res) {
    try {
        const validated = validators_1.PostAdminCreateBlogCategory.parse(req.body);
        const service = req.scope.resolve(blog_1.BLOG_MODULE);
        const slug = await service.ensureUniqueCategorySlug(validated.slug || validated.name);
        // La categoría nace en la tienda activa: si no, se crea desde una y aparece en
        // todas, y el listado filtrado ya no la encuentra donde se creó.
        const blog_category = await service.createBlogCategories({
            ...(0, scope_1.siteDefaults)(await (0, request_1.siteFromRequest)(req), site_scope_1.BLOG_CATEGORY_SITE_SCOPE),
            ...validated,
            slug,
            image: (validated.image ?? null),
        });
        return res.status(201).json({ blog_category });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Error creating blog category';
        return res.status(400).json({ message });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2Jsb2ctY2F0ZWdvcmllcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQVVBLGtCQTRCQztBQUdELG9CQXFCQztBQTdERCxnREFBb0Q7QUFFcEQsNkNBQTJEO0FBRTNELDZEQUFrRTtBQUNsRSx5REFBeUU7QUFDekUsaUVBQTRFO0FBRTVFLHlFQUF5RTtBQUNsRSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQXNCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLGtCQUFXLENBQUMsQ0FBQztRQUNsRSxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztRQUM5RCxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMvRCxNQUFNLENBQUMsR0FBRyxPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUVwRSxNQUFNLE9BQU8sR0FBNEIsRUFBRSxDQUFDO1FBQzVDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDTixPQUFPLENBQUMsR0FBRyxHQUFHO2dCQUNaLEVBQUUsSUFBSSxFQUFFLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLEVB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