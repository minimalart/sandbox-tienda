import { defineRouteConfig } from '@medusajs/admin-sdk';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Container,
  Drawer,
  Heading,
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
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge, DropdownMenu, IconButton } from '@medusajs/ui';
import { EllipsisHorizontal } from '@medusajs/icons';
import {
  type TemperatureMode,
  type Vehicle,
  type VehicleType,
  useCreateVehicle,
  useDeleteVehicle,
  useDrivers,
  useUpdateVehicle,
  useVehicles,
} from '../../../hooks/api/delivery';
import { useStoreLocations } from '../../../hooks/api/store-locations';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { StoreLocationFilter } from '../../../components/delivery/store-location-filter';

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<VehicleType, string> = {
  motorcycle: 'Moto',
  van: 'Van',
  truck: 'Camión',
  car: 'Auto',
};

const TYPE_VALUES = Object.keys(TYPE_LABELS) as VehicleType[];

const TEMP_LABELS: Record<TemperatureMode, string> = {
  ambient: 'Ambiente',
  refrigerated: 'Refrigerado',
  frozen: 'Congelado',
};
const TEMP_VALUES = Object.keys(TEMP_LABELS) as TemperatureMode[];

// Sentinel para "sin asignar" en el Select de driver (UI Select no admite value="").
const NO_DRIVER = '__none';

const vehicleFormSchema = z.object({
  plate: z.string().min(1, 'La patente es obligatoria'),
  type: z.enum(['motorcycle', 'van', 'truck', 'car']),
  capacity_kg: z.string().optional(),
  capacity_m3: z.string().optional(),
  // Multi-sucursal: un vehículo puede operar en varias sucursales.
  store_location_ids: z.array(z.string()),
  driver_id: z.string().optional(),
  has_refrigeration: z.boolean(),
  max_orders: z.string().optional(),
  temperature_modes: z.array(z.enum(['ambient', 'refrigerated', 'frozen'])),
  active: z.boolean(),
});

type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

const emptyForm: VehicleFormValues = {
  plate: '',
  type: 'motorcycle',
  capacity_kg: '',
  capacity_m3: '',
  store_location_ids: [],
  driver_id: NO_DRIVER,
  has_refrigeration: false,
  max_orders: '',
  temperature_modes: [],
  active: true,
};

