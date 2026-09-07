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
  StatusBadge,
  Switch,
  Table,
  Text,
  toast,
  Toaster,
} from '@medusajs/ui';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { DropdownMenu, IconButton } from '@medusajs/ui';
import { EllipsisHorizontal, Plus, Trash } from '@medusajs/icons';
import {
  type Driver,
  type DriverShift,
  type DriverStatus,
  useCreateDriver,
  useCreateDriverShift,
  useDeleteDriver,
  useDeleteDriverShift,
  useDriverShifts,
  useDrivers,
  useUpdateDriver,
} from '../../../hooks/api/delivery';
import { useStoreLocations } from '../../../hooks/api/store-locations';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { StoreLocationFilter } from '../../../components/delivery/store-location-filter';

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<DriverStatus, 'green' | 'orange' | 'grey'> = {
  available: 'green',
  on_route: 'orange',
  offline: 'grey',
};

const STATUS_LABELS: Record<DriverStatus, string> = {
  available: 'Disponible',
  on_route: 'En ruta',
  offline: 'Desconectado',
};

const STATUS_VALUES = Object.keys(STATUS_LABELS) as DriverStatus[];

// Sentinel para "sin sucursal" en el Select del form (UI Select no admite value="").
const NO_LOCATION = '__none';

// Validación 'HH:mm' (24h), igual que el backend (validators.ts → HHMM).
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Días de la semana, convención JS Date.getDay() (0=domingo).
const DAY_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

// String numérico → entero positivo o null (max_active_deliveries).
const toPositiveInt = (raw?: string): number | null => {
  if (!raw || !raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
};

const driverFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  phone: z.string().optional(),
  email: z
    .string()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),
  status: z.enum(['available', 'on_route', 'offline']),
  store_location_id: z.string().optional(),
  max_active_deliveries: z.string().optional(),
  active: z.boolean(),
});

type DriverFormValues = z.infer<typeof driverFormSchema>;

const emptyForm: DriverFormValues = {
  name: '',
  phone: '',
  email: '',
  status: 'offline',
  store_location_id: NO_LOCATION,
  max_active_deliveries: '',
  active: true,
};

