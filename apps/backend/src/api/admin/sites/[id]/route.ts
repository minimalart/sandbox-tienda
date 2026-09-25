import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import {
  deleteProductsWorkflow,
  deleteSalesChannelsWorkflow,
  deleteStockLocationsWorkflow,
} from '@medusajs/core-flows';
import { DEMO_STORE_MODULE } from '../../../../modules/demo-store';
import { ensureDemoStoreTables } from '../../../../modules/demo-store/ensure-tables';
import { isMainStore } from '../../../../modules/demo-store/main-store';
import { configureStoreB2B } from '../../../../modules/demo-store/configure-b2b';
import { updateDemoStoreStockLocationWorkflow } from '../../../../workflows/update-demo-store-stock-location';
import { updateDemoStoreSalesChannelWorkflow } from '../../../../workflows/update-demo-store-sales-channel';
import { type UpdateDemoStoreInput } from '../schemas';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);

  await ensureDemoStoreTables(req.scope);

  const demo = await service.retrieveDemoStore(id);
  const jobs = await service.listImportJobs(
    { demo_store_id: id },
    { order: { created_at: 'DESC' } }
  );

  res.status(200).json({
    demo_store: demo,
    import_jobs: jobs,
    latest_import_job: jobs?.[0] ?? null,
  });
}

