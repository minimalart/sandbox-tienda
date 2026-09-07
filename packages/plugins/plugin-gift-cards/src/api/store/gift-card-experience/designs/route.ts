import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { siteFromPublishableKey } from '../../../../lib/multistore/publishable-key';
import { siteColumnFilter } from '../../../../lib/multistore/scope';
import { GIFT_CARD_EXPERIENCE_MODULE } from '../../../../modules/gift-card-experience';
import type GiftCardExperienceModuleService from '../../../../modules/gift-card-experience/service';
import { GIFT_CARD_DESIGN_SITE_SCOPE } from '../../../../modules/gift-card-experience/site-scope';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<GiftCardExperienceModuleService>(GIFT_CARD_EXPERIENCE_MODULE);
  /**
   * La tienda sale de la publishable key: acá no hay header `x-site-id` —eso es del
   * admin— y el storefront no manda ninguno. Si la key no trae canal, se usa la
   * configuración global, que es lo de siempre.
   *
   * Importa porque `settings` gobierna el texto legal, los horarios de entrega y el
   * diseño por defecto: mostrarle al comprador los de otra tienda es un problema
   * legal, no cosmético.
   */
  const resolution = await siteFromPublishableKey(req);
  const settings = await service.getSettings(
    resolution.status === 'site' ? resolution.site.id : null,
  );
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
  const designs = await service.listActiveDesigns(
    siteColumnFilter(resolution, GIFT_CARD_DESIGN_SITE_SCOPE),
  );
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
