import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { DEMO_STORE_MODULE } from '../../../modules/demo-store';
import { ensureDemoStoreTables } from '../../../modules/demo-store/ensure-tables';
import { ensureMainStore } from '../../../modules/demo-store/main-store';
import { isSalesChannelSource } from '../../../modules/demo-store/source-type';
import {
  assertAdoptableSalesChannel,
  provisionDemoStore,
} from '../../../modules/demo-store/provision';
import { type CreateDemoStoreInput } from './schemas';

export async function POST(
  req: MedusaRequest<CreateDemoStoreInput>,
  res: MedusaResponse,
): Promise<void> {
  const input = req.validatedBody as CreateDemoStoreInput;
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);

  await ensureDemoStoreTables(req.scope);

  // Origen `sales_channel`: el canal de origen pasa a SER el canal de la demo, así
  // que se valida que sea adoptable ANTES de provisionar (existe, no es el canal
  // por defecto de la tienda, no es de otra demo). Sin esto la demo se crea, se le
  // provisiona región/depósito y solo después el import falla — dejando una tienda
  // a medio armar apuntando a un canal inexistente.
  const adoptSalesChannelId = isSalesChannelSource(input.source_type) ? input.source_url : null;
  if (adoptSalesChannelId) {
    await assertAdoptableSalesChannel(req.scope, { salesChannelId: adoptSalesChannelId });
  }

  const demo = await service.createDemoStores({
    name: input.name,
    slug: input.slug,
    template_code: input.template_code,
    country_code: input.country_code,
    currency_code: input.currency_code,
    locale: input.locale,
    source_type: input.source_type,
    source_url: input.source_url,
    source_config: input.source_config ?? null,
    target_count: input.target_count ?? null,
    theme: input.theme ?? null,
    content_config: input.content_config ?? null,
    b2b_enabled: input.b2b_enabled,
    recurring_enabled: input.recurring_enabled,
    tinting_enabled: input.tinting_enabled,
    status: 'provisioning',
  });

  // Provision operational config synchronously (fast: creates SC/region/etc).
  let provision;
  try {
    provision = await provisionDemoStore(req.scope, {
      id: demo.id,
      name: demo.name,
      slug: demo.slug,
      country_code: demo.country_code,
      currency_code: demo.currency_code,
      b2bEnabled: input.b2b_enabled,
      adoptSalesChannelId,
      reuseStockLocationId: input.reuse_stock_location_id ?? null,
    });
  } catch (err) {
    logger.error(`[demo-store] Provision failed: ${(err as Error).message}`);
    await service.updateDemoStores({ id: demo.id, status: 'failed' });
    res.status(500).json({
      message: `Provisioning failed: ${(err as Error).message}`,
      demo_store: { ...demo, status: 'failed' },
    });
    return;
  }

  await service.updateDemoStores({
    id: demo.id,
    sales_channel_id: provision.salesChannelId,
    region_id: provision.regionId,
    stock_location_id: provision.stockLocationId,
    // Follow the effective region currency (a reused region may differ).
    currency_code: provision.currencyCode,
    // Persist the B2B ids (credentials only when the test buyer was just created).
    ...(provision.b2b
      ? {
          b2b_sales_channel_id: provision.b2b.salesChannelId,
          b2b_customer_group_id: provision.b2b.customerGroupId,
          b2b_company_id: provision.b2b.companyId,
          ...(provision.b2b.testEmail
            ? {
                b2b_test_email: provision.b2b.testEmail,
                b2b_test_password: provision.b2b.testPassword,
              }
            : {}),
        }
      : {}),
  });

  // Enqueue the import as 'pending'; the process-demo-store-imports cron runs it.
  // Durable: a server restart no longer kills an inline fire-and-forget import.
  const job = await service.createImportJobs({
    demo_store_id: demo.id,
    source_type: demo.source_type,
    source_url: demo.source_url,
    target_count: input.target_count ?? null,
    status: 'pending',
  });
  await service.updateDemoStores({ id: demo.id, status: 'importing' });

  res.status(201).json({
    demo_store: {
      ...demo,
      sales_channel_id: provision.salesChannelId,
      region_id: provision.regionId,
      stock_location_id: provision.stockLocationId,
      status: 'importing',
    },
    import_job: job,
  });
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const offset = req.query.offset ? Number(req.query.offset) : 0;

  try {
    await ensureDemoStoreTables(req.scope);
    // El listado es el único lugar donde la fila principal TIENE que existir para
    // poder mostrarla, así que se siembra acá y no como efecto secundario del DDL.
    // Idempotente y con su propio try/catch: no puede tirar un 500 en el listado.
    await ensureMainStore(req.scope);

    const [demos, count] = await service.listAndCountDemoStores(
      {},
      {
        skip: offset,
        take: limit,
        // La principal primero, en UNA query: a prueba de paginación. Ordenar en JS
        // sobre la página actual la dejaría fuera del top en cuanto haya >20 tiendas.
        order: { is_main: 'DESC', created_at: 'DESC' },
      },
    );

    // Resolve the latest import job per demo with a separate query (avoids
    // relying on relation auto-loading, which keeps the list endpoint robust).
    const ids = (demos as any[]).map((d) => d.id);
    const latestByDemo = new Map<string, any>();
    if (ids.length > 0) {
      const jobs = await service.listImportJobs(
        { demo_store_id: ids },
        { order: { created_at: 'DESC' } },
      );
      for (const j of jobs as any[]) {
        if (!latestByDemo.has(j.demo_store_id)) latestByDemo.set(j.demo_store_id, j);
      }
    }

    const rows = (demos as any[]).map((d) => ({
      ...d,
      latest_import_job: latestByDemo.get(d.id) ?? null,
    }));

    res.status(200).json({ demo_stores: rows, count, offset, limit });
  } catch (err) {
    // Log for observability, then let Medusa's error handler format the response.
    const e = err as Error;
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
    logger.error(`[demo-store] list failed: ${e.name}: ${e.message}\n${e.stack}`);
    throw err;
  }
}