// Convierte un string numérico del form en un entero positivo o null.
const toPositiveInt = (raw?: string): number | null => {
  if (!raw || !raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
};

const VehicleFormDrawer = ({
  open,
  onClose,
  vehicle,
}: {
  open: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
}) => {
  const isEdit = !!vehicle;
  const { data: locData } = useStoreLocations({ limit: 200 });
  const locations = locData?.store_locations ?? [];
  const { data: driverData } = useDrivers({ active: true, limit: 200 });
  const drivers = driverData?.drivers ?? [];

  const create = useCreateVehicle();
  const update = useUpdateVehicle(vehicle?.id ?? '');
  const isPending = create.isPending || update.isPending;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: emptyForm,
  });

  useEffect(() => {
    if (open) {
      reset(
        vehicle
          ? {
              plate: vehicle.plate,
              type: vehicle.type,
              capacity_kg:
                vehicle.capacity_kg != null ? String(vehicle.capacity_kg) : '',
              capacity_m3:
                vehicle.capacity_m3 != null ? String(vehicle.capacity_m3) : '',
              store_location_ids: vehicle.store_location_ids ?? [],
              driver_id: vehicle.driver_id ?? NO_DRIVER,
              has_refrigeration: vehicle.has_refrigeration ?? false,
              max_orders:
                vehicle.max_orders != null ? String(vehicle.max_orders) : '',
              temperature_modes: vehicle.temperature_modes ?? [],
              active: vehicle.active ?? true,
            }
          : emptyForm,
      );
    }
  }, [open, vehicle, reset]);

  const onSubmit = handleSubmit((values) => {
    const payload = {
      plate: values.plate.trim(),
      type: values.type,
      capacity_kg: toPositiveInt(values.capacity_kg),
      capacity_m3: toPositiveInt(values.capacity_m3),
      store_location_ids: values.store_location_ids.length
        ? values.store_location_ids
        : null,
      driver_id:
        values.driver_id && values.driver_id !== NO_DRIVER
          ? values.driver_id
          : null,
      has_refrigeration: values.has_refrigeration,
      max_orders: toPositiveInt(values.max_orders),
      temperature_modes: values.temperature_modes.length
        ? values.temperature_modes
        : null,
      active: values.active,
    };

    const onSuccess = () => {
      toast.success(isEdit ? 'Vehículo actualizado' : 'Vehículo creado');
      onClose();
    };
    const onError = (e: unknown) => toast.error((e as Error).message);

    if (isEdit) {
      update.mutate(payload, { onSuccess, onError });
    } else {
      create.mutate(payload, { onSuccess, onError });
    }
  });

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content className="z-50">
        <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
          <Drawer.Header>
            <Drawer.Title>
              {isEdit ? 'Editar vehículo' : 'Nuevo vehículo'}
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-4 overflow-y-auto">
            <Controller
              control={control}
              name="plate"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Patente
                  </Label>
                  <Input {...field} placeholder="AB123CD" disabled={isPending} />
                  {errors.plate ? (
                    <Text size="xsmall" className="text-ui-fg-error">
                      {errors.plate.message}
                    </Text>
                  ) : null}
                </div>
              )}
            />
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Tipo
                  </Label>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isPending}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Tipo" />
                    </Select.Trigger>
                    <Select.Content className="z-[60]">
                      {TYPE_VALUES.map((t) => (
                        <Select.Item key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              )}
            />
            <div className="grid grid-cols-2 gap-2">
              <Controller
                control={control}
                name="capacity_kg"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <Label size="small" weight="plus">
                      Capacidad (kg)
                    </Label>
                    <Input
                      {...field}
                      type="number"
                      min={1}
                      placeholder="—"
                      disabled={isPending}
                    />
                  </div>
                )}
              />
              <Controller
                control={control}
                name="capacity_m3"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <Label size="small" weight="plus">
                      Capacidad (m³)
                    </Label>
                    <Input
                      {...field}
                      type="number"
                      min={1}
                      placeholder="—"
                      disabled={isPending}
                    />
                  </div>
                )}
              />
            </div>
            <Controller
              control={control}
              name="store_location_ids"
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <Label size="small" weight="plus">
                    Sucursales
                  </Label>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    Un vehículo puede operar en varias sucursales.
                  </Text>
                  {locations.length === 0 ? (
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      No hay sucursales cargadas.
                    </Text>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {locations.map((loc) => {
                        const checked = field.value.includes(loc.id);
                        return (
                          <div
                            key={loc.id}
                            className="flex items-center justify-between"
                          >
                            <Text size="small">{loc.name}</Text>
                            <Switch
                              checked={checked}
                              disabled={isPending}
                              onCheckedChange={(on) =>
                                field.onChange(
                                  on
                                    ? [...field.value, loc.id]
                                    : field.value.filter((v) => v !== loc.id),
                                )
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            />
            <Controller
              control={control}
              name="driver_id"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Repartidor asignado
                  </Label>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isPending}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Sin asignar" />
                    </Select.Trigger>
                    <Select.Content className="z-[60]">
                      <Select.Item value={NO_DRIVER}>Sin asignar</Select.Item>
                      {drivers.map((d) => (
                        <Select.Item key={d.id} value={d.id}>
                          {d.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              )}
            />
            <Controller
              control={control}
              name="max_orders"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Tope de órdenes por viaje
                  </Label>
                  <Input
                    {...field}
                    type="number"
                    min={1}
                    placeholder="Sin tope"
                    disabled={isPending}
                  />
                </div>
              )}
            />
            <Controller
              control={control}
              name="has_refrigeration"
              render={({ field }) => (
                <div className="flex items-center justify-between">
                  <Label size="small" weight="plus">
                    Refrigeración
                  </Label>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                  />
                </div>
              )}
            />
            <Controller
              control={control}
              name="temperature_modes"
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <Label size="small" weight="plus">
                    Modos de temperatura soportados
                  </Label>
                  <div className="flex flex-col gap-2">
                    {TEMP_VALUES.map((t) => {
                      const checked = field.value.includes(t);
                      return (
                        <div
                          key={t}
                          className="flex items-center justify-between"
                        >
                          <Text size="small">{TEMP_LABELS[t]}</Text>
                          <Switch
                            checked={checked}
                            disabled={isPending}
                            onCheckedChange={(on) =>
                              field.onChange(
                                on
                                  ? [...field.value, t]
                                  : field.value.filter((v) => v !== t),
                              )
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            />
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <div className="flex items-center justify-between">
                  <Label size="small" weight="plus">
                    Activo
                  </Label>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                  />
                </div>
              )}
            />
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" isLoading={isPending}>
              {isEdit ? 'Guardar' : 'Crear'}
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  );
};

const fmtCapacity = (v: Vehicle): string => {
  const parts: string[] = [];
  if (v.capacity_kg != null) parts.push(`${v.capacity_kg} kg`);
  if (v.capacity_m3 != null) parts.push(`${v.capacity_m3} m³`);
  return parts.length ? parts.join(' · ') : '—';
};

const VehiclesPage = () => {
  const [type, setType] = useState<string>('all');
  const [storeLocationId, setStoreLocationId] = useState<string | undefined>(
    undefined,
  );
  const [page, setPage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [toDelete, setToDelete] = useState<Vehicle | null>(null);

  const { data, isLoading } = useVehicles({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    type: type === 'all' ? undefined : (type as VehicleType),
    store_location_id: storeLocationId,
  });
  // Para resolver el nombre del driver asignado en la tabla.
  const { data: driverData } = useDrivers({ limit: 200 });
  const deleteVehicle = useDeleteVehicle();

  const vehicles = data?.vehicles ?? [];
  const count = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const driverNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of driverData?.drivers ?? []) map.set(d.id, d.name);
    return map;
  }, [driverData]);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (v: Vehicle) => {
    setEditing(v);
    setDrawerOpen(true);
  };

  const onConfirmDelete = () => {
    if (!toDelete) return;
    deleteVehicle.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success('Vehículo eliminado');
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
            <Heading>Vehículos</Heading>
            <ExtensionVersion extension="delivery" />
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
              value={type}
              onValueChange={(v) => {
                setType(v);
                setPage(0);
              }}
            >
              <Select.Trigger className="w-[160px]">
                <Select.Value placeholder="Tipo" />
              </Select.Trigger>
              <Select.Content className="z-[60]">
                <Select.Item value="all">Todos los tipos</Select.Item>
                {TYPE_VALUES.map((t) => (
                  <Select.Item key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Button size="small" variant="primary" onClick={openCreate}>
              Nuevo vehículo
            </Button>
          </div>
        </div>

        {/*
          `scoped`: `admin/delivery/vehicles` mete el filtro en el WHERE (`siteFilter(…,
          VEHICLE_SITE_SCOPE)`, `api/admin/delivery/vehicles/route.ts:30`) y `[id]` corre
          `assertIdInSite`.

          Es el único descriptor de delivery con `fkIsArray`: un vehículo puede estar
          asignado a VARIAS sucursales (`store_location_ids`), así que basta con que una
          sea de la tienda activa para que aparezca. Una flota compartida entre tiendas
          se ve desde las dos, y es lo correcto — es un solo camión.
        */}
        <SiteScopeBar screen="delivery.vehicles" />

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Patente</Table.HeaderCell>
              <Table.HeaderCell>Tipo</Table.HeaderCell>
              <Table.HeaderCell>Capacidad</Table.HeaderCell>
              <Table.HeaderCell>Frío / Tope</Table.HeaderCell>
              <Table.HeaderCell>Repartidor</Table.HeaderCell>
              <Table.HeaderCell>Activo</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <Table.Cell colSpan={7}>Cargando…</Table.Cell>
              </Table.Row>
            ) : vehicles.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={7}>No hay vehículos todavía.</Table.Cell>
              </Table.Row>
            ) : (
              vehicles.map((v) => (
                <Table.Row
                  key={v.id}
                  className="cursor-pointer"
                  onClick={() => openEdit(v)}
                >
                  <Table.Cell>
                    <Text size="small" weight="plus" className="font-mono">
                      {v.plate}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>{TYPE_LABELS[v.type] ?? v.type}</Table.Cell>
                  <Table.Cell>
                    <Text size="small">{fmtCapacity(v)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1">
                      {v.has_refrigeration ? (
                        <Badge size="2xsmall" color="blue">
                          Frío
                        </Badge>
                      ) : null}
                      <Text size="small">
                        {v.max_orders != null ? `${v.max_orders} órd.` : '—'}
                      </Text>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {v.driver_id
                      ? (driverNameById.get(v.driver_id) ?? v.driver_id)
                      : '—'}
                  </Table.Cell>
                  <Table.Cell>
                    <VehicleActiveToggle vehicle={v} />
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
                          <DropdownMenu.Item onClick={() => openEdit(v)}>
                            Editar
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            className="text-ui-fg-error"
                            onClick={() => setToDelete(v)}
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
            {count} vehículos · Página {page + 1} de {pageCount}
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
      </Container>

      <VehicleFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        vehicle={editing}
      />

      <Prompt open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Eliminar vehículo</Prompt.Title>
            <Prompt.Description>
              ¿Seguro que querés eliminar el vehículo {toDelete?.plate}? Esta
              acción no se puede deshacer.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action
              onClick={onConfirmDelete}
              disabled={deleteVehicle.isPending}
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

// Toggle activo/inactivo por fila (cada uno con su propia mutación scopeada al id).
const VehicleActiveToggle = ({ vehicle }: { vehicle: Vehicle }) => {
  const update = useUpdateVehicle(vehicle.id);
  return (
    <Switch
      checked={vehicle.active ?? true}
      disabled={update.isPending}
      onClick={(e) => e.stopPropagation()}
      onCheckedChange={(checked) =>
        update.mutate(
          { active: checked },
          {
            onSuccess: () =>
              toast.success(checked ? 'Vehículo activado' : 'Vehículo desactivado'),
            onError: (err) => toast.error((err as Error).message),
          },
        )
      }
    />
  );
};

export const config = defineRouteConfig({
  label: 'Vehículos',
});

export default VehiclesPage;
