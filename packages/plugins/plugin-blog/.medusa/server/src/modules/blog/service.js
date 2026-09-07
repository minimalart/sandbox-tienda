"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
class BlogModuleService extends (0, utils_1.MedusaService)({
    BlogPost: models_1.BlogPost,
    BlogCategory: models_1.BlogCategory,
    BlogPostProduct: models_1.BlogPostProduct,
    BlogSettings: models_1.BlogSettings,
}) {
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
        return base || 'post';
    }
    /** Returns a slug not used by another (non-deleted) post. */
    async ensureUniquePostSlug(slug, excludeId) {
        const normalized = this.generateSlug(slug);
        let candidate = normalized;
        let suffix = 2;
        for (;;) {
            const existing = await this.listBlogPosts({ slug: candidate });
            const taken = existing.some((p) => p.id !== excludeId);
            if (!taken) {
                return candidate;
            }
            candidate = `${normalized}-${suffix}`;
            suffix += 1;
        }
    }
    /** Returns a slug not used by another (non-deleted) category. */
    async ensureUniqueCategorySlug(slug, excludeId) {
        const normalized = this.generateSlug(slug);
        let candidate = normalized;
        let suffix = 2;
        for (;;) {
            const existing = await this.listBlogCategories({ slug: candidate });
            const taken = existing.some((c) => c.id !== excludeId);
            if (!taken) {
                return candidate;
            }
            candidate = `${normalized}-${suffix}`;
            suffix += 1;
        }
    }
    /** List + count posts with optional text search, status and category filters. */
    async searchPosts(q, opts = {}) {
        const filters = {};
        if (opts.status) {
            filters.status = opts.status;
        }
        if (opts.category_id) {
            filters.category_id = opts.category_id;
        }
        if (q && q.trim()) {
            filters.$or = [
                { title: { $ilike: `%${q.trim()}%` } },
                { excerpt: { $ilike: `%${q.trim()}%` } },
                { slug: { $ilike: `%${q.trim()}%` } },
            ];
        }
        Object.assign(filters, opts.extraFilters ?? {});
        return this.listAndCountBlogPosts(filters, {
            skip: opts.offset ?? 0,
            take: opts.limit ?? 20,
            order: { created_at: 'DESC' },
        });
    }
    /** Returns the published post for a slug, or undefined. */
    async getPublishedBySlug(slug) {
        const [post] = await this.listBlogPosts({ slug, status: 'published' }, { take: 1 });
        return post;
    }
    /** Returns the linked product ids for a post, ordered by sort_order. */
    async getPostProductIds(blogPostId) {
        const links = await this.listBlogPostProducts({ blog_post_id: blogPostId }, { order: { sort_order: 'ASC' } });
        return links.map((l) => l.product_id);
    }
    /** Replaces a post's product associations with the given ordered ids. */
    async setPostProducts(blogPostId, productIds) {
        const existing = await this.listBlogPostProducts({
            blog_post_id: blogPostId,
        });
        if (existing.length) {
            await this.deleteBlogPostProducts(existing.map((l) => l.id));
        }
        if (!productIds.length) {
            return [];
        }
        return this.createBlogPostProducts(productIds.map((product_id, index) => ({
            blog_post_id: blogPostId,
            product_id,
            sort_order: index,
        })));
    }
    /** Returns the singleton settings row, creating defaults on first access. */
    /**
     * La configuración EFECTIVA de una tienda: la suya si la definió, la global si no.
     *
     * La creación perezosa es SIEMPRE sobre la fila global. Crear una por tienda la
     * primera vez que alguien mira la pantalla congelaría los defaults de ese momento,
     * y a partir de ahí cambiar el global ya no se propagaría a esa tienda.
     */
    async getSettings(siteId) {
        if (siteId) {
            const [own] = await this.listBlogSettings({ site_id: siteId }, { take: 1 });
            if (own)
                return own;
        }
        const [existing] = await this.listBlogSettings({ site_id: null }, { take: 1 });
        if (existing) {
            return existing;
        }
        return this.createBlogSettings({ site_id: null });
    }
    /**
     * Guarda la configuración de UNA tienda, creando su fila si no existe.
     *
     * Parte del valor EFECTIVO, no de los defaults: el operador abre la pantalla, ve el
     * heredado, cambia un campo y espera que el resto quede como lo veía.
     */
    async upsertSettingsForSite(siteId, values) {
        const current = (await this.getSettings(siteId));
        if ((current.site_id ?? null) === siteId) {
            return this.updateBlogSettings({ id: current.id, ...values });
        }
        const { id: _ignored, ...inherited } = current;
        return this.createBlogSettings({ ...inherited, site_id: siteId, ...values });
    }
    /** Upserts the singleton settings row. */
    async updateSettings(data) {
        const current = await this.getSettings();
        return this.updateBlogSettings({ id: current.id, ...data });
    }
}
exports.default = BlogModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2Jsb2cvc2VydmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHFEQUEwRDtBQUMxRCxxQ0FLa0I7QUFlbEIsTUFBTSxpQkFBa0IsU0FBUSxJQUFBLHFCQUFhLEVBQUM7SUFDNUMsUUFBUSxFQUFSLGlCQUFRO0lBQ1IsWUFBWSxFQUFaLHFCQUFZO0lBQ1osZUFBZSxFQUFmLHdCQUFlO0lBQ2YsWUFBWSxFQUFaLHFCQUFZO0NBQ2IsQ0FBQztJQUNBLDBFQUEwRTtJQUMxRSxZQUFZLENBQUMsS0FBYTtRQUN4QixNQUFNLElBQUksR0FBRyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7YUFDdkIsV0FBVyxFQUFFO2FBQ2IsU0FBUyxDQUFDLEtBQUssQ0FBQztZQUNqQixvREFBb0Q7YUFDbkQsT0FBTyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUM7YUFDckIsT0FBTyxDQUFDLGFBQWEsRUFBRSxHQUFHLENBQUM7YUFDM0IsT0FBTyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUM7YUFDdkIsS0FBSyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNoQixPQUFPLElBQUksSUFBSSxNQUFNLENBQUM7SUFDeEIsQ0FBQztJQUVELDZEQUE2RDtJQUM3RCxLQUFLLENBQUMsb0JBQW9CLENBQUMsSUFBWSxFQUFFLFNBQWtCO1FBQ3pELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDM0MsSUFBSSxTQUFTLEdBQUcsVUFBVSxDQUFDO1FBQzNCLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQztRQUNmLFNBQVMsQ0FBQztZQUNSLE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQy9ELE1BQU0sS0FBSyxH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