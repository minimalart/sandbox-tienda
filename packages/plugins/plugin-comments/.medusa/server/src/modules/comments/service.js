"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
const models_1 = require("./models");
class CommentsModuleService extends (0, utils_1.MedusaService)({
    Comment: models_1.Comment,
    CommentSettings: models_1.CommentSettings,
}) {
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
            const [own] = await this.listCommentSettings({ site_id: siteId }, { take: 1 });
            if (own)
                return own;
        }
        const [existing] = await this.listCommentSettings({ site_id: null }, { take: 1 });
        if (existing) {
            return existing;
        }
        return this.createCommentSettings({ site_id: null });
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
            return this.updateCommentSettings({ id: current.id, ...values });
        }
        const { id: _ignored, ...inherited } = current;
        return this.createCommentSettings({ ...inherited, site_id: siteId, ...values });
    }
    /** Upserts the singleton settings row. */
    async updateSettings(data) {
        const current = await this.getSettings();
        return this.updateCommentSettings({ id: current.id, ...data });
    }
    /**
     * Validates an incoming comment against the global settings: review_mode
     * (rating and/or content required), rating range, content length, rate limit
     * and flood control. Throws a MedusaError on the first violation.
     */
    async validateForCreate(input, settings) {
        const mode = settings.review_mode;
        const hasRating = input.rating !== undefined && input.rating !== null;
        const content = (input.content ?? '').trim();
        const hasContent = content.length > 0;
        // review_mode gating
        if (mode === 'rating' && !hasRating) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, 'Se requiere un puntaje.');
        }
        if (mode === 'comment' && !hasContent) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, 'Se requiere un comentario.');
        }
        if (mode === 'both' && (!hasRating || !hasContent)) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, 'Se requiere puntaje y comentario.');
        }
        // rating range (only when a rating is provided / expected)
        if (hasRating) {
            const r = input.rating;
            if (!Number.isInteger(r) || r < 1 || r > settings.rating_scale) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `El puntaje debe ser un entero entre 1 y ${settings.rating_scale}.`);
            }
        }
        // content length (only when content is present)
        if (hasContent) {
            if (content.length < settings.min_length) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `El comentario debe tener al menos ${settings.min_length} caracteres.`);
            }
            if (content.length > settings.max_length) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.INVALID_DATA, `El comentario no puede superar los ${settings.max_length} caracteres.`);
            }
        }
        // rate limit: N comments per minute per customer
        const since = new Date(Date.now() - 60_000);
        const recent = await this.listComments({ customer_id: input.customer_id, created_at: { $gte: since } }, { take: settings.rate_limit_per_minute + 1 });
        if (recent.length >= settings.rate_limit_per_minute) {
            throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'Estás comentando demasiado rápido. Esperá un momento.');
        }
        // flood control: no identical content consecutively from the same customer
        if (hasContent) {
            const [last] = await this.listComments({ customer_id: input.customer_id }, { take: 1, order: { created_at: 'DESC' } });
            if (last && (last.content ?? '').trim() === content) {
                throw new utils_1.MedusaError(utils_1.MedusaError.Types.NOT_ALLOWED, 'No se permiten comentarios idénticos consecutivos.');
            }
        }
    }
    /**
     * Creates a comment applying moderation policy: 'auto' publishes immediately
     * (status=approved, published_at=now), 'manual' leaves it pending.
     */
    async createCommentModerated(input, settings) {
        const auto = settings.moderation === 'auto';
        const content = input.content?.trim() ? input.content.trim() : null;
        return this.createComments({
            commentable_type: input.commentable_type,
            commentable_id: input.commentable_id,
            parent_id: input.parent_id ?? null,
            customer_id: input.customer_id,
            author_name: input.author_name ?? null,
            rating: input.rating ?? null,
            content,
            verified_buyer: input.verified_buyer ?? false,
            status: auto ? 'approved' : 'pending',
            published_at: auto ? new Date() : null,
            site_id: input.site_id ?? null,
        });
    }
    async approve(id) {
        return this.updateComments({
            id,
            status: 'approved',
            published_at: new Date(),
        });
    }
    async hide(id) {
        return this.updateComments({ id, status: 'hidden' });
    }
    /** Soft-delete: keeps the row so replies can still render a tombstone. */
    async softDelete(id) {
        return this.updateComments({ id, status: 'deleted' });
    }
    /**
     * Approved-comment aggregate for an entity: average rating (rounded to 1
     * decimal) and the count of approved top-level comments.
     */
    async getAggregate(type, id) {
        const approved = await this.listComments({ commentable_type: type, commentable_id: id, status: 'approved' }, { take: 10_000 });
        const ratings = approved
            .map((c) => c.rating)
            .filter((r) => typeof r === 'number');
        const average = ratings.length > 0
            ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) /
                10
            : null;
        return {
            total: approved.length,
            rating_count: ratings.length,
            average_rating: average,
        };
    }
}
exports.default = CommentsModuleService;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmljZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9tb2R1bGVzL2NvbW1lbnRzL3NlcnZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxxREFBdUU7QUFDdkUscUNBQW9EO0FBaUNwRCxNQUFNLHFCQUFzQixTQUFRLElBQUEscUJBQWEsRUFBQztJQUNoRCxPQUFPLEVBQVAsZ0JBQU87SUFDUCxlQUFlLEVBQWYsd0JBQWU7Q0FDaEIsQ0FBQztJQUNBLDZFQUE2RTtJQUM3RTs7Ozs7O09BTUc7SUFDSCxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQXNCO1FBQ3RDLElBQUksTUFBTSxFQUFFLENBQUM7WUFDWCxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQUMsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUMvRSxJQUFJLEdBQUc7Z0JBQUUsT0FBTyxHQUFHLENBQUM7UUFDdEIsQ0FBQztRQUNELE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ2xGLElBQUksUUFBUSxFQUFFLENBQUM7WUFDYixPQUFPLFFBQVEsQ0FBQztRQUNsQixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMscUJBQXFCLENBQUMsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxLQUFLLENBQUMscUJBQXFCLENBQUMsTUFBcUIsRUFBRSxNQUErQjtRQUNoRixNQUFNLE9BQU8sR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBdUMsQ0FBQztRQUN2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