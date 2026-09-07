import type { MedusaContainer } from '@medusajs/framework/types';
import { getRecurringOrderConfig } from './config';

/**
 * Resuelve si la feature de compras recurrentes está habilitada para un sales
 * channel. Si el canal pertenece a un demo, manda su toggle
 * `demo_store.recurring_enabled`; si no (tienda principal), manda el env
 * `RECURRING_ORDERS_ENABLED`. Falla abierto solo hacia la config global si el
 * módulo de demos no está disponible.
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
    // esta búsqueda por `sales_channel_id` la encuentra. Y el default de la columna
    // `recurring_enabled` es FALSE: sin este `!demo.is_main`, la sola existencia de
    // la fila principal apagaría las compras recurrentes del sitio principal, sin un
    // error en ningún lado. Para la principal manda el env, como antes de la fila.
    //
    // Se chequea `is_main` inline y no vía `isMainStore()`: este archivo es un
    // `managed_file` de la extensión `recurring-orders`, que se le entrega a
    // proyectos SIN el módulo demo-store. Ver `modules/module-keys.test.ts`.
    if (demo && !demo.is_main) return Boolean(demo.recurring_enabled);
  } catch {
    // Sin módulo de demos (o error de lectura): cae a la config global.
  }
  return config.enabled;
}
