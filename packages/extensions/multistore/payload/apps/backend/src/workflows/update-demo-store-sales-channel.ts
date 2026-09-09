import type { ISalesChannelModuleService } from '@medusajs/framework/types';
/**
 * Reasigna el sales channel de una demo store (incluida la principal).
 *
 * El SC es la IDENTIDAD DE CATÁLOGO del demo: los productos que la storefront
 * lee salen de ahí. Cambiarlo tiene tres efectos que este workflow reconstituye
 * atómicamente (steps compensables):
 *
 *  1. `stock_location ↔ sales_channel` — si el demo tiene SL asignado, el link
 *     se transfiere del SC viejo al SC nuevo. Sin esto, las shipping options
 *     del SL siguen conectadas al SC viejo y el checkout del demo se rompe.
 *
 *  2. `publishable_api_key ↔ sales_channel` — TODAS las publishable keys se
 *     re-linkean: pierden el SC viejo, ganan el SC nuevo. Sin esto la storefront
 *     sigue leyendo un canal que la demo ya no usa (o peor, sigue leyéndolo pero
 *     el demo apunta a otro).
 *
 *  3. `demo_store.sales_channel_id` — persiste el ID nuevo.
 *
 * `null` explícito = desasignar (raro; deja el demo sin SC → sin catálogo).
 * String vacío no está permitido por el schema.
 *
 * NO se valida "canal ya adoptado por otra demo" ni "canal default de main":
 * el operador es responsable del cambio, y la validación existente
 * (`assertAdoptableSalesChannel`) es demasiado estricta para el update (por
 * ejemplo, la principal creada con el default_sales_channel del Medusa Store
 * quiere justamente moverse a otro).
 */
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import {
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from '@medusajs/core-flows';
import { MedusaError, Modules } from '@medusajs/framework/utils';
import { DEMO_STORE_MODULE } from '../modules/demo-store';

export type UpdateDemoStoreSalesChannelInput = {
  demo_store_id: string;
  sales_channel_id: string | null;
};

/**
 * Valida el estado inicial:
 *  - El demo existe.
 *  - El SC nuevo (si no es null) existe.
 *  - Snapshot de `previousSalesChannelId` + `stockLocationId` para los steps
 *    siguientes.
 *  - Recolecta TODAS las publishable_api_keys — el link se re-hace sobre las
 *    mismas, no se filtran por SC (la lógica de `provision.ts` es "linkear a
 *    todas para que la storefront siempre encuentre su catálogo").
 */
const validateStep = createStep(
  'update-demo-sales-channel-validate',
  async (input: UpdateDemoStoreSalesChannelInput, { container }) => {
    const service: any = container.resolve(DEMO_STORE_MODULE);
    const demo = await service.retrieveDemoStore(input.demo_store_id);
    if (!demo) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Demo store ${input.demo_store_id} no existe.`,
      );
    }

    if (input.sales_channel_id) {
      const scService = container.resolve<ISalesChannelModuleService>(Modules.SALES_CHANNEL);
      const [sc] = await scService.listSalesChannels({ id: input.sales_channel_id });
      if (!sc) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Sales channel ${input.sales_channel_id} no existe.`,
        );
      }
      if (sc.id === demo.sales_channel_id) {
        // No-op: el operador puso el mismo SC. No hay nada que hacer, pero
        // devolver un error tipado es más útil que ejecutar todo el workflow
        // silencioso (y potencialmente romper links por transacción vacía).
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `El sales channel ya es el ${sc.id}. Elegí uno distinto para reasignar.`,
        );
      }
    }

    const apiKeyService: any = container.resolve(Modules.API_KEY);
    const publishableKeys = await apiKeyService.listApiKeys({ type: 'publishable' });

    return new StepResponse({
      previousSalesChannelId: (demo.sales_channel_id as string | null) ?? null,
      stockLocationId: (demo.stock_location_id as string | null) ?? null,
      publishableKeyIds: (publishableKeys as any[]).map((k) => k.id as string),
    });
  },
);

/**
 * Transfiere el link SL↔SC del SC viejo al SC nuevo (si el demo tiene SL y hay
 * SCs válidos en ambos extremos). Sin este step, el checkout con el SL del demo
 * seguiría offreciendo shipping options ligadas al SC viejo — y esas dejan de
 * existir para el demo cuando se lo re-vincula al SC nuevo.
 */
