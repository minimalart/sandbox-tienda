/**
 * auto-build-routes (F6) — AUTO-ARMADO de rutas de flota propia: toma las
 * ejecuciones own_fleet sin rutear de una sucursal (y opcionalmente una zona),
 * las reparte entre los vehículos disponibles por bin-packing (buildRoutes,
 * función PURA) y crea una Route por bin REUSANDO el workflow create-route. Si se
 * pide, optimiza el orden de cada ruta reusando optimize-route.
 *
 * NO duplica la creación de rutas ni la optimización: cada bin se materializa
 * invocando createRouteWorkflow(container).run(...) (mismo patrón que
 * dispatch-route, que itera assign-delivery dentro de un step porque el SDK no
 * permite loops dinámicos de runAsStep en la definición del workflow). La
 * optimización opcional invoca optimizeRouteWorkflow del mismo modo.
 *
 * SOLO FLOTA PROPIA: el candidato debe ser own_fleet, no terminal y sin ruta.
 *
 * DECISIÓN — order_count = 1 por ejecución:
 *  Cada DeliveryExecution = UN pedido a entregar. El tope max_orders del vehículo
 *  (y max_orders_per_vehicle) se interpreta como "máximo de PEDIDOS por viaje",
 *  no de items. Por eso cada stop aporta order_count=1 al bin, independientemente
 *  de cuántos items tenga la orden. El peso/volumen sí se acumulan reales
 *  (buildOrderItemsAggregate) para respetar capacity_kg/capacity_m3.
 *
 * NO lanza error si no hay candidatos: devuelve routes:[] y unassigned:[].
 */

import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import { DELIVERY_TERMINAL_STATUSES } from '../modules/delivery/types';
import { buildOrderItemsAggregate } from '../modules/delivery/order-context';
import {
  buildRoutes,
  type BuildableStop,
  type BuildableVehicle,
} from '../modules/delivery/route-builder';
import createRouteWorkflow from './create-route';
import optimizeRouteWorkflow from './optimize-route';

export interface AutoBuildRoutesInput {
  store_location_id: string;
  delivery_zone_id?: string | null;
  planned_date?: string | Date | null;
  max_orders_per_vehicle?: number | null;
  fill_priority?: 'fill_first' | 'balance';
  optimize?: boolean;
}

export interface AutoBuildRoutesResult {
  routes: {
    route_id: string;
    code: string;
    vehicle_id: string | null;
    stop_count: number;
  }[];
  unassigned_execution_ids: string[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/* ===========================================================================
 * Step 1 — cargar ejecuciones candidatas y derivar BuildableStop por cada una.
 * ===========================================================================*/

interface LoadStopsInput {
  store_location_id: string;
  delivery_zone_id?: string | null;
}

const loadCandidateExecutionsStep = createStep(
  'auto-build-load-candidate-executions',
  async (input: LoadStopsInput, { container }) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    // Candidatas: own_fleet, status NO terminal, SIN ruta, de esta sucursal (y
    // zona si vino). route_id null → todavía no ruteadas.
    const filters: Record<string, unknown> = {
      provider_type: 'own_fleet',
      store_location_id: input.store_location_id,
      route_id: null,
      status: { $nin: [...DELIVERY_TERMINAL_STATUSES] },
    };
    if (input.delivery_zone_id) {
      filters.delivery_zone_id = input.delivery_zone_id;
    }

    const executions = (await service.listDeliveryExecutions(filters, {
      select: ['id', 'status', 'provider_type', 'route_id'],
    })) as UnknownRecord[];

    const executionIds = executions
      .map((e) => (typeof e.id === 'string' ? e.id : null))
      .filter((id): id is string => Boolean(id));

    if (executionIds.length === 0) {
      return new StepResponse<BuildableStop[]>([]);
    }

    // Una sola query.graph para todas: items (peso/temperatura) + dirección
    // (lat/lng + volume_m3) — mismo set de fields que usa getEligibleResources /
    // create-route.
    const { data: rows } = await query.graph({
      entity: 'delivery_execution',
      fields: [
        'id',
        'order.shipping_address.metadata',
        'order.items.quantity',
        'order.items.variant_sku',
        'order.items.variant.sku',
        'order.items.variant.weight',
        'order.items.product.weight',
        'order.items.variant.metadata',
        'order.items.product.metadata',
      ],
      filters: { id: executionIds },
    });

    const byId = new Map<string, UnknownRecord>();
    for (const r of (rows ?? []) as UnknownRecord[]) {
      byId.set(String(r.id), r);
    }

    const stops: BuildableStop[] = executionIds.map((executionId) => {
      const row = byId.get(executionId);
      const order = isRecord(row?.order) ? row!.order : undefined;
      const items = Array.isArray(order?.items) ? (order!.items as unknown[]) : [];
      const aggregate = buildOrderItemsAggregate(items);

      const addr = isRecord(order?.shipping_address)
        ? (order!.shipping_address as UnknownRecord)
        : undefined;
      const meta = isRecord(addr?.metadata)
        ? (addr!.metadata as UnknownRecord)
        : undefined;

      const lat = toNumber(meta?.lat);
      const lng = toNumber(meta?.lng);
      const volumeM3 = toNumber(meta?.volume_m3) ?? 0;

      return {
        execution_id: executionId,
        weight_kg: aggregate.weight_kg ?? 0,
        volume_m3: volumeM3,
        // DECISIÓN: 1 pedido por ejecución (ver doc de cabecera).
        order_count: 1,
        temperature: aggregate.temperature,
        lat,
        lng,
      };
    });

    return new StepResponse(stops);
  },
);

/* ===========================================================================
 * Step 2 — cargar la flota disponible como BuildableVehicle.
 * ===========================================================================*/

interface LoadFleetInput {
  store_location_id: string;
  delivery_zone_id?: string | null;
}

const loadFleetStep = createStep(
  'auto-build-load-fleet',
  async (input: LoadFleetInput, { container }) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

    // Vehicle es multi-sucursal (store_location_ids json): traemos los activos
    // y filtramos por membresía en la sucursal (el query generado no soporta
    // "contiene" sobre json).
    const vehicleRows = (
      (await service.listVehicles({ active: true })) as UnknownRecord[]
    ).filter(
      (v) =>
        Array.isArray(v.store_location_ids) &&
        (v.store_location_ids as string[]).includes(input.store_location_id),
    );

    // Si vino zona y la zona tiene vehículos mapeados (ZoneResource), restringimos
    // a esos. Si la zona NO tiene NINGÚN vehículo mapeado → sin restricción (todos
    // los de la sucursal) — misma semántica null-vs-[] de getEligibleResources.
    let allowedVehicleIds: Set<string> | null = null;
    if (input.delivery_zone_id) {
      const zoneRows = (await service.listZoneResources({
        delivery_zone_id: input.delivery_zone_id,
        resource_type: 'vehicle',
        active: true,
      })) as UnknownRecord[];
      if (zoneRows.length > 0) {
        allowedVehicleIds = new Set(
          zoneRows
            .map((z) => (typeof z.resource_id === 'string' ? z.resource_id : null))
            .filter((id): id is string => Boolean(id)),
        );
      }
    }

    const vehicles: BuildableVehicle[] = vehicleRows
      .filter((v) =>
        allowedVehicleIds ? allowedVehicleIds.has(String(v.id)) : true,
      )
      .map((v) => ({
        id: String(v.id),
        capacity_kg: v.capacity_kg == null ? null : Number(v.capacity_kg),
        capacity_m3: v.capacity_m3 == null ? null : Number(v.capacity_m3),
        max_orders: v.max_orders == null ? null : Number(v.max_orders),
        has_refrigeration: Boolean(v.has_refrigeration),
        temperature_modes: Array.isArray(v.temperature_modes)
          ? (v.temperature_modes as unknown[]).map(String)
          : null,
      }));

    return new StepResponse(vehicles);
  },
);

