"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPTY_PUCK_DATA = void 0;
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
exports.EMPTY_PUCK_DATA = { content: [], root: { props: {} } };
class LandingPageModuleService extends (0, utils_1.MedusaService)({ LandingPage: models_1.LandingPage }) {
    /** URL-safe slug from a title (accent-folded, lowercased, hyphenated). */
    generateSlug(title) {
        const base = (title || '')
            .toLowerCase()
            .normalize('NFD')
            // strip combining diacritical marks (U+0300–U+036F)
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 96);
        return base || 'landing';
    }
    /** Returns a slug that is not used by another (non-deleted) landing page. */
    async ensureUniqueSlug(slug, excludeId) {
        const normalized = this.generateSlug(slug);
        let candidate = normalized;
        let suffix = 2;
        for (;;) {
            const existing = await this.listLandingPages({ slug: candidate });
            const taken = existing.some((page) => page.id !== excludeId);
            if (!taken) {
                return candidate;
            }
            candidate = `${normalized}-${suffix}`;
            suffix += 1;
        }
    }
}
exports.default = LandingPageModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2xhbmRpbmctcGFnZS9zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHFEQUEwRDtBQUMxRCxxQ0FBdUM7QUFFMUIsUUFBQSxlQUFlLEdBQUcsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDO0FBRXBFLE1BQU0sd0JBQXlCLFNBQVEsSUFBQSxxQkFBYSxFQUFDLEVBQUUsV0FBVyxFQUFYLG9CQUFXLEVBQUUsQ0FBQztJQUNuRSwwRUFBMEU7SUFDMUUsWUFBWSxDQUFDLEtBQWE7UUFDeEIsTUFBTSxJQUFJLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO2FBQ3ZCLFdBQVcsRUFBRTthQUNiLFNBQVMsQ0FBQyxLQUFLLENBQUM7WUFDakIsb0RBQW9EO2FBQ25ELE9BQU8sQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDO2FBQ3JCLE9BQU8sQ0FBQyxhQUFhLEVBQUUsR0FBRyxDQUFDO2FBQzNCLE9BQU8sQ0FBQyxVQUFVLEVBQUUsRUFBRSxDQUFDO2FBQ3ZCLEtBQUssQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDaEIsT0FBTyxJQUFJLElBQUksU0FBUyxDQUFDO0lBQzNCLENBQUM7SUFFRCw2RUFBNkU7SUFDN0UsS0FBSyxDQUFDLGdCQUFnQixDQUFDLElBQVksRUFBRSxTQUFrQjtRQUNyRCxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzNDLElBQUksU0FBUyxHQUFHLFVBQVUsQ0FBQztRQUMzQixJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFDZixTQUFTLENBQUM7WUFDUixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQ2xFLE1BQU0sS0FBSyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQ3pCLENBQUMsSUFBb0IsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUUsS0FBSyxTQUFTLENBQ2hELENBQUM7WUFDRixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBQ1gsT0FBTyxTQUFTLENBQUM7WUFDbkIsQ0FBQztZQUNELFNBQVMsR0FBRyxHQUFHLFVBQVUsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUN0QyxNQUFNLElBQUksQ0FBQyxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7Q0FDRjtBQUVELGtCQUFlLHdCQUF3QixDQUFDIn0=