const DriverFormDrawer = ({
  open,
  onClose,
  driver,
}: {
  open: boolean;
  onClose: () => void;
  /** Si viene, el drawer está en modo edición. */
  driver: Driver | null;
}) => {
  const isEdit = !!driver;
  const { data: locData } = useStoreLocations({ limit: 200 });
  const locations = locData?.store_locations ?? [];

  const create = useCreateDriver();
  const update = useUpdateDriver(driver?.id ?? '');
  const isPending = create.isPending || update.isPending;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: emptyForm,
  });

  useEffect(() => {
    if (open) {
      reset(
        driver
          ? {
              name: driver.name,
              phone: driver.phone ?? '',
              email: driver.email ?? '',
              status: driver.status,
              store_location_id: driver.store_location_id ?? NO_LOCATION,
              max_active_deliveries:
                driver.max_active_deliveries != null
                  ? String(driver.max_active_deliveries)
                  : '',
              active: driver.active ?? true,
            }
          : emptyForm,
      );
    }
  }, [open, driver, reset]);

  const onSubmit = handleSubmit((values) => {
    const payload = {
      name: values.name.trim(),
      phone: values.phone?.trim() ? values.phone.trim() : null,
      email: values.email?.trim() ? values.email.trim() : null,
      status: values.status,
      store_location_id:
        values.store_location_id && values.store_location_id !== NO_LOCATION
          ? values.store_location_id
          : null,
      max_active_deliveries: toPositiveInt(values.max_active_deliveries),
      active: values.active,
    };

    const onSuccess = () => {
      toast.success(isEdit ? 'Repartidor actualizado' : 'Repartidor creado');
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
              {isEdit ? 'Editar repartidor' : 'Nuevo repartidor'}
            </Drawer.Title>
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
                  <Input {...field} placeholder="Juan Pérez" disabled={isPending} />
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
              name="phone"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Teléfono
                  </Label>
                  <Input
                    {...field}
                    placeholder="+54 11 5555-5555"
                    disabled={isPending}
                  />
                </div>
              )}
            />
            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Email
                  </Label>
                  <Input
                    {...field}
                    type="email"
                    placeholder="juan@empresa.com"
                    disabled={isPending}
                  />
                  {errors.email ? (
                    <Text size="xsmall" className="text-ui-fg-error">
                      {errors.email.message}
                    </Text>
                  ) : null}
                </div>
              )}
            />
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Estado
                  </Label>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isPending}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Estado" />
                    </Select.Trigger>
                    <Select.Content className="z-[60]">
                      {STATUS_VALUES.map((s) => (
                        <Select.Item key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
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
                    onValueChange={field.onChange}
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
              name="max_active_deliveries"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label size="small" weight="plus">
                    Tope de entregas activas simultáneas
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

            {/* ── Editor de turnos (solo en edición: requiere driver.id) ── */}
            {isEdit && driver ? <ShiftsEditor driverId={driver.id} /> : null}
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
// Editor de turnos (DriverShift) embebido en el drawer del repartidor.
//
// Grilla semanal de disponibilidad. Lista los turnos del driver, permite agregar
// (día + start/end 'HH:mm') y borrar. Usa los endpoints
// /admin/delivery/drivers/:id/shifts.
// ---------------------------------------------------------------------------
const fmtShiftDay = (d: number): string => DAY_LABELS[d] ?? String(d);

const ShiftsEditor = ({ driverId }: { driverId: string }) => {
  const { data, isLoading } = useDriverShifts(driverId);
  const createShift = useCreateDriverShift(driverId);
  const deleteShift = useDeleteDriverShift(driverId);

  const [day, setDay] = useState<string>('1');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');

  const shifts = data?.shifts ?? [];

  const onAdd = () => {
    if (!HHMM.test(start) || !HHMM.test(end)) {
      toast.error("Horarios en formato 'HH:mm' (ej. 09:00).");
      return;
    }
    if (start >= end) {
      toast.error('La hora de inicio debe ser anterior a la de fin.');
      return;
    }
    createShift.mutate(
      {
        day_of_week: Number(day),
        start_time: start,
        end_time: end,
      },
      {
        onSuccess: () => {
          toast.success('Turno agregado');
          setStart('');
          setEnd('');
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const onRemove = (shift: DriverShift) => {
    deleteShift.mutate(shift.id, {
      onSuccess: () => toast.success('Turno eliminado'),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <div className="flex flex-col gap-3 border-t border-ui-border-base pt-4">
      <Label size="small" weight="plus">
        Turnos (disponibilidad semanal)
      </Label>
      {isLoading ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Cargando turnos…
        </Text>
      ) : shifts.length === 0 ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Sin turnos: el repartidor no tiene restricción horaria.
        </Text>
      ) : (
        <div className="flex flex-col gap-2">
          {shifts.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border border-ui-border-base p-2"
            >
              <Text size="small">
                {fmtShiftDay(s.day_of_week)} · {s.start_time}–{s.end_time}
              </Text>
              <IconButton
                type="button"
                variant="transparent"
                disabled={deleteShift.isPending}
                onClick={() => onRemove(s)}
              >
                <Trash />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label size="xsmall" className="text-ui-fg-subtle">
            Día
          </Label>
          <Select value={day} onValueChange={setDay}>
            <Select.Trigger>
              <Select.Value placeholder="Día" />
            </Select.Trigger>
            <Select.Content className="z-[60]">
              {DAY_VALUES.map((d) => (
                <Select.Item key={d} value={String(d)}>
                  {DAY_LABELS[d]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label size="xsmall" className="text-ui-fg-subtle">
            Desde
          </Label>
          <Input
            value={start}
            onChange={(e) => setStart(e.target.value)}
            placeholder="09:00"
            className="w-[90px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label size="xsmall" className="text-ui-fg-subtle">
            Hasta
          </Label>
          <Input
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            placeholder="18:00"
            className="w-[90px]"
          />
        </div>
        <Button
          size="small"
          variant="secondary"
          type="button"
          disabled={createShift.isPending}
          onClick={onAdd}
        >
          <Plus />
          Agregar
        </Button>
      </div>
    </div>
  );
};

const DriversPage = () => {
  const [status, setStatus] = useState<string>('all');
  const [storeLocationId, setStoreLocationId] = useState<string | undefined>(
    undefined,
  );
  const [page, setPage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [toDelete, setToDelete] = useState<Driver | null>(null);

  const { data, isLoading } = useDrivers({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    status: status === 'all' ? undefined : (status as DriverStatus),
    store_location_id: storeLocationId,
  });

  const deleteDriver = useDeleteDriver();

  const drivers = data?.drivers ?? [];
  const count = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (d: Driver) => {
    setEditing(d);
    setDrawerOpen(true);
  };

  const onConfirmDelete = () => {
    if (!toDelete) return;
    deleteDriver.mutate(toDelete.id, {
      onSuccess: () => {
        toast.success('Repartidor eliminado');
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
            <Heading>Repartidores</Heading>
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
                {STATUS_VALUES.map((s) => (
                  <Select.Item key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Button size="small" variant="primary" onClick={openCreate}>
              Nuevo repartidor
            </Button>
          </div>
        </div>

        {/*
          `scoped`: `admin/delivery/drivers` mete el filtro en el WHERE (`siteFilter(…,
          DRIVER_SITE_SCOPE)`, `api/admin/delivery/drivers/route.ts:30`) y `[id]` corre
          `assertIdInSite`. La tienda se hereda de la sucursal del repartidor.

          `empty: 'all'`: el repartidor todavía sin sucursal se ve desde todas las
          tiendas. Es deliberado —esconder a alguien que recién se dio de alta haría
          creer que el alta falló—, no una fuga del filtro.
        */}
        <SiteScopeBar screen="delivery.drivers" />

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Nombre</Table.HeaderCell>
              <Table.HeaderCell>Contacto</Table.HeaderCell>
              <Table.HeaderCell>Estado</Table.HeaderCell>
              <Table.HeaderCell>Activo</Table.HeaderCell>
              <Table.HeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <Table.Cell colSpan={5}>Cargando…</Table.Cell>
              </Table.Row>
            ) : drivers.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  No hay repartidores todavía.
                </Table.Cell>
              </Table.Row>
            ) : (
              drivers.map((d) => (
                <Table.Row
                  key={d.id}
                  className="cursor-pointer"
                  onClick={() => openEdit(d)}
                >
                  <Table.Cell>
                    <Text size="small" weight="plus">
                      {d.name}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-col">
                      <Text size="small">{d.phone || '—'}</Text>
                      {d.email ? (
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {d.email}
                        </Text>
                      ) : null}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={STATUS_COLORS[d.status] ?? 'grey'}>
                      {STATUS_LABELS[d.status] ?? d.status}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>
                    <DriverActiveToggle driver={d} />
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
                          <DropdownMenu.Item onClick={() => openEdit(d)}>
                            Editar
                          </DropdownMenu.Item>
                          <DropdownMenu.Separator />
                          <DropdownMenu.Item
                            className="text-ui-fg-error"
                            onClick={() => setToDelete(d)}
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
            {count} repartidores · Página {page + 1} de {pageCount}
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

      <DriverFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        driver={editing}
      />

      <Prompt open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <Prompt.Content>
          <Prompt.Header>
            <Prompt.Title>Eliminar repartidor</Prompt.Title>
            <Prompt.Description>
              ¿Seguro que querés eliminar a {toDelete?.name}? Esta acción no se
              puede deshacer.
            </Prompt.Description>
          </Prompt.Header>
          <Prompt.Footer>
            <Prompt.Cancel>Cancelar</Prompt.Cancel>
            <Prompt.Action
              onClick={onConfirmDelete}
              disabled={deleteDriver.isPending}
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
const DriverActiveToggle = ({ driver }: { driver: Driver }) => {
  const update = useUpdateDriver(driver.id);
  return (
    <Switch
      checked={driver.active ?? true}
      disabled={update.isPending}
      onClick={(e) => e.stopPropagation()}
      onCheckedChange={(checked) =>
        update.mutate(
          { active: checked },
          {
            onSuccess: () =>
              toast.success(checked ? 'Repartidor activado' : 'Repartidor desactivado'),
            onError: (err) => toast.error((err as Error).message),
          },
        )
      }
    />
  );
};

export const config = defineRouteConfig({
  label: 'Repartidores',
});

export default DriversPage;
