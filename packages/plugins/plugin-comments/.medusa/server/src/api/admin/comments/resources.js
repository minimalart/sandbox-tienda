"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resourceKey = void 0;
exports.loadCommentResources = loadCommentResources;
const utils_1 = require("@medusajs/framework/utils");
const isLocal = (u) => /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(u);
const isNonStorefront = (u) => /medusajs\.com/i.test(u);
/**
 * Base pública del storefront, resuelta en runtime con la misma lógica que
 * `GET /admin/store-config/storefront-url` (STOREFRONT_URL explícita, si no el
 * primer origin público de STORE_CORS). Se duplica a propósito para que la
 * extensión no dependa de otra: son ~10 líneas de env.
 */
function resolveStorefrontBase() {
    const origins = (process.env.STORE_CORS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const publicOrigins = origins.filter((o) => !isLocal(o) && !isNonStorefront(o));
    const fromCors = publicOrigins.find((o) => o.startsWith('https://')) ||
        publicOrigins[0] ||
        origins[0];
    return (process.env.STOREFRONT_URL?.trim() ||
        fromCors ||
        'http://localhost:3000').replace(/\/+$/, '');
}
/**
 * `query.graph` tolerante: si el módulo dueño de la entidad no está instalado
 * (ej. una tienda con `comments` pero sin la extensión de blog) el grafo tira, y
 * eso no debe romper el listado de moderación — se degrada a "sin resumen".
 */
async function safeGraph(query, input) {
    try {
        const { data } = await query.graph(input);
        return (data ?? []);
    }
    catch {
        return [];
    }
}
const uniq = (values) => [...new Set(values.filter(Boolean))];
/** Clave del mapa: el par polimórfico completo. */
const resourceKey = (type, id) => `${type}:${id}`;
exports.resourceKey = resourceKey;
/**
 * Trae los resúmenes de los recursos comentados, indexados por
 * `${commentable_type}:${commentable_id}`. Una query por tipo presente.
 */
async function loadCommentResources(container, targets) {
    const out = new Map();
    if (!targets.length)
        return out;
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const base = resolveStorefrontBase();
    const productIds = uniq(targets
        .filter((t) => t.commentable_type === 'product')
        .map((t) => t.commentable_id));
    const postIds = uniq(targets
        .filter((t) => t.commentable_type === 'blog_post')
        .map((t) => t.commentable_id));
    if (productIds.length) {
        const products = await safeGraph(query, {
            entity: 'product',
            // Sin filtro de status: el moderador tiene que poder ver que el comentario
            // es de un producto que quedó en borrador.
            fields: ['id', 'title', 'handle', 'thumbnail', 'status'],
            filters: { id: productIds },
        });
        for (const p of products) {
            if (!p?.id)
                continue;
            out.set((0, exports.resourceKey)('product', p.id), {
                type: 'product',
                id: p.id,
                title: p.title ?? null,
                handle: p.handle ?? null,
                thumbnail: p.thumbnail ?? null,
                status: p.status ?? null,
                admin_path: `/products/${p.id}`,
                // El ancla es el bloque de opiniones del PDP; si cambiara, el link sigue
                // siendo válido (solo no scrollea). La URL va sin countryCode: el proxy
                // del storefront reescribe las URLs limpias.
                storefront_url: p.handle
                    ? `${base}/products/${p.handle}#comments-heading`
                    : null,
            });
        }
    }
    if (postIds.length) {
        const posts = await safeGraph(query, {
            entity: 'blog_post',
            fields: ['id', 'title', 'slug', 'status'],
            filters: { id: postIds },
        });
        for (const post of posts) {
            if (!post?.id)
                continue;
            out.set((0, exports.resourceKey)('blog_post', post.id), {
                type: 'blog_post',
                id: post.id,
                title: post.title ?? null,
                handle: post.slug ?? null,
                thumbnail: null,
                status: post.status ?? null,
                admin_path: `/blog/articles/${post.id}`,
                storefront_url: post.slug ? `${base}/blog/${post.slug}` : null,
            });
        }
    }
    return out;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzb3VyY2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2FwaS9hZG1pbi9jb21tZW50cy9yZXNvdXJjZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBc0ZBLG9EQW9GQztBQTFLRCxxREFBc0U7QUE4QnRFLE1BQU0sT0FBTyxHQUFHLENBQUMsQ0FBUyxFQUFXLEVBQUUsQ0FDckMsa0RBQWtELENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBRTdELE1BQU0sZUFBZSxHQUFHLENBQUMsQ0FBUyxFQUFXLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFFekU7Ozs7O0dBS0c7QUFDSCxTQUFTLHFCQUFxQjtJQUM1QixNQUFNLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQztTQUMzQyxLQUFLLENBQUMsR0FBRyxDQUFDO1NBQ1YsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDcEIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ25CLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDaEYsTUFBTSxRQUFRLEdBQ1osYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNuRCxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBQ2hCLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUViLE9BQU8sQ0FDTCxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWMsRUFBRSxJQUFJLEVB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