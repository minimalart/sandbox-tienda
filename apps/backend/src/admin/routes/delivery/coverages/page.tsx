import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Button,
  Container,
  Drawer,
  Heading,
  DropdownMenu,
  IconButton,
  Input,
  Label,
  Prompt,
  Select,
  Switch,
  Table,
  Text,
  toast,
  Toaster,
} from '@medusajs/ui';
import { EllipsisHorizontal } from '@medusajs/icons';
import { useEffect, useMemo, useState } from 'react';
import {
  type BranchCoverageItem,
  type PolygonPoint,
  useCoverages,
  useCreateCoverage,
  useDeleteCoverage,
  useStoreLocations,
  useUpdateCoverage,
} from '../../../hooks/api/store-locations';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { PolygonPicker } from '../../store-locations/components/polygon-picker';

// Sentinel para "sin sucursal" en el Select (UI Select no admite value="").
const NO_LOCATION = '__none';

// String numérico → entero (priority, admite 0 y negativos).
const toInt = (raw?: string): number => {
  if (!raw || !raw.trim()) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

// ---------------------------------------------------------------------------
// Drawer crear/editar cobertura.
//
// La cobertura pertenece SIEMPRE a la sucursal seleccionada en la página
// (storeLocationId). "Asignar a una sucursal" = crear la cobertura ahí. El
// endpoint update no cambia store_location_id, así que en edición la sucursal
// es fija (no se puede mover). El polígono se dibuja sobre el mapa (o se sube
// vía GeoJSON) reusando PolygonPicker de store-locations en modo editable.
// ---------------------------------------------------------------------------
const CoverageFormDrawer = ({
  open,
  onClose,
  storeLocationId,
  center,
  coverage,
}: {
  open: boolean;
  onClose: () => void;
  storeLocationId: string;
  center: { lat: number; lng: number } | null;
  /** Si viene, el drawer está en modo edición. */
  coverage: BranchCoverageItem | null;
}) => {
  const isEdit = !!coverage;

  const create = useCreateCoverage(storeLocationId);
  const update = useUpdateCoverage(storeLocationId, coverage?.id ?? '');
  const isPending = create.isPending || update.isPending;

  const [name, setName] = useState('');
  const [priority, setPriority] = useState('0');
  const [active, setActive] = useState(true);
  const [polygon, setPolygon] = useState<PolygonPoint[]>([]);

  useEffect(() => {
    if (open) {
      setName(coverage?.name ?? '');
      setPriority(String(coverage?.priority ?? 0));
      setActive(coverage?.active ?? true);
      setPolygon(Array.isArray(coverage?.polygon) ? coverage.polygon : []);
    }
  }, [open, coverage]);

  const onSubmit = () => {
    if (!name.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    if (polygon.length < 3) {
      toast.error('El polígono debe tener al menos 3 puntos. Cargá un GeoJSON.');
      return;
    }

    const payload = {
      name: name.trim(),
      polygon,
      priority: toInt(priority),
      active,
    };

    const onSuccess = () => {
      toast.success(isEdit ? 'Cobertura actualizada' : 'Cobertura creada');
      onClose();
    };
    const onError = (e: unknown) => toast.error((e as Error).message);

    if (isEdit) {
      update.mutate(payload, { onSuccess, onError });
    } else {
      create.mutate(payload, { onSuccess, onError });
    }
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content className="z-50">
        <div className="flex flex-1 flex-col overflow-hidden">
          <Drawer.Header>
            <Drawer.Title>
              {isEdit ? 'Editar cobertura' : 'Nueva cobertura'}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-4 overflow-y-auto">
            <div className="flex flex-col gap-1">
              <Label size="small" weight="plus">
                Nombre
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="CABA Centro"
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label size="small" weight="plus">
                  Prioridad
                </Label>
                <Input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  placeholder="0"
                  disabled={isPending}
                />
              </div>
              <div className="flex items-end justify-between gap-2">
                <Label size="small" weight="plus">
                  Activa
                </Label>
                <Switch
                  checked={active}
                  onCheckedChange={setActive}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label size="small" weight="plus">
                Polígono (GeoJSON)
              </Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Dibujá el polígono sobre el mapa o subí un archivo .geojson
                (Polygon / MultiPolygon / Feature / FeatureCollection). Se
                guarda el anillo exterior. Podés arrastrar los vértices para
                ajustarlo.
              </Text>
              <PolygonPicker value={polygon} center={center} onChange={setPolygon} editable />
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="button"
              isLoading={isPending}
              onClick={onSubmit}
            >
              {isEdit ? 'Guardar' : 'Crear'}
            </Button>
          </Drawer.Footer>
        </div>
      </Drawer.Content>
    </Drawer>
  );
};

const CoveragesPage = () => {
  const [storeLocationId, setStoreLocationId] = useState<string>(NO_LOCATION);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<BranchCoverageItem | null>(null);
  const [toDelete, setToDelete] = useState<BranchCoverageItem | null>(null);

  const { data: locData } = useStoreLocations({ limit: 200 });
  const locations = locData?.store_locations ?? [];

  const selectedId = storeLocationId !== NO_LOCATION ? storeLocationId : '';

  const { data, isLoading } = useCoverages(selectedId);
  const coverages = data?.coverages ?? [];

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedId) ?? null,
    [locations, selectedId],
  );

  // Centro del mapa: lat/lng de la sucursal si existen.
  const center = useMemo(() => {
    if (!selectedLocation?.lat || !selectedLocation?.lng) return null;
    const lat = parseFloat(selectedLocation.lat);
    const lng = parseFloat(selectedLocation.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [selectedLocation]);

  const deleteCoverage = useDeleteCoverage(selectedId, toDelete?.id ?? '');

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (c: BranchCoverageItem) => {
    setEditing(c);
    setDrawerOpen(true);
  };

  const onConfirmDelete = () => {
    if (!toDelete) return;
    deleteCoverage.mutate(undefined, {
      onSuccess: () => {
        toast.success('Cobertura eliminada');
        setToDelete(null);
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <>
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-x-2">
            <Heading>Coberturas</Heading>
            <ExtensionVersion extension="delivery" />
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={storeLocationId}
              onValueChange={(v) => setStoreLocationId(v)}
            >
              <Select.Trigger className="w-[220px]">
                <Select.Value placeholder="Elegí una sucursal" />
              </Select.Trigger>
              <Select.Content className="z-[60]">
                <Select.Item value={NO_LOCATION}>Elegí una sucursal</Select.Item>
                {locations.map((loc) => (
                  <Select.Item key={loc.id} value={loc.id}>
                    {loc.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Button size="small" variant="secondary" asChild>
              <a href="/app/delivery/coverages/map">Ver mapa de coberturas</a>
            </Button>
            <Button
              size="small"
              variant="primary"
              onClick={openCreate}
              disabled={!selectedId}
            >
              Nueva cobertura
            </Button>
          </div>
        </div>

        {/*
          `scoped`, y acá lo que filtra NO es la ruta de coberturas sino la de
          sucursales: el combo de arriba se llena con `useStoreLocations()`, y
          `admin/store-locations` mete el filtro en el WHERE (`siteFilter(…,
          STORE_LOCATION_SITE_SCOPE)`, `api/admin/store-locations/route.ts:35`). Las
          coberturas se piden después, por sucursal, y esa ruta corre `assertIdInSite`
          en GET y en POST (`store-locations/[id]/coverage/route.ts:14` y `:34`).

          O sea que el operador no puede ni elegir una sucursal ajena ni pedirle las
          coberturas a una. Por eso esta pantalla mapea a `admin/store-locations` en el
          `ROUTE_OF` del test y no a una ruta de `delivery`.
        */}
        <SiteScopeBar screen="delivery.coverages" />

        <Text size="small" className="text-ui-fg-subtle px-6 pt-2 pb-2">
          La cobertura pertenece a una sucursal. Crear una cobertura acá la
          asigna a la sucursal seleccionada.
        </Text>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Nombre</Table.HeaderCell>
              <Table.HeaderCell>Puntos</Table.HeaderCell>
              <Table.HeaderCell>Prioridad</Table.HeaderCell>
              <Table.HeaderCell>Activa</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {!selectedId ? (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  Elegí una sucursal para ver sus coberturas.
                </Table.Cell>
              </Table.Row>
            ) : isLoading ? (
              <Table.Row>
                <Table.Cell colSpan={5}>Cargando…</Table.Cell>
              </Table.Row>
            ) : coverages.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  Esta sucursal no tiene coberturas todavía.
                </Table.Cell>
              </Table.Row>
            ) : (
              coverages.map((c) => (
                <Table.Row
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => openEdit(c)}
                >
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {c.name}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    {Array.isArray(c.polygon) ? c.polygon.length : 0}
                  </Table.Cell>
                  <Table.Cell>{c.priority}</Table.Cell>
                  <Table.Cell>
                    <CoverageActiveToggle
                      storeLocationId={selectedId}
                      coverage={c}
                    />
                  </Table.Cell>
                  <Table.Cell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenu.Trigger asChild>
                          <IconButton variant="transparent">
                            <EllipsisHorizontal />
                          </IconButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end">
                          <DropdownMenu.Item onClick={() => openEdit(c)}>
                            Editar
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            className="text-ui-fg-error"
                            onClick={() => setToDelete(c)}
                          >
                            Eliminar
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Container>

      {selectedId ? (
        <CoverageFormDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          storeLocationId={selectedId}
          center={center}
          coverage={editing}
        />
      ) : null}

      <Prompt open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Eliminar cobertura</Prompt.Title>
            <Prompt.Description>
              ¿Seguro que querés eliminar la cobertura {toDelete?.name}? Esta
              acción no se puede deshacer.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action
              onClick={onConfirmDelete}
              disabled={deleteCoverage.isPending}
            >
              Eliminar
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>

      <Toaster />
    </>
  );
};

// Toggle activa/inactiva por fila (cada uno con su mutación scopeada al id).
const CoverageActiveToggle = ({
  storeLocationId,
  coverage,
}: {
  storeLocationId: string;
  coverage: BranchCoverageItem;
}) => {
  const update = useUpdateCoverage(storeLocationId, coverage.id);
  return (
    <Switch
      checked={coverage.active ?? true}
      disabled={update.isPending}
      onClick={(e) => e.stopPropagation()}
      onCheckedChange={(checked) =>
        update.mutate(
          { active: checked },
          {
            onSuccess: () =>
              toast.success(checked ? 'Cobertura activada' : 'Cobertura desactivada'),
            onError: (err) => toast.error((err as Error).message),
          },
        )
      }
    />
  );
};

export const config = defineRouteConfig({
  label: 'Coberturas',
});

export default CoveragesPage;
