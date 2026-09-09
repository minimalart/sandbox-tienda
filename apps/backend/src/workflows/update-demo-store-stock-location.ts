import type { IRegionModuleService, IStockLocationService } from '@medusajs/framework/types';
/**
 * Reasigna el stock location (y opcionalmente la region) de una demo store
 * existente. Reconstituye el link SC↔stock-location: desliga el viejo (si había)
 * y linka el nuevo (si no es null). Persiste el nuevo id en `demo_store`.
 *
 * Diseñado para el PATCH del admin de sites, tanto para la tienda principal
 * (que se sembraba con `stock_location_id: null` a propósito) como para hijas
 * (que hasta hoy no permitían cambiar el location asignado sin re-provisionar).
 *
 * Steps compensables — si `linkNewStockLocationStep` falla después de haber
 * deslinkeado el viejo, la compensación de `unlinkOldStockLocationStep` lo
 * vuelve a linkear. El update de la fila es la última operación: si algo antes
 * falla, la demo queda apuntando al location viejo (consistente).
 */
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { linkSalesChannelsToStockLocationWorkflow } from '@medusajs/core-flows';
import { MedusaError, Modules } from '@medusajs/framework/utils';
import { DEMO_STORE_MODULE } from '../modules/demo-store';

export type UpdateDemoStoreStockLocationInput = {
  demo_store_id: string;
  /**
   * Nuevo stock location. `null` = detach (la demo queda sin location propio,
   * que es el estado inicial de la principal). String = ID a linkear.
   */
  stock_location_id: string | null;
  /**
   * Región opcional a reasignar en el mismo paso. `null` = detach. Ausente = no
   * se toca. Nota: en Medusa un país sólo puede pertenecer a UNA region; este
   * workflow NO valida esa constraint (el link se rechaza si hay conflicto).
   */
  region_id?: string | null;
};

/**
 * Valida existencia del stock location nuevo (si no es null) ANTES de hacer
 * cualquier cambio. Evita dejar la demo huérfana por un ID inválido.
 */
