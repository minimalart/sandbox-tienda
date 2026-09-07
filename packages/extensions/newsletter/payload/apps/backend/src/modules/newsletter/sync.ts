import type { MedusaContainer } from '@medusajs/framework/types';
import type { SiteResolution } from '../../lib/multistore/types';
import { syncContactToBrevo } from './brevo';
import { NEWSLETTER_MODULE } from './index';
import { getNewsletterSettings } from './settings';
import type NewsletterModuleService from './service';

/**
 * Sincroniza UNA suscripción ya persistida contra Brevo y deja el resultado
 * escrito en su propia fila.
 *
 * Vive acá y no en la ruta store porque tiene DOS llamadores que no pueden
 * divergir: el alta desde el storefront y el botón "Reintentar" del admin. Si
 * cada uno escribiera su propio `sync_status`, el reintento podría dejar la fila
 * en un estado que el alta nunca produce y la pantalla mostraría algo que el
 * código no sabe explicar.
 *
 * NUNCA tira. El contacto ya está guardado antes de que esto corra: que Brevo
 * conteste o no es información, no un fracaso del alta. El llamador decide qué
 * hacer con el resultado; la respuesta HTTP al visitante no depende de él.
 */
export type SubscriptionSyncOutcome = {
  sync_status: 'synced' | 'failed' | 'skipped';
  sync_error: string | null;
};

export async function syncSubscription(
  container: MedusaContainer,
  subscription: { id: string; email: string },
  resolution?: SiteResolution,
): Promise<SubscriptionSyncOutcome> {
  const service: NewsletterModuleService = container.resolve(NEWSLETTER_MODULE);

  let outcome: SubscriptionSyncOutcome;
  let listId: number | null = null;

  try {
    const settings = await getNewsletterSettings(container, resolution);
    const result = await syncContactToBrevo(settings, { email: subscription.email });

    if (result.status === 'synced') {
      listId = result.listId;
      outcome = { sync_status: 'synced', sync_error: null };
    } else if (result.status === 'skipped') {
      outcome = { sync_status: 'skipped', sync_error: result.reason };
    } else {
      outcome = { sync_status: 'failed', sync_error: result.error };
    }
  } catch (error) {
    /**
     * Resolver la configuración también puede fallar (base caída, secreto que no
     * descifra). Sin este catch sería la única forma de que la fila quede en
     * `pending` para siempre, sin motivo escrito: el peor estado posible, porque
     * es el que se confunde con "todavía no se intentó".
     */
    outcome = {
      sync_status: 'failed',
      sync_error: `No se pudo resolver la configuración de Newsletter: ${(error as Error).message}`,
    };
  }

  await service.updateNewsletterSubscriptions({
    id: subscription.id,
    ...outcome,
    synced_at: outcome.sync_status === 'synced' ? new Date() : null,
    provider_list_id: listId === null ? null : String(listId),
  });

  return outcome;
}
