import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { MedusaError } from '@medusajs/framework/utils';
import { assertRowInSite, resolveSite, siteFromRequest } from '../../../../../lib/multistore';
import { NEWSLETTER_MODULE } from '../../../../../modules/newsletter';
import type NewsletterModuleService from '../../../../../modules/newsletter/service';
import { NEWSLETTER_SUBSCRIPTION_SITE_SCOPE } from '../../../../../modules/newsletter/site-scope';
import { syncSubscription } from '../../../../../modules/newsletter/sync';

type SubscriptionRow = { id: string; email: string; site_id: string | null };

/**
 * POST /admin/newsletter-subscriptions/:id/retry — reintenta la sincronización.
 *
 * ─── LA TIENDA SALE DE LA FILA, NO DE LA PANTALLA ───────────────────────────
 *
 * Es el detalle que hace esto correcto y no sólo funcional. El operador puede
 * estar parado en "Todas las tiendas", y ahí la resolución del REQUEST no apunta
 * a ninguna: usarla resolvería las credenciales de la INSTANCIA y mandaría el
 * contacto a la cuenta de Brevo equivocada — el mismo cruce entre clientes que
 * `scope: 'site'` existe para impedir, entrando por la puerta de atrás.
 *
 * La tienda de una suscripción es un hecho de la fila. `assertRowInSite` es una
 * pregunta distinta y sigue haciendo falta: si este operador PUEDE tocarla.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const id = req.params.id;
  const service: NewsletterModuleService = req.scope.resolve(NEWSLETTER_MODULE);

  const [subscription] = (await service.listNewsletterSubscriptions(
    { id },
    { take: 1 },
  )) as SubscriptionRow[];

  /**
   * Los dos 404 son el MISMO 404 a propósito: no existe y "es de otra tienda"
   * tienen que ser indistinguibles desde afuera, porque un 403 en el segundo caso
   * confirmaría que el id existe y eso ya filtra existencia entre tiendas.
   *
   * El chequeo explícito no es sólo para el tipo: `assertRowInSite` se va sin
   * hacer nada cuando no hay a qué filtrar (proyecto sin multitienda), así que sin
   * esta línea un id inventado llegaría como `undefined` al `syncSubscription`.
   */
  if (!subscription) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontrado.');
  }
  assertRowInSite(subscription, await siteFromRequest(req), NEWSLETTER_SUBSCRIPTION_SITE_SCOPE);

  const resolution = await resolveSite(req.scope, {
    siteId: subscription.site_id,
    allowMainFallback: false,
  });

  const outcome = await syncSubscription(
    req.scope,
    { id: subscription.id, email: subscription.email },
    resolution,
  );

  return res.json({ newsletter_subscription: { id: subscription.id, ...outcome } });
}
