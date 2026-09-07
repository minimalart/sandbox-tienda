"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeName = normalizeName;
exports.loadTaxonomy = loadTaxonomy;
exports.resolveCategoryIds = resolveCategoryIds;
exports.resolveTagIds = resolveTagIds;
const utils_1 = require("@medusajs/framework/utils");
/** Normaliza acentos/caso para matching robusto (portado del tool original). */
function normalizeName(s) {
    return (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}
/** Carga todas las categorías y tags existentes y arma índices de matching. */
async function loadTaxonomy(container) {
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    // Se leen las categorías PLANAS (id, name, parent_category_id) y el path se
    // arma caminando el árbol en memoria. Se evita el nesting
    // `parent_category.parent_category.name` a propósito: el self-relation de
    // product_category no lo resuelve de forma confiable vía query.graph (el resto
    // del repo también camina por parent_category_id, ver typesense-sync/loader).
    const { data: rawCats } = await query.graph({
        entity: 'product_category',
        fields: ['id', 'name', 'parent_category_id'],
        pagination: { skip: 0, take: 5000 },
    });
    const catNodes = rawCats.map((c) => ({
        id: c.id,
        name: c.name,
        parent: c.parent_category_id ?? null,
    }));
    const byId = new Map(catNodes.map((c) => [c.id, c]));
    const buildPath = (id) => {
        const parts = [];
        let cursor = id;
        const guard = new Set();
        while (cursor && byId.has(cursor) && !guard.has(cursor)) {
            guard.add(cursor);
            const node = byId.get(cursor);
            if (!node)
                break;
            parts.unshift(node.name);
            cursor = node.parent;
        }
        return parts.join(' > ');
    };
    const categories = catNodes.map((c) => ({
        id: c.id,
        name: c.name,
        path: buildPath(c.id),
    }));
    const { data: rawTags } = await query.graph({
        entity: 'product_tag',
        fields: ['id', 'value'],
        pagination: { skip: 0, take: 5000 },
    });
    const tags = rawTags.map((t) => ({
        id: t.id,
        value: t.value,
    }));
    const categoryByNormalizedName = new Map();
    for (const c of categories) {
        categoryByNormalizedName.set(normalizeName(c.name), c);
        categoryByNormalizedName.set(normalizeName(c.path), c);
    }
    const tagByNormalizedValue = new Map();
    for (const t of tags)
        tagByNormalizedValue.set(normalizeName(t.value), t);
    return { categories, tags, categoryByNormalizedName, tagByNormalizedValue };
}
/** Resuelve nombres/paths propuestos por la IA a IDs reales existentes. */
function resolveCategoryIds(taxonomy, proposed) {
    const ids = new Set();
    for (const p of proposed ?? []) {
        const hit = taxonomy.categoryByNormalizedName.get(normalizeName(p));
        if (hit)
            ids.add(hit.id);
    }
    return [...ids];
}
/** Resuelve valores de tag propuestos a IDs existentes (descarta inexistentes). */
function resolveTagIds(taxonomy, proposed) {
    const ids = new Set();
    for (const p of proposed ?? []) {
        const hit = taxonomy.tagByNormalizedValue.get(normalizeName(p));
        if (hit)
            ids.add(hit.id);
    }
    return [...ids];
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGF4b25vbXkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9jYXRhbG9nYWRvci9haS90YXhvbm9teS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQW9CQSxzQ0FNQztBQUdELG9DQTZEQztBQUdELGdEQU9DO0FBR0Qsc0NBT0M7QUE5R0QscURBQXNFO0FBbUJ0RSxnRkFBZ0Y7QUFDaEYsU0FBZ0IsYUFBYSxDQUFDLENBQVM7SUFDckMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDYixTQUFTLENBQUMsS0FBSyxDQUFDO1NBQ2hCLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUM7U0FDL0IsSUFBSSxFQUFFO1NBQ04sV0FBVyxFQUFFLENBQUM7QUFDbkIsQ0FBQztBQUVELCtFQUErRTtBQUN4RSxLQUFLLFVBQVUsWUFBWSxDQUFDLFNBQTBCO0lBQzNELE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxPQUFPLENBQUMsaUNBQXlCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFakUsNEVBQTRFO0lBQzVFLDBEQUEwRDtJQUMxRCwwRUFBMEU7SUFDMUUsK0VBQStFO0lBQy9FLDhFQUE4RTtJQUM5RSxNQUFNLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxHQUFHLE1BQU0sS0FBSyxDQUFDLEtBQUssQ0FBQztRQUMxQyxNQUFNLEVBQUUsa0JBQWtCO1FBQzFCLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsb0JBQW9CLENBQUM7UUFDNUMsVUFBVSxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFO0tBQ3BDLENBQUMsQ0FBQztJQUdILE1BQU0sUUFBUSxHQUFlLE9BQTBDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2xGLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBWTtRQUNsQixJQUFJ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