/**
 * optimize-route (M8) — optimiza automáticamente el ORDEN de las paradas de una
 * Route minimizando la distancia total, usando el optimizador puro
 * (nearest-neighbor + 2-opt sobre haversine) del módulo delivery.
 *
 * Qué hace y qué NO:
 *  - SOLO reordena: reescribe el `sequence` de los RouteStops existentes. NO
 *    agrega, quita ni cambia qué stops tiene la ruta (a diferencia de
 *    update-route-stops, que sí hace el diff de pertenencia). Por eso acá NO se
 *    reusa update-route-stops: ese workflow es para EDITAR la composición; este
 *    solo resecuencia, y lo hace con service.updateRouteStops por id (el mismo
 *    mecanismo que update-route-stops usa para actualizar sequences).
 *
 * Origen del recorrido (punto de salida del optimizador):
 *  1) Si la ruta tiene `store_location_id` y esa sucursal tiene lat/lng válidas
 *     (en store_location.lat/lng, que son TEXT → se parsean), ese es el origen.
 *  2) Fallback: si no hay sucursal o no tiene coords, se usa el PRIMER stop con
 *     coordenadas válidas (orden por sequence) como origen. Ese stop igual entra
 *     al cálculo como parada; arrancar el NN desde él solo fija el ancla inicial.
 *  3) Si no hay NINGÚN origen resoluble (sin sucursal con coords y sin stops con
 *     coords), no hay nada que optimizar: se devuelve improvement 0 y no se toca
 *     el orden (idempotente / no-op seguro).
 *
 * Idempotencia: correrlo sobre una ruta ya óptima deja el mismo orden y reporta
 * improvement_pct 0 (el optimizador nunca devuelve un orden peor que el actual).
 * Reescribir sequences a los mismos valores es inofensivo.
 *
 * optimization_meta persistido en la Route:
 *   { optimized_at, algorithm: 'nn+2opt', total_distance_km, original_distance_km,
 *     improvement_pct, optimized_count, unlocated_count }
 * `optimized_at` se sella en el workflow con new Date() (mismo patrón que
 * dispatch-route / service.transition, que usan new Date() directo en el backend).
 *
 * Compensación: restaura los sequences previos de cada stop y el optimization_meta
 * previo de la ruta.
 */

import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { MedusaError } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../modules/delivery';
import type DeliveryModuleService from '../modules/delivery/service';
import { STORE_LOCATION_MODULE } from '../modules/store-location';
import type StoreLocationModuleService from '../modules/store-location/service';
import {
  optimizeStops,
  type GeoPoint,
  type OptimizerStop,
} from '../modules/delivery/route-optimizer';
import { isTerminalRouteStatus } from '../modules/delivery/types';

export interface OptimizeRouteInput {
  route_id: string;
}

export interface OptimizeRouteResult {
  route_id: string;
  /** Cómo se resolvió el origen del recorrido. */
  origin_source: 'store_location' | 'first_stop' | 'none';
  total_distance_km: number;
  original_distance_km: number;
  improvement_pct: number;
  optimized_count: number;
  unlocated_count: number;
  stop_count: number;
  /** Metadatos persistidos en route.optimization_meta. */
  optimization_meta: RouteOptimizationMeta;
}

/** Forma de lo que guardamos en route.optimization_meta. */
export interface RouteOptimizationMeta {
  optimized_at: string;
  algorithm: 'nn+2opt';
  total_distance_km: number;
  original_distance_km: number;
  improvement_pct: number;
  optimized_count: number;
  unlocated_count: number;
  origin_source: 'store_location' | 'first_stop' | 'none';
}

type UnknownRecord = Record<string, unknown>;

const toNumber = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Snapshot para compensación: sequences previos + optimization_meta previo. */
interface OptimizeSnapshot {
  route_id: string;
  prev_meta: unknown;
  prev_sequences: { id: string; sequence: number }[];
}

