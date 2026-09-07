"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const publishable_key_1 = require("../../../../lib/multistore/publishable-key");
const scope_1 = require("../../../../lib/multistore/scope");
const gift_card_experience_1 = require("../../../../modules/gift-card-experience");
const site_scope_1 = require("../../../../modules/gift-card-experience/site-scope");
async function GET(req, res) {
    const service = req.scope.resolve(gift_card_experience_1.GIFT_CARD_EXPERIENCE_MODULE);
    /**
     * La tienda sale de la publishable key: acá no hay header `x-site-id` —eso es del
     * admin— y el storefront no manda ninguno. Si la key no trae canal, se usa la
     * configuración global, que es lo de siempre.
     *
     * Importa porque `settings` gobierna el texto legal, los horarios de entrega y el
     * diseño por defecto: mostrarle al comprador los de otra tienda es un problema
     * legal, no cosmético.
     */
    const resolution = await (0, publishable_key_1.siteFromPublishableKey)(req);
    const settings = await service.getSettings(resolution.status === 'site' ? resolution.site.id : null);
    /**
     * Los DISEÑOS también, que era la mitad que faltaba: la tienda ya se resolvía dos
     * líneas más arriba para `settings` y el listado la ignoraba, así que el comprador
     * elegía entre las tarjetas de TODAS las tiendas. Es la imagen que le llega por mail
     * a quien recibe el regalo, con la marca de otro negocio encima.
     *
     * Y no era sólo estético: el `public_id` que elige acá viaja al checkout, y
     * `createGiftCardIntentsForOrder` lo resuelve con `resolveDesign` sin mirar tienda,
     * así que el diseño ajeno quedaba SNAPSHOTEADO en `gift_card_delivery` para siempre.
     *
     * `empty: 'all'` deja pasar los globales —incluido el `brand-default` que siembra
     * `ensureDefaultDesign`—, así que ninguna tienda se queda sin nada para ofrecer.
     */
    const designs = await service.listActiveDesigns((0, scope_1.siteColumnFilter)(resolution, site_scope_1.GIFT_CARD_DESIGN_SITE_SCOPE));
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({
        designs: designs.map((design) => ({
            id: design.public_id,
            name: design.name,
            occasion: design.occasion,
            desktop_image_url: design.desktop_image_url,
            mobile_image_url: design.mobile_image_url,
            text_color: design.text_color,
            content_position: design.content_position,
        })),
        settings: {
            timezone: settings.timezone,
            schedule_horizon_days: settings.schedule_horizon_days,
            windows: {
                morning: settings.morning_time,
                afternoon: settings.afternoon_time,
                evening: settings.evening_time,
            },
        },
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi9zcmMvYXBpL3N0b3JlL2dpZnQtY2FyZC1leHBlcmllbmNlL2Rlc2lnbnMvcm91dGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFPQSxrQkFvREM7QUExREQsZ0ZBQW9GO0FBQ3BGLDREQUFvRTtBQUNwRSxtRkFBdUY7QUFFdkYsb0ZBQWtHO0FBRTNGLEtBQUssVUFBVSxHQUFHLENBQUMsR0FBa0IsRUFBRSxHQUFtQjtJQUMvRCxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBa0Msa0RBQTJCLENBQUMsQ0FBQztJQUNoRzs7Ozs7Ozs7T0FRRztJQUNILE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBQSx3Q0FBc0IsRUFBQyxHQUFHLENBQUMsQ0FBQztJQUNyRCxNQUFNLFFBQVEsR0FBRyxNQUFNLE9BQU8sQ0FBQyxXQUFXLENBQ3hDLFVBQVUsQ0FBQyxNQUFNLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUN6RCxDQUFDO0lBQ0Y7Ozs7Ozs7Ozs7OztPQVlHO0lBQ0gsTUFBTSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUMsaUJBQWlCLENBQzdDLElBQUEsd0JBQWdCLEVBQUMsVUFBVSxFQUFFLHdDQUEyQixDQUFDLENBQzFELENBQUM7SUFDRixHQUFHLENBQUMsU0FBUyxDQUFDLGVBQWUsRUFBRSxnREFBZ0QsQ0FBQyxDQUFDO0lBQ2pGLEdBQUcsQ0FBQyxJQUFJLENBQUM7UUFDUCxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNoQyxFQUFFLEVBQUUsTUFBTSxDQUFDLFNBQVM7WUFDcEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJO1lBQ2pCLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtZQUN6QixpQkFBaUIsRUFBRSxNQUFNLENBQUMsaUJBQWlCO1lBQzNDLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxnQkFBZ0I7WUFDekMsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVO1lBQzdCLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxnQkFBZ0I7U0FDMUMsQ0FBQyxDQUFDO1FBQ0gsUUFBUSxFQUFFO1lBQ1IsUUFBUSxFQUFFLFFBQVEsQ0FBQyxRQUFRO1lBQzNCLHFCQUFxQixFQUFFLFFBQVEsQ0FBQyxxQkFBcUI7WUFDckQsT0FBTyxFQUFFO2dCQUNQLE9BQU8sRUFBRSxRQUFRLENBQUMsWUFBWTtnQkFDOUIsU0FBUyxFQUFFLFFBQVEsQ0FBQyxjQUFjO2dCQUNsQyxPQUFPLEVBQUUsUUFBUSxDQUFDLFlBQVk7YUFDL0I7U0FDRjtLQUNGLENBQUMsQ0FBQztBQUNMLENBQUMifQ==