export async function POST(
  req: MedusaRequest<UpdateDemoStoreInput>,
  res: MedusaResponse
): Promise<void> {
  const id = req.params.id as string;
  const input = req.validatedBody as UpdateDemoStoreInput;
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);

  // Detect the B2B enable transition BEFORE applying the update.
  const before = await service.retrieveDemoStore(id);

  // The same provisioning contract applies to the main site and child sites.

  // Cambios de sales_channel_id se procesan PRIMERO porque el workflow SC
  // reconstruye los links SL↔SC y publishable_key↔SC, y luego el workflow SL
  // (si también viene) opera sobre el SC nuevo — ese orden evita re-linkeos
  // innecesarios.
  const relocateSalesChannel = Object.prototype.hasOwnProperty.call(input, 'sales_channel_id');
  if (relocateSalesChannel) {
    try {
      await updateDemoStoreSalesChannelWorkflow(req.scope).run({
        input: {
          demo_store_id: id,
          sales_channel_id: input.sales_channel_id as string | null,
        },
      });
    } catch (err) {
      logger.error(`[demo-store] update sales_channel falló: ${(err as Error).message}`);
      res.status(400).json({
        message: `No se pudo cambiar el sales channel: ${(err as Error).message}`,
      });
      return;
    }
  }

  // Cambios de stock_location_id / region_id — se procesan DESPUÉS del SC
  // (arriba) porque el workflow SL usa `demo.sales_channel_id` para reconstruir
  // los links, y ese ID ya fue actualizado.
  const relocateStockLocation = Object.prototype.hasOwnProperty.call(input, 'stock_location_id');
  const relocateRegion = Object.prototype.hasOwnProperty.call(input, 'region_id');
  if (relocateStockLocation || relocateRegion) {
    try {
      // Necesito la fila actualizada porque el SC pudo haber cambiado arriba.
      const current = relocateSalesChannel ? await service.retrieveDemoStore(id) : before;
      await updateDemoStoreStockLocationWorkflow(req.scope).run({
        input: {
          demo_store_id: id,
          stock_location_id: relocateStockLocation
            ? (input.stock_location_id as string | null)
            : (current.stock_location_id ?? null),
          ...(relocateRegion ? { region_id: input.region_id as string | null } : {}),
        },
      });
    } catch (err) {
      logger.error(`[demo-store] update stock_location/region falló: ${(err as Error).message}`);
      res.status(400).json({
        message: `No se pudo cambiar la asignación: ${(err as Error).message}`,
      });
      return;
    }
  }

  // El update genérico ya NO propaga sales_channel_id ni stock_location_id ni
  // region_id — los workflows de arriba se encargan. Los strippeo del payload
  // para evitar doble escritura (redundante, no dañino).
  const {
    b2b_enabled,
    b2b_sales_channel_id,
    b2b_price_list_id,
    stock_location_id: _sl,
    region_id: _rg,
    sales_channel_id: _sc,
    ...rest
  } = input;
  // Checkout has its own validated, revision-controlled writer. General/footer
  // saves must never erase it or overwrite it from a stale editor.
  const contentConfig = rest.content_config;
  delete rest.content_config;
  let demo = await service.updateDemoStores({ id, ...rest });
  if (contentConfig) {
    const pg: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
    await pg('demo_store').where({ id }).update({
      content_config: pg.raw(`(?::jsonb - 'checkout') || CASE WHEN content_config -> 'checkout' IS NOT NULL THEN jsonb_build_object('checkout', content_config -> 'checkout') ELSE '{}'::jsonb END`, [JSON.stringify(contentConfig)]),
      updated_at: new Date(),
    });
    demo = await service.retrieveDemoStore(id);
  }

  if (
    b2b_enabled ||
    (b2b_enabled !== false && before.b2b_enabled && (b2b_sales_channel_id !== undefined || b2b_price_list_id !== undefined))
  ) {
    try {
      const configured = await configureStoreB2B(req.scope, demo, {
        b2b_sales_channel_id,
        b2b_price_list_id,
      });
      res.status(200).json({ demo_store: configured });
    } catch (err) {
      logger.error('[demo-store] B2B setup failed: ' + (err as Error).message);
      res.status(400).json({ message: (err as Error).message });
    }
    return;
  }
  if (b2b_enabled === false) {
    res
      .status(200)
      .json({ demo_store: await service.updateDemoStores({ id, b2b_enabled: false }) });
    return;
  }

  res.status(200).json({ demo_store: demo });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);

  const demo = await service.retrieveDemoStore(id);

  // La tienda principal NO se borra. El teardown de abajo no tiene otra entrada, y
  // sobre la fila principal se llevaría por delante el canal de ventas por defecto,
  // el stock location y —si alguien le hubiera prendido B2B— la company real.
  if (isMainStore(demo)) {
    res.status(409).json({
      message:
        'La tienda principal no se puede eliminar: es el sitio que se sirve en el host raíz.',
    });
    return;
  }

  // El 409 sólo mira órdenes ACTIVAS (no las sessions sin orden ni las canceladas):
  // una sesión sin orden es un carrito abandonado y no bloquea la baja, y una orden
  // cancelada ya no requiere intervención del operador. Si NO hay órdenes activas
  // pero SÍ existe historial de checkout (site_checkout_session), el teardown físico
  // se saltea para preservar las referencias que las órdenes canceladas y las
  // propias filas de site_checkout_session todavía consultan; el soft-delete de la
  // fila demo_store alcanza para sacarla del panel sin romper esas referencias.
  const checkoutDb: any = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const sessions = await checkoutDb('site_checkout_session').where({ site_id: id }).select('cart_id');
  const cartIds = (sessions as any[]).map((s) => s.cart_id).filter(Boolean);
  const hasCheckoutHistory = cartIds.length > 0;

  if (hasCheckoutHistory) {
    const { data: links } = await query.graph({
      entity: 'order_cart',
      fields: ['order_id'],
      filters: { cart_id: cartIds },
    });
    const orderIds = ((links ?? []) as any[]).map((l) => l.order_id).filter(Boolean);
    if (orderIds.length > 0) {
      const { data: orders } = await query.graph({
        entity: 'order',
        fields: ['id', 'display_id', 'status', 'canceled_at'],
        filters: { id: orderIds },
      });
      const active = ((orders ?? []) as any[]).filter(
        (o) => o.status !== 'canceled' && !o.canceled_at
      );
      if (active.length > 0) {
        const labels = active.map((o) => `#${o.display_id ?? o.id}`);
        const list = labels.join(', ');
        const message =
          labels.length === 1
            ? `No se puede eliminar: cancelá primero la orden ${list} y volvé a intentar.`
            : `No se puede eliminar: cancelá primero las órdenes ${list} y volvé a intentar.`;
        res.status(409).json({ message });
        return;
      }
    }
  }

  if (!hasCheckoutHistory) {
    // Origen `sales_channel`: el catálogo NO es de la demo, son productos que ya
    // existían en otro canal de esta instancia (la demo los comparte, no los clona).
    // Borrarlos al borrar la demo se llevaría el catálogo real por delante. Y si el
    // canal además es el ADOPTADO (la demo usa el canal de origen tal cual), tampoco
    // se borra el canal: es preexistente.
    const sharesSourceCatalog = demo.source_type === 'sales_channel';
    const adoptedSalesChannel = sharesSourceCatalog && demo.source_url === demo.sales_channel_id;

    // Best-effort teardown of the demo's provisioned resources. Products first
    // (a sales channel with products can't be deleted), then SC/region/stock.
    if (demo.sales_channel_id && !sharesSourceCatalog) {
      try {
        // query.graph can't filter products by sales_channels nor traverse
        // sales_channel.products; select sales_channels.id and filter in JS.
        const { data: products } = await query.graph({
          entity: 'product',
          fields: ['id', 'sales_channels.id'],
          pagination: { take: 100000, skip: 0 },
        });
        const productIds = ((products ?? []) as any[])
          .filter(
            (p) =>
              Array.isArray(p.sales_channels) &&
              p.sales_channels.some((sc: any) => sc?.id === demo.sales_channel_id)
          )
          .map((p) => p.id as string);
        if (productIds.length > 0) {
          await deleteProductsWorkflow(req.scope).run({ input: { ids: productIds } });
        }
      } catch (err) {
        logger.warn(`[demo-store] Product cleanup failed: ${(err as Error).message}`);
      }
    }

    // El canal adoptado se deja intacto (existía antes de la demo y puede seguir en
    // uso). Borrar el canal desvincula sus productos por los remote links, sin
    // borrarlos: para una demo con catálogo compartido eso es exactamente lo que hay
    // que hacer.
    if (demo.sales_channel_id && !adoptedSalesChannel) {
      try {
        await deleteSalesChannelsWorkflow(req.scope).run({ input: { ids: [demo.sales_channel_id] } });
      } catch (err) {
        logger.warn(`[demo-store] Sales channel cleanup failed: ${(err as Error).message}`);
      }
    }

    // ── B2B teardown (best-effort) ─────────────────────────────────────────────
    // Automatically provisioned wholesale resources are owned by the site;
    // manually selected resources are retained. Deleting a channel only unlinks its products, it doesn't
    // delete them. The test buyer + auth identity are intentionally LEFT:
    // provisioning reuses them by email on recreate, which keeps a same-slug recreate
    // working (deleting only the customer would orphan its auth identity and break
    // re-provisioning).
    if (demo.b2b_company_id) {
      try {
        const companyService: any = req.scope.resolve('company');
        const members = await companyService.listCompanyMembers({ company_id: demo.b2b_company_id });
        const memberIds = (members as any[]).map((m) => m.id);
        if (memberIds.length) await companyService.deleteCompanyMembers(memberIds);
        await companyService.deleteCompanies([demo.b2b_company_id]);
      } catch (err) {
        logger.warn(`[demo-store] B2B company cleanup failed: ${(err as Error).message}`);
      }
    }
    if (demo.b2b_price_list_id && demo.b2b_price_list_owned !== false) {
      try {
        const pricing: any = req.scope.resolve(Modules.PRICING);
        await pricing.deletePriceLists([demo.b2b_price_list_id]);
      } catch (err) {
        logger.warn(`[demo-store] B2B price list cleanup failed: ${(err as Error).message}`);
      }
    }
    if (demo.b2b_customer_group_id) {
      try {
        const customerService: any = req.scope.resolve(Modules.CUSTOMER);
        await customerService.deleteCustomerGroups([demo.b2b_customer_group_id]);
      } catch (err) {
        logger.warn(`[demo-store] B2B customer group cleanup failed: ${(err as Error).message}`);
      }
    }
    if (demo.b2b_sales_channel_id && demo.b2b_sales_channel_owned !== false) {
      try {
        await deleteSalesChannelsWorkflow(req.scope).run({
          input: { ids: [demo.b2b_sales_channel_id] },
        });
      } catch (err) {
        logger.warn(`[demo-store] B2B sales channel cleanup failed: ${(err as Error).message}`);
      }
    }

    if (demo.stock_location_id) {
      try {
        await deleteStockLocationsWorkflow(req.scope).run({
          input: { ids: [demo.stock_location_id] },
        });
      } catch (err) {
        logger.warn(`[demo-store] Stock location cleanup failed: ${(err as Error).message}`);
      }
    }
    // IMPORTANT: do NOT delete the region. Provisioning REUSES the existing region
    // for the demo's country (a country can belong to only one region in Medusa),
    // so the region is almost always SHARED with the main store / other demos.
    // Deleting it once removed the store's Argentina region and broke pricing for
    // the entire catalog. Regions are cheap to leave; never delete on teardown.
  }

  // Soft-delete siempre: la fila demo_store tiene `deleted_at` con índices parciales
  // (where deleted_at is null), así que sale del panel sin romper referencias.
  //
  // OJO: `deleteDemoStores` de MedusaService es HARD delete y el FK
  // `demo_import_job_demo_store_id_foreign` NO es ON DELETE CASCADE
  // (Mikro-ORM `hasMany` no lo agrega por default). Con hard delete Postgres
  // rechaza con 23503 y el `db-error-mapper` de Medusa lo convierte en un
  // 404 confuso ("You tried to set relationship id: ..., but such entity
  // does not exist"). Por eso se usa `softDeleteXxx`: es un UPDATE de
  // `deleted_at`, no toca FKs, y funciona tanto para el path con historial
  // de checkout (preserva las FK de site_checkout_session/snapshot/cart_context)
  // como para el path sin historial. Los import_jobs se soft-deletean antes
  // para no dejar filas apuntando a un padre invisible.
  await service.softDeleteImportJobs({ demo_store_id: id });
  await service.softDeleteDemoStores(id);

  res.status(200).json({ id, object: 'demo_store', deleted: true, soft_deleted: hasCheckoutHistory });
}
