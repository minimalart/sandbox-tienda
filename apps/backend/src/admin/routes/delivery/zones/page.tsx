import { defineRouteConfig } from '@medusajs/admin-sdk';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Prompt,
  Select,
  StatusBadge,
  Switch,
  Table,
  Text,
  toast,
  Toaster,
} from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { DropdownMenu, IconButton } from '@medusajs/ui';
import { EllipsisHorizontal, Plus, Trash } from '@medusajs/icons';
import {
  type AssignStrategy,
  type DeliveryProviderType,
  type DeliveryZone,
  type ZoneResource,
  type ZoneResourceType,
  useCreateZone,
  useCreateZoneResource,
  useDeleteZone,
  useDeleteZoneResource,
  useDrivers,
  useUpdateZone,
  useVehicles,
  useZoneConflicts,
  useZoneResources,
  useZones,
} from '../../../hooks/api/delivery';
import { useCoverages, useStoreLocations } from '../../../hooks/api/store-locations';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { StoreLocationFilter } from '../../../components/delivery/store-location-filter';

const PAGE_SIZE = 20;

// Validación 'HH:mm' (24h), igual que el backend (validators.ts → HHMM).
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const PROVIDER_LABELS: Record<DeliveryProviderType, string> = {
  andreani: 'Andreani',
  own_fleet: 'Flota propia',
  store_pickup: 'Retiro en tienda',
};

const PROVIDER_VALUES = Object.keys(PROVIDER_LABELS) as DeliveryProviderType[];

// Estrategias de asignación automática de flota propia (F5/F7).
const STRATEGY_ASSIGN_LABELS: Record<AssignStrategy, string> = {
  round_robin: 'Round-robin',
  first_available: 'Primer disponible',
  least_load: 'Menor carga',
};
const STRATEGY_ASSIGN_VALUES = Object.keys(
  STRATEGY_ASSIGN_LABELS,
) as AssignStrategy[];

const RESOURCE_TYPE_LABELS: Record<ZoneResourceType, string> = {
  driver: 'Repartidor',
  vehicle: 'Vehículo',
};

// Sentinel para "sin sucursal" en el Select (UI Select no admite value="").
const NO_LOCATION = '__none';
// Sentinel para "sin estrategia" (cae al default global).
const NO_STRATEGY = '__none';
// Sentinel para "sin cobertura" en el Select (UI Select no admite value="").
const NO_COVERAGE = '__none';

// Lee default_assign_strategy desde metadata de la zona (string válido o null).
const readDefaultStrategy = (
  metadata?: Record<string, unknown> | null,
): AssignStrategy | null => {
  const raw = metadata?.default_assign_strategy;
  if (
    raw === 'round_robin' ||
    raw === 'first_available' ||
    raw === 'least_load'
  ) {
    return raw;
  }
  return null;
};

const zoneFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  store_location_id: z.string().optional(),
  branch_coverage_id: z.string().optional(),
  pricing_tier: z.string().optional(),
  sla_hours: z.string().optional(),
  cutoff_time: z
    .string()
    .optional()
    .refine((v) => !v || HHMM.test(v), "Formato 'HH:mm' (ej. 18:30)"),
  enabled_providers: z.array(z.enum(['andreani', 'own_fleet', 'store_pickup'])),
  default_assign_strategy: z.string(),
  priority: z.string().optional(),
  active: z.boolean(),
});

type ZoneFormValues = z.infer<typeof zoneFormSchema>;

const emptyForm: ZoneFormValues = {
  name: '',
  store_location_id: NO_LOCATION,
  branch_coverage_id: NO_COVERAGE,
  pricing_tier: '',
  sla_hours: '',
  cutoff_time: '',
  enabled_providers: [],
  default_assign_strategy: NO_STRATEGY,
  priority: '0',
  active: true,
};

