'use client';

import { useRecentlyViewedStore } from '@minimalart/mercatto-storefront-shared/stores/recently-viewed';
import { useEffect } from 'react';

/**
 * Registra la visita al producto actual. No renderiza nada.
 *
 * Es un componente propio y NO un agregado a `lib/analytics/product-view-tracker.tsx`,
 * que ya corre en cada PDP. Razones: ese archivo es core, su vecino
 * `google-analytics.tsx` lo posee la extensión `ga4`, y acoplarlos ataría dos
 * extensiones entre sí además de agregar otro punto de montaje core que habría que
 * generar. Un recorder dentro del slot del PDP suma exactamente un punto de montaje.
 *
 * Toma primitivas y no el producto entero, así el efecto se re-dispara sólo al cambiar
 * de producto (mismo criterio que el tracker de GA4).
 */
export default function RecentlyViewedRecorder({
  productId,
  handle,
}: {
  productId: string;
  handle?: string | null;
}) {
  const load = useRecentlyViewedStore((state) => state.load);
  const record = useRecentlyViewedStore((state) => state.record);

  useEffect(() => {
    // Cargar primero: sin esto el primer `record` escribiría sobre una lista vacía y
    // borraría el historial que había en localStorage.
    load();
    record({ id: productId, handle });
  }, [productId, handle, load, record]);

  return null;
}
