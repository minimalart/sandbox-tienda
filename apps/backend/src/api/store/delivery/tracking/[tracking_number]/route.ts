/**
 * Store API — Timeline unificado de tracking (M4).
 *
 * GET /store/delivery/tracking/:tracking_number
 *
 * A diferencia del endpoint legacy /store/andreani/tracking (que pega EN VIVO a
 * Andreani en cada request), este sirve el timeline YA NORMALIZADO y persistido
 * que el job de sync + los eventos de driver/sistema fueron appendeando a la
 * tabla `tracking_event`. Resuelve la DeliveryExecution por tracking_number, lee
 * sus TrackingEvents ordenados por occurred_at y los devuelve.
 *
 * El endpoint legacy NO se toca: sigue funcionando para quien consuma el shape
 * crudo de Andreani. Este es la nueva fuente unificada multi-provider.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { TimelineEvent } from '../../../../../modules/delivery/tracking-types';

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const getString = (source: unknown, key: string): string | null => {
  if (!isRecord(source)) return null;
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
};

const toIso = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim().length > 0) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  return null;
};

const toLocation = (
  value: unknown,
): { lat: number; lng: number } | null => {
  if (!isRecord(value)) return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const sendError = (
  res: MedusaResponse,
  status: number,
  payload: { code: string; message: string },
) =>
  res
    .status(status)
    .json({ error: payload, timestamp: new Date().toISOString() });

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El middleware (validateAndTransformQuery sobre params no aplica acá: validamos
  // el param manualmente con el mismo regex del validator para mantener el shape
  // de error 400 consistente con el endpoint legacy).
  const trackingNumber = (req.params.tracking_number ?? '').trim();

  if (!trackingNumber) {
    sendError(res, 400, {
      code: 'MISSING_TRACKING_NUMBER',
      message: 'Tracking number is required',
    });
    return;
  }

  if (!/^[A-Z0-9]{8,15}$/.test(trackingNumber)) {
    sendError(res, 400, {
      code: 'INVALID_TRACKING_NUMBER',
      message: 'Invalid tracking number format',
    });
    return;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  // 1) Resolver la ejecución por tracking_number.
  const { data: executions } = await query.graph({
    entity: 'delivery_execution',
    fields: ['id', 'status', 'provider_type', 'tracking_number'],
    filters: { tracking_number: trackingNumber },
  });

  const execution = (executions as UnknownRecord[])?.[0];

  if (!execution) {
    sendError(res, 404, {
      code: 'TRACKING_NOT_FOUND',
      message: 'No delivery execution found for this tracking number',
    });
    return;
  }

  const executionId = getString(execution, 'id');
  if (!executionId) {
    sendError(res, 404, {
      code: 'TRACKING_NOT_FOUND',
      message: 'No delivery execution found for this tracking number',
    });
    return;
  }

  // 2) Traer los eventos del timeline ordenados por occurred_at.
  const { data: rawEvents } = await query.graph({
    entity: 'tracking_event',
    fields: [
      'id',
      'source',
      'code',
      'external_code',
      'description',
      'occurred_at',
      'location',
    ],
    filters: { delivery_execution_id: executionId },
    pagination: { order: { occurred_at: 'ASC' } },
  });

  const events: TimelineEvent[] = (rawEvents as UnknownRecord[]).map((e) => ({
    code: getString(e, 'code') ?? 'unknown',
    source: getString(e, 'source') ?? 'system',
    description: getString(e, 'description'),
    occurred_at: toIso(e.occurred_at),
    location: toLocation(e.location),
  }));

  res.status(200).json({
    tracking_number: trackingNumber,
    status: getString(execution, 'status') ?? 'pending',
    provider_type: getString(execution, 'provider_type'),
    events,
    last_updated: new Date().toISOString(),
  });
}
