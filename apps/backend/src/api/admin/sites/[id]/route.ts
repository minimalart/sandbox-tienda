import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import {
  deleteProductsWorkflow,
  deleteSalesChannelsWorkflow,
  deleteStockLocationsWorkflow,
} from '@medusajs/core-flows';
import { COMPANY_MODULE } from '../../../../modules/company';
import { DEMO_STORE_MODULE } from '../../../../modules/demo-store';
import { ensureDemoStoreTables } from '../../../../modules/demo-store/ensure-tables';
import { isMainStore } from '../../../../modules/demo-store/main-store';
import { provisionDemoB2B } from '../../../../modules/demo-store/provision';
import { provisionDemoB2BPricing } from '../../../../modules/demo-store/b2b-pricing';
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
    { order: { created_at: 'DESC' } },
  );

  res.status(200).json({
    demo_store: demo,
    import_jobs: jobs,
    latest_import_job: jobs?.[0] ?? null,
  });
}

export async function POST(
  req: MedusaRequest<UpdateDemoStoreInput>,
  res: MedusaResponse,
): Promise<void> {
  const id = req.params.id as string;
  const input = req.validatedBody as UpdateDemoStoreInput;
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);

  // Detect the B2B enable transition BEFORE applying the update.
  const before = await service.retrieveDemoStore(id);

  // La tienda principal NO puede habilitar B2B: `provisionDemoB2B` +
  // `provisionDemoB2BPricing` crearían un SEGUNDO canal mayorista y una price list
  // sobre la tienda real. Va antes del update para que la transición ni se persista.
  if (isMainStore(before) && input.b2b_enabled) {
    res.status(409).json({
      message:
        'La tienda principal no puede habilitar B2B desde acá: provisionaría un segundo ' +
        'canal mayorista y una lista de precios sobre el catálogo real.',
    });
    return;
  }

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
      logger.error(
        `[demo-store] update sales_channel falló: ${(err as Error).message}`,
      );
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
            : current.stock_location_id ?? null,
          ...(relocateRegion ? { region_id: input.region_id as string | null } : {}),
        },
      });
    } catch (err) {
      logger.error(
        `[demo-store] update stock_location/region falló: ${(err as Error).message}`,
      );
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
    stock_location_id: _sl,
    region_id: _rg,
    sales_channel_id: _sc,
    ...rest
  } = input;
  const demo = await service.updateDemoStores({ id, ...rest });

  // Enabling B2B on an existing demo provisions the wholesale resources inline
  // (channel/group/company/user) and — if the demo already has a catalog —
  // links its products + builds the tiered price list from the CURRENT prices
  // (no re-import). Best-effort: a hiccup leaves the demo B2C-functional and a
  // "Reintentar" completes it. Requires the B2C resources to exist already.
  if (
    input.b2b_enabled &&
    !before.b2b_sales_channel_id &&
    before.region_id &&
    before.stock_location_id
  ) {
    try {
      const b2b = await provisionDemoB2B(req.scope, {
        id: before.id,
        name: demo.name ?? before.name,
        slug: before.slug,
        regionId: before.region_id,
        stockLocationId: before.stock_location_id,
      });
      await service.updateDemoStores({
        id,
        b2b_sales_channel_id: b2b.salesChannelId,
        b2b_customer_group_id: b2b.customerGroupId,
        b2b_company_id: b2b.companyId,
        ...(b2b.testEmail
          ? { b2b_test_email: b2b.testEmail, b2b_test_password: b2b.testPassword }
          : {}),
      });
      if (before.status === 'ready' && before.sales_channel_id) {
        const pricing = await provisionDemoB2BPricing(req.scope, {
          demoSlug: before.slug,
          sourceSalesChannelId: before.sales_channel_id,
          b2bSalesChannelId: b2b.salesChannelId,
          customerGroupId: b2b.customerGroupId,
          currencyCode: before.currency_code,
          regionId: before.region_id,
        });
        if (pricing.priceListId) {
          await service.updateDemoStores({ id, b2b_price_list_id: pricing.priceListId });
        }
      }
    } catch (err) {
      logger.warn(`[demo-store] B2B enable-on-edit skipped: ${(err as Error).message}`);
    }
    res.status(200).json({ demo_store: await service.retrieveDemoStore(id) });
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
            p.sales_channels.some((sc: any) => sc?.id === demo.sales_channel_id),
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
  // The wholesale channel is ALWAYS the demo's own (B2B provisioning creates it),
  // so it always goes: deleting a channel only unlinks its products, it doesn't
  // delete them. The test buyer + auth identity are intentionally LEFT:
  // provisioning reuses them by email on recreate, which keeps a same-slug recreate
  // working (deleting only the customer would orphan its auth identity and break
  // re-provisioning).
  if (demo.b2b_company_id) {
    try {
      const companyService: any = req.scope.resolve(COMPANY_MODULE);
      const members = await companyService.listCompanyMembers({ company_id: demo.b2b_company_id });
      const memberIds = (members as any[]).map((m) => m.id);
      if (memberIds.length) await companyService.deleteCompanyMembers(memberIds);
      await companyService.deleteCompanies([demo.b2b_company_id]);
    } catch (err) {
      logger.warn(`[demo-store] B2B company cleanup failed: ${(err as Error).message}`);
    }
  }
  if (demo.b2b_price_list_id) {
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
  if (demo.b2b_sales_channel_id) {
    try {
      await deleteSalesChannelsWorkflow(req.scope).run({ input: { ids: [demo.b2b_sales_channel_id] } });
    } catch (err) {
      logger.warn(`[demo-store] B2B sales channel cleanup failed: ${(err as Error).message}`);
    }
  }

  if (demo.stock_location_id) {
    try {
      await deleteStockLocationsWorkflow(req.scope).run({ input: { ids: [demo.stock_location_id] } });
    } catch (err) {
      logger.warn(`[demo-store] Stock location cleanup failed: ${(err as Error).message}`);
    }
  }
  // IMPORTANT: do NOT delete the region. Provisioning REUSES the existing region
  // for the demo's country (a country can belong to only one region in Medusa),
  // so the region is almost always SHARED with the main store / other demos.
  // Deleting it once removed the store's Argentina region and broke pricing for
  // the entire catalog. Regions are cheap to leave; never delete on teardown.

  // Cascade-deletes the demo's import jobs via the FK.
  await service.deleteDemoStores(id);

  res.status(200).json({ id, object: 'demo_store', deleted: true });
}