const optimizeRouteStep = createStep(
  'optimize-route-stops',
  async (input: OptimizeRouteInput, { container }) => {
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);
    const storeLocationService =
      container.resolve<StoreLocationModuleService>(STORE_LOCATION_MODULE);

    // 1) Ruta debe existir y no estar terminal (no reordenamos rutas cerradas).
    const route = (await service
      .retrieveRoute(input.route_id)
      .catch(() => null)) as UnknownRecord | null;
    if (!route) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Route ${input.route_id} no existe.`,
      );
    }
    const status = String(route.status);
    if (isTerminalRouteStatus(status)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `La ruta ${input.route_id} está en estado terminal '${status}'; no se puede reoptimizar.`,
      );
    }

    // 2) Stops actuales ordenados por sequence (el orden ORIGINAL contra el que
    //    medimos la mejora).
    const stops = (await service.listRouteStops(
      { route_id: input.route_id },
      { order: { sequence: 'ASC' } },
    )) as UnknownRecord[];

    const prevSequences = stops.map((s) => ({
      id: String(s.id),
      sequence: Number(s.sequence) || 0,
    }));

    // 3) Resolución del origen.
    let origin: GeoPoint | null = null;
    let originSource: OptimizeRouteResult['origin_source'] = 'none';

    const storeLocationId = route.store_location_id as string | null;
    if (storeLocationId) {
      const loc = (await storeLocationService
        .retrieveStoreLocation(storeLocationId)
        .catch(() => null)) as UnknownRecord | null;
      const lat = toNumber(loc?.lat);
      const lng = toNumber(loc?.lng);
      if (lat !== null && lng !== null) {
        origin = { lat, lng };
        originSource = 'store_location';
      }
    }

    // Fallback: primer stop (por sequence) con coords válidas como ancla inicial.
    if (!origin) {
      for (const s of stops) {
        const lat = toNumber(s.lat);
        const lng = toNumber(s.lng);
        if (lat !== null && lng !== null) {
          origin = { lat, lng };
          originSource = 'first_stop';
          break;
        }
      }
    }

    const optimizerStops: OptimizerStop[] = stops.map((s) => ({
      id: String(s.id),
      lat: toNumber(s.lat),
      lng: toNumber(s.lng),
    }));

    const optimizedAt = new Date();

    // 4) Sin origen resoluble → no-op seguro (no tocamos el orden).
    if (!origin) {
      const meta: RouteOptimizationMeta = {
        optimized_at: optimizedAt.toISOString(),
        algorithm: 'nn+2opt',
        total_distance_km: 0,
        original_distance_km: 0,
        improvement_pct: 0,
        optimized_count: 0,
        unlocated_count: stops.length,
        origin_source: 'none',
      };
      await service.updateRoutes({
        id: input.route_id,
        optimization_meta: meta as unknown as Record<string, unknown>,
      });
      const snapshot: OptimizeSnapshot = {
        route_id: input.route_id,
        prev_meta: route.optimization_meta ?? null,
        prev_sequences: prevSequences,
      };
      return new StepResponse(
        {
          route_id: input.route_id,
          origin_source: 'none' as const,
          total_distance_km: 0,
          original_distance_km: 0,
          improvement_pct: 0,
          optimized_count: 0,
          unlocated_count: stops.length,
          stop_count: stops.length,
          optimization_meta: meta,
        } satisfies OptimizeRouteResult,
        snapshot,
      );
    }

    // 5) Optimización pura.
    const result = optimizeStops(origin, optimizerStops);

    // 6) Reescritura de sequences según el orden óptimo (1..n). Solo se persiste
    //    el cambio en los stops cuyo sequence efectivamente cambió.
    const desiredSequenceById = new Map<string, number>();
    result.ordered.forEach((stopId, idx) => {
      desiredSequenceById.set(stopId, idx + 1);
    });

    const prevSequenceById = new Map<string, number>(
      prevSequences.map((p) => [p.id, p.sequence]),
    );

    for (const [stopId, seq] of desiredSequenceById) {
      if (prevSequenceById.get(stopId) !== seq) {
        await service.updateRouteStops({ id: stopId, sequence: seq });
      }
    }

    // 7) Persistir métricas en la ruta.
    const meta: RouteOptimizationMeta = {
      optimized_at: optimizedAt.toISOString(),
      algorithm: 'nn+2opt',
      total_distance_km: result.total_distance_km,
      original_distance_km: result.original_distance_km,
      improvement_pct: result.improvement_pct,
      optimized_count: result.optimized_count,
      unlocated_count: result.unlocated_count,
      origin_source: originSource,
    };
    await service.updateRoutes({
      id: input.route_id,
      optimization_meta: meta as unknown as Record<string, unknown>,
    });

    const snapshot: OptimizeSnapshot = {
      route_id: input.route_id,
      prev_meta: route.optimization_meta ?? null,
      prev_sequences: prevSequences,
    };

    return new StepResponse(
      {
        route_id: input.route_id,
        origin_source: originSource,
        total_distance_km: result.total_distance_km,
        original_distance_km: result.original_distance_km,
        improvement_pct: result.improvement_pct,
        optimized_count: result.optimized_count,
        unlocated_count: result.unlocated_count,
        stop_count: stops.length,
        optimization_meta: meta,
      } satisfies OptimizeRouteResult,
      snapshot,
    );
  },
  async (snapshot: OptimizeSnapshot | undefined, { container }) => {
    if (!snapshot) return;
    const service = container.resolve<DeliveryModuleService>(DELIVERY_MODULE);

    // Restaurar sequences previos de los stops que todavía existan.
    const currentStops = (await service.listRouteStops({
      route_id: snapshot.route_id,
    })) as UnknownRecord[];
    const currentIds = new Set(currentStops.map((s) => String(s.id)));
    for (const prev of snapshot.prev_sequences) {
      if (currentIds.has(prev.id)) {
        await service.updateRouteStops({ id: prev.id, sequence: prev.sequence });
      }
    }

    // Restaurar optimization_meta previo.
    await service.updateRoutes({
      id: snapshot.route_id,
      optimization_meta: snapshot.prev_meta as Record<string, unknown> | null,
    });
  },
);

export const optimizeRouteWorkflow = createWorkflow(
  'optimize-route',
  (input: OptimizeRouteInput) => {
    const result = optimizeRouteStep(input);
    return new WorkflowResponse(result);
  },
);

export default optimizeRouteWorkflow;
