import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  IInventoryService,
  IStockLocationService,
  Logger,
  MedusaContainer,
} from '@medusajs/framework/types';
import {
  createInventoryLevelsWorkflow,
  updateInventoryLevelsWorkflow,
} from '@medusajs/medusa/core-flows';
import { ERP_MODULE } from '../../../../modules/erp';
import type ErpModuleService from '../../../../modules/erp/service';
import { getErpAdapter } from '../../../../modules/erp/adapters/registry';
import { OdooErpAdapter } from '../../../../modules/erp/adapters/odoo';
import type { AdapterContext } from '../../../../modules/erp/adapters/types';
import type { ErpConfigSettings } from '../../../../modules/erp/types';

/**
 * POST /webhooks/erp-odoo/stock — actualiza el stock de una variante en Medusa
 * cuando Odoo emite un cambio de `stock.quant`.
 *
 * Contraparte en Odoo: un `ir.actions.server` de tipo `webhook` (Odoo 18/19
 * lo trae nativo) disparado por una automation rule sobre `stock.quant` con
 * `trigger_field_ids=[quantity]` para no dispararse en cada write interno.
 *
 * Shape del body enviado por Odoo (verificado con `webhook_sample_payload`):
 *   {
 *     "_action": "ERP-Odoo Stock Webhook(#123)",   // debug
 *     "_id": 1,
 *     "_model": "stock.quant",
 *     "id": 1,
 *     "location_id": 5,          // int, referencia a stock.location
 *     "product_id": 36,          // int, referencia a product.product
 *     "quantity": 16.0,
 *     "reserved_quantity": 0.0
 *   }
 *
 * Ni el SKU ni el nombre del depósito viajan: `webhook_field_ids` en Odoo
 * NO permite navegar relaciones (`product_id.default_code` no es
 * seleccionable). Resolvemos ambos con hops a Odoo, reusando el adapter y
 * sus credenciales guardadas en `erp_config`.
 *
 * También aceptamos un shape simplificado `{ sku, available }` para poder
 * probar el endpoint manualmente con curl sin depender de Odoo.
 *
 * ── Autenticación ──────────────────────────────────────────────────────────
 *
 * Odoo 18/19 tiene el server action `webhook` como mecanismo nativo, pero
 * NO deja configurar headers custom en la request. La única forma que tiene
 * el operador de meterle un secreto es en la URL. Aceptamos el token por dos
 * canales, en este orden:
 *
 *   1. `?token=…` en la query string (patrón esperado en producción — el
 *      operador pega la URL con el token en `webhook_url` una sola vez).
 *   2. Header `X-Erp-Webhook-Token` / `X-Webhook-Token` (para pruebas manuales
 *      desde curl o herramientas que sí soportan headers).
 *
 * Si `ERP_ODOO_WEBHOOK_TOKEN` está en env se exige match; si no, el endpoint
 * queda abierto (modo dev). Producción SIEMPRE debe setearlo.
 *
 * ── Errores ────────────────────────────────────────────────────────────────
 *
 * Responde 200 al emisor pase lo que pase: Odoo no reintenta server actions
 * de tipo `webhook`, y aunque lo hiciera, el patrón "webhook nunca falla al
 * emisor" evita truenos que nadie ve. Cualquier fallo queda en el log; el
 * cron `stock_sync` reconcilia después.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const container = req.scope;
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const expectedToken = process.env.ERP_ODOO_WEBHOOK_TOKEN?.trim();
  if (expectedToken) {
    const query = (req.query ?? {}) as Record<string, string | string[] | undefined>;
    const queryToken = typeof query.token === 'string' ? query.token : undefined;
    const headerToken =
      (req.headers['x-erp-webhook-token'] as string | undefined) ??
      (req.headers['x-webhook-token'] as string | undefined);
    if (queryToken !== expectedToken && headerToken !== expectedToken) {
      logger.warn('[erp-odoo webhook] Token inválido — se rechaza.');
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
  }

  const bodyPreview = JSON.stringify(req.body ?? null).slice(0, 500);
  logger.info(`[erp-odoo webhook] stock event received: ${bodyPreview}`);

  // Respondemos 200 rápido y procesamos en background.
  res.status(200).json({ ok: true });

  void handleStockEvent(container, logger, req.body).catch((err) => {
    logger.error(`[erp-odoo webhook] falló handle: ${(err as Error).message}`);
  });
};

type StockEventInput = {
  sku: string;
  available: number;
  /**
   * `complete_name` del `stock.location` de Odoo (`"WH/Stock"`,
   * `"My Co/Stock/Shelf A"`). Es la clave que usa `deposito_map` para mapear
   * al `stock_location_id` de Medusa. `null` cuando no viajó (shape manual
   * `{sku, available}`) o cuando el lookup falló — ahí caemos a
   * `settings.stock_location_id` o al fallback.
   */
  locationName: string | null;
};