const validateInputStep = createStep(
  'update-demo-stock-location-validate',
  async (input: UpdateDemoStoreStockLocationInput, { container }) => {
    const service: any = container.resolve(DEMO_STORE_MODULE);
    const demo = await service.retrieveDemoStore(input.demo_store_id);
    if (!demo) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Demo store ${input.demo_store_id} no existe.`,
      );
    }

    if (input.stock_location_id) {
      const stockLocationService = container.resolve<IStockLocationService>(Modules.STOCK_LOCATION);
      const [sl] = await stockLocationService.listStockLocations({
        id: input.stock_location_id,
      });
      if (!sl) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Stock location ${input.stock_location_id} no existe.`,
        );
      }
    }

    if (input.region_id) {
      const regionService = container.resolve<IRegionModuleService>(Modules.REGION);
      const [region] = await regionService.listRegions({ id: input.region_id });
      if (!region) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Region ${input.region_id} no existe.`,
        );
      }
    }

    return new StepResponse({
      previousStockLocationId: (demo.stock_location_id as string | null) ?? null,
      previousRegionId: (demo.region_id as string | null) ?? null,
      salesChannelId: (demo.sales_channel_id as string | null) ?? null,
    });
  },
);

/**
 * Desliga el SC del stock location viejo (si había). El link se restaura en la
 * compensación si algún step posterior falla.
 *
 * `linkSalesChannelsToStockLocationWorkflow` con `remove` es idempotente: si el
 * link no existe, no tira error. Y si el SC ES null (edge case: demo sin SC
 * asignado, poco común), se salta el unlink.
 */
const unlinkOldStockLocationStep = createStep(
  'update-demo-stock-location-unlink-old',
  async (
    input: { previousStockLocationId: string | null; salesChannelId: string | null },
    { container },
  ) => {
    if (!input.previousStockLocationId || !input.salesChannelId) {
      return new StepResponse({ unlinked: false }, null);
    }
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: input.previousStockLocationId,
        remove: [input.salesChannelId],
      },
    });
    return new StepResponse(
      { unlinked: true },
      {
        stockLocationId: input.previousStockLocationId,
        salesChannelId: input.salesChannelId,
      },
    );
  },
  async (compensation, { container }) => {
    if (!compensation) return;
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: compensation.stockLocationId,
        add: [compensation.salesChannelId],
      },
    });
  },
);

/**
 * Linkea el SC al stock location nuevo (si `stock_location_id` no es null y
 * la demo tiene SC asignado). En el caso `null` este step es no-op: la demo
 * queda sin location.
 */
const linkNewStockLocationStep = createStep(
  'update-demo-stock-location-link-new',
  async (
    input: {
      newStockLocationId: string | null;
      salesChannelId: string | null;
    },
    { container },
  ) => {
    if (!input.newStockLocationId || !input.salesChannelId) {
      return new StepResponse({ linked: false }, null);
    }
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: input.newStockLocationId,
        add: [input.salesChannelId],
      },
    });
    return new StepResponse(
      { linked: true },
      {
        stockLocationId: input.newStockLocationId,
        salesChannelId: input.salesChannelId,
      },
    );
  },
  async (compensation, { container }) => {
    if (!compensation) return;
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: compensation.stockLocationId,
        remove: [compensation.salesChannelId],
      },
    });
  },
);

/**
 * Update final de la fila demo_store con los IDs nuevos. Se hace después de
 * los links para que si algo falla, la fila siga apuntando al estado consistente.
 */
const persistDemoRowStep = createStep(
  'update-demo-stock-location-persist',
  async (
    input: {
      demoStoreId: string;
      stockLocationId: string | null;
      regionId: string | null | undefined;
    },
    { container },
  ) => {
    const service: any = container.resolve(DEMO_STORE_MODULE);
    // Solo se toca region_id si vino explícito (undefined = no tocar).
    const patch: Record<string, unknown> = {
      id: input.demoStoreId,
      stock_location_id: input.stockLocationId,
    };
    if (input.regionId !== undefined) {
      patch.region_id = input.regionId;
    }
    const before = await service.retrieveDemoStore(input.demoStoreId);
    await service.updateDemoStores(patch);
    return new StepResponse(
      { updated: true },
      {
        demoStoreId: input.demoStoreId,
        previousStockLocationId: before?.stock_location_id ?? null,
        previousRegionId: before?.region_id ?? null,
        touchedRegion: input.regionId !== undefined,
      },
    );
  },
  async (compensation, { container }) => {
    if (!compensation) return;
    const service: any = container.resolve(DEMO_STORE_MODULE);
    const rollback: Record<string, unknown> = {
      id: compensation.demoStoreId,
      stock_location_id: compensation.previousStockLocationId,
    };
    if (compensation.touchedRegion) {
      rollback.region_id = compensation.previousRegionId;
    }
    await service.updateDemoStores(rollback);
  },
);

export const updateDemoStoreStockLocationWorkflow = createWorkflow(
  'update-demo-store-stock-location',
  (input: UpdateDemoStoreStockLocationInput) => {
    const context = validateInputStep(input);

    unlinkOldStockLocationStep({
      previousStockLocationId: context.previousStockLocationId,
      salesChannelId: context.salesChannelId,
    });

    linkNewStockLocationStep(
      transform({ input, context }, ({ input, context }) => ({
        newStockLocationId: input.stock_location_id,
        salesChannelId: context.salesChannelId,
      })),
    );

    persistDemoRowStep(
      transform({ input }, ({ input }) => ({
        demoStoreId: input.demo_store_id,
        stockLocationId: input.stock_location_id,
        regionId: input.region_id,
      })),
    );

    return new WorkflowResponse({ demo_store_id: input.demo_store_id });
  },
);
