import { Text } from '@medusajs/ui';
import { useEffect, useRef, useState } from 'react';
import {
  getGoogleMapsApiKey,
  loadGoogleMaps,
} from '../../../../components/geo/google-maps-loader';
import type { ZoneConflictGeometry } from '../../../../hooks/api/delivery';

/* Tipados estructurales mínimos de la Google Maps API (sin @types). */
type LatLngLike = { lat: number; lng: number };
type GPolygon = { setMap: (map: unknown) => void };
type GMap = { fitBounds?: (b: unknown) => void };
type GMapsNS = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
  Polygon: new (opts: Record<string, unknown>) => GPolygon;
  LatLngBounds: new () => { extend: (p: LatLngLike) => void; isEmpty: () => boolean };
};

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

const getMaps = (): GMapsNS | null =>
  (window as unknown as { google?: { maps?: GMapsNS } }).google?.maps ?? null;

/** Anillo almacenado {x:lng,y:lat} (strings) → {lat,lng}[] para Google Maps. */
const toLatLng = (polygon: { x: string; y: string }[]): LatLngLike[] =>
  polygon
    .map((p) => ({ lat: parseFloat(p.y), lng: parseFloat(p.x) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

type ZonesConflictMapProps = {
  zones: ZoneConflictGeometry[];
  /** zoneId → color de relleno/contorno (coherente con la leyenda por sucursal). */
  colorByZoneId: Record<string, string>;
  /** Ids de zonas en conflicto: se resaltan con contorno más marcado. */
  conflictIds: Set<string>;
};

/**
 * Mapa read-only que pinta TODAS las coberturas de zonas activas, coloreadas por
 * sucursal. Las zonas en conflicto se dibujan con contorno más grueso para ver
 * dónde se solapan. Reusa el loader de Google Maps del módulo store-locations.
 */
export const ZonesConflictMap = ({
  zones,
  colorByZoneId,
  conflictIds,
}: ZonesConflictMapProps) => {
  const apiKey = getGoogleMapsApiKey();
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GMap | null>(null);
  const polygonsRef = useRef<GPolygon[]>([]);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => !cancelled && (setHasError(false), setIsLoaded(true)))
      .catch(() => !cancelled && setHasError(true));
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    const maps = getMaps();
    if (!isLoaded || !maps || !mapDivRef.current) return;

    if (!mapRef.current) {
      mapRef.current = new maps.Map(mapDivRef.current, {
        center: DEFAULT_CENTER,
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
      });
    }
    const map = mapRef.current;

    // Limpiar polígonos previos.
    polygonsRef.current.forEach((p) => p.setMap(null));
    polygonsRef.current = [];

    const bounds = new maps.LatLngBounds();
    for (const zone of zones) {
      const ring = toLatLng(zone.polygon);
      if (ring.length < 3) continue;
      const color = colorByZoneId[zone.zone_id] ?? '#6b7280';
      const inConflict = conflictIds.has(zone.zone_id);
      const polygon = new maps.Polygon({
        paths: ring,
        strokeColor: inConflict ? '#dc2626' : color,
        strokeWeight: inConflict ? 3 : 1.5,
        strokeOpacity: 0.9,
        fillColor: color,
        fillOpacity: inConflict ? 0.35 : 0.18,
        clickable: false,
        map,
      });
      polygonsRef.current.push(polygon);
      ring.forEach((p) => bounds.extend(p));
    }
    if (!bounds.isEmpty()) map.fitBounds?.(bounds);
  }, [isLoaded, zones, colorByZoneId, conflictIds]);

  useEffect(() => {
    return () => {
      polygonsRef.current.forEach((p) => p.setMap(null));
      polygonsRef.current = [];
    };
  }, []);

  if (!apiKey || hasError) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        {apiKey
          ? 'No se pudo cargar Google Maps.'
          : 'Falta GOOGLE_MAPS_API_KEY para ver el mapa de zonas.'}
      </Text>
    );
  }

  if (!isLoaded) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        Cargando mapa…
      </Text>
    );
  }

  return (
    <div
      ref={mapDivRef}
      className="h-[480px] w-full overflow-hidden rounded-lg border border-ui-border-base"
    />
  );
};

export default ZonesConflictMap;
