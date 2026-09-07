"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const landing_page_1 = require("../../../modules/landing-page");
const helpers_1 = require("./helpers");
/**
 * GET /store/landing-pages — public list of PUBLISHED landing pages.
 * Query: limit, offset, locale. Never returns drafts/archived.
 */
async function GET(req, res) {
    try {
        const service = req.scope.resolve(landing_page_1.LANDING_PAGE_MODULE);
        const limit = req.query.limit ? Number(req.query.limit) : 20;
        const offset = req.query.offset ? Number(req.query.offset) : 0;
        const locale = typeof req.query.locale === 'string' ? req.query.locale : undefined;
        const filters = { status: 'published' };
        if (locale) {
            filters.locale = locale;
        }
        const [pages, count] = await service.listAndCountLandingPages(filters, {
            skip: offset,
            take: limit,
            order: { published_at: 'DESC' },
        });
        return res.status(200).json({
            landing_pages: pages.map(helpers_1.toPublicLandingPage),
            count,
            limit,
            offset,
        });
    }
    catch (error) {
        console.error('[Store LandingPages] Error listing landing pages:', error);
        return res.status(200).json({ landing_pages: [], count: 0 });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2xhbmRpbmctcGFnZXMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFTQSxrQkErQkM7QUF2Q0QsZ0VBQW9FO0FBRXBFLHVDQUFnRDtBQUVoRDs7O0dBR0c7QUFDSSxLQUFLLFVBQVUsR0FBRyxDQUFDLEdBQWtCLEVBQUUsR0FBbUI7SUFDL0QsSUFBSSxDQUFDO1FBQ0gsTUFBTSxPQUFPLEdBQTZCLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUN6RCxrQ0FBbUIsQ0FDcEIsQ0FBQztRQUNGLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQzdELE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQy9ELE1BQU0sTUFBTSxHQUNWLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBRXRFLE1BQU0sT0FBTyxHQUE0QixFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsQ0FBQztRQUNqRSxJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1gsT0FBTyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDMUIsQ0FBQztRQUVELE1BQU0sQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEdBQUcsTUFBTSxPQUFPLENBQUMsd0JBQXdCLENBQUMsT0FBTyxFQUFFO1lBQ3JFLElBQUksRUFBRSxNQUFNO1lBQ1osSUFBSSxFQUFFLEtBQUs7WUFDWCxLQUFLLEVBQUUsRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFO1NBQ2hDLENBQUMsQ0FBQztRQUVILE9BQU8sR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUM7WUFDMUIsYUFBYSxFQUFHLEtBQStCLENBQUMsR0FBRyxDQUFDLDZCQUFtQixDQUFDO1lBQ3hFLEtBQUs7WUFDTCxLQUFLO1lBQ0wsTUFBTTtTQUNQLENBQUMsQ0FBQztJQUNMLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQyxtREFBbUQsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMxRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsYUFBYSxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUMvRCxDQUFDO0FBQ0gsQ0FBQyJ9