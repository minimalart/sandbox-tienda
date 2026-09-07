"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
class BannerModuleService extends (0, utils_1.MedusaService)({
    Banner: models_1.Banner,
    BannerAudit: models_1.BannerAudit,
    BannerAnalytics: models_1.BannerAnalytics,
}) {
    parseJsonField(value) {
        if (value === null || value === undefined)
            return null;
        if (typeof value === 'object')
            return value;
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            }
            catch {
                return null;
            }
        }
        return null;
    }
    async resolveBanners(query) {
        const now = new Date();
        const placements = Array.isArray(query.placement) ? query.placement : [query.placement];
        const banners = await this.listBanners({
            status: 'published',
            placement: placements,
        });
        const parsed = banners.map((banner) => ({
            ...banner,
            content: this.parseJsonField(banner.content),
            media: this.parseJsonField(banner.media),
            cta: this.parseJsonField(banner.cta),
            rules: this.parseJsonField(banner.rules),
            metadata: this.parseJsonField(banner.metadata),
        }));
        const filtered = parsed.filter((banner) => {
            if (banner.start_at && new Date(banner.start_at) > now) {
                return false;
            }
            if (banner.end_at && new Date(banner.end_at) <= now) {
                return false;
            }
            if (!this.matchRules(banner.rules, query)) {
                return false;
            }
            return true;
        });
        filtered.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        return filtered;
    }
    matchRules(rules, query) {
        // Scoping estricto por canal (contexto demo): el banner debe estar
        // explícitamente asignado al canal pedido. Excluye globales/sin canal.
        if (query.require_sales_channel) {
            const scoped = rules?.sales_channel_ids ?? [];
            if (!query.sales_channel_id || !scoped.includes(query.sales_channel_id)) {
                return false;
            }
        }
        if (!rules)
            return true;
        if (rules.sales_channel_ids?.length) {
            if (!query.sales_channel_id)
                return false;
            if (!rules.sales_channel_ids.includes(query.sales_channel_id)) {
                return false;
            }
        }
        if (rules.customer_group_ids?.length) {
            const queryGroupIds = [
                ...(query.customer_group_id ? [query.customer_group_id] : []),
                ...(query.customer_group_ids ?? []),
            ];
            if (queryGroupIds.length === 0)
                return false;
            if (!rules.customer_group_ids.some((id) => queryGroupIds.includes(id))) {
                return false;
            }
        }
        if (rules.locales?.length) {
            if (!query.locale)
                return false;
            if (!rules.locales.includes(query.locale)) {
                return false;
            }
        }
        if (rules.countries?.length) {
            if (!query.country)
                return false;
            if (!rules.countries.includes(query.country)) {
                return false;
            }
        }
        if (rules.devices?.length) {
            if (!query.device)
                return false;
            if (!rules.devices.includes(query.device)) {
                return false;
            }
        }
        if (rules.paths?.length && query.path) {
            const matched = rules.paths.some((pattern) => this.matchPath(pattern, query.path));
            if (!matched)
                return false;
        }
        return true;
    }
    matchPath(pattern, path) {
        const regexPattern = pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '{{DOUBLE}}')
            .replace(/\*/g, '[^/]*')
            .replace(/{{DOUBLE}}/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(path);
    }
    generateHandle(internalName) {
        return internalName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    async createAuditEntry(bannerId, action, userId, changes, snapshot) {
        await this.createBannerAudits({
            banner_id: bannerId,
            action,
            user_id: userId,
            changes,
            snapshot,
        });
    }
    async trackImpression(bannerId) {
        const existing = await this.listBannerAnalytics({ banner_id: bannerId });
        const current = existing[0];
        if (current) {
            await this.updateBannerAnalytics({
                id: current.id,
                impressions: (current.impressions ?? 0) + 1,
                last_impression_at: new Date(),
            });
        }
        else {
            await this.createBannerAnalytics({
                banner_id: bannerId,
                impressions: 1,
                clicks: 0,
                last_impression_at: new Date(),
            });
        }
    }
    async trackClick(bannerId) {
        const existing = await this.listBannerAnalytics({ banner_id: bannerId });
        const current = existing[0];
        if (current) {
            await this.updateBannerAnalytics({
                id: current.id,
                clicks: (current.clicks ?? 0) + 1,
                last_click_at: new Date(),
            });
        }
        else {
            await this.createBannerAnalytics({
                banner_id: bannerId,
                impressions: 0,
                clicks: 1,
                last_click_at: new Date(),
            });
        }
    }
}
exports.default = BannerModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2Jhbm5lci9zZXJ2aWNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEscURBQTBEO0FBQzFELHFDQUFnRTtBQUdoRSxNQUFNLG1CQUFvQixTQUFRLElBQUEscUJBQWEsRUFBQztJQUM5QyxNQUFNLEVBQU4sZUFBTTtJQUNOLFdBQVcsRUFBWCxvQkFBVztJQUNYLGVBQWUsRUFBZix3QkFBZTtDQUNoQixDQUFDO0lBQ1EsY0FBYyxDQUFJLEtBQWM7UUFDdEMsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLEtBQUssS0FBSyxTQUFTO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDdkQsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRO1lBQUUsT0FBTyxLQUFVLENBQUM7UUFDakQsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUM5QixJQUFJLENBQUM7Z0JBQ0gsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBTSxDQUFDO1lBQ2hDLENBQUM7WUFBQyxNQUFNLENBQUM7Z0JBQ1AsT0FBTyxJQUFJLENBQUM7WUFDZCxDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELEtBQUssQ0FBQyxjQUFjLENBQUMsS0FBdUI7UUFDMUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUN2QixNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFeEYsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDO1lBQ3JDLE1BQU0sRUFBRSxXQUFXO1lBQ25CLFNBQVMsRUFBRSxV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