// String numérico → entero positivo o null (sla_hours).
const toPositiveInt = (raw?: string): number | null => {
  if (!raw || !raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
};

// String numérico → entero (priority, admite 0 y negativos).
const toInt = (raw?: string): number => {
  if (!raw || !raw.trim()) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const ZoneFormDrawer = ({
  open,
  onClose,
  zone,
}: {
  open: boolean;
  onClose: () => void;
  /** Si viene, el drawer está en modo edición. */
  zone: DeliveryZone | null;
}) => {
  const isEdit = !!zone;
  const { data: locData } = useStoreLocations({ limit: 200 });
  const locations = locData?.store_locations ?? [];

  const create = useCreateZone();
  const update = useUpdateZone(zone?.id ?? '');
  const conflicts = useZoneConflicts();
  const isPending = create.isPending || update.isPending;

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ZoneFormValues>({
    resolver: zodResolver(zoneFormSchema),
    defaultValues: emptyForm,
  });

  // Sucursal elegida en el form → coberturas disponibles para el select.
  const watchedLocation = watch('store_location_id');
  const coverageLocationId =
    watchedLocation && watchedLocation !== NO_LOCATION ? watchedLocation : '';
  const { data: coverageData } = useCoverages(coverageLocationId);
  const coverages = coverageData?.coverages ?? [];

  useEffect(() => {
    if (open) {
      reset(
        zone
          ? {
              name: zone.name,
              store_location_id: zone.store_location_id ?? NO_LOCATION,
              branch_coverage_id: zone.branch_coverage_id ?? NO_COVERAGE,
              pricing_tier: zone.pricing_tier ?? '',
              sla_hours: zone.sla_hours != null ? String(zone.sla_hours) : '',
              cutoff_time: zone.cutoff_time ?? '',
              enabled_providers: zone.enabled_providers ?? [],
              default_assign_strategy:
                readDefaultStrategy(zone.metadata) ?? NO_STRATEGY,
              priority: String(zone.priority ?? 0),
              active: zone.active ?? true,
            }
          : emptyForm,
      );
    }
  }, [open, zone, reset]);

  const onSubmit = handleSubmit((values) => {
    // Persistimos default_assign_strategy en metadata, preservando el resto.
    const baseMeta: Record<string, unknown> = { ...(zone?.metadata ?? {}) };
    if (values.default_assign_strategy === NO_STRATEGY) {
      delete baseMeta.default_assign_strategy;
    } else {
      baseMeta.default_assign_strategy = values.default_assign_strategy;
    }

    const payload = {
      name: values.name.trim(),
      store_location_id:
        values.store_location_id && values.store_location_id !== NO_LOCATION
          ? values.store_location_id
          : null,
      branch_coverage_id:
        values.branch_coverage_id && values.branch_coverage_id !== NO_COVERAGE
          ? values.branch_coverage_id
          : null,
      pricing_tier: values.pricing_tier?.trim()
        ? values.pricing_tier.trim()
        : null,
      sla_hours: toPositiveInt(values.sla_hours),
      cutoff_time: values.cutoff_time?.trim() ? values.cutoff_time.trim() : null,
      enabled_providers: values.enabled_providers.length
        ? values.enabled_providers
        : null,
      priority: toInt(values.priority),
      active: values.active,
      metadata: Object.keys(baseMeta).length ? baseMeta : null,
    };

    // Aviso (no bloqueante) si la cobertura elegida se solapa con otra zona.
    const warnIfConflicts = async (zoneId: string) => {
      try {
        const { data } = await conflicts.refetch();
        const names = (data?.conflicts ?? [])
          .filter((c) => c.zone_a_id === zoneId || c.zone_b_id === zoneId)
          .map((c) => (c.zone_a_id === zoneId ? c.zone_b_name : c.zone_a_name));
        const unique = Array.from(new Set(names));
        if (unique.length) {
          toast.warning('Cobertura solapada', {
            description: `Esta zona se solapa con: ${unique.join(', ')}.`,
          });
        }
      } catch {
        /* el aviso es best-effort: no rompe el guardado */
      }
    };

    const onError = (e: unknown) => toast.error((e as Error).message);

    if (isEdit && zone) {
      update.mutate(payload, {
        onSuccess: () => {
          toast.success('Zona actualizada');
          onClose();
          void warnIfConflicts(zone.id);
        },
        onError,
      });
    } else {
      create.mutate(payload, {
        onSuccess: (res) => {
          toast.success('Zona creada');
          onClose();
          void warnIfConflicts(res.zone.id);
        },
        onError,
      });
    }
  });

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Content className="z-50">
        <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
          <Drawer.Header>
            <Drawer.Title>{isEdit ? 'Editar zona' : 'Nueva zona'}</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-4 overflow-y-auto">
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Nombre
                  </Label>
                  <Input
                    {...field}
                    placeholder="CABA Centro"
                    disabled={isPending}
                  />
                  {errors.name ? (
                    <Text size="xsmall" className="text-ui-fg-error">
                      {errors.name.message}
                    </Text>
                  ) : null}
                </div>
              )}
            />
            <Controller
              control={control}
              name="store_location_id"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Sucursal
                  </Label>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      // La cobertura pertenece a una sucursal: al cambiarla,
                      // reseteamos la cobertura elegida.
                      setValue('branch_coverage_id', NO_COVERAGE);
                    }}
                    disabled={isPending}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Sin asignar" />
                    </Select.Trigger>
                    <Select.Content className="z-[60]">
                      <Select.Item value={NO_LOCATION}>Sin asignar</Select.Item>
                      {locations.map((loc) => (
                        <Select.Item key={loc.id} value={loc.id}>
                          {loc.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              )}
            />
            <Controller
              control={control}
              name="branch_coverage_id"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Cobertura
                  </Label>
                  <Select
                    value={field.value || NO_COVERAGE}
                    onValueChange={field.onChange}
                    disabled={isPending || !coverageLocationId}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Sin cobertura" />
                    </Select.Trigger>
                    <Select.Content className="z-[60]">
                      <Select.Item value={NO_COVERAGE}>Sin cobertura</Select.Item>
                      {coverages.map((c) => (
                        <Select.Item key={c.id} value={c.id}>
                          {c.name}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {coverageLocationId
                      ? 'Las coberturas se gestionan en Delivery → Coberturas. Acá elegís cuál asociar a la zona.'
                      : 'Elegí primero una sucursal para ver sus coberturas.'}
                  </Text>
                </div>
              )}
            />
            <div className="grid grid-cols-2 gap-2">
              <Controller
                control={control}
                name="sla_hours"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <Label size="small" weight="plus">
                      SLA (horas)
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
                name="cutoff_time"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <Label size="small" weight="plus">
                      Corte (HH:mm)
                    </Label>
                    <Input
                      {...field}
                      placeholder="18:00"
                      disabled={isPending}
                    />
                    {errors.cutoff_time ? (
                      <Text size="xsmall" className="text-ui-fg-error">
                        {errors.cutoff_time.message}
                      </Text>
                    ) : null}
                  </div>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Controller
                control={control}
                name="pricing_tier"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <Label size="small" weight="plus">
                      Pricing tier
                    </Label>
                    <Input
                      {...field}
                      placeholder="standard"
                      disabled={isPending}
                    />
                  </div>
                )}
              />
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <div className="flex flex-col gap-1">
                    <Label size="small" weight="plus">
                      Prioridad
                    </Label>
                    <Input
                      {...field}
                      type="number"
                      placeholder="0"
                      disabled={isPending}
                    />
                  </div>
                )}
              />
            </div>
            <Controller
              control={control}
              name="enabled_providers"
              render={({ field }) => (
                <div className="flex flex-col gap-2">
                  <Label size="small" weight="plus">
                    Providers habilitados
                  </Label>
                  <div className="flex flex-col gap-2">
                    {PROVIDER_VALUES.map((p) => {
                      const checked = field.value.includes(p);
                      return (
                        <div
                          key={p}
                          className="flex items-center justify-between"
                        >
                          <Text size="small">{PROVIDER_LABELS[p]}</Text>
                          <Switch
                            checked={checked}
                            disabled={isPending}
                            onCheckedChange={(on) =>
                              field.onChange(
                                on
                                  ? [...field.value, p]
                                  : field.value.filter((v) => v !== p),
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
              name="default_assign_strategy"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Estrategia de asignación por defecto
                  </Label>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isPending}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Default global" />
                    </Select.Trigger>
                    <Select.Content className="z-[60]">
                      <Select.Item value={NO_STRATEGY}>
                        Default global
                      </Select.Item>
                      {STRATEGY_ASSIGN_VALUES.map((s) => (
                        <Select.Item key={s} value={s}>
                          {STRATEGY_ASSIGN_LABELS[s]}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              )}
            />
            <Controller
              control={control}
              name="active"
              render={({ field }) => (
                <div className="flex items-center justify-between">
                  <Label size="small" weight="plus">
                    Activa
                  </Label>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isPending}
                  />
                </div>
              )}
            />

            {/* ── Recursos de la zona (solo en edición: requiere zone.id) ── */}
            {isEdit && zone ? <ZoneResourcesEditor zoneId={zone.id} /> : null}
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

// ---------------------------------------------------------------------------
// Editor de recursos de zona (ZoneResource) embebido en el drawer de la zona.
//
// Lista los drivers/vehículos asociados a la zona, permite agregar (tipo +
// recurso) y quitar. Usa los endpoints /admin/delivery/zones/:id/resources.
// ---------------------------------------------------------------------------
const ZoneResourcesEditor = ({ zoneId }: { zoneId: string }) => {
  const { data, isLoading } = useZoneResources(zoneId);
  const createResource = useCreateZoneResource(zoneId);
  const deleteResource = useDeleteZoneResource(zoneId);

  const { data: driverData } = useDrivers({ active: true, limit: 200 });
  const { data: vehicleData } = useVehicles({ active: true, limit: 200 });

  const [type, setType] = useState<ZoneResourceType>('driver');
  const [resourceId, setResourceId] = useState<string>('');

  const resources = data?.resources ?? [];
  const drivers = driverData?.drivers ?? [];
  const vehicles = vehicleData?.vehicles ?? [];

  const driverNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of drivers) map.set(d.id, d.name);
    return map;
  }, [drivers]);
  const vehiclePlateById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vehicles) map.set(v.id, v.plate);
    return map;
  }, [vehicles]);

  const resolveLabel = (r: ZoneResource): string => {
    if (r.resource_type === 'driver')
      return driverNameById.get(r.resource_id) ?? r.resource_id;
    return vehiclePlateById.get(r.resource_id) ?? r.resource_id;
  };

  const onAdd = () => {
    if (!resourceId) {
      toast.error('Elegí un recurso.');
      return;
    }
    createResource.mutate(
      { resource_type: type, resource_id: resourceId },
      {
        onSuccess: () => {
          toast.success('Recurso agregado');
          setResourceId('');
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const onRemove = (r: ZoneResource) => {
    deleteResource.mutate(r.id, {
      onSuccess: () => toast.success('Recurso quitado'),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-ui-border-base pt-4">
      <Label size="small" weight="plus">
        Recursos de la zona
      </Label>
      {isLoading ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Cargando recursos…
        </Text>
      ) : resources.length === 0 ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Sin recursos asignados: la zona no restringe la flota por recurso.
        </Text>
      ) : (
        <div className="flex flex-col gap-2">
          {resources.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-md border border-ui-border-base p-2"
            >
              <div className="flex items-center gap-2">
                <Badge size="2xsmall">
                  {RESOURCE_TYPE_LABELS[r.resource_type] ?? r.resource_type}
                </Badge>
                <Text size="small">{resolveLabel(r)}</Text>
              </div>
              <IconButton
                type="button"
                variant="transparent"
                disabled={deleteResource.isPending}
                onClick={() => onRemove(r)}
              >
                <Trash />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label size="xsmall" className="text-ui-fg-subtle">
            Tipo
          </Label>
          <Select
            value={type}
            onValueChange={(v) => {
              setType(v as ZoneResourceType);
              setResourceId('');
            }}
          >
            <Select.Trigger className="w-[130px]">
              <Select.Value placeholder="Tipo" />
            </Select.Trigger>
            <Select.Content className="z-[60]">
              <Select.Item value="driver">Repartidor</Select.Item>
              <Select.Item value="vehicle">Vehículo</Select.Item>
            </Select.Content>
          </Select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <Label size="xsmall" className="text-ui-fg-subtle">
            Recurso
          </Label>
          <Select value={resourceId} onValueChange={setResourceId}>
            <Select.Trigger>
              <Select.Value placeholder="Seleccioná" />
            </Select.Trigger>
            <Select.Content className="z-[60]">
              {(type === 'driver' ? drivers : vehicles).map((item) => (
                <Select.Item key={item.id} value={item.id}>
                  {type === 'driver'
                    ? (item as { name: string }).name
                    : (item as { plate: string }).plate}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <Button
          size="small"
          variant="secondary"
          type="button"
          disabled={createResource.isPending}
          onClick={onAdd}
        >
          <Plus />
          Agregar
        </Button>
      </div>
    </div>
  );
};

const ZonesPage = () => {
  const [storeLocationId, setStoreLocationId] = useState<string | undefined>(
    undefined,
  );
  const [page, setPage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [toDelete, setToDelete] = useState<DeliveryZone | null>(null);

  const { data, isLoading } = useZones({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    store_location_id: storeLocationId,
  });
  // Para resolver el nombre de la sucursal en la tabla.
  const { data: locData } = useStoreLocations({ limit: 200 });
  const { data: conflictData } = useZoneConflicts();
  const byZone = conflictData?.by_zone ?? {};
  const deleteZone = useDeleteZone();

  const zones = data?.zones ?? [];
  const count = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of locData?.store_locations ?? []) map.set(l.id, l.name);
    return map;
  }, [locData]);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (z: DeliveryZone) => {
    setEditing(z);
    setDrawerOpen(true);
  };

  const onConfirmDelete = () => {
    if (!toDelete) return;
    deleteZone.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success('Zona eliminada');
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
            <Heading>Zonas</Heading>
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
            <Button size="small" variant="secondary" asChild>
              <a href="/app/delivery/zones/conflicts">Ver conflictos</a>
            </Button>
            <Button size="small" variant="primary" onClick={openCreate}>
              Nueva zona
            </Button>
          </div>
        </div>

        {/*
          `scoped`: `admin/delivery/zones` mete el filtro en el WHERE (`siteFilter(…,
          DELIVERY_ZONE_SITE_SCOPE)`, `api/admin/delivery/zones/route.ts:27`) y `[id]`
          corre `assertIdInSite`. El POST no lleva `siteDefaults` y está BIEN: la zona
          hereda la tienda de su `store_location_id`, que es campo obligatorio del
          formulario — un eje propio contradiría al padre.
        */}
        <SiteScopeBar screen="delivery.zones" />

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Nombre</Table.HeaderCell>
              <Table.HeaderCell>Sucursal</Table.HeaderCell>
              <Table.HeaderCell>SLA</Table.HeaderCell>
              <Table.HeaderCell>Corte</Table.HeaderCell>
              <Table.HeaderCell>Prioridad</Table.HeaderCell>
              <Table.HeaderCell>Providers</Table.HeaderCell>
              <Table.HeaderCell>Activa</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <Table.Cell colSpan={8}>Cargando…</Table.Cell>
              </Table.Row>
            ) : zones.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={8}>No hay zonas todavía.</Table.Cell>
              </Table.Row>
            ) : (
              zones.map((z) => (
                <Table.Row
                  key={z.id}
                  className="cursor-pointer"
                  onClick={() => openEdit(z)}
                >
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Text size="small" weight="plus">
                        {z.name}
                      </Text>
                      {byZone[z.id]?.length ? (
                        <Badge size="2xsmall" color="red">
                          Solapa con {byZone[z.id].length}
                        </Badge>
                      ) : null}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {z.store_location_id
                      ? (locationNameById.get(z.store_location_id) ??
                        z.store_location_id)
                      : '—'}
                  </Table.Cell>
                  <Table.Cell>
                    {z.sla_hours != null ? `${z.sla_hours} h` : '—'}
                  </Table.Cell>
                  <Table.Cell>{z.cutoff_time || '—'}</Table.Cell>
                  <Table.Cell>{z.priority}</Table.Cell>
                  <Table.Cell>
                    {z.enabled_providers && z.enabled_providers.length ? (
                      <div className="flex flex-wrap gap-1">
                        {z.enabled_providers.map((p) => (
                          <Badge key={p} size="2xsmall">
                            {PROVIDER_LABELS[p] ?? p}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <ZoneActiveToggle zone={z} />
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
                          <DropdownMenu.Item onClick={() => openEdit(z)}>
                            Editar
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            className="text-ui-fg-error"
                            onClick={() => setToDelete(z)}
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
            {count} zonas · Página {page + 1} de {pageCount}
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

      <ZoneFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        zone={editing}
      />

      <Prompt open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Eliminar zona</Prompt.Title>
            <Prompt.Description>
              ¿Seguro que querés eliminar la zona {toDelete?.name}? Esta acción
              no se puede deshacer.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action
              onClick={onConfirmDelete}
              disabled={deleteZone.isPending}
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
const ZoneActiveToggle = ({ zone }: { zone: DeliveryZone }) => {
  const update = useUpdateZone(zone.id);
  return (
    <Switch
      checked={zone.active ?? true}
      disabled={update.isPending}
      onClick={(e) => e.stopPropagation()}
      onCheckedChange={(checked) =>
        update.mutate(
          { active: checked },
          {
            onSuccess: () =>
              toast.success(checked ? 'Zona activada' : 'Zona desactivada'),
            onError: (err) => toast.error((err as Error).message),
          },
        )
      }
    />
  );
};

export const config = defineRouteConfig({
  label: 'Zonas',
});

export default ZonesPage;
