"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectionPreviewSchema = void 0;
exports.POST = POST;
const utils_1 = require("@medusajs/framework/utils");
const zod_1 = require("zod");
const product_scope_1 = require("../../../../../lib/multistore/product-scope");
/**
 * Filtros de selección de productos (Paso 1, PRD §11.2). Sólo trabaja sobre
 * productos EXISTENTES: nunca crea ni importa (PRD §11.3).
 */
exports.SelectionPreviewSchema = zod_1.z.object({
    q: zod_1.z.string().optional(),
    category_id: zod_1.z.string().optional(),
    collection_id: zod_1.z.string().optional(),
    tag_id: zod_1.z.string().optional(),
    status: zod_1.z.enum(['draft', 'proposed', 'published', 'rejected']).optional(),
    /** Productos a los que les falta este campo (best-effort: description/subtitle/title). */
    missing_field: zod_1.z.enum(['description', 'subtitle', 'title']).optional(),
    limit: zod_1.z.number().int().positive().max(100).optional(),
});
const VOLUME_WARN_THRESHOLD = 200;
/** POST /admin/catalogador/selection/preview — resuelve filtros → conteo + muestra. */
async function POST(req, res) {
    const input = req.validatedBody;
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    /**
     * El paso 1 del catalogador ELIGE sobre qué productos van a correr los pasos
     * siguientes, así que su conteo es la promesa de la corrida entera: "voy a tocar
     * estos 340". Sin el eje, ese número —y la muestra— eran los del catálogo de toda
     * la instalación, y `admin/catalogador/executions` filtra: el operador elegía
     * sobre un universo que su pantalla de corridas después no le muestra.
     *
     * `[]` se propaga tal cual y no se ignora: una tienda sin catálogo tiene que ver
     * cero, no todo.
     */
    const allowedProducts = await (0, product_scope_1.productIdsForSite)(req);
    const filters = {};
    if (allowedProducts !== null)
        filters.id = allowedProducts;
    if (input.q)
        filters.title = { $ilike: `%${input.q}%` };
    if (input.status)
        filters.status = input.status;
    if (input.category_id)
        filters.categories = { id: input.category_id };
    if (input.collection_id)
        filters.collection_id = input.collection_id;
    if (input.tag_id)
        filters.tags = { id: input.tag_id };
    const sampleLimit = input.limit ?? 20;
    const { data, metadata } = await query.graph({
        entity: 'product',
        fields: ['id', 'title', 'status', 'thumbnail', 'subtitle', 'description'],
        filters,
        pagination: { skip: 0, take: sampleLimit, order: { title: 'ASC' } },
    });
    let products = data;
    let count = metadata?.count ?? products.length;
    // "Sin campo X" — post-filtro best-effort sobre la muestra (Medusa no filtra
    // por null de forma uniforme). Se marca la limitación al usuario en la UI.
    let approximate = false;
    if (input.missing_field) {
        products = products.filter((p) => {
            const val = p[input.missing_field];
            return val === null || val === undefined || String(val).trim() === '';
        });
        count = products.length;
        approximate = true;
    }
    res.status(200).json({
        count,
        approximate,
        sample: products.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            thumbnail: p.thumbnail ?? null,
        })),
        warning: count > VOLUME_WARN_THRESHOLD ? 'volume_high' : null,
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL3NlbGVjdGlvbi9wcmV2aWV3L3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQXlCQSxvQkE4REM7QUF0RkQscURBQXNFO0FBQ3RFLDZCQUF3QjtBQUN4QiwrRUFBZ0Y7QUFFaEY7OztHQUdHO0FBQ1UsUUFBQSxzQkFBc0IsR0FBRyxPQUFDLENBQUMsTUFBTSxDQUFDO0lBQzdDLENBQUMsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3hCLFdBQVcsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2xDLGFBQWEsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ3BDLE1BQU0sRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQzdCLE1BQU0sRUFBRSxPQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUU7SUFDekUsMEZBQTBGO0lBQzFGLGFBQWEsRUFBRSxPQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsYUFBYSxFQUFFLFVBQVUsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRTtJQUN0RSxLQUFLLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUU7Q0FDdkQsQ0FBQyxDQUFDO0FBSUgsTUFBTSxxQkFBcUIsR0FBRyxHQUFHLENBQUM7QUFFbEMsdUZBQXVGO0FBQ2hGLEtBQUssVUFBVSxJQUFJLENBQ3hCLEdBQXlDLEVBQ3pDLEdBQW1CO0lBRW5CLE1B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