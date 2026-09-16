import { Button, Text, toast } from '@medusajs/ui';
import { useEffect, useRef, useState } from 'react';

import { getGoogleMapsApiKey, loadGoogleMaps } from './google-maps-loader';
import {
  extractGeoJsonAreas,
  ringToPolygonPoints,
  type GeoJsonAreasResult,
} from './geojson-areas';


import type { PolygonPoint } from './types';
export type { PolygonPoint };

/**
 * Todos los textos del picker. Se pasan por prop en vez de leerse de i18n
 * porque el componente lo usan dos extensiones con namespaces distintos
 * (`storeLocations` para la cobertura de una sucursal, `multistore` para las
 * zonas del store locator) y una de las dos puede no estar instalada.
 */
export type PolygonPickerLabels = {
  upload: string;
  draw: string;
  drawFinish: string;
  drawUndo: string;
  drawCancel: string;
  drawNeedThree: string;
  clear: string;
  /** Recibe la cantidad de vértices. */
  points: (n: number) => string;
  drawHint: string;
  editHint: string;
  mapHint: string;
  geojsonError: string;
  /** Recibe cuántas áreas trae el archivo. */
  geojsonMulti: (n: number) => string;
  geojsonHoles: (n: number) => string;
  geojsonDiscarded: (n: number) => string;
  mapsLoading: string;
  mapsKeyError: string;
  mapsNoKeyHint: string;
};

/* Narrow structural typings for the Google Maps API (no @types here). */
type LatLngLike = { lat: number; lng: number };
type GLatLng = { lat: () => number; lng: () => number };
type GMapsEventListener = unknown;
type GMVCArray = {
  getAt: (i: number) => GLatLng;
  getLength: () => number;
  push: (p: LatLngLike) => void;
  removeAt: (i: number) => void;
  insertAt: (i: number, p: LatLngLike) => void;
  addListener: (event: string, handler: (...args: unknown[]) => void) => GMapsEventListener;
};
type GPolygon = {
  setMap: (map: unknown) => void;
  getPath: () => GMVCArray;
  setEditable: (editable: boolean) => void;
  addListener: (event: string, handler: (...args: unknown[]) => void) => GMapsEventListener;
};
type GPolyline = { setMap: (map: unknown) => void; setPath: (path: LatLngLike[]) => void };
type GMarker = { setMap: (map: unknown) => void };
type GMap = {
  addListener?: (event: string, handler: (...args: unknown[]) => void) => GMapsEventListener;
  fitBounds?: (b: unknown) => void;
};
type GMapsNS = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
  Polygon: new (opts: Record<string, unknown>) => GPolygon;
  Polyline: new (opts: Record<string, unknown>) => GPolyline;
  Marker: new (opts: Record<string, unknown>) => GMarker;
  LatLngBounds: new () => { extend: (p: LatLngLike) => void };
  event: {
    removeListener: (listener: GMapsEventListener) => void;
    clearInstanceListeners: (instance: unknown) => void;
  };
};

const DEFAULT_CENTER = { lat: -34.6037, lng: -58.3816 };

const getMaps = (): GMapsNS | null =>
  (window as unknown as { google?: { maps?: GMapsNS } }).google?.maps ?? null;

/** Stored points → {lat,lng}[] (drop the trailing closing duplicate for rendering). */
const polygonPointsToLatLng = (points: PolygonPoint[]): LatLngLike[] => {
  const ring = points.map((p) => ({ lat: parseFloat(p.y), lng: parseFloat(p.x) }));
  const a = ring[0];
  const b = ring[ring.length - 1];
  if (ring.length >= 2 && a && b && a.lat === b.lat && a.lng === b.lng) {
    ring.pop();
  }
  return ring.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
};

/** {lat,lng}[] (open ring) → stored PolygonPoint[] (closed). Reuses ringToPolygonPoints. */
const latLngToPolygonPoints = (ring: LatLngLike[]): PolygonPoint[] =>
  ringToPolygonPoints(ring.map((p) => [p.lng, p.lat]));

/** Read the current vertices of a polygon path as {lat,lng}[]. */
const readPath = (path: GMVCArray): LatLngLike[] => {
  const out: LatLngLike[] = [];
  const len = path.getLength();
  for (let i = 0; i < len; i++) {
    const ll = path.getAt(i);
    out.push({ lat: ll.lat(), lng: ll.lng() });
  }
  return out;
};

export interface PolygonMapPickerProps {
  labels: PolygonPickerLabels;
  value: PolygonPoint[] | null;
  onChange: (polygon: PolygonPoint[]) => void;
  /** Optional initial center (e.g. the branch's lat/lng). */
  center?: { lat: number; lng: number } | null;
  /**
   * When true, the map polygon is editable (drag vertices, right-click to
   * delete, click-to-draw a new one). Default false → read-only preview, which
   * keeps `coverage-section` behaving exactly as before.
   */
  editable?: boolean;
  /**
   * OPCIONAL. Cuando está presente, el archivo subido se DELEGA al consumidor
   * con todas sus áreas y el picker no toca `value`: el que decide qué hacer
   * con N áreas es quien maneja la lista de coberturas, no el picker de un
   * polígono.
   *
   * Cuando NO está presente (el consumidor de `delivery/coverages`), el picker
   * sigue cargando una sola área — pero AVISA cuántas había. Ese silencio es el
   * bug que dejó a las cuatro sucursales de Bariloche con el polígono de Junín
   * de los Andes.
   */
  onAreasParsed?: (result: GeoJsonAreasResult, fileName: string) => void;
}

/**
 * Coverage polygon input. Always supports GeoJSON upload + a map preview.
 *
 * When `editable` is true it additionally lets the user:
 *  - Draw a brand-new polygon by clicking on the map (then "Finish" to close it).
 *  - Edit an existing polygon by dragging its vertices / inserting via the
 *    ghost midpoints / right-clicking a vertex to delete it.
 *
 * The legacy `google.maps.drawing.DrawingManager` is NOT used (removed in Maps
 * JS API v3.65); drawing is done with native click handling + an editable
 * `google.maps.Polygon`. Vertices are stored as `PolygonPoint[]` ({x:lng,
 * y:lat}, closed ring).
 *
 * El GeoJSON subido se parsea con `extractGeoJsonAreas`, que devuelve TODAS las
 * áreas del archivo. Este componente edita UN polígono, así que sólo puede
 * quedarse con una: si el archivo trae más, lo dice con un toast, y si el
 * consumidor pasa `onAreasParsed` le delega la decisión completa.
 */
