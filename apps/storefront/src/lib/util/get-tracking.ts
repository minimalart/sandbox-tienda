import { CARRIER_REGISTRY, getCarrier } from "@lib/constants";
import type { HttpTypes } from "@medusajs/types";

// ============================================================================
// TIPOS
// ============================================================================

/**
 * Un ticket generado por el workflow de tickets del carrier (ej.
 * andreani-generate-tickets.ts), persistido en order.metadata bajo una clave
 * por carrier.
 */
type CarrierTicket = {
  tracking_number: string;
  generated_at: string;
};

/** Clave de order.metadata donde cada carrier appendea sus tickets generados. */
const CARRIER_TICKET_METADATA_KEYS: Record<string, string> = {
  andreani: "andreani_tickets",
  // El workflow `correo-generate-tickets` appendea acá (ver
  // apps/backend/src/workflows/correo-generate-tickets.ts). El ticket de
  // Correo no emite placeholders `PENDING-*` como Andreani — el filtro de
  // isPendingTrackingNumber más abajo simplemente nunca matchea para este
  // carrier, no hace falta una rama aparte.
  correo_argentino: "correo_tickets",
};

export type OrderTracking = {
  number: string;
  url: string;
  carrier: string;
};

// ============================================================================
// HELPERS
// ============================================================================

function isPendingTrackingNumber(value?: string | null): boolean {
  return !!value?.startsWith("PENDING-");
}

// ============================================================================
// getTracking
// ============================================================================

/**
 * Resuelve el tracking number + URL pública + carrier de una orden.
 *
 * Antes esto vivía duplicado en order-details-template.tsx y
 * b2b-order-detail.tsx, cada uno con su propia URL de Andreani hardcodeada y
 * su propia lectura de `order.metadata.andreani_tickets`.
 *
 * Prioriza el tracking number del label del fulfillment (más reciente) y cae
 * al último ticket persistido en metadata si el label todavía está en el
 * placeholder `PENDING-<display_id>` que usan los fulfillments antes de que
 * el carrier confirme el número real.
 */
export function getTracking(
  order: HttpTypes.StoreOrder,
): OrderTracking | null {
  const labelTracking = (
    order.fulfillments?.[0] as { labels?: { tracking_number?: string }[] } | undefined
  )?.labels?.[0]?.tracking_number;

  // Hoy solo existe Andreani — cuando se sume un segundo carrier, este loop ya
  // recorre todas las claves de metadata registradas y toma el ticket más
  // reciente entre todos, sin tocar este archivo.
  const latestTicket = Object.entries(CARRIER_TICKET_METADATA_KEYS)
    .flatMap(([carrierId, metadataKey]) => {
      const tickets = order.metadata?.[metadataKey] as
        | CarrierTicket[]
        | undefined;
      return (tickets ?? []).map((ticket) => ({ ...ticket, carrierId }));
    })
    .sort(
      (a, b) =>
        new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime(),
    )[0];

  const rawTracking = isPendingTrackingNumber(labelTracking)
    ? latestTicket?.tracking_number
    : (labelTracking ?? latestTicket?.tracking_number);

  const trackingNumber = isPendingTrackingNumber(rawTracking)
    ? undefined
    : rawTracking;

  if (!trackingNumber) return null;

  // Si el TN vino solo del label (sin ticket de metadata) no sabemos el
  // carrier — hoy es siempre Andreani, así que ese es el fallback.
  const carrier =
    getCarrier(latestTicket?.carrierId) ?? CARRIER_REGISTRY.andreani;

  return {
    number: trackingNumber,
    url: carrier.trackingUrlTemplate(trackingNumber),
    carrier: carrier.id,
  };
}
