import { defineRouteConfig } from '@medusajs/admin-sdk';

import {
  Button,
  Checkbox,
  Container,
  Drawer,
  DropdownMenu,
  Heading,
  IconButton,
  Prompt,
  Select,
  StatusBadge,
  Table,
  Text,
  toast,
} from '@medusajs/ui';
import { Input, Label, Switch } from '@medusajs/ui';
import { EllipsisHorizontal } from '@medusajs/icons';
import { useMemo, useState } from 'react';
import {
  type AutoBuildRoutesResult,
  useAutoBuildRoutes,
  useDeliveryExecutions,
  useDrivers,
  useVehicles,
  useZones,
} from '../../../hooks/api/delivery';
import { useStoreLocations } from '../../../hooks/api/store-locations';
import {
  type Route,
  type RouteStatus,
  type RouteStop,
  useCreateRoute,
  useDeleteRoute,
  useDispatchRoute,
  useOptimizeRoute,
  useRoute,
  useRoutes,
  useUpdateRouteStops,
} from '../../../hooks/api/delivery-routes';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { HintIcon } from '../../../components/common/setting-label';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { StoreLocationFilter } from '../../../components/delivery/store-location-filter';

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<RouteStatus, 'green' | 'orange' | 'red' | 'blue' | 'grey'> = {
  planned: 'grey',
  dispatched: 'blue',
  in_progress: 'orange',
  completed: 'green',
  canceled: 'red',
};

const STATUS_LABELS: Record<RouteStatus, string> = {
  planned: 'Planificada',
  dispatched: 'Despachada',
  in_progress: 'En curso',
  completed: 'Completada',
  canceled: 'Cancelada',
};

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