export const PolygonMapPicker = ({
  labels,
  value,
  onChange,
  center,
  editable = false,
  onAreasParsed,
}: PolygonMapPickerProps) => {
  const apiKey = getGoogleMapsApiKey();

  const [isLoaded, setIsLoaded] = useState(false);
  const [hasMapError, setHasMapError] = useState(false);
  // Drawing mode (only relevant when `editable`): a new ring being clicked out.
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawCount, setDrawCount] = useState(0);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GMap | null>(null);
  const polygonRef = useRef<GPolygon | null>(null);
  // Listeners attached to the editable polygon path (must be torn down).
  const pathListenersRef = useRef<GMapsEventListener[]>([]);
  // True while the polygon is being drawn live (markers + polyline previews).
  const drawClickListenerRef = useRef<GMapsEventListener | null>(null);
  const drawMarkersRef = useRef<GMarker[]>([]);
  const drawLineRef = useRef<GPolyline | null>(null);
  const drawPointsRef = useRef<LatLngLike[]>([]);
  /**
   * Marks that the next `value` change originated from this component (drag /
   * vertex edit / finished drawing). When set, the rebuild effect skips
   * re-creating the polygon from scratch, avoiding flicker and listener churn.
   */
  const internalChangeRef = useRef(false);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const pointCount = value?.length ?? 0;
  const hasPolygon = pointCount >= 3;

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => !cancelled && (setHasMapError(false), setIsLoaded(true)))
      .catch(() => !cancelled && setHasMapError(true));
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  /** Tear down all path listeners attached to the current editable polygon. */
  const clearPathListeners = () => {
    const maps = getMaps();
    if (maps) {
      pathListenersRef.current.forEach((l) => maps.event.removeListener(l));
    }
    pathListenersRef.current = [];
  };

  /** Remove the live-drawing overlays (markers + polyline) and click listener. */
  const clearDrawingOverlays = () => {
    const maps = getMaps();
    if (drawClickListenerRef.current && maps) {
      maps.event.removeListener(drawClickListenerRef.current);
    }
    drawClickListenerRef.current = null;
    drawMarkersRef.current.forEach((m) => m.setMap(null));
    drawMarkersRef.current = [];
    drawLineRef.current?.setMap(null);
    drawLineRef.current = null;
    drawPointsRef.current = [];
  };

  /**
   * Attach an editable polygon for `ring` and wire path listeners that push
   * every vertex edit back through onChange (flagged as an internal change).
   */
  const attachEditablePolygon = (map: GMap, maps: GMapsNS, ring: LatLngLike[]) => {
    const polygon = new maps.Polygon({
      paths: ring,
      editable: true,
      draggable: false,
      clickable: true,
      strokeColor: '#2e7d32',
      strokeWeight: 2,
      fillColor: '#2e7d32',
      fillOpacity: 0.15,
      map,
    });
    polygonRef.current = polygon;

    const emit = () => {
      const path = polygon.getPath();
      const pts = readPath(path);
      if (pts.length < 3) return;
      internalChangeRef.current = true;
      onChangeRef.current(latLngToPolygonPoints(pts));
    };

    const path = polygon.getPath();
    pathListenersRef.current.push(
      path.addListener('set_at', emit),
      path.addListener('insert_at', emit),
      path.addListener('remove_at', emit),
    );
    // Right-click a vertex to delete it (only if >3 vertices remain).
    pathListenersRef.current.push(
      polygon.addListener('rightclick', (...args: unknown[]) => {
        const ev = args[0] as { vertex?: number } | undefined;
        if (ev?.vertex == null) return;
        const p = polygon.getPath();
        if (p.getLength() <= 3) {
          toast.error(labels.drawNeedThree);
          return;
        }
        p.removeAt(ev.vertex); // triggers remove_at → emit
      }),
    );
  };

  // Build / rebuild the map overlay whenever the polygon, map or mode changes.
  useEffect(() => {
    const maps = getMaps();
    if (!isLoaded || !maps || !mapDivRef.current) return;

    if (!mapRef.current) {
      mapRef.current = new maps.Map(mapDivRef.current, {
        center: center ?? DEFAULT_CENTER,
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
      });
    }
    const map = mapRef.current;

    // If the change came from the polygon itself (drag/edit), the overlay is
    // already correct — don't rebuild it (avoids flicker + listener churn).
    if (internalChangeRef.current) {
      internalChangeRef.current = false;
      return;
    }

    // While actively drawing a new ring, leave the live overlay untouched.
    if (isDrawing) return;

    // Drop the previous polygon + its listeners.
    clearPathListeners();
    polygonRef.current?.setMap(null);
    polygonRef.current = null;

    const ring = value?.length ? polygonPointsToLatLng(value) : [];
    if (ring.length >= 3) {
      if (editable) {
        attachEditablePolygon(map, maps, ring);
      } else {
        polygonRef.current = new maps.Polygon({
          paths: ring,
          editable: false,
          draggable: false,
          clickable: false,
          strokeColor: '#2e7d32',
          strokeWeight: 2,
          fillColor: '#2e7d32',
          fillOpacity: 0.15,
          map,
        });
      }
      const bounds = new maps.LatLngBounds();
      ring.forEach((p) => bounds.extend(p));
      map.fitBounds?.(bounds);
    }
  }, [isLoaded, value, center, editable, isDrawing]);

  // Cleanup on unmount: remove every listener + overlay we created.
  useEffect(() => {
    return () => {
      const maps = getMaps();
      clearPathListeners();
      clearDrawingOverlays();
      if (maps && polygonRef.current) {
        maps.event.clearInstanceListeners(polygonRef.current);
      }
      polygonRef.current?.setMap(null);
      polygonRef.current = null;
    };
  }, []);

  /** Render the in-progress drawing overlay from drawPointsRef. */
  const renderDrawingOverlay = (map: GMap, maps: GMapsNS) => {
    const pts = drawPointsRef.current;
    // Markers for each vertex.
    drawMarkersRef.current.forEach((m) => m.setMap(null));
    drawMarkersRef.current = pts.map(
      (p) =>
        new maps.Marker({
          position: p,
          map,
          // Small dot.
          icon: {
            path: 0, // google.maps.SymbolPath.CIRCLE
            scale: 5,
            fillColor: '#2e7d32',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 1,
          },
        }),
    );
    // Connecting polyline.
    if (!drawLineRef.current) {
      drawLineRef.current = new maps.Polyline({
        path: pts,
        strokeColor: '#2e7d32',
        strokeWeight: 2,
        clickable: false,
        map,
      });
    } else {
      drawLineRef.current.setPath(pts);
    }
  };

  const startDrawing = () => {
    const maps = getMaps();
    const map = mapRef.current;
    if (!maps || !map || !map.addListener) return;

    // Remove any existing polygon while drawing a fresh one.
    clearPathListeners();
    polygonRef.current?.setMap(null);
    polygonRef.current = null;

    clearDrawingOverlays();
    drawPointsRef.current = [];
    setDrawCount(0);
    setIsDrawing(true);

    drawClickListenerRef.current = map.addListener('click', (...args: unknown[]) => {
      const ev = args[0] as { latLng?: GLatLng } | undefined;
      const ll = ev?.latLng;
      if (!ll) return;
      drawPointsRef.current.push({ lat: ll.lat(), lng: ll.lng() });
      setDrawCount(drawPointsRef.current.length);
      renderDrawingOverlay(map, maps);
    });
  };

  const undoLastPoint = () => {
    const maps = getMaps();
    const map = mapRef.current;
    if (!maps || !map) return;
    drawPointsRef.current.pop();
    setDrawCount(drawPointsRef.current.length);
    renderDrawingOverlay(map, maps);
  };

  const cancelDrawing = () => {
    clearDrawingOverlays();
    setDrawCount(0);
    setIsDrawing(false);
  };

  const finishDrawing = () => {
    const pts = drawPointsRef.current;
    if (pts.length < 3) {
      toast.error(labels.drawNeedThree);
      return;
    }
    const points = latLngToPolygonPoints(pts);
    clearDrawingOverlays();
    setDrawCount(0);
    setIsDrawing(false);
    // External change (not internal): let the rebuild effect create the
    // editable polygon from `value` on the next render.
    onChange(points);
  };

  const handleClear = () => {
    if (isDrawing) cancelDrawing();
    clearPathListeners();
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    onChange([]);
  };

  const handleFile = async (file: File) => {
    let result: GeoJsonAreasResult;
    try {
      result = extractGeoJsonAreas(JSON.parse(await file.text()));
    } catch {
      toast.error(labels.geojsonError);
      return;
    }

    // El consumidor sabe manejar N áreas: se le pasa el reporte completo y el
    // picker no decide nada.
    if (onAreasParsed) {
      onAreasParsed(result, file.name);
      return;
    }

    // Modo un-polígono. Lo que NO puede pasar es cargar el área #0 en silencio.
    const first = result.areas[0];
    if (!first) {
      toast.error(labels.geojsonError);
      return;
    }
    if (result.areas.length > 1) {
      toast.warning(labels.geojsonMulti(result.areas.length));
    }
    if (result.ignoredHoles > 0) {
      toast.warning(labels.geojsonHoles(result.ignoredHoles));
    }
    if (result.discarded.length) {
      toast.warning(labels.geojsonDiscarded(result.discarded.length));
    }

    const points = ringToPolygonPoints(first.ring);
    if (points.length < 3) {
      toast.error(labels.geojsonError);
      return;
    }
    onChange(points);
  };

  const canDraw = editable && apiKey && !hasMapError && isLoaded;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {!isDrawing && (
          <label className="inline-flex">
            <Button variant="secondary" size="small" asChild>
              <span>{labels.upload}</span>
            </Button>
            <input
              type="file"
              accept=".geojson,.json,application/geo+json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.currentTarget.value = '';
              }}
            />
          </label>
        )}

        {/* Draw controls (editable + map available + no polygon yet). */}
        {canDraw && !hasPolygon && !isDrawing && (
          <Button type="button" size="small" variant="secondary" onClick={startDrawing}>
            {labels.draw}
          </Button>
        )}

        {isDrawing && (
          <>
            <Button
              type="button"
              size="small"
              variant="primary"
              onClick={finishDrawing}
              disabled={drawCount < 3}
            >
              {labels.drawFinish}
            </Button>
            <Button
              type="button"
              size="small"
              variant="secondary"
              onClick={undoLastPoint}
              disabled={drawCount === 0}
            >
              {labels.drawUndo}
            </Button>
            <Button type="button" size="small" variant="transparent" onClick={cancelDrawing}>
              {labels.drawCancel}
            </Button>
          </>
        )}

        {hasPolygon && !isDrawing && (
          <Button type="button" size="small" variant="transparent" onClick={handleClear}>
            {labels.clear}
          </Button>
        )}
      </div>

      {hasPolygon && !isDrawing && (
        <Text size="small" className="text-ui-tag-green-text">
          {labels.points(pointCount)}
        </Text>
      )}

      {isDrawing && (
        <Text size="small" className="text-ui-fg-subtle">
          {labels.points(drawCount)}
        </Text>
      )}

      {apiKey && !hasMapError ? (
        isLoaded ? (
          <div
            ref={mapDivRef}
            className="h-[280px] w-full overflow-hidden rounded-lg border border-ui-border-base"
          />
        ) : (
          <Text size="small" className="text-ui-fg-subtle">
            {labels.mapsLoading}
          </Text>
        )
      ) : (
        <Text size="small" className="text-ui-fg-subtle">
          {apiKey ? labels.mapsKeyError : labels.mapsNoKeyHint}
        </Text>
      )}

      <Text size="small" className="text-ui-fg-subtle">
        {editable
          ? isDrawing
            ? labels.drawHint
            : hasPolygon
              ? labels.editHint
              : labels.mapHint
          : labels.mapHint}
      </Text>
    </div>
  );
};
