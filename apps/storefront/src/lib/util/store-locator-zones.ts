import type { StoreLocatorZone } from '../types/store-locator';

// GeoJSON positions use longitude, latitude. Boundary points belong to the zone.
function ringContains(ring: number[][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j];
    const [bx, by] = ring[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (
      Math.abs(cross) < 1e-10 &&
      x >= Math.min(ax, bx) &&
      x <= Math.max(ax, bx) &&
      y >= Math.min(ay, by) &&
      y <= Math.max(ay, by)
    )
      return true;
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function matchesZone(
  lat: number | null,
  lng: number | null,
  zone: StoreLocatorZone
): boolean {
  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const polygons =
    zone.geometry.type === 'Polygon' ? [zone.geometry.coordinates] : zone.geometry.coordinates;
  return polygons.some(
    ([outer, ...holes]) =>
      !!outer &&
      ringContains(outer, lng, lat) &&
      !holes.some((hole) => ringContains(hole, lng, lat))
  );
}
