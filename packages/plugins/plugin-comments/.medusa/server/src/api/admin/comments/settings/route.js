"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const comments_1 = require("../../../../modules/comments");
const request_1 = require("../../../../lib/multistore/request");
/** `null` = la fila GLOBAL, el fallback de toda tienda sin config propia. */
const siteOf = async (req) => {
    const resolution = await (0, request_1.siteFromRequest)(req);
    return resolution.status === 'site' ? resolution.site.id : null;
};
// GET /admin/comments/settings — read the global config.
async function GET(req, res) {
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    const settings = await service.getSettings(await siteOf(req));
    res.status(200).json({ settings });
}
// POST /admin/comments/settings — update the global config.
async function POST(req, res) {
    const service = req.scope.resolve(comments_1.COMMENTS_MODULE);
    /**
     * `upsertSettingsForSite` y no `updateSettings`: si la tienda no tiene fila propia,
     * el GET devuelve la GLOBAL, y actualizar esa fila por su id escribiría la
     * configuración de la instancia entera creyendo editar una sola tienda.
     */
    const settings = await service.upsertSettingsForSite(await siteOf(req), req.validatedBody);
    res.status(200).json({ settings });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL2FkbWluL2NvbW1lbnRzL3NldHRpbmdzL3JvdXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBZUEsa0JBT0M7QUFHRCxvQkFZQztBQXBDRCwyREFBK0Q7QUFJL0QsZ0VBQXFFO0FBR3JFLDZFQUE2RTtBQUM3RSxNQUFNLE1BQU0sR0FBRyxLQUFLLEVBQUUsR0FBa0IsRUFBMEIsRUFBRTtJQUNsRSxNQUFNLFVBQVUsR0FBRyxNQUFNLElBQUEseUJBQWUsRUFBQyxHQUFHLENBQUMsQ0FBQztJQUM5QyxPQUFPLFVBQVUsQ0FBQyxNQUFNLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO0FBQ2xFLENBQUMsQ0FBQztBQUVGLHlEQUF5RDtBQUNsRCxLQUFLLFVBQVUsR0FBRyxDQUN2QixHQUFrQixFQUNsQixHQUFtQjtJQUVuQixNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBd0IsMEJBQWUsQ0FBQyxDQUFDO0lBQzFFLE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLFdBQVcsQ0FBQyxNQUFNLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzlELEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztBQUNyQyxDQUFDO0FBRUQsNERBQTREO0FBQ3JELEtBQUssVUFBVSxJQUFJLENBQ3hCLEdBQWtELEVBQ2xELEdBQW1CO0lBRW5CLE1BQU0sT0FBTyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUF3QiwwQkFBZSxDQUFDLENBQUM7SUFDMUU7Ozs7T0FJRztJQUNILE1BQU0sUUFBUSxHQUFHLE1BQU0sT0FBTyxDQUFDLHFCQUFxQixDQUFDLE1BQU0sTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxhQUF3QyxDQUFDLENBQUM7SUFDdEgsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO0FBQ3JDLENBQUMifQ==