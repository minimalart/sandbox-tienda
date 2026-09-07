import { Badge, Button, Container, Heading, Table, Text } from '@medusajs/ui';
import { useMemo } from 'react';
import { useZoneConflicts } from '../../../../hooks/api/delivery';
import { ExtensionVersion } from '../../../../components/common/extension-version';
import { SiteScopeBar } from '../../../../components/common/site-scope-bar';
import { ZonesConflictMap } from './zones-map';

// Paleta de colores distinguibles, una por sucursal.
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

const ZoneConflictsPage = () => {
  const { data, isLoading } = useZoneConflicts();
  const zones = data?.zones ?? [];
  const conflicts = data?.conflicts ?? [];

  // Color por sucursal (determinístico) + leyenda.
  const { colorByZoneId, legend } = useMemo(() => {
    const storeOrder: string[] = [];
    const storeName = new Map<string, string>();
    for (const z of zones) {
      const key = z.store_location_id ?? NO_STORE_KEY;
      if (!storeName.has(key)) {
        storeName.set(key, z.store_name ?? 'Sin sucursal');
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
    const byZone: Record<string, string> = {};
    for (const z of zones) {
      byZone[z.zone_id] =
        colorOfStore.get(z.store_location_id ?? NO_STORE_KEY) ?? NO_STORE_COLOR;
    }
    const leg = storeOrder.map((key) => ({
      key,
      name: storeName.get(key) ?? 'Sin sucursal',
      color: colorOfStore.get(key) ?? NO_STORE_COLOR,
    }));
    return { colorByZoneId: byZone, legend: leg };
  }, [zones]);

  const conflictIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of conflicts) {
      set.add(c.zone_a_id);
      set.add(c.zone_b_id);
    }
    return set;
  }, [conflicts]);

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading>Conflictos de zonas</Heading>
          <ExtensionVersion extension="delivery" />
        </div>
        <Button size="small" variant="secondary" asChild>
          <a href="/app/delivery/zones">Volver a zonas</a>
        </Button>
      </div>

      {/*
        `scoped`: `admin/delivery/zones/conflicts` mete el filtro en el WHERE de las
        zonas antes de cruzar polígonos (`siteFilter(…, DELIVERY_ZONE_SITE_SCOPE)`,
        `api/admin/delivery/zones/conflicts/route.ts:42`).

        Que filtre ANTES del cruce es lo que hace útil la pantalla: un conflicto contra
        una zona de otra tienda no es un conflicto —son territorios de negocios
        distintos— y aparecería como un falso positivo que nadie puede resolver.
      */}
      <SiteScopeBar screen="delivery.zone-conflicts" />

      <div className="flex flex-col gap-4 px-6 pt-4 pb-6">
        <Text size="small" className="text-ui-fg-subtle">
          Dos zonas entran en conflicto cuando los polígonos de sus coberturas se
          solapan. El mapa muestra todas las zonas activas, coloreadas por
          sucursal; las que están en conflicto se resaltan con contorno rojo.
        </Text>

        {/* Leyenda por sucursal */}
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

        <ZonesConflictMap
          zones={zones}
          colorByZoneId={colorByZoneId}
          conflictIds={conflictIds}
        />

        <Heading level="h2" className="mt-2 text-base">
          Pares en conflicto ({conflicts.length})
        </Heading>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Zona A</Table.HeaderCell>
              <Table.HeaderCell>Sucursal A</Table.HeaderCell>
              <Table.HeaderCell>Zona B</Table.HeaderCell>
              <Table.HeaderCell>Sucursal B</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <Table.Cell colSpan={4}>Cargando…</Table.Cell>
              </Table.Row>
            ) : conflicts.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={4}>
                  No hay zonas en conflicto. 🎉
                </Table.Cell>
              </Table.Row>
            ) : (
              conflicts.map((c) => (
                <Table.Row key={`${c.zone_a_id}-${c.zone_b_id}`}>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ backgroundColor: colorByZoneId[c.zone_a_id] }}
                      />
                      <Text size="small" weight="plus">
                        {c.zone_a_name}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{c.store_a_name ?? '—'}</Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-sm"
                        style={{ backgroundColor: colorByZoneId[c.zone_b_id] }}
                      />
                      <Text size="small" weight="plus">
                        {c.zone_b_name}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>{c.store_b_name ?? '—'}</Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>

        {!isLoading && conflicts.length > 0 && (
          <Badge size="small" color="red" className="self-start">
            {conflictIds.size} zona(s) con solapamiento
          </Badge>
        )}
      </div>
    </Container>
  );
};

export default ZoneConflictsPage;