async function handleStockEvent(
  container: MedusaContainer,
  logger: Logger,
  body: unknown
): Promise<void> {
  const service = container.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getConfig();
  if (!config || config.provider !== 'odoo') {
    logger.warn(
      `[erp-odoo webhook] no hay config ERP con provider=odoo (actual: ${config?.provider ?? 'none'}). Se ignora.`
    );
    return;
  }

  const input = await extractStockEvent(logger, service, config, body);
  if (!input) return;

  const settings = (config.settings ?? {}) as ErpConfigSettings;
  const targetLocationId = await resolveTargetStockLocationId(container, logger, settings, input);
  if (!targetLocationId) return; // ya logueado.

  await applyStockChange(container, logger, input, targetLocationId);
}

async function extractStockEvent(
  logger: Logger,
  service: ErpModuleService,
  config: NonNullable<Awaited<ReturnType<ErpModuleService['getConfig']>>>,
  body: unknown
): Promise<StockEventInput | null> {
  if (!body || typeof body !== 'object') {
    logger.warn('[erp-odoo webhook] body vacío o no-object — se ignora.');
    return null;
  }
  const b = body as Record<string, unknown>;

  const available = extractAvailable(b);
  if (available === null) {
    logger.warn('[erp-odoo webhook] no se pudo extraer `available` — se ignora.');
    return null;
  }

  // Shape simple para tests manuales: `{ sku, available, location_name? }`.
  const directSku = typeof b.sku === 'string' ? b.sku.trim() : '';
  if (directSku) {
    return {
      sku: directSku,
      available,
      locationName: typeof b.location_name === 'string' ? b.location_name.trim() : null,
    };
  }

  // Shape del webhook Odoo.
  if (b._model !== 'stock.quant') {
    logger.warn(
      `[erp-odoo webhook] shape desconocido (sin sku directo y _model=${JSON.stringify(b._model)}) — se ignora.`
    );
    return null;
  }
  const productId = extractInt(b.product_id);
  if (!productId) {
    logger.warn('[erp-odoo webhook] product_id inválido — se ignora.');
    return null;
  }
  const locationId = extractInt(b.location_id);

  const adapter = getErpAdapter(config.provider);
  if (!(adapter instanceof OdooErpAdapter)) {
    logger.warn('[erp-odoo webhook] adapter registrado no es OdooErpAdapter — se ignora.');
    return null;
  }
  const credentials = service.getDecryptedCredentials(config);
  if (!credentials) {
    logger.warn('[erp-odoo webhook] no hay credentials guardadas — se ignora.');
    return null;
  }
  const ctx: AdapterContext = {
    credentials,
    settings: (config.settings ?? {}) as Record<string, unknown>,
    countryCode: config.country_code ?? 'AR',
    logger,
  };

  const sku = await adapter.lookupSkuByProductId(productId, ctx);
  if (!sku) {
    logger.info(
      `[erp-odoo webhook] product_id=${productId} no tiene default_code en Odoo — se ignora.`
    );
    return null;
  }

  // El nombre del depósito es opcional: sin él el mapeo cae al default. Un
  // fallo de red acá no debería voltear el update — se degrada a la location
  // por defecto y sigue.
  const locationName = locationId ? await adapter.lookupLocationCompleteName(locationId, ctx) : null;

  return { sku, available, locationName };
}

function extractAvailable(b: Record<string, unknown>): number | null {
  const raw = b.available;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.floor(raw));
  }
  const qty = b.quantity;
  if (typeof qty === 'number' && Number.isFinite(qty)) {
    const reserved =
      typeof b.reserved_quantity === 'number' && Number.isFinite(b.reserved_quantity)
        ? b.reserved_quantity
        : 0;
    return Math.max(0, Math.floor(qty - reserved));
  }
  return null;
}

function extractInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0) return v;
  if (typeof v === 'string') {
    const parsed = Number(v);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

/**
 * Resuelve a qué `stock_location_id` de Medusa mandar el update, siguiendo el
 * mismo orden de precedencia que el cron `stock_sync`:
 *
 *   1. `settings.stock_sync.deposito_map[]` — match por
 *      `deposito === locationName` con `enabled !== false`. Es el modo
 *      producción: cada depósito de Odoo → una location distinta de Medusa.
 *   2. `settings.stock_location_id` — location única para toda la tienda.
 *   3. Fallback histórico: la stock location más antigua por `created_at`.
 *      Solo aparece en instancias sin configuración explícita, y se loguea
 *      warning como el cron para evitar que se convierta en un "modo
 *      configurado por accidente".
 *
 * Devuelve `null` cuando literalmente no hay ninguna stock location en la
 * tienda (fresh install) — imposible de escribir.
 */
async function resolveTargetStockLocationId(
  container: MedusaContainer,
  logger: Logger,
  settings: ErpConfigSettings,
  input: StockEventInput
): Promise<string | null> {
  const depositoMap = settings.stock_sync?.deposito_map ?? [];
  if (input.locationName) {
    const match = depositoMap.find(
      (row) => row.enabled !== false && row.deposito === input.locationName
    );
    if (match) return match.stock_location_id;
    if (depositoMap.length > 0) {
      logger.info(
        `[erp-odoo webhook] depósito "${input.locationName}" NO está en el mapa (deposito_map tiene ${depositoMap.length} entradas). Se cae al fallback.`
      );
    }
  }

  const configured = settings.stock_location_id?.trim();
  if (configured) return configured;

  const stockLocationService = container.resolve<IStockLocationService>(Modules.STOCK_LOCATION);
  const [locations, count] = await stockLocationService.listAndCountStockLocations(
    {},
    { take: 5, order: { created_at: 'ASC' } }
  );
  if (count === 0) {
    logger.error('[erp-odoo webhook] No hay stock locations en Medusa — se ignora.');
    return null;
  }
  if (count > 1) {
    logger.warn(
      `[erp-odoo webhook] hay ${count} stock locations y ninguna configurada — se usa la más antigua (${locations[0]!.id}). Configurá settings.stock_location_id o el deposito_map.`
    );
  }
  return locations[0]!.id;
}

async function applyStockChange(
  container: MedusaContainer,
  logger: Logger,
  input: StockEventInput,
  targetLocationId: string
): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: variants } = (await query.graph({
    entity: 'product_variant',
    fields: ['id', 'sku', 'inventory_items.inventory_item_id'],
    filters: { sku: input.sku },
    pagination: { take: 5 },
  })) as {
    data: Array<{
      id: string;
      sku: string | null;
      inventory_items?: Array<{ inventory_item_id: string | null } | null> | null;
    }>;
  };
  if (variants.length === 0) {
    logger.info(`[erp-odoo webhook] SKU ${input.sku} no existe en Medusa — se ignora.`);
    return;
  }
  if (variants.length > 1) {
    logger.warn(
      `[erp-odoo webhook] SKU ${input.sku} duplicado en Medusa (${variants.length} variantes) — se ignora.`
    );
    return;
  }
  const inventoryItemId =
    variants[0]!.inventory_items?.find((it) => it?.inventory_item_id)?.inventory_item_id ?? null;
  if (!inventoryItemId) {
    logger.warn(`[erp-odoo webhook] SKU ${input.sku} sin inventory_item — se ignora.`);
    return;
  }

  const inventoryService = container.resolve<IInventoryService>(Modules.INVENTORY);
  const [levels] = await inventoryService.listAndCountInventoryLevels(
    { inventory_item_id: [inventoryItemId], location_id: [targetLocationId] },
    { take: 1 }
  );
  const existing = levels[0];
  const currentStocked = existing ? Number(existing.stocked_quantity) || 0 : 0;
  if (existing && currentStocked === input.available) {
    logger.info(
      `[erp-odoo webhook] SKU ${input.sku} sin cambios (stocked=${currentStocked}) — no-op.`
    );
    return;
  }

  if (existing) {
    await updateInventoryLevelsWorkflow(container).run({
      input: {
        updates: [
          {
            inventory_item_id: inventoryItemId,
            location_id: targetLocationId,
            stocked_quantity: input.available,
          },
        ],
      },
    });
  } else {
    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: [
          {
            inventory_item_id: inventoryItemId,
            location_id: targetLocationId,
            stocked_quantity: input.available,
          },
        ],
      },
    });
  }
  logger.info(
    `[erp-odoo webhook] SKU ${input.sku}: ${currentStocked} → ${input.available} en ${targetLocationId}` +
      (input.locationName ? ` (Odoo: ${input.locationName})` : '')
  );
}
