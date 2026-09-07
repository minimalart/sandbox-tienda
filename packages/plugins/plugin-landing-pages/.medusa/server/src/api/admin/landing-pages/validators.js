"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostAdminUpdateLandingPage = exports.PostAdminCreateLandingPage = void 0;
const zod_1 = require("zod");
const puck_schema_1 = require("../../../modules/landing-page/ai/puck-schema");
const seoSchema = zod_1.z.object({
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    image: zod_1.z.string().optional(),
    noindex: zod_1.z.boolean().optional(),
});
// Puck's native document. Kept permissive (passthrough) so editor upgrades that
// add fields don't break persistence — the renderer maps known components only.
const puckDataSchema = zod_1.z
    .object({
    content: zod_1.z.array(zod_1.z.any()).optional(),
    root: zod_1.z.object({ props: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional() }).passthrough().optional(),
    zones: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
})
    .passthrough()
    // Endurecido: descarta componentes/props no permitidos y sanitiza strings,
    // sin romper landings existentes (sanitizePuckData nunca falla; normaliza y
    // preserva el id de Puck por bloque).
    .transform((val) => (0, puck_schema_1.sanitizePuckData)(val));
const statusSchema = zod_1.z.enum(['draft', 'published', 'archived']);
// URL-safe slug: lowercase words separated by single hyphens.
const slugSchema = zod_1.z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be URL-safe (a-z, 0-9, hyphens)');
exports.PostAdminCreateLandingPage = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required').trim(),
    slug: slugSchema.optional(),
    status: statusSchema.optional(),
    description: zod_1.z.string().optional().nullable(),
    seo: seoSchema.optional().nullable(),
    puck_data: puckDataSchema.optional().nullable(),
    template: zod_1.z.string().optional().nullable(),
    locale: zod_1.z.string().optional().nullable(),
    sales_channel_id: zod_1.z.string().optional().nullable(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional().nullable(),
});
exports.PostAdminUpdateLandingPage = zod_1.z.object({
    title: zod_1.z.string().min(1).trim().optional(),
    slug: slugSchema.optional(),
    status: statusSchema.optional(),
    description: zod_1.z.string().optional().nullable(),
    seo: seoSchema.optional().nullable(),
    puck_data: puckDataSchema.optional().nullable(),
    template: zod_1.z.string().optional().nullable(),
    locale: zod_1.z.string().optional().nullable(),
    sales_channel_id: zod_1.z.string().optional().nullable(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional().nullable(),
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmFsaWRhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL3NyYy9hcGkvYWRtaW4vbGFuZGluZy1wYWdlcy92YWxpZGF0b3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZCQUF3QjtBQUN4Qiw4RUFBZ0Y7QUFFaEYsTUFBTSxTQUFTLEdBQUcsT0FBQyxDQUFDLE1BQU0sQ0FBQztJQUN6QixLQUFLLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM1QixXQUFXLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUNsQyxLQUFLLEVBQUUsT0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLFFBQVEsRUFBRTtJQUM1QixPQUFPLEVBQUUsT0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRTtDQUNoQyxDQUFDLENBQUM7QUFFSCxnRkFBZ0Y7QUFDaEYsZ0ZBQWdGO0FBQ2hGLE1BQU0sY0FBYyxHQUFHLE9BQUM7S0FDckIsTUFBTSxDQUFDO0lBQ04sT0FBTyxFQUFFLE9BQUMsQ0FBQyxLQUFLLENBQUMsT0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsUUFBUSxFQUFFO0lBQ3BDLElBQUksRUFBRSxPQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsS0FBSyxFQUFFLE9BQUMsQ0FBQyxNQUFNLENBQUMsT0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLE9BQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLEVBQUU7SUFDNUYsS0FBSyxFQUFFLE9BQUMsQ0FBQyxNQUFNLENBQUMsT0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLE9BQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLFFBQVEsRUFBRTtDQUNoRCxDQUFDO0tBQ0QsV0FBVyxFQUFFO0lBQ2QsMkVBQTJFO0lBQzNF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