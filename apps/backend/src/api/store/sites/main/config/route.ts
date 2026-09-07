import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { DEMO_STORE_MODULE } from '../../../../../modules/demo-store';
import { ensureDemoStoreTables } from '../../../../../modules/demo-store/ensure-tables';
import { ensureMainStore } from '../../../../../modules/demo-store/main-store';
import { buildTenantConfig } from '../../../../../modules/demo-store/templates';

/**
 * Config pública de la tienda PRINCIPAL — la que se sirve en el host raíz.
 *
 * Hermano de `[slug]/config`, con su propia ruta en vez de resolverse por slug. Dos
 * razones:
 *
 *  1. La ruta `[slug]` devuelve 404 para `is_main` a propósito: mientras el proxy
 *     siga mapeando `/demo/{slug}` a ella, dejar que la principal respondiera haría
 *     que `/demo/principal` renderice el sitio principal en una URL de tienda.
 *  2. El storefront no conoce el slug de la principal, y no debería: es un detalle
 *     del backend. `main` es un segmento fijo.
 *
 * Es PURAMENTE ADITIVO: nada lo consume hasta que el storefront agregue su rama.
 * Si el storefront saliera primero, esta ruta da 404 y `getTenant()` cae al
 * `defaultConfig` — inocuo. Al revés, con el payload mal, se rompería el branding
 * del sitio principal: por eso `main-store.test.ts` y `templates/main-config.test.ts`
 * asertan que toda clave del payload sea IGUAL a la de `defaultConfig` o esté
 * AUSENTE.
 *
 * `Cache-Control` se deja al default de Medusa; el storefront cachea del lado suyo
 * con `next: { revalidate: 60, tags: [...] }`, igual que para las demás tiendas.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);

  await ensureDemoStoreTables(req.scope);
  // Idempotente. Va acá además del listado del admin porque el storefront puede
  // pegarle a esta ruta antes de que alguien abra el admin por primera vez.
  await ensureMainStore(req.scope);

  const [main] = await service.listDemoStores({ is_main: true }, { take: 1 });
  if (!main) {
    // No se pudo sembrar (típicamente: el store no tiene `default_sales_channel_id`).
    // 404 y el storefront cae a su `defaultConfig`, que es el comportamiento previo
    // a esta fase: degradar al estado anterior, nunca romper el sitio principal.
    res.status(404).json({ message: 'Main store row not available.' });
    return;
  }

  res.status(200).json({ config: buildTenantConfig(main) });
}