const relinkStockLocationStep = createStep(
  'update-demo-sales-channel-relink-sl',
  async (
    input: {
      stockLocationId: string | null;
      previousSalesChannelId: string | null;
      newSalesChannelId: string | null;
    },
    { container },
  ) => {
    if (!input.stockLocationId) {
      return new StepResponse({ relinked: false }, null);
    }
    // Remove old, then add new. Idempotente: si el link no existía, no falla.
    if (input.previousSalesChannelId) {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: {
          id: input.stockLocationId,
          remove: [input.previousSalesChannelId],
        },
      });
    }
    if (input.newSalesChannelId) {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: {
          id: input.stockLocationId,
          add: [input.newSalesChannelId],
        },
      });
    }
    return new StepResponse(
      { relinked: true },
      {
        stockLocationId: input.stockLocationId,
        previousSalesChannelId: input.previousSalesChannelId,
        newSalesChannelId: input.newSalesChannelId,
      },
    );
  },
  async (compensation, { container }) => {
    if (!compensation) return;
    // Revert: quita el nuevo, restaura el viejo.
    if (compensation.newSalesChannelId) {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: {
          id: compensation.stockLocationId,
          remove: [compensation.newSalesChannelId],
        },
      });
    }
    if (compensation.previousSalesChannelId) {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: {
          id: compensation.stockLocationId,
          add: [compensation.previousSalesChannelId],
        },
      });
    }
  },
);

/**
 * Re-linkea TODAS las publishable_api_keys al SC nuevo (y desliga del viejo).
 * Igual criterio que `provisionDemoStore` — el operador no elige cuál key
 * usa la storefront (`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`), así que se linkean
 * todas para no romper el read del catálogo.
 */
const relinkPublishableKeysStep = createStep(
  'update-demo-sales-channel-relink-pks',
  async (
    input: {
      publishableKeyIds: string[];
      previousSalesChannelId: string | null;
      newSalesChannelId: string | null;
    },
    { container },
  ) => {
    for (const keyId of input.publishableKeyIds) {
      if (input.previousSalesChannelId) {
        await linkSalesChannelsToApiKeyWorkflow(container).run({
          input: { id: keyId, remove: [input.previousSalesChannelId] },
        });
      }
      if (input.newSalesChannelId) {
        await linkSalesChannelsToApiKeyWorkflow(container).run({
          input: { id: keyId, add: [input.newSalesChannelId] },
        });
      }
    }
    return new StepResponse(
      { relinked: input.publishableKeyIds.length },
      {
        publishableKeyIds: input.publishableKeyIds,
        previousSalesChannelId: input.previousSalesChannelId,
        newSalesChannelId: input.newSalesChannelId,
      },
    );
  },
  async (compensation, { container }) => {
    if (!compensation) return;
    for (const keyId of compensation.publishableKeyIds) {
      if (compensation.newSalesChannelId) {
        await linkSalesChannelsToApiKeyWorkflow(container).run({
          input: { id: keyId, remove: [compensation.newSalesChannelId] },
        });
      }
      if (compensation.previousSalesChannelId) {
        await linkSalesChannelsToApiKeyWorkflow(container).run({
          input: { id: keyId, add: [compensation.previousSalesChannelId] },
        });
      }
    }
  },
);

/**
 * Persiste el nuevo `sales_channel_id` en la fila. Es el último step para que
 * si algo antes falla, la fila siga consistente con los links (que ya se
 * reconstruyeron o no se tocaron).
 */
const persistStep = createStep(
  'update-demo-sales-channel-persist',
  async (
    input: { demoStoreId: string; salesChannelId: string | null },
    { container },
  ) => {
    const service: any = container.resolve(DEMO_STORE_MODULE);
    const before = await service.retrieveDemoStore(input.demoStoreId);
    await service.updateDemoStores({
      id: input.demoStoreId,
      sales_channel_id: input.salesChannelId,
    });
    return new StepResponse(
      { updated: true },
      {
        demoStoreId: input.demoStoreId,
        previousSalesChannelId: (before?.sales_channel_id as string | null) ?? null,
      },
    );
  },
  async (compensation, { container }) => {
    if (!compensation) return;
    const service: any = container.resolve(DEMO_STORE_MODULE);
    await service.updateDemoStores({
      id: compensation.demoStoreId,
      sales_channel_id: compensation.previousSalesChannelId,
    });
  },
);

export const updateDemoStoreSalesChannelWorkflow = createWorkflow(
  'update-demo-store-sales-channel',
  (input: UpdateDemoStoreSalesChannelInput) => {
    const context = validateStep(input);

    relinkStockLocationStep(
      transform({ input, context }, ({ input, context }) => ({
        stockLocationId: context.stockLocationId,
        previousSalesChannelId: context.previousSalesChannelId,
        newSalesChannelId: input.sales_channel_id,
      })),
    );

    relinkPublishableKeysStep(
      transform({ input, context }, ({ input, context }) => ({
        publishableKeyIds: context.publishableKeyIds,
        previousSalesChannelId: context.previousSalesChannelId,
        newSalesChannelId: input.sales_channel_id,
      })),
    );

    persistStep(
      transform({ input }, ({ input }) => ({
        demoStoreId: input.demo_store_id,
        salesChannelId: input.sales_channel_id,
      })),
    );

    return new WorkflowResponse({ demo_store_id: input.demo_store_id });
  },
);
