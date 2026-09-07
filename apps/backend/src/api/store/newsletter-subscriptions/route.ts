import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { z } from 'zod';
import { siteFromPublishableKey } from '../../../lib/multistore';
import { NEWSLETTER_MODULE } from '../../../modules/newsletter';
import type NewsletterModuleService from '../../../modules/newsletter/service';
import { syncSubscription } from '../../../modules/newsletter/sync';

const BodySchema = z.object({
  email: z.string().trim().email().max(200),
  source: z.string().trim().max(60).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

type SubscriptionRow = { id: string; email: string };

/**
 * POST /store/newsletter-subscriptions — alta al newsletter desde el storefront.
 * Requiere publishable key (middleware de store de Medusa).
 *
 * ─── EL ORDEN DE LOS DOS PASOS ES EL PUNTO DE TODO ESTO ─────────────────────
 *
 * Primero se GUARDA la suscripción, después se intenta Brevo. Al revés —que es
 * lo que parece natural— un error de Brevo se lleva puesto el contacto, y el
 * visitante ya cerró la pestaña. Guardando primero, el peor caso es una fila con
 * `sync_status: 'failed'` y el motivo escrito, que se reintenta cuando se quiera.
 *
 * ─── POR QUÉ RESPONDE 201 AUNQUE BREVO FALLE ────────────────────────────────
 *
 * Porque desde donde está parado el visitante, se suscribió: le tenemos el mail
 * y la intención. Devolverle un error lo empujaría a reintentar un alta que ya
 * existe, y el problema —una key vencida, una lista mal cargada— no lo puede
 * resolver él. Lo que SÍ hace la respuesta es decir la verdad en `sync_status`,
 * y esa verdad queda además en la pantalla de Suscriptores del admin. Es la
 * diferencia exacta con el endpoint que esto reemplaza, que devolvía
 * `{ success: true }` sin haber hablado con nadie.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Ingresá un email válido.' });
  }

  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const service: NewsletterModuleService = req.scope.resolve(NEWSLETTER_MODULE);

  /** Brevo trata los mails sin distinguir mayúsculas; el índice único, no. */
  const email = parsed.data.email.toLowerCase();

  /**
   * La tienda sale de la publishable key, igual que en contacto: es lo único
   * confiable en una request de storefront. Y acá NO es sólo una etiqueta —
   * decide contra qué cuenta de Brevo se sincroniza, así que el `allowMainFallback:
   * false` que trae el helper es parte del aislamiento: una key mal configurada
   * NO puede terminar escribiendo en la lista de la tienda principal.
   */
  const resolution = await siteFromPublishableKey(req);
  const site_id = resolution.status === 'site' ? resolution.site.id : null;

  const fwd = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;
  const user_agent = (req.headers['user-agent'] as string) || null;

  const [existing] = (await service.listNewsletterSubscriptions(
    { email, site_id },
    { take: 1 },
  )) as SubscriptionRow[];

  let subscription: SubscriptionRow;
  if (existing) {
    /**
     * Re-suscribirse vuelve a poner la fila en `pending` a propósito: si la vez
     * anterior falló, este intento es una oportunidad legítima de arreglarlo.
     * Conservar el `failed` viejo haría que el segundo intento no se note.
     */
    await service.updateNewsletterSubscriptions({
      id: existing.id,
      sync_status: 'pending',
      sync_error: null,
      source: parsed.data.source ?? 'storefront',
      ip,
      user_agent,
      ...(parsed.data.metadata ? { metadata: parsed.data.metadata } : {}),
    });
    subscription = existing;
  } else {
    const [created] = (await service.createNewsletterSubscriptions([
      {
        email,
        site_id,
        source: parsed.data.source ?? 'storefront',
        sync_status: 'pending',
        ip,
        user_agent,
        metadata: parsed.data.metadata ?? null,
      },
    ])) as SubscriptionRow[];
    if (!created) {
      // No debería pasar nunca, pero devolver 201 sin fila sería volver a la
      // mentira original: éxito para el visitante y nada persistido.
      logger.error(`[Newsletter] createNewsletterSubscriptions no devolvió fila para ${email}`);
      return res.status(500).json({ message: 'No se pudo registrar la suscripción.' });
    }
    subscription = created;
  }

  const outcome = await syncSubscription(req.scope, { id: subscription.id, email }, resolution);

  if (outcome.sync_status !== 'synced') {
    logger.warn(
      `[Newsletter] ${email} quedó en '${outcome.sync_status}': ${outcome.sync_error ?? 'sin detalle'}`,
    );
  }

  return res.status(201).json({
    newsletter_subscription: {
      id: subscription.id,
      email,
      sync_status: outcome.sync_status,
    },
  });
}
