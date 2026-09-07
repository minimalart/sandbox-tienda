import type { MedusaContainer } from '@medusajs/framework/types';
import type { SiteResolution } from '../../lib/multistore/types';
import newsletterDescriptors from '../app-settings/descriptors/newsletter';
import { resolveMany } from '../app-settings/service';

/**
 * Configuración efectiva de Newsletter, con la precedencia de `app-settings`.
 *
 * Una sola entrada, y ASÍNCRONA, a diferencia de Andreani o Kapso: el único call
 * site es la ruta `/store/newsletter-subscriptions`, que tiene `req.scope`
 * completo y la tienda ya resuelta desde la publishable key. No hay ningún camino
 * sincrónico ni ningún contenedor hermético que atender, así que el gemelo por
 * knex de esas extensiones acá sería código muerto.
 *
 * Ver `descriptors/newsletter.ts` para por qué las credenciales son `scope: 'site'`.
 */

export const NEWSLETTER_SETTINGS_NAMESPACE = newsletterDescriptors.namespace;

export type NewsletterSettings = {
  /** Interruptor de la sincronización. Apagado NO apaga el formulario. */
  enabled: boolean;
  /** `''` cuando no hay ninguna cargada — indistinguible de "vacía", a propósito. */
  apiKey: string;
  /** `null` cuando no hay lista configurada. Nunca se adivina un número. */
  listId: number | null;
  apiUrl: string;
};

const DEFAULT_API_URL = 'https://api.brevo.com/v3';

/**
 * El valor de la fila viaja en jsonb y el del entorno pasa por `coerceFromEnv`,
 * así que un número puede llegar como `number` o como `string` según de dónde
 * salga. Normalizar acá evita que `listIds: ["2"]` le llegue a Brevo, que
 * responde 400 con un mensaje que no menciona el tipo.
 *
 * Exportada para poder probarla sola: es la única lógica de este archivo que
 * puede equivocarse, y el resto es cableado contra `resolveMany`.
 */
export function parseListId(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function getNewsletterSettings(
  container: MedusaContainer,
  resolution?: SiteResolution,
): Promise<NewsletterSettings> {
  const values = await resolveMany(container, newsletterDescriptors.settings, resolution);

  return {
    // El default del descriptor es `true`; sólo un `false` explícito apaga.
    enabled: values.NEWSLETTER_ENABLED !== false,
    apiKey: asString(values.BREVO_API_KEY),
    listId: parseListId(values.BREVO_LIST_ID),
    apiUrl: asString(values.BREVO_API_URL) || DEFAULT_API_URL,
  };
}
