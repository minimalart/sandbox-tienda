import { Button, Container, Heading, Text } from '@medusajs/ui';
import { useMemo } from 'react';
import {
  useCoveragesOverview,
  type ZoneConflictGeometry,
} from '../../../../hooks/api/delivery';
import { ExtensionVersion } from '../../../../components/common/extension-version';
import { SiteScopeBar } from '../../../../components/common/site-scope-bar';
import { ZonesConflictMap } from '../../zones/conflicts/zones-map';

// Misma paleta que la vista de conflictos, para coherencia visual.
const PALETTE = [
  '#2563eb',
  '#16a34a',
  '#db2777',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#dc2626',
  '#059669',
  '#4f46e5',
];
const NO_STORE_COLOR = '#6b7280';
const NO_STORE_KEY = '__none';

const CoveragesMapPage = () => {
  const { data, isLoading } = useCoveragesOverview();
  const coverages = useMemo(() => data?.coverages ?? [], [data]);

  // Adaptamos las coberturas a la forma que consume el mapa (reusa el de zonas).
  const mapZones: ZoneConflictGeometry[] = useMemo(
    () =>
      coverages.map((c) => ({
        zone_id: c.id,
        zone_name: c.name,
        store_location_id: c.store_location_id,
        store_name: c.store_name,
        branch_coverage_id: c.id,
        coverage_name: c.name,
        polygon: c.polygon,
      })),
    [coverages],
  );

  const { colorByZoneId, legend } = useMemo(() => {
    const storeOrder: string[] = [];
    const storeName = new Map<string, string>();
    for (const c of coverages) {
      const key = c.store_location_id ?? NO_STORE_KEY;
      if (!storeName.has(key)) {
        storeName.set(key, c.store_name ?? 'Sin sucursal');
        storeOrder.push(key);
      }
    }
    const colorOfStore = new Map<string, string>();
    let i = 0;
    for (const key of storeOrder) {
      if (key === NO_STORE_KEY) {
        colorOfStore.set(key, NO_STORE_COLOR);
      } else {
        colorOfStore.set(key, PALETTE[i % PALETTE.length]);
        i++;
      }
    }
    const byId: Record<string, string> = {};
    for (const c of coverages) {
      byId[c.id] =
        colorOfStore.get(c.store_location_id ?? NO_STORE_KEY) ?? NO_STORE_COLOR;
    }
    const leg = storeOrder.map((key) => ({
      key,
      name: storeName.get(key) ?? 'Sin sucursal',
      color: colorOfStore.get(key) ?? NO_STORE_COLOR,
    }));
    return { colorByZoneId: byId, legend: leg };
  }, [coverages]);

  const emptyConflicts = useMemo(() => new Set<string>(), []);

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading>Mapa de coberturas</Heading>
          <ExtensionVersion extension="delivery" />
        </div>
        <Button size="small" variant="secondary" asChild>
          <a href="/app/delivery/coverages">Volver a coberturas</a>
        </Button>
      </div>

      {/*
        `scoped`: el mapa se alimenta de `admin/delivery/coverages-overview`, que mete
        el filtro en el WHERE de las sucursales
        (`siteFilter(…, BRANCH_COVERAGE_SITE_SCOPE)`, descriptor en
        `modules/store-location/site-scope.ts`).

        Es la pantalla donde el badge más importa: un mapa que dice "así se reparte el
        territorio" mostrando polígonos de otra tienda no se lee como un error de
        filtro, se lee como un solapamiento que hay que ir a arreglar.
      */}
      <SiteScopeBar screen="delivery.coverages-map" />

      <div className="flex flex-col gap-4 px-6 pt-4 pb-6">
        <Text size="small" className="text-ui-fg-subtle">
          Todas las coberturas activas, coloreadas por sucursal. Sirve para ver
          de un vistazo cómo se reparte el territorio y dónde se pisan.
        </Text>

        {legend.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {legend.map((l) => (
              <div key={l.key} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ backgroundColor: l.color }}
                />
                <Text size="xsmall">{l.name}</Text>
              </div>
            ))}
          </div>
        )}

        {isLoading ? (
          <Text size="small" className="text-ui-fg-subtle">
            Cargando coberturas…
          </Text>
        ) : mapZones.length === 0 ? (
          <Text size="small" className="text-ui-fg-subtle">
            No hay coberturas activas con polígono para mostrar.
          </Text>
        ) : (
          <ZonesConflictMap
            zones={mapZones}
            colorByZoneId={colorByZoneId}
            conflictIds={emptyConflicts}
          />
        )}
      </div>
    </Container>
  );
};

export default CoveragesMapPage;
