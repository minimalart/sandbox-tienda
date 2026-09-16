import type { MedusaContainer } from '@medusajs/framework/types';
import { getRecurringOrderConfig } from './config';

/**
 * Resuelve si la feature de compras recurrentes está habilitada para un sales
 * channel. El env `RECURRING_ORDERS_ENABLED` es la llave maestra de la instancia;
 * con ella prendida manda el toggle `recurring_enabled` de la fila del sitio
 * dueno del canal, demos Y tienda principal por igual. Falla abierto hacia la
 * config global solo si el modulo de sitios no esta disponible o el canal no
 * pertenece a ninguna fila.
 */
export async function isRecurringEnabledForChannel(
  container: MedusaContainer,
  salesChannelId: string | null | undefined,
): Promise<boolean> {
  const config = getRecurringOrderConfig();
  if (!config.enabled) return false;
  if (!salesChannelId) return config.enabled;

  try {
    // Keep the customer-project package independent from the boilerplate-only
    // demo creator. In the boilerplate the service still resolves by its stable
    // internal module name; generated sites simply fall through to global config.
    const demoService: any = container.resolve('demo_store');
    const demos = await demoService.listDemoStores(
      { sales_channel_id: salesChannelId },
      { take: 1 },
    );
    const demo = demos?.[0];
    // La fila de la tienda PRINCIPAL tiene el canal por defecto del store, así que
    // esta busqueda por `sales_channel_id` la encuentra, y su toggle vale igual que
    // el de cualquier otra tienda. Antes se la salteaba (`!demo.is_main`) por miedo
    // al default FALSE de la columna, pero `ensureMainStore` siembra la fila
    // principal con `recurring_enabled: true` desde que la fila existe, asi que un
    // FALSE ahi solo puede venir de alguien apagandolo en /app/sites. Y ese apagado
    // tiene que valer: el storefront ya no muestra "Suscribirse" y el backend no
    // puede seguir aceptando altas por detras.
    if (demo) return Boolean(demo.recurring_enabled);
  } catch {
    // Sin módulo de demos (o error de lectura): cae a la config global.
  }
  return config.enabled;
}