/* ===========================================================================
 * Step 3 — bin-packing PURO (sin DB). buildRoutes.
 * ===========================================================================*/

interface PackInput {
  stops: BuildableStop[];
  vehicles: BuildableVehicle[];
  max_orders_per_vehicle?: number | null;
  fill_priority?: 'fill_first' | 'balance';
}

const packStep = createStep('auto-build-pack', async (input: PackInput) => {
  const result = buildRoutes(input.stops, input.vehicles, {
    max_orders_per_vehicle: input.max_orders_per_vehicle ?? null,
    fill_priority: input.fill_priority ?? 'fill_first',
  });
  return new StepResponse(result);
});

/* ===========================================================================
 * Step 4 — crear una Route por bin (REUSA create-route) y opcionalmente
 * optimizar (REUSA optimize-route). Patrón dispatch-route: iterar .run() dentro
 * de un step.
 * ===========================================================================*/

interface CreateRoutesInput {
  store_location_id: string;
  planned_date?: string | Date | null;
  optimize?: boolean;
  bins: {
    vehicle_id: string | null;
    execution_ids: string[];
  }[];
}

const createRoutesStep = createStep(
  'auto-build-create-routes',
  async (input: CreateRoutesInput, { container }) => {
    const routes: AutoBuildRoutesResult['routes'] = [];

    for (const bin of input.bins) {
      if (!bin.execution_ids.length) continue;

      const { result: created } = await createRouteWorkflow(container).run({
        input: {
          store_location_id: input.store_location_id,
          vehicle_id: bin.vehicle_id,
          planned_date: input.planned_date ?? null,
          execution_ids: bin.execution_ids,
        },
      });

      const routeId = created.route_id;

      if (input.optimize) {
        await optimizeRouteWorkflow(container).run({
          input: { route_id: routeId },
        });
      }

      routes.push({
        route_id: routeId,
        code: created.code,
        vehicle_id: bin.vehicle_id,
        stop_count: created.stop_count,
      });
    }

    return new StepResponse(routes);
  },
);

export const autoBuildRoutesWorkflow = createWorkflow(
  'auto-build-routes',
  (input: AutoBuildRoutesInput) => {
    const stops = loadCandidateExecutionsStep({
      store_location_id: input.store_location_id,
      delivery_zone_id: input.delivery_zone_id,
    });

    const vehicles = loadFleetStep({
      store_location_id: input.store_location_id,
      delivery_zone_id: input.delivery_zone_id,
    });

    const packInput = transform({ stops, vehicles, input }, (data) => ({
      stops: data.stops,
      vehicles: data.vehicles,
      max_orders_per_vehicle: data.input.max_orders_per_vehicle ?? null,
      fill_priority: data.input.fill_priority ?? 'fill_first',
    }));
    const packed = packStep(packInput);

    const createInput = transform({ packed, input }, (data) => ({
      store_location_id: data.input.store_location_id,
      planned_date: data.input.planned_date ?? null,
      optimize: data.input.optimize ?? false,
      bins: data.packed.bins.map((b) => ({
        vehicle_id: b.vehicle_id,
        execution_ids: b.execution_ids,
      })),
    }));
    const routes = createRoutesStep(createInput);

    return new WorkflowResponse(
      transform({ routes, packed }, (data) => ({
        routes: data.routes,
        unassigned_execution_ids: data.packed.unassigned,
      })),
    );
  },
);

export default autoBuildRoutesWorkflow;
