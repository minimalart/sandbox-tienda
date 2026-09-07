import { z } from 'zod';

/**
 * Param del tracking_number en el endpoint unificado de timeline.
 * Mismo formato aceptado que el endpoint legacy /store/andreani/tracking.
 */
export const GetDeliveryTrackingParams = z.object({
  tracking_number: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{8,15}$/, 'Invalid tracking number format'),
});

export type GetDeliveryTrackingParamsType = z.infer<
  typeof GetDeliveryTrackingParams
>;
