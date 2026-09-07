"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogadorConfigSchema = void 0;
exports.GET = GET;
exports.POST = POST;
const zod_1 = require("zod");
const config_1 = require("../../../../modules/catalogador/config");
const _shared_1 = require("../_shared");
/**
 * Rangos de `image_technical`, en el ÚNICO lugar que puede hacerlos cumplir.
 *
 * Los clamps de `ai/images.ts` corren al CONSUMIR, no al escribir, así que hasta
 * ahora la UI podía mostrar `webp_quality: 10` mientras sharp usaba 40 — y un
 * `<Input type="number">` vacío persistía `max_dimension: 0`, que hace explotar
 * `sharp.resize({ width: 0 })` y termina como un warning por imagen, en silencio.
 * Rechazar acá con un 400 es lo honesto: el operador ve qué campo está mal en vez
 * de que se le corrija a la espalda.
 */
const IMAGE_TECHNICAL_BOUNDS = {
    // Mismo rango que el clamp de `optimizeToWebp`/`normalizeSquareWebp`.
    webp_quality: { min: 40, max: 95, int: true },
    // 0 haría que el loop de compresión corra siempre hasta el piso de calidad.
    max_kb: { min: 1, max: 20000, int: true },
    // 0 rompe sharp. El techo es holgado a propósito: acota el disparate, no el uso.
    max_dimension: { min: 16, max: 8000, int: true },
    // 0 es válido y significa "no exigir resolución mínima".
    min_dimension: { min: 0, max: 8000, int: true },
};
/**
 * Body de `POST /admin/catalogador/config`.
 *
 * Deliberadamente un `record` con `superRefine` y NO un `z.object({...})`: un
 * schema de objeto DESCARTA las claves que no modela, así que uno incompleto
 * borraría secciones enteras de la config en cada guardado (la UI manda el objeto
 * completo). Esta forma valida lo que importa sin poder perder nada.
 */
exports.CatalogadorConfigSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).superRefine((value, ctx) => {
    const section = value.image_technical;
    if (section === undefined || section === null)
        return;
    if (typeof section !== 'object' || Array.isArray(section)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['image_technical'],
            message: 'image_technical debe ser un objeto.',
        });
        return;
    }
    for (const [field, bounds] of Object.entries(IMAGE_TECHNICAL_BOUNDS)) {
        const raw = section[field];
        if (raw === undefined || raw === null)
            continue;
        const path = ['image_technical', field];
        if (typeof raw !== 'number' || !Number.isFinite(raw)) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path, message: `${field} debe ser un número.` });
            continue;
        }
        if (bounds.int && !Number.isInteger(raw)) {
            ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path, message: `${field} debe ser un entero.` });
            continue;
        }
        if (raw < bounds.min || raw > bounds.max) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path,
                message: `${field} debe estar entre ${bounds.min} y ${bounds.max} (recibido ${raw}).`,
            });
        }
    }
    const keepOriginals = section.keep_originals;
    if (keepOriginals !== undefined && keepOriginals !== null && typeof keepOriginals !== 'boolean') {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['image_technical', 'keep_originals'],
            message: 'keep_originals debe ser un booleano.',
        });
    }
});
/** GET /admin/catalogador/config — config efectiva (sin secretos). */
async function GET(req, res) {
    const config = await (0, config_1.getCatalogadorConfig)(req.scope, await (0, _shared_1.siteOf)(req));
    res.status(200).json({ config });
}
/**
 * POST /admin/catalogador/config — persiste config (merge parcial). Los secretos
 * (API keys de barcode/scraping) NO se aceptan acá: viven en env (PRD §22.4).
 */
async function POST(req, res) {
    // `validatedBody` y NO `req.body`: hasta ahora esta ruta era la única del
    // Catalogador sin middleware de validación, y persistía cualquier número.
    const patch = (req.validatedBody ?? {});
    const config = await (0, config_1.upsertCatalogadorConfig)(req.scope, patch, await (0, _shared_1.siteOf)(req));
    res.status(200).json({ config });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NhdGFsb2dhZG9yL2NvbmZpZy9yb3V0ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFtRkEsa0JBR0M7QUFNRCxvQkFNQztBQWpHRCw2QkFBd0I7QUFDeEIsbUVBSWdEO0FBRWhELHdDQUFvQztBQUVwQzs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFNLHNCQUFzQixHQUFHO0lBQzdCLHNFQUFzRTtJQUN0RSxZQUFZLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRTtJQUM3Qyw0RUFBNEU7SUFDNUUsTUFBTSxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUU7SUFDekMsaUZBQWlGO0lBQ2pGLGFBQWEsRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFO0lBQ2hELHlEQUF5RDtJQUN6RCxhQUFhLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRTtDQUN2QyxDQUFDO0FBRVg7Ozs7Ozs7R0FPRztBQUNVLFFBQUEsdUJBQXVCLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxFQUFFO0lBQ2xHLE1BQU0sT0FBTyxHQUFJLEtBQWlDLENBQUMsZUFBZSxDQUFDO0lBQ25FLElBQUksT0FBTyxLQUFLLFNBQVMsSUFBSSxPQUFPLEtBQUssSUFBSTtRQUFFLE9BQU87SUFDdEQsSUFB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