// ---------------------------------------------------------------------------
// Drawer de detalle: paradas ordenadas + reordenamiento manual (botones up/down)
// + despacho. Cada reordenamiento reenvía la lista completa de stops con sequence
// recalculado 1..n al workflow update-route-stops (mecanismo robusto sin DnD).
// ---------------------------------------------------------------------------
const RouteDetailDrawer = ({
  routeId,
  onClose,
}: {
  routeId: string | null;
  onClose: () => void;
}) => {
  const { data, isLoading } = useRoute(routeId);
  const route = data?.route ?? null;
  const updateStops = useUpdateRouteStops(routeId ?? '');
  const dispatchRoute = useDispatchRoute(routeId ?? '');
  const optimizeRoute = useOptimizeRoute(routeId ?? '');

  // Orden local para mover paradas sin re-fetch entre cada click; se persiste al
  // soltar (cada move dispara el guardado del nuevo orden).
  const stops = route?.stops ?? [];

  const persistOrder = (ordered: RouteStop[]) => {
    updateStops.mutate(
      {
        stops: ordered.map((s, i) => ({
          delivery_execution_id: s.delivery_execution_id,
          sequence: i + 1,
        })),
      },
      {
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= stops.length) return;
    const next = [...stops];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    persistOrder(next);
  };

  const removeStop = (executionId: string) => {
    const next = stops.filter((s) => s.delivery_execution_id !== executionId);
    persistOrder(next);
  };

  const onDispatch = () => {
    dispatchRoute.mutate(undefined, {
      onSuccess: () => toast.success('Ruta despachada'),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const onOptimize = () => {
    optimizeRoute.mutate(undefined, {
      onSuccess: (r) => {
        const pct = r.optimization.improvement_pct;
        if (pct > 0) {
          toast.success(
            `Orden optimizado: −${pct.toFixed(1)}% distancia (${r.optimization.total_distance_km.toFixed(1)} km)`,
          );
        } else if (r.optimization.origin_source === 'none') {
          toast.warning('No hay coordenadas suficientes para optimizar.');
        } else {
          toast.success('El orden ya era óptimo (0% de mejora).');
        }
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const isPlanned = route?.status === 'planned';
  // Solo reordenamos rutas no terminales y con al menos 2 paradas.
  const canOptimize =
    route?.status !== 'completed' &&
    route?.status !== 'canceled' &&
    stops.length >= 2;
  const optMeta = route?.optimization_meta ?? null;

  return (
    <Drawer open={!!routeId} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content className="z-50">
        <Drawer.Header>
          <Drawer.Title>{route ? route.code : 'Ruta'}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto overflow-x-hidden">
          {isLoading || !route ? (
            <Text>Cargando…</Text>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <StatusBadge color={STATUS_COLORS[route.status]}>
                  {STATUS_LABELS[route.status]}
                </StatusBadge>
                <Button
                  size="small"
                  variant="primary"
                  disabled={!isPlanned || !route.driver_id || dispatchRoute.isPending}
                  onClick={onDispatch}
                >
                  Despachar ruta
                </Button>
              </div>
              {!route.driver_id ? (
                <Text size="small" className="text-ui-fg-subtle">
                  Asigná un driver a la ruta para poder despacharla.
                </Text>
              ) : null}

              <div className="flex items-center justify-between">
                <Heading level="h3">Paradas ({stops.length})</Heading>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={!canOptimize || optimizeRoute.isPending}
                  onClick={onOptimize}
                >
                  {optimizeRoute.isPending ? 'Optimizando…' : 'Optimizar orden'}
                </Button>
              </div>
              {optMeta && optMeta.origin_source !== 'none' ? (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Última optimización:{' '}
                  {optMeta.improvement_pct > 0
                    ? `−${optMeta.improvement_pct.toFixed(1)}% distancia`
                    : 'sin mejora'}{' '}
                  · {optMeta.total_distance_km.toFixed(1)} km
                  {optMeta.unlocated_count > 0
                    ? ` · ${optMeta.unlocated_count} sin coordenadas`
                    : ''}
                </Text>
              ) : null}
              {stops.length === 0 ? (
                <Text size="small" className="text-ui-fg-subtle">
                  La ruta no tiene paradas.
                </Text>
              ) : (
                <div className="flex flex-col gap-2">
                  {stops.map((s, i) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-md border border-ui-border-base p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Text weight="plus" className="w-6 text-center">
                          {i + 1}
                        </Text>
                        <div className="flex flex-col">
                          <Text size="small" weight="plus">
                            {s.order?.display_id != null
                              ? `#${s.order.display_id}`
                              : s.delivery_execution_id}
                          </Text>
                          <Text size="xsmall" className="text-ui-fg-subtle">
                            {s.address?.address_1 ?? '—'}
                            {s.address?.city ? `, ${s.address.city}` : ''}
                          </Text>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <IconButton
                          size="small"
                          disabled={i === 0 || updateStops.isPending}
                          onClick={() => move(i, -1)}
                        >
                          ↑
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={i === stops.length - 1 || updateStops.isPending}
                          onClick={() => move(i, 1)}
                        >
                          ↓
                        </IconButton>
                        <Button
                          size="small"
                          variant="transparent"
                          disabled={updateStops.isPending}
                          onClick={() => removeStop(s.delivery_execution_id)}
                        >
                          Quitar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer>
  );
};

// ---------------------------------------------------------------------------
// Drawer de creación: selecciona ejecuciones own_fleet SIN ruta + driver + vehicle.
// ---------------------------------------------------------------------------
const CreateRouteDrawer = ({
  open,
  onClose,
  storeLocationId,
}: {
  open: boolean;
  onClose: () => void;
  /** M10: scope de tienda heredado del filtro de la lista. */
  storeLocationId?: string;
}) => {
  const { data: execData } = useDeliveryExecutions({
    provider_type: 'own_fleet',
    unrouted: true,
    limit: 100,
    store_location_id: storeLocationId,
  });
  const { data: driverData } = useDrivers({
    active: true,
    store_location_id: storeLocationId,
  });
  const { data: vehicleData } = useVehicles({
    active: true,
    store_location_id: storeLocationId,
  });
  const createRoute = useCreateRoute();

  const [selected, setSelected] = useState<string[]>([]);
  const [driverId, setDriverId] = useState<string>('');
  const [vehicleId, setVehicleId] = useState<string>('');

  const executions = execData?.delivery_executions ?? [];
  const drivers = driverData?.drivers ?? [];
  const vehicles = vehicleData?.vehicles ?? [];

  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const reset = () => {
    setSelected([]);
    setDriverId('');
    setVehicleId('');
  };

  const onCreate = () => {
    if (selected.length === 0) {
      toast.error('Seleccioná al menos una ejecución.');
      return;
    }
    createRoute.mutate(
      {
        driver_id: driverId || null,
        vehicle_id: vehicleId || null,
        store_location_id: storeLocationId ?? null,
        execution_ids: selected,
      },
      {
        onSuccess: () => {
          toast.success('Ruta creada');
          reset();
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content className="z-50">
        <Drawer.Header>
          <Drawer.Title>Crear ruta (flota propia)</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto overflow-x-hidden">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Select value={driverId} onValueChange={setDriverId}>
                <Select.Trigger>
                  <Select.Value placeholder="Driver" />
                </Select.Trigger>
                <Select.Content className="z-[60]">
                  {drivers.map((d) => (
                    <Select.Item key={d.id} value={d.id}>
                      {d.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <Select.Trigger>
                  <Select.Value placeholder="Vehículo" />
                </Select.Trigger>
                <Select.Content className="z-[60]">
                  {vehicles.map((v) => (
                    <Select.Item key={v.id} value={v.id}>
                      {v.plate}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>

            {/* El párrafo se comía dos renglones del drawer justo antes de la lista de
                checkboxes, que es lo que se viene a tocar acá. Es la aclaración del
                criterio de ESTA lista —no de la extensión— así que va al tooltip del
                encabezado y no al drawer de ayuda. El `Heading` se queda `h3`: bajarlo a
                `Label` para poder usar `SettingLabel` le sacaría el nivel al árbol de
                encabezados del drawer. */}
            <div className="flex min-w-0 items-center gap-2">
              <Heading level="h3">
                Ejecuciones sin ruta ({executions.length})
              </Heading>
              <HintIcon
                label="Ejecuciones sin ruta"
                hint="Solo se listan ejecuciones de flota propia que no pertenecen a ninguna ruta. El orden de las paradas se ajusta luego en el detalle."
              />
            </div>
            {executions.length === 0 ? (
              <Text size="small" className="text-ui-fg-subtle">
                No hay ejecuciones de flota propia sin ruta.
              </Text>
            ) : (
              <div className="flex flex-col gap-2">
                {executions.map((e) => (
                  <label
                    key={e.id}
                    className="flex items-center gap-3 rounded-md border border-ui-border-base p-3"
                  >
                    <Checkbox
                      checked={selected.includes(e.id)}
                      onCheckedChange={() => toggle(e.id)}
                    />
                    <div className="flex flex-col">
                      <Text size="small" weight="plus">
                        {e.order?.display_id != null
                          ? `#${e.order.display_id}`
                          : e.id}
                      </Text>
                      <Text size="xsmall" className="text-ui-fg-subtle">
                        {e.order?.email ?? '—'}
                      </Text>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={createRoute.isPending}
            onClick={onCreate}
          >
            Crear ruta
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

// ---------------------------------------------------------------------------
// Drawer de auto-armado de rutas (F6/F7): bin-packing de las ejecuciones
// own_fleet sin rutear entre los vehículos. POST /admin/delivery/routes/auto-build.
// ---------------------------------------------------------------------------
const NO_ZONE = '__none';

const AutoBuildDrawer = ({
  open,
  onClose,
  storeLocationId,
}: {
  open: boolean;
  onClose: () => void;
  storeLocationId?: string;
}) => {
  const { data: locData } = useStoreLocations({ limit: 200 });
  const locations = locData?.store_locations ?? [];

  const [locationId, setLocationId] = useState<string>(storeLocationId ?? '');
  const [zoneId, setZoneId] = useState<string>(NO_ZONE);
  const [maxOrders, setMaxOrders] = useState<string>('');
  const [fillPriority, setFillPriority] = useState<'fill_first' | 'balance'>(
    'fill_first',
  );
  const [optimize, setOptimize] = useState(false);
  const [result, setResult] = useState<AutoBuildRoutesResult | null>(null);

  // Zonas de la sucursal elegida (para acotar el armado a una zona).
  const { data: zoneData } = useZones({
    store_location_id: locationId || undefined,
    active: true,
    limit: 200,
  });
  const zones = zoneData?.zones ?? [];

  const autoBuild = useAutoBuildRoutes();

  const reset = () => {
    setZoneId(NO_ZONE);
    setMaxOrders('');
    setFillPriority('fill_first');
    setOptimize(false);
    setResult(null);
  };

  const onBuild = () => {
    if (!locationId) {
      toast.error('Elegí una sucursal.');
      return;
    }
    const max = maxOrders.trim() ? Number(maxOrders) : null;
    autoBuild.mutate(
      {
        store_location_id: locationId,
        delivery_zone_id: zoneId === NO_ZONE ? null : zoneId,
        max_orders_per_vehicle:
          max != null && Number.isFinite(max) && max > 0 ? Math.trunc(max) : null,
        fill_priority: fillPriority,
        optimize,
      },
      {
        onSuccess: (r) => {
          setResult(r);
          toast.success(
            `${r.routes.length} ruta(s) creada(s)${
              r.unassigned_execution_ids.length
                ? ` · ${r.unassigned_execution_ids.length} sin asignar`
                : ''
            }`,
          );
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
    >
      <Drawer.Content className="z-50">
        <Drawer.Header>
          <Drawer.Title>Auto-armar rutas (flota propia)</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="overflow-y-auto overflow-x-hidden">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label size="small" weight="plus">
                Sucursal
              </Label>
              <Select
                value={locationId}
                onValueChange={(v) => {
                  setLocationId(v);
                  setZoneId(NO_ZONE);
                }}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Seleccioná una sucursal" />
                </Select.Trigger>
                <Select.Content className="z-[60]">
                  {locations.map((l) => (
                    <Select.Item key={l.id} value={l.id}>
                      {l.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label size="small" weight="plus">
                Zona (opcional)
              </Label>
              <Select value={zoneId} onValueChange={setZoneId}>
                <Select.Trigger>
                  <Select.Value placeholder="Todas las zonas" />
                </Select.Trigger>
                <Select.Content className="z-[60]">
                  <Select.Item value={NO_ZONE}>Todas las zonas</Select.Item>
                  {zones.map((z) => (
                    <Select.Item key={z.id} value={z.id}>
                      {z.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label size="small" weight="plus">
                Tope de órdenes por vehículo (opcional)
              </Label>
              <Input
                type="number"
                min={1}
                value={maxOrders}
                onChange={(e) => setMaxOrders(e.target.value)}
                placeholder="Sin tope"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label size="small" weight="plus">
                Estrategia de llenado
              </Label>
              <Select
                value={fillPriority}
                onValueChange={(v) =>
                  setFillPriority(v as 'fill_first' | 'balance')
                }
              >
                <Select.Trigger>
                  <Select.Value placeholder="Estrategia" />
                </Select.Trigger>
                <Select.Content className="z-[60]">
                  <Select.Item value="fill_first">
                    Llenar primero (menos vehículos)
                  </Select.Item>
                  <Select.Item value="balance">
                    Balancear (repartir carga)
                  </Select.Item>
                </Select.Content>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label size="small" weight="plus">
                Optimizar orden de paradas
              </Label>
              <Switch checked={optimize} onCheckedChange={setOptimize} />
            </div>

            {result ? (
              <div className="flex flex-col gap-2 rounded-md border border-ui-border-base p-3">
                <Text size="small" weight="plus">
                  Resultado
                </Text>
                <Text size="small">
                  {result.routes.length} ruta(s) creada(s).
                </Text>
                {result.routes.map((r) => (
                  <Text key={r.route_id} size="xsmall" className="text-ui-fg-subtle">
                    {r.code} · {r.stop_count} parada(s)
                    {r.vehicle_id ? ` · ${r.vehicle_id}` : ''}
                  </Text>
                ))}
                {result.unassigned_execution_ids.length ? (
                  <Text size="xsmall" className="text-ui-fg-error">
                    {result.unassigned_execution_ids.length} ejecución(es) sin
                    asignar (sin vehículo compatible o sin cupo).
                  </Text>
                ) : (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Todas las ejecuciones fueron asignadas.
                  </Text>
                )}
              </div>
            ) : null}
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cerrar
          </Button>
          <Button
            variant="primary"
            disabled={autoBuild.isPending || !locationId}
            isLoading={autoBuild.isPending}
            onClick={onBuild}
          >
            Auto-armar
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

const RoutesPage = () => {
  const [status, setStatus] = useState<string>('all');
  const [storeLocationId, setStoreLocationId] = useState<string | undefined>(
    undefined,
  );
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [autoBuilding, setAutoBuilding] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Route | null>(null);

  const { data, isLoading } = useRoutes({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    status: status === 'all' ? undefined : (status as RouteStatus),
    store_location_id: storeLocationId,
  });
  const deleteRoute = useDeleteRoute();

  const routes = data?.routes ?? [];
  const count = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const onConfirmDelete = () => {
    if (!toDelete) return;
    deleteRoute.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success('Ruta eliminada');
        setToDelete(null);
      },
      onError: (e) => toast.error((e as Error).message),
    });
  };

  const statusOptions = useMemo(
    () => Object.keys(STATUS_LABELS) as RouteStatus[],
    [],
  );

  return (
    <Container className="p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading>Rutas</Heading>
          <ExtensionVersion extension="delivery-routes" />
        </div>
        <div className="flex items-center gap-2">
          <StoreLocationFilter
            value={storeLocationId}
            onChange={(v) => {
              setStoreLocationId(v);
              setPage(0);
            }}
          />
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
          >
            <Select.Trigger className="w-[180px]">
              <Select.Value placeholder="Estado" />
            </Select.Trigger>
            <Select.Content className="z-[60]">
              <Select.Item value="all">Todos los estados</Select.Item>
              {statusOptions.map((s) => (
                <Select.Item key={s} value={s}>
                  {STATUS_LABELS[s]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Button
            size="small"
            variant="secondary"
            onClick={() => setAutoBuilding(true)}
          >
            Auto-armar rutas
          </Button>
          <Button size="small" variant="primary" onClick={() => setCreating(true)}>
            Crear ruta
          </Button>
        </div>
      </div>

      {/*
        `scoped`: `admin/delivery/routes` mete el filtro en el WHERE (`siteFilter(…,
        DELIVERY_ROUTE_SITE_SCOPE)`, `api/admin/delivery/routes/route.ts:37`) y `[id]`
        corre `assertIdInSite`. La ruta hereda la tienda de su sucursal de salida.
      */}
      <SiteScopeBar screen="delivery.routes" />

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Código</Table.HeaderCell>
            <Table.HeaderCell>Estado</Table.HeaderCell>
            <Table.HeaderCell>Driver</Table.HeaderCell>
            <Table.HeaderCell>Fecha</Table.HeaderCell>
            <Table.HeaderCell>Paradas</Table.HeaderCell>
            <Table.HeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {isLoading ? (
            <Table.Row>
              <Table.Cell colSpan={6}>Cargando…</Table.Cell>
            </Table.Row>
          ) : routes.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={6}>No hay rutas todavía.</Table.Cell>
            </Table.Row>
          ) : (
            routes.map((r) => (
              <Table.Row
                key={r.id}
                className="cursor-pointer"
                onClick={() => setDetailId(r.id)}
              >
                <Table.Cell>
                  <Text size="small" weight="plus" className="font-mono">
                    {r.code}
                  </Text>
                </Table.Cell>
                <Table.Cell>
                  <StatusBadge color={STATUS_COLORS[r.status] ?? 'grey'}>
                    {STATUS_LABELS[r.status] ?? r.status}
                  </StatusBadge>
                </Table.Cell>
                <Table.Cell>{r.driver_id ?? '—'}</Table.Cell>
                <Table.Cell>{fmtDate(r.planned_date)}</Table.Cell>
                <Table.Cell>{r.stop_count ?? 0}</Table.Cell>
                <Table.Cell onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenu.Trigger asChild>
                        <IconButton variant="transparent">
                          <EllipsisHorizontal />
                        </IconButton>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content align="end">
                        <DropdownMenu.Item onClick={() => setDetailId(r.id)}>
                          Ver detalle
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator />
                        <DropdownMenu.Item
                          className="text-ui-fg-error"
                          onClick={() => setToDelete(r)}
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

      <div className="flex items-center justify-between px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          {count} rutas · Página {page + 1} de {pageCount}
        </Text>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant="secondary"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <Button
            size="small"
            variant="secondary"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>

      <CreateRouteDrawer
        open={creating}
        onClose={() => setCreating(false)}
        storeLocationId={storeLocationId}
      />
      <AutoBuildDrawer
        open={autoBuilding}
        onClose={() => setAutoBuilding(false)}
        storeLocationId={storeLocationId}
      />
      <RouteDetailDrawer routeId={detailId} onClose={() => setDetailId(null)} />

      <Prompt open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Eliminar ruta</Prompt.Title>
            <Prompt.Description>
              ¿Seguro que querés eliminar la ruta {toDelete?.code}? Esta acción
              no se puede deshacer.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action onClick={onConfirmDelete} disabled={deleteRoute.isPending}>
              Eliminar
            </Prompt.Action>
          </Prompt.Footer>
        </Prompt.Content>
      </Prompt>
    </Container>
  );
};

export const config = defineRouteConfig({
  label: 'Rutas',
});

export default RoutesPage;
