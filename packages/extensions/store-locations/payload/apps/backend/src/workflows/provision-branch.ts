import {
  createWorkflow,
  createStep,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { STORE_LOCATION_MODULE } from '../modules/store-location';
import type StoreLocationModuleService from '../modules/store-location/service';

export type ChannelType = 'b2c' | 'b2b' | 'in_person';

export type ProvisionBranchInput = {
  /** StoreLocation (branch) id. */
  store_location_id: string;
  /** Inventory location the branch ships from. `null` clears it. */
  stock_location_id?: string | null;
  /** Operational status. */
  active?: boolean;
  /**
   * Sales channels owned by this branch. The branch↔channel links are synced to
   * exactly this set (missing links created, stale links dismissed), and each
   * channel's `metadata.channel_type` is set.
   */
  sales_channels?: { id: string; channel_type: ChannelType }[];
};

/**
 * EL ORDEN DE LAS CLAVES IMPORTA y no es cosmético.
 *
 * `remoteLink` registra cada link con una clave armada a partir del ORDEN de las
 * relaciones declaradas en `defineLink` (`modules-sdk/src/link.ts`: `[primary
 * .serviceName, primary.foreignKey, foreign.serviceName, foreign.foreignKey]
 * .join('-')`), y resuelve el módulo con un lookup EXACTO de esa misma clave,
 * reconstruida desde `Object.keys(link)`. Un objeto con las claves al revés no
 * matchea nada: `create`/`dismiss` tiran "Module to type ... was not found.
 * Ensure the link exists, keys are correct, and link is passed in the correct
 * order" — que es exactamente lo que rompía el provisioning de sucursales.
 *
 * `links/store-location-sales-channel.ts` declara salesChannel PRIMERO, así que
 * acá va primero. Si algún día se invierte ese `defineLink`, hay que invertir esto.
 */
type BranchChannelLink = {
  [Modules.SALES_CHANNEL]: { sales_channel_id: string };
  [STORE_LOCATION_MODULE]: { store_location_id: string };
};

const buildBranchChannelLink = (
  storeLocationId: string,
  salesChannelId: string,
): BranchChannelLink => ({
  [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannelId },
  [STORE_LOCATION_MODULE]: { store_location_id: storeLocationId },
});

/**
 * Link NATIVO de Medusa. Orden correcto: `sales-channel-location.ts` del core
 * declara sus `relationships` como [SALES_CHANNEL, STOCK_LOCATION].
 */
const buildChannelStockLink = (salesChannelId: string, stockLocationId: string) => ({
  [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannelId },
  [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
});

/**
 * Turns a step failure into something OBSERVABLE.
 *
 * Two facts about Medusa 2.18 make a failing step disappear without a trace:
 *  1. Both workflow engines round-trip the transaction checkpoint through JSON
 *     (`workflow-orchestrator-storage.ts`: `JSON.parse(JSON.stringify(...))` on
 *     read for in-memory, `JSON.stringify({ errors, flow })` for redis). An
 *     Error's `message` and `stack` are NON-enumerable, so the error reaches
 *     `workflow.run()` as a bare `{}` — not even an Error instance.
 *  2. `TransactionOrchestrator` never logs step failures. There is no logger
 *     call anywhere in it.
 *
 * So the only place the real error still exists is right here, inside the step.
 * This logs it (with its stack) at the source, and returns a replacement whose
 * `message` is redefined as ENUMERABLE so it survives the JSON round-trip and
 * reaches the HTTP response instead of the caller's generic fallback.
 */
const stepFailure = (container: MedusaContainer, step: string, error: unknown): Error => {
  const detail = error instanceof Error ? error.message : String(error);
  const message = `${step}: ${detail}`;

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  logger.error(`[provision-branch] ${message}`);
  if (error instanceof Error && error.stack) logger.error(error.stack);

  const failure = new Error(message);
  Object.defineProperty(failure, 'message', {
    value: message,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return failure;
};

/**
 * Updates the branch's operational fields (stock_location_id, active). Restores
 * the previous values on rollback.
 */
const updateBranchOperationalStep = createStep(
  'provision-branch-update-operational',
  async (
    input: { store_location_id: string; stock_location_id?: string | null; active?: boolean },
    { container },
  ) => {
    try {
      const service: StoreLocationModuleService = container.resolve(STORE_LOCATION_MODULE);
      const prev = await service.retrieveStoreLocation(input.store_location_id);

      const update: Record<string, unknown> = { id: input.store_location_id };
      if (input.stock_location_id !== undefined) update.stock_location_id = input.stock_location_id;
      if (input.active !== undefined) update.active = input.active;

      await service.updateStoreLocations(update);

      return new StepResponse(
        { store_location_id: input.store_location_id },
        {
          store_location_id: input.store_location_id,
          stock_location_id: prev.stock_location_id ?? null,
          active: prev.active,
        },
      );
    } catch (error) {
      throw stepFailure(container, 'update-operational', error);
    }
  },
  async (prev, { container }) => {
    if (!prev) return;
    const service: StoreLocationModuleService = container.resolve(STORE_LOCATION_MODULE);
    await service.updateStoreLocations({
      id: prev.store_location_id,
      stock_location_id: prev.stock_location_id,
      active: prev.active,
    });
  },
);

/**
 * Syncs the branch↔sales-channel links to the requested set and stamps
 * `metadata.channel_type` on each channel. Rollback reverts both the links and
 * the channel metadata.
 */
const syncBranchSalesChannelsStep = createStep(
  'provision-branch-sync-channels',
  async (
    input: {
      store_location_id: string;
      sales_channels?: { id: string; channel_type: ChannelType }[];
    },
    { container },
  ) => {
    try {
      const link = container.resolve(ContainerRegistrationKeys.LINK);
      const query = container.resolve(ContainerRegistrationKeys.QUERY);
      const scService = container.resolve(Modules.SALES_CHANNEL);

      const salesChannels = input.sales_channels ?? [];

      const { data: branchRows } = await query.graph({
        entity: 'store_location',
        fields: ['id', 'sales_channels.id'],
        filters: { id: input.store_location_id },
      });
      const currentIds: string[] = (branchRows?.[0]?.sales_channels ?? []).map(
        (s: { id: string }) => s.id,
      );
      const desiredIds = salesChannels.map((s) => s.id);

      const toAdd = desiredIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !desiredIds.includes(id));

      if (toAdd.length) {
        await link.create(toAdd.map((id) => buildBranchChannelLink(input.store_location_id, id)));
      }
      if (toRemove.length) {
        await link.dismiss(toRemove.map((id) => buildBranchChannelLink(input.store_location_id, id)));
      }

      const prevMetadata: Record<string, Record<string, unknown> | null> = {};
      for (const sc of salesChannels) {
        const existing = await scService.retrieveSalesChannel(sc.id);
        prevMetadata[sc.id] = (existing.metadata as Record<string, unknown> | null) ?? null;
        await scService.updateSalesChannels(sc.id, {
          metadata: { ...(existing.metadata ?? {}), channel_type: sc.channel_type },
        });
      }

      return new StepResponse(
        { added: toAdd, removed: toRemove },
        { store_location_id: input.store_location_id, added: toAdd, removed: toRemove, prevMetadata },
      );
    } catch (error) {
      throw stepFailure(container, 'sync-channels', error);
    }
  },
  async (prev, { container }) => {
    if (!prev) return;
    const link = container.resolve(ContainerRegistrationKeys.LINK);
    const scService = container.resolve(Modules.SALES_CHANNEL);

    if (prev.added.length) {
      await link.dismiss(prev.added.map((id) => buildBranchChannelLink(prev.store_location_id, id)));
    }
    if (prev.removed.length) {
      await link.create(prev.removed.map((id) => buildBranchChannelLink(prev.store_location_id, id)));
    }
    for (const [scId, metadata] of Object.entries(prev.prevMetadata)) {
      await scService.updateSalesChannels(scId, { metadata });
    }
  },
);

/**
 * Links the branch's sales channels to its stock location (native SC↔stock
 * link), so inventory for those channels is served from this branch's
 * warehouse. No-op when there is no stock location or no channels. Idempotent.
 */
type LinkStockCompensation = { added: string[]; stock_location_id: string | null };

const linkChannelsToStockLocationStep = createStep(
  'provision-branch-link-stock',
  async (
    input: {
      stock_location_id?: string | null;
      sales_channels?: { id: string; channel_type: ChannelType }[];
    },
    { container },
  ) => {
    try {
      const channelIds = (input.sales_channels ?? []).map((s) => s.id);
      if (!input.stock_location_id || !channelIds.length) {
        const empty: LinkStockCompensation = { added: [], stock_location_id: null };
        return new StepResponse({ added: [] as string[] }, empty);
      }
      const stockLocationId = input.stock_location_id;
      const link = container.resolve(ContainerRegistrationKeys.LINK);
      const query = container.resolve(ContainerRegistrationKeys.QUERY);

      const { data: locRows } = await query.graph({
        entity: 'stock_location',
        fields: ['id', 'sales_channels.id'],
        filters: { id: stockLocationId },
      });
      const linkedIds: string[] = (locRows?.[0]?.sales_channels ?? []).map(
        (s: { id: string }) => s.id,
      );
      const toAdd = channelIds.filter((id) => !linkedIds.includes(id));

      if (toAdd.length) {
        await link.create(toAdd.map((id) => buildChannelStockLink(id, stockLocationId)));
      }

      const compensation: LinkStockCompensation = { added: toAdd, stock_location_id: stockLocationId };
      return new StepResponse({ added: toAdd }, compensation);
    } catch (error) {
      throw stepFailure(container, 'link-stock', error);
    }
  },
  async (prev: LinkStockCompensation | undefined, { container }) => {
    if (!prev?.added.length || !prev.stock_location_id) return;
    const stockLocationId = prev.stock_location_id;
    const link = container.resolve(ContainerRegistrationKeys.LINK);
    await link.dismiss(prev.added.map((id) => buildChannelStockLink(id, stockLocationId)));
  },
);

/**
 * Provisions / re-syncs a branch's commercial wiring: its inventory location,
 * its sales channels (links + channel_type), and the native sales-channel ↔
 * stock-location links so inventory resolves for those channels.
 *
 * Idempotent: safe to re-run with the desired end state.
 */
export const provisionBranchWorkflow = createWorkflow(
  'provision-branch',
  (input: ProvisionBranchInput) => {
    updateBranchOperationalStep({
      store_location_id: input.store_location_id,
      stock_location_id: input.stock_location_id,
      active: input.active,
    });

    const channelSync = syncBranchSalesChannelsStep({
      store_location_id: input.store_location_id,
      sales_channels: input.sales_channels,
    });

    linkChannelsToStockLocationStep({
      stock_location_id: input.stock_location_id,
      sales_channels: input.sales_channels,
    });

    return new WorkflowResponse(channelSync);
  },
);

export default provisionBranchWorkflow;
