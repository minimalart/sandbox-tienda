import {
  Badge,
  Button,
  Drawer,
  Heading,
  Label,
  Select,
  StatusBadge,
  Text,
  toast,
} from '@medusajs/ui';
import { useEffect, useMemo, useState } from 'react';
import {
  type DeliveryProviderType,
  type DeliveryServiceMode,
  type DeliveryStatus,
  type ProofOfDelivery,
  type RejectedResource,
  type TrackingEvent,
  useAssignDelivery,
  useAutoAssign,
  useDeliveryExecution,
  useDeliveryExecutionEvents,
  useDeliveryExecutionProofs,
  useDrivers,
  useEligibleResources,
  useVehicles,
} from '../../hooks/api/delivery';

// Etiquetas es-AR compartidas con el ops board. Se redefinen acá para mantener
// el componente autocontenido (el board no las exporta).
const STATUS_COLORS: Record<
  DeliveryStatus,
  'green' | 'orange' | 'red' | 'blue' | 'grey'
> = {
  pending: 'grey',
  ready: 'blue',
  assigned: 'blue',
  picked_up: 'orange',
  in_transit: 'orange',
  at_pickup_point: 'orange',
  delivered: 'green',
  failed_attempt: 'red',
  canceled: 'red',
};

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Pendiente',
  ready: 'Lista',
  assigned: 'Asignada',
  picked_up: 'Retirada',
  in_transit: 'En tránsito',
  at_pickup_point: 'En punto de retiro',
  delivered: 'Entregada',
  failed_attempt: 'Intento fallido',
  canceled: 'Cancelada',
};

const PROVIDER_LABELS: Record<DeliveryProviderType, string> = {
  andreani: 'Andreani',
  own_fleet: 'Flota propia',
  store_pickup: 'Retiro en tienda',
};

const SERVICE_MODE_LABELS: Record<DeliveryServiceMode, string> = {
  home_delivery: 'A domicilio',
  hop: 'HOP',
  branch_pickup: 'Retiro en sucursal',
  store_pickup: 'Retiro en tienda',
};

const SOURCE_LABELS: Record<string, string> = {
  andreani: 'Andreani',
  driver: 'Repartidor',
  system: 'Sistema',
};

const POD_TYPE_LABELS: Record<string, string> = {
  photo: 'Foto',
  signature: 'Firma',
  pin: 'PIN',
  geo: 'Geolocalización',
  note: 'Nota',
};

// Motivos de rechazo de la elegibilidad de flota propia → texto es-AR.
//
// Las claves coinciden EXACTAMENTE con los códigos que emite el motor:
//   - Driver  (fleet-eligibility.ts isDriverEligible):
//     inactive, offline, overloaded, off_shift, zone_not_allowed
//   - Vehicle (fleet-eligibility.ts isVehicleEligible):
//     inactive, over_weight, over_volume, over_orders,
//     no_temperature_support, zone_not_allowed
//   - Workflow (auto-assign-delivery.ts, campo `reason`):
//     no_eligible_driver
// El fallback de reasonLabel devuelve el código crudo, pero con estas claves
// cubiertas NO debería dispararse.
const REASON_LABELS: Record<string, string> = {
  // Comunes driver + vehicle
  inactive: 'Inactivo',
  zone_not_allowed: 'Zona no habilitada',
  // Driver
  offline: 'Desconectado',
  overloaded: 'Sin cupo (tope de entregas alcanzado)',
  off_shift: 'Fuera de turno',
  // Vehicle
  over_weight: 'Excede capacidad de peso',
  over_volume: 'Excede capacidad de volumen',
  over_orders: 'Excede tope de órdenes',
  no_temperature_support: 'No soporta el frío requerido',
  // Workflow auto-assign
  no_eligible_driver: 'Sin repartidor elegible',
};

const reasonLabel = (reason: string): string =>
  REASON_LABELS[reason] ?? reason;

// Estrategias de asignación → texto es-AR (para el toast de éxito).
const STRATEGY_LABELS: Record<string, string> = {
  round_robin: 'rotación / round robin',
  first_available: 'primero disponible',
  least_load: 'menor carga',
};

const strategyLabel = (strategy: string): string =>
  STRATEGY_LABELS[strategy] ?? strategy;

