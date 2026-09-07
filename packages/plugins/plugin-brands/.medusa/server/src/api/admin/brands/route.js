"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBrandSchema = void 0;
exports.POST = POST;
exports.GET = GET;
const zod_1 = require("zod");
const brand_1 = require("../../../modules/brand");
const create_brand_1 = require("../../../workflows/create-brand");
const request_1 = require("../../../lib/multistore/request");
const scope_1 = require("../../../lib/multistore/scope");
const site_scope_1 = require("../../../modules/brand/site-scope");
exports.CreateBrandSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    handle: zod_1.z.string().min(1, 'Handle is required'),
    description: zod_1.z.string().optional(),
    is_active: zod_1.z.boolean().optional().default(true),
    sales_channel_ids: zod_1.z.array(zod_1.z.string()).nullish(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
async function POST(req, res) {
    const input = req.validatedBody;
    const site = await (0, request_1.siteFromRequest)(req);
    // Con una tienda activa, la marca nace en ESA tienda. Sin esto, crear desde la
    // tienda Norte produce una marca global que aparece en todas, y el creador no
    // tiene forma de notarlo.
    //
    // El default se aplica sólo si el cuerpo NO trae la clave: mandar `null` explícito
    // sigue significando "global", que es una elección legítima del que llama.
    const defaults = input.sales_channel_ids === undefined
        ? (0, scope_1.siteDefaults)(site, site_scope_1.BRAND_SITE_SCOPE)
        : {};
    const { result } = await (0, create_brand_1.createBrandWorkflow)(req.scope).run({
        input: { ...input, ...defaults },
    });
    res.status(201).json({ brand: result });
}
async function GET(req, res) {
    const brandService = req.scope.resolve(brand_1.BRAND_MODULE);
    const site = await (0, request_1.siteFromRequest)(req);
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    // MedusaService filters pass through to MikroORM, which supports $or/$ilike.
    const filters = {};
    if (q) {
        filters.$or = [
            { name: { $ilike: `%${q}%` } },
            { handle: { $ilike: `%${q}%` } },
            { description: { $ilike: `%${q}%` } },
        ];
    }
    // Sin tienda activa devuelve `{}` y el listado se comporta igual que antes. El
    // filtro va DENTRO de listAndCount, no sobre el resultado: filtrar en memoria
    // —como hace el lado store— daría un `count` que no coincide con lo paginado.
    Object.assign(filters, await (0, scope_1.siteFilter)(req.scope, site, site_scope_1.BRAND_SITE_SCOPE));
    const [brands, count] = await brandService.listAndCountBrands(filters, {
        skip: offset,
        take: limit,
        order: { name: 'ASC' },
    });
    res.status(200).json({ brands, count, offset, limit });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2JyYW5kcy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFvQkEsb0JBc0JDO0FBRUQsa0JBOEJDO0FBekVELDZCQUF3QjtBQUN4QixrREFBc0Q7QUFFdEQsa0VBQXNFO0FBQ3RFLDZEQUFrRTtBQUNsRSx5REFBeUU7QUFDekUsa0VBQXFFO0FBRXhELFFBQUEsaUJBQWlCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUN4QyxJQUFJLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsa0JBQWtCLENBQUM7SUFDM0MsTUFBTSxFQUFFLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLG9CQUFvQixDQUFDO0lBQy9DLFdBQVcsRUFBRSxPQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxFQUFFO0lBQ2xDLFNBQVMsRUFBRSxPQUFDLENBQUMsT0FBTyxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztJQUMvQyxpQkFBaUIsRUFBRSxPQUFDLENBQUMsS0FBSyxDQUFDLE9BQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLE9BQU8sRUFBRTtJQUNoRCxRQUFRLEVBQUUsT0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFO0NBQ3ZELENBQUMsQ0FBQztBQUlJLEtBQUssVUFBVSxJQUFJLENBQ3hCLEdBQW9DLEVBQ3BDLEdBQW1CO0lBRW5CLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxhQUFpQyxDQUFDO0lBQ3BELE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRXhDLCtF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