"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const landing_page_1 = require("../../../../modules/landing-page");
const helpers_1 = require("../helpers");
/**
 * GET /store/landing-pages/:slug — public, returns a single PUBLISHED landing
 * page by slug. Optional `?locale=` filter. 404 when not found/published.
 */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(landing_page_1.LANDING_PAGE_MODULE);
        const locale = typeof req.query.locale === 'string' ? req.query.locale : undefined;
        const filters = {
            status: 'published',
            slug: req.params.slug,
        };
        if (locale) {
            filters.locale = locale;
        }
        const [page] = await service.listLandingPages(filters, { take: 1 });
        if (!page) {
            return res.status(404).json({ message: 'Landing page not found' });
        }
        return res
            .status(200)
            .json({ landing_page: (0, helpers_1.toPublicLandingPage)(page) });
    }
    catch (error) {
        console.error('[Store LandingPages] Error fetching landing page:', error);
        return res.status(404).json({ message: 'Landing page not found' });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2xhbmRpbmctcGFnZXMvW3NsdWddL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBU0Esa0JBNkJDO0FBckNELG1FQUF1RTtBQUV2RSx3Q0FBaUQ7QUFFakQ7OztHQUdHO0FBQ0ksS0FBSyxVQUFVLEdBQUcsQ0FBQyxHQUFrQixFQUFFLEdBQW1CO0lBQy9ELElBQUksQ0FBQztRQUNILE1BQU0sT0FBTyxHQUE2QixHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FDekQsa0NBQW1CLENBQ3BCLENBQUM7UUFDRixNQUFNLE1BQU0sR0FDVixPQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUV0RSxNQUFNLE9BQU8sR0FBNEI7WUFDdkMsTUFBTSxFQUFFLFdBQVc7WUFDbkIsSUFBSSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSTtTQUN0QixDQUFDO1FBQ0YsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNYLE9BQU8sQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQzFCLENBQUM7UUFFRCxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFcEUsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ1YsT0FBTyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxDQUFDLENBQUM7UUFDckUsQ0FBQztRQUVELE9BQU8sR0FBRzthQUNQLE1BQU0sQ0FBQyxHQUFHLENBQUM7YUFDWCxJQUFJLENBQUMsRUFBRSxZQUFZLEVBQUUsSUFBQSw2QkFBbUIsRUFBQyxJQUEyQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxtREFBbUQsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMxRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsT0FBTyxFQUFFLHdCQUF3QixFQUFFLENBQUMsQ0FBQztJQUNyRSxDQUFDO0FBQ0gsQ0FBQyJ9