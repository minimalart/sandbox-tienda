import type { MedusaRequest } from '@medusajs/framework/http';
import { ModuleRegistrationName } from '@medusajs/framework/utils';
import { buildInstanceBranding, EMPTY_INSTANCE_BRANDING, type InstanceBranding } from './branding';

/**
 * Lee la marca de la instalación del contenedor. Adaptador de `branding.ts`, que es
 * puro.
 *
 * Vive aparte de la ruta porque lo consumen CUATRO superficies: `/instance-branding`
 * (que alimenta al admin), `/favicon.ico`, la página de aceptar invitación y la de
 * conexión del MCP. Las tres últimas tenían el logo de Mercatto escrito a mano.
 *
 * ── Por qué el módulo de tiendas se resuelve por STRING ──────────────────────────
 *
 * La marca vive en el `theme` de la fila principal de `demo_store`, que pertenece a
 * la extensión "Tiendas" (`optionalModule('demo_store', 'demo-store')` en
 * `medusa-config.ts`), y `project-composer` le borra esa carpeta a los proyectos que
 * no la eligen. Un `import` a `modules/demo-store` dejaría sin compilar a todo esto
 * —que es CORE— en esos proyectos, y el modo de falla es el build rojo en el repo del
 * cliente, no acá. Por eso la key de registración literal y `allowUnregistered`.
 *
 * NUNCA lanza: todos sus consumidores son páginas que tienen que renderizar igual.
 */
export async function readInstanceBranding(
  scope: MedusaRequest['scope'],
): Promise<InstanceBranding> {
  try {
    const storeService: any = scope.resolve(ModuleRegistrationName.STORE);
    const [store] = await storeService.listStores({}, { take: 1 });

    /**
     * `allowUnregistered` cubre "la extensión no está instalada". El try/catch de
     * adentro cubre el otro caso: instalada pero con la tabla todavía sin crear —
     * las rutas de la extensión llaman a `ensureDemoStoreTables()` antes de leer y
     * desde acá no se puede importar. En los dos casos degradar al nombre del Store
     * es la respuesta correcta, no un error.
     */
    let theme: unknown = null;
    try {
      const demoStore: any = scope.resolve('demo_store', { allowUnregistered: true });
      if (typeof demoStore?.listDemoStores === 'function') {
        const [main] = await demoStore.listDemoStores({ is_main: true }, { take: 1 });
        theme = main?.theme ?? null;
      }
    } catch {
      theme = null;
    }

    return buildInstanceBranding(store?.name, theme as Record<string, unknown>);
  } catch (error) {
    console.error('[InstanceBranding] Error reading branding:', error);
    return EMPTY_INSTANCE_BRANDING;
  }
}