// Tipo de vehículo → texto es-AR (para enriquecer la etiqueta de patente).
const VEHICLE_TYPE_LABELS: Record<string, string> = {
  motorcycle: 'Moto',
  van: 'Van',
  truck: 'Camión',
  car: 'Auto',
};

const fmtDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const isImageUrl = (url?: string | null): boolean =>
  !!url && /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(url);

type Props = {
  executionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ExecutionDetailDrawer = ({
  executionId,
  open,
  onOpenChange,
}: Props) => {
  const detailQuery = useDeliveryExecution(executionId ?? undefined);
  const eventsQuery = useDeliveryExecutionEvents(executionId ?? undefined);
  const proofsQuery = useDeliveryExecutionProofs(executionId ?? undefined);

  const execution = detailQuery.data?.delivery_execution;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Heading>
            {execution?.order?.display_id != null
              ? `Entrega · Orden #${execution.order.display_id}`
              : 'Detalle de entrega'}
          </Heading>
        </Drawer.Header>
        <Drawer.Body className="flex-1 overflow-y-auto p-4">
          {detailQuery.isLoading ? (
            <Text className="text-ui-fg-subtle">Cargando detalle…</Text>
          ) : detailQuery.isError ? (
            <Text className="text-ui-fg-error">
              No se pudo cargar la ejecución:{' '}
              {(detailQuery.error as Error)?.message ?? 'error desconocido'}
            </Text>
          ) : !execution ? (
            <Text className="text-ui-fg-subtle">Ejecución no encontrada.</Text>
          ) : (
            <div className="flex flex-col gap-6">
              <HeaderSection execution={execution} />
              <AssignmentSection
                executionId={execution.id}
                providerType={execution.provider_type}
                status={execution.status}
                driver={execution.driver}
                vehicle={execution.vehicle}
                storeLocationId={execution.store_location_id ?? undefined}
              />
              <TimelineSection
                isLoading={eventsQuery.isLoading}
                isError={eventsQuery.isError}
                events={eventsQuery.data?.events ?? []}
              />
              <EvidenceSection
                isLoading={proofsQuery.isLoading}
                isError={proofsQuery.isError}
                proofs={proofsQuery.data?.proofs_of_delivery ?? []}
              />
            </div>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button variant="secondary">Cerrar</Button>
          </Drawer.Close>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

type DetailExecution = NonNullable<
  ReturnType<typeof useDeliveryExecution>['data']
>['delivery_execution'];

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <Text size="xsmall" className="text-ui-fg-subtle">
      {label}
    </Text>
    <Text size="small">{value ?? '—'}</Text>
  </div>
);

const HeaderSection = ({ execution }: { execution: DetailExecution }) => {
  const addr = execution.order?.shipping_address;
  const recipient = addr
    ? [addr.first_name, addr.last_name].filter(Boolean).join(' ')
    : '';
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <StatusBadge color={STATUS_COLORS[execution.status] ?? 'grey'}>
          {STATUS_LABELS[execution.status] ?? execution.status}
        </StatusBadge>
        <Badge size="small">
          {PROVIDER_LABELS[execution.provider_type] ?? execution.provider_type}
        </Badge>
        <Badge size="small">
          {SERVICE_MODE_LABELS[execution.service_mode] ??
            execution.service_mode}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Orden"
          value={
            execution.order?.display_id != null
              ? `#${execution.order.display_id}`
              : '—'
          }
        />
        <Field label="Email" value={execution.order?.email ?? '—'} />
        <Field
          label="Tracking"
          value={
            execution.tracking_number ? (
              <span className="font-mono">{execution.tracking_number}</span>
            ) : (
              '—'
            )
          }
        />
        <Field label="Intentos" value={execution.attempt_count ?? 0} />
        {recipient ? <Field label="Destinatario" value={recipient} /> : null}
        {addr?.phone ? <Field label="Teléfono" value={addr.phone} /> : null}
      </div>
      {addr && (addr.address_1 || addr.city) ? (
        <Field
          label="Dirección"
          value={[addr.address_1, addr.city, addr.postal_code]
            .filter(Boolean)
            .join(', ')}
        />
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Despachada" value={fmtDateTime(execution.dispatched_at)} />
        <Field label="Entregada" value={fmtDateTime(execution.delivered_at)} />
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Asignación (solo flota propia permite asignar manualmente)
// ---------------------------------------------------------------------------

type AssignmentProps = {
  executionId: string;
  providerType: DeliveryProviderType;
  status: DeliveryStatus;
  driver: DetailExecution['driver'];
  vehicle: DetailExecution['vehicle'];
  storeLocationId?: string;
};

const AssignmentSection = ({
  executionId,
  providerType,
  status,
  driver,
  vehicle,
  storeLocationId,
}: AssignmentProps) => {
  const isOwnFleet = providerType === 'own_fleet';
  const alreadyAssigned = !!driver;

  return (
    <section className="flex flex-col gap-3 border-t border-ui-border-base pt-4">
      <Heading level="h3">Asignación</Heading>
      {alreadyAssigned ? (
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Repartidor"
            value={
              driver?.phone ? `${driver.name} · ${driver.phone}` : driver?.name
            }
          />
          <Field
            label="Vehículo"
            value={vehicle ? vehicle.plate : 'Sin vehículo'}
          />
        </div>
      ) : isOwnFleet ? (
        <AssignForm
          executionId={executionId}
          status={status}
          storeLocationId={storeLocationId}
        />
      ) : (
        // Andreani / store_pickup NO los maneja la flota propia: la entrega la
        // ejecuta el carrier o el cliente retira. No mostramos form de asignación.
        <Text size="small" className="text-ui-fg-subtle">
          {providerType === 'andreani'
            ? 'Entrega gestionada por Andreani. No requiere asignación de flota propia.'
            : 'Retiro en tienda. No requiere asignación de flota propia.'}
        </Text>
      )}
    </section>
  );
};

const NONE = '__none__';

const AssignForm = ({
  executionId,
  status,
  storeLocationId,
}: {
  executionId: string;
  status: DeliveryStatus;
  storeLocationId?: string;
}) => {
  const [driverId, setDriverId] = useState<string>('');
  const [vehicleId, setVehicleId] = useState<string>(NONE);

  // Solo repartidores activos; acotamos por sucursal cuando la ejecución la tiene.
  const driversQuery = useDrivers({
    active: true,
    store_location_id: storeLocationId,
    limit: 200,
  });
  const vehiclesQuery = useVehicles({
    active: true,
    store_location_id: storeLocationId,
    limit: 200,
  });

  // Universo completo (incluye inactivos / de otras sucursales) SOLO para
  // resolver id → nombre en candidatos, rechazados y feedback. Un recurso
  // rechazado puede ser 'inactive', así que no podemos limitarnos a los activos.
  const allDriversQuery = useDrivers({ limit: 500 });
  const allVehiclesQuery = useVehicles({ limit: 500 });

  // Mapas id → etiqueta legible. Driver = nombre; Vehicle = "tipo (patente)".
  const driverLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of allDriversQuery.data?.drivers ?? []) {
      map.set(d.id, d.name);
    }
    return map;
  }, [allDriversQuery.data]);

  const vehicleLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of allVehiclesQuery.data?.vehicles ?? []) {
      // "Van · ABC123" — el tipo es el dato más legible que expone el recurso
      // (no hay nombre amigable propio del vehículo).
      const typeLabel = v.type ? VEHICLE_TYPE_LABELS[v.type] : null;
      map.set(v.id, typeLabel ? `${typeLabel} · ${v.plate}` : v.plate);
    }
    return map;
  }, [allVehiclesQuery.data]);

  // Resuelven id → nombre con fallback al id crudo si el recurso no está
  // (p. ej. mapas todavía cargando), para nunca dejar la UI vacía.
  const driverLabel = (id: string): string => driverLabelById.get(id) ?? id;
  const vehicleLabel = (id: string): string => vehicleLabelById.get(id) ?? id;

  const { mutateAsync, isPending } = useAssignDelivery(executionId);

  // Auto-asignación: vista previa de candidatos (lazy) + botón de auto-asignar.
  const autoAssign = useAutoAssign(executionId);
  const [showPreview, setShowPreview] = useState(false);
  const eligibleQuery = useEligibleResources(
    showPreview ? executionId : undefined,
  );
  const [lastRejected, setLastRejected] = useState<RejectedResource[] | null>(
    null,
  );
  // Rechazos de vehículos cuando SÍ se asignó driver pero NO vehículo: los
  // mostramos como advertencia (no es un fallo total, pero el operador debería
  // verlos para entender por qué quedó sin vehículo).
  const [vehicleWarning, setVehicleWarning] = useState<
    RejectedResource[] | null
  >(null);

  const drivers = useMemo(
    () => driversQuery.data?.drivers ?? [],
    [driversQuery.data],
  );
  const vehicles = useMemo(
    () => vehiclesQuery.data?.vehicles ?? [],
    [vehiclesQuery.data],
  );

  // Solo permitimos asignar desde estados previos al despacho.
  const canAssign = status === 'pending' || status === 'ready';

  // Reset al cambiar de ejecución.
  useEffect(() => {
    setDriverId('');
    setVehicleId(NONE);
    setShowPreview(false);
    setLastRejected(null);
    setVehicleWarning(null);
  }, [executionId]);

  const handleAutoAssign = async () => {
    try {
      const { assignment } = await autoAssign.mutateAsync(undefined);
      if (assignment.assigned) {
        setLastRejected(null);
        const driverName = assignment.driver_id
          ? driverLabel(assignment.driver_id)
          : 'repartidor';
        const estrategia = strategyLabel(assignment.strategy);

        if (assignment.vehicle_id) {
          // Caso completo: driver + vehículo.
          toast.success(
            `Auto-asignada: ${driverName} · ${vehicleLabel(
              assignment.vehicle_id,
            )} (estrategia ${estrategia})`,
          );
          setVehicleWarning(null);
        } else {
          // Driver asignado pero SIN vehículo: ninguno elegible. Advertencia
          // clara + listado de los vehículos rechazados para dar contexto.
          const rejectedVehicles = (assignment.rejected ?? []).filter(
            (r) => r.resource_type === 'vehicle',
          );
          setVehicleWarning(rejectedVehicles);
          toast.warning(
            `Se asignó ${driverName} (estrategia ${estrategia}) pero NO vehículo: ` +
              'ningún vehículo elegible (ver motivos).',
          );
        }
      } else {
        setVehicleWarning(null);
        setLastRejected(assignment.rejected ?? []);
        toast.warning(
          assignment.reason
            ? `Sin asignar: ${reasonLabel(assignment.reason)}`
            : 'No hay recursos elegibles para esta entrega.',
        );
      }
    } catch (e) {
      toast.error((e as Error).message ?? 'No se pudo auto-asignar.');
    }
  };

  const handleSubmit = async () => {
    if (!driverId) {
      toast.error('Elegí un repartidor.');
      return;
    }
    try {
      await mutateAsync({
        driver_id: driverId,
        vehicle_id: vehicleId === NONE ? null : vehicleId,
      });
      toast.success('Entrega asignada.');
    } catch (e) {
      toast.error((e as Error).message ?? 'No se pudo asignar.');
    }
  };

  if (!canAssign) {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        Esta entrega ya está en curso ({STATUS_LABELS[status] ?? status}) y no
        admite reasignación desde acá.
      </Text>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="assign-driver">Repartidor</Label>
        <Select value={driverId} onValueChange={setDriverId}>
          <Select.Trigger id="assign-driver">
            <Select.Value placeholder="Seleccioná un repartidor" />
          </Select.Trigger>
          <Select.Content className="z-[60]">
            {drivers.map((d) => (
              <Select.Item key={d.id} value={d.id}>
                {d.name}
                {d.phone ? ` · ${d.phone}` : ''}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        {driversQuery.isLoading ? (
          <Text size="xsmall" className="text-ui-fg-subtle">
            Cargando repartidores…
          </Text>
        ) : drivers.length === 0 ? (
          <Text size="xsmall" className="text-ui-fg-subtle">
            No hay repartidores activos disponibles.
          </Text>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="assign-vehicle">Vehículo (opcional)</Label>
        <Select value={vehicleId} onValueChange={setVehicleId}>
          <Select.Trigger id="assign-vehicle">
            <Select.Value placeholder="Sin vehículo" />
          </Select.Trigger>
          <Select.Content className="z-[60]">
            <Select.Item value={NONE}>Sin vehículo</Select.Item>
            {vehicles.map((v) => (
              <Select.Item key={v.id} value={v.id}>
                {v.plate}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="small"
          onClick={handleSubmit}
          isLoading={isPending}
          disabled={!driverId}
        >
          Asignar
        </Button>
        <Button
          size="small"
          variant="secondary"
          onClick={handleAutoAssign}
          isLoading={autoAssign.isPending}
        >
          Auto-asignar
        </Button>
        <Button
          size="small"
          variant="transparent"
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? 'Ocultar candidatos' : 'Ver candidatos'}
        </Button>
      </div>

      {/* Previsualización de candidatos elegibles (lazy: GET eligible-resources). */}
      {showPreview ? (
        <div className="flex flex-col gap-2 rounded-md border border-ui-border-base p-3">
          {eligibleQuery.isLoading ? (
            <Text size="xsmall" className="text-ui-fg-subtle">
              Cargando candidatos…
            </Text>
          ) : eligibleQuery.isError ? (
            <Text size="xsmall" className="text-ui-fg-error">
              No se pudieron cargar los candidatos.
            </Text>
          ) : (
            <>
              <Text size="xsmall" weight="plus">
                Repartidores elegibles (
                {eligibleQuery.data?.eligible_resources.eligible_drivers
                  .length ?? 0}
                )
              </Text>
              {(eligibleQuery.data?.eligible_resources.eligible_drivers ?? [])
                .length === 0 ? (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Ninguno.
                </Text>
              ) : (
                eligibleQuery.data?.eligible_resources.eligible_drivers.map(
                  (d) => (
                    <Text key={d.id} size="xsmall">
                      {driverLabel(d.id)} · carga {d.load}
                    </Text>
                  ),
                )
              )}
              <Text size="xsmall" weight="plus" className="mt-1">
                Vehículos elegibles (
                {eligibleQuery.data?.eligible_resources.eligible_vehicles
                  .length ?? 0}
                )
              </Text>
              {(eligibleQuery.data?.eligible_resources.eligible_vehicles ?? [])
                .length === 0 ? (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Ninguno.
                </Text>
              ) : (
                eligibleQuery.data?.eligible_resources.eligible_vehicles.map(
                  (v) => (
                    <Text key={v.id} size="xsmall">
                      {vehicleLabel(v.id)}
                    </Text>
                  ),
                )
              )}
              <RejectedList
                rejected={
                  eligibleQuery.data?.eligible_resources.rejected ?? []
                }
                driverLabel={driverLabel}
                vehicleLabel={vehicleLabel}
              />
            </>
          )}
        </div>
      ) : null}

      {/* Motivos de rechazo del último intento de auto-asignación fallido. */}
      {lastRejected && lastRejected.length ? (
        <div className="flex flex-col gap-1 rounded-md border border-ui-border-error p-3">
          <Text size="xsmall" weight="plus" className="text-ui-fg-error">
            No se pudo auto-asignar — recursos rechazados:
          </Text>
          <RejectedList
            rejected={lastRejected}
            driverLabel={driverLabel}
            vehicleLabel={vehicleLabel}
          />
        </div>
      ) : null}

      {/* Advertencia: se asignó repartidor pero NO vehículo (ninguno elegible). */}
      {vehicleWarning ? (
        <div className="flex flex-col gap-1 rounded-md border border-ui-tag-orange-border bg-ui-tag-orange-bg p-3">
          <Text size="xsmall" weight="plus" className="text-ui-tag-orange-text">
            Se asignó repartidor pero NO vehículo: ningún vehículo elegible.
          </Text>
          {vehicleWarning.length ? (
            <RejectedList
              rejected={vehicleWarning}
              driverLabel={driverLabel}
              vehicleLabel={vehicleLabel}
            />
          ) : (
            <Text size="xsmall" className="text-ui-fg-subtle">
              No hay vehículos configurados para esta entrega.
            </Text>
          )}
        </div>
      ) : null}
    </div>
  );
};

const RejectedList = ({
  rejected,
  driverLabel,
  vehicleLabel,
}: {
  rejected: RejectedResource[];
  driverLabel: (id: string) => string;
  vehicleLabel: (id: string) => string;
}) => {
  if (!rejected.length) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {rejected.map((r, i) => {
        const isDriver = r.resource_type === 'driver';
        const label = isDriver ? driverLabel(r.id) : vehicleLabel(r.id);
        return (
          <Text
            key={`${r.resource_type}-${r.id}-${i}`}
            size="xsmall"
            className="text-ui-fg-subtle"
          >
            {isDriver ? 'Repartidor' : 'Vehículo'} {label} —{' '}
            {reasonLabel(r.reason)}
          </Text>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Timeline de eventos
// ---------------------------------------------------------------------------

const TimelineSection = ({
  isLoading,
  isError,
  events,
}: {
  isLoading: boolean;
  isError: boolean;
  events: TrackingEvent[];
}) => (
  <section className="flex flex-col gap-3 border-t border-ui-border-base pt-4">
    <Heading level="h3">Timeline</Heading>
    {isLoading ? (
      <Text size="small" className="text-ui-fg-subtle">
        Cargando eventos…
      </Text>
    ) : isError ? (
      <Text size="small" className="text-ui-fg-error">
        No se pudieron cargar los eventos.
      </Text>
    ) : events.length === 0 ? (
      <Text size="small" className="text-ui-fg-subtle">
        Sin eventos registrados todavía.
      </Text>
    ) : (
      <ol className="flex flex-col gap-0">
        {events.map((ev, idx) => (
          <li key={ev.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="mt-1 h-2 w-2 rounded-full bg-ui-fg-interactive" />
              {idx < events.length - 1 ? (
                <span className="w-px flex-1 bg-ui-border-base" />
              ) : null}
            </div>
            <div className="flex flex-col gap-0.5 pb-4">
              <Text size="small" weight="plus">
                {ev.description || ev.code}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {fmtDateTime(ev.occurred_at)} ·{' '}
                {SOURCE_LABELS[ev.source] ?? ev.source} · {ev.code}
              </Text>
              {ev.location?.lat != null && ev.location?.lng != null ? (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {ev.location.lat}, {ev.location.lng}
                </Text>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    )}
  </section>
);

// ---------------------------------------------------------------------------
// Evidencia de entrega (POD)
// ---------------------------------------------------------------------------

const EvidenceSection = ({
  isLoading,
  isError,
  proofs,
}: {
  isLoading: boolean;
  isError: boolean;
  proofs: ProofOfDelivery[];
}) => (
  <section className="flex flex-col gap-3 border-t border-ui-border-base pt-4">
    <Heading level="h3">Evidencia de entrega</Heading>
    {isLoading ? (
      <Text size="small" className="text-ui-fg-subtle">
        Cargando evidencia…
      </Text>
    ) : isError ? (
      <Text size="small" className="text-ui-fg-error">
        No se pudo cargar la evidencia.
      </Text>
    ) : proofs.length === 0 ? (
      <Text size="small" className="text-ui-fg-subtle">
        Sin evidencia de entrega.
      </Text>
    ) : (
      <div className="flex flex-col gap-4">
        {proofs.map((p) => (
          <ProofCard key={p.id} proof={p} />
        ))}
      </div>
    )}
  </section>
);

const ProofCard = ({ proof }: { proof: ProofOfDelivery }) => {
  const hasGeo = proof.captured_lat != null && proof.captured_lng != null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-ui-border-base p-3">
      <div className="flex items-center justify-between">
        <Badge size="small">{POD_TYPE_LABELS[proof.type] ?? proof.type}</Badge>
        <Text size="xsmall" className="text-ui-fg-subtle">
          {fmtDateTime(proof.captured_at)}
        </Text>
      </div>
      {/* Foto: las URLs públicas (Modules.FILE) se muestran con <img>. */}
      {isImageUrl(proof.file_url) ? (
        <img
          src={proof.file_url as string}
          alt="Evidencia de entrega"
          className="max-h-64 w-full rounded-md object-contain"
        />
      ) : proof.file_url ? (
        <a
          href={proof.file_url}
          target="_blank"
          rel="noreferrer"
          className="text-ui-fg-interactive text-sm underline"
        >
          Ver archivo
        </a>
      ) : null}
      {/* Firma capturada (imagen). */}
      {proof.signature_url ? (
        <div className="flex flex-col gap-1">
          <Text size="xsmall" className="text-ui-fg-subtle">
            Firma
          </Text>
          <img
            src={proof.signature_url}
            alt="Firma del receptor"
            className="max-h-32 w-full rounded-md bg-ui-bg-base object-contain"
          />
        </div>
      ) : null}
      {hasGeo ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Geo: {proof.captured_lat}, {proof.captured_lng}
        </Text>
      ) : null}
      {proof.pin_validated != null ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          PIN: {proof.pin_validated ? 'validado' : 'no validado'}
        </Text>
      ) : null}
      {proof.note ? <Text size="small">{proof.note}</Text> : null}
    </div>
  );
};
