import { defineRouteConfig } from '@medusajs/admin-sdk';
import { TruckFast } from '@medusajs/icons';
import {
  Button,
  Container,
  Heading,
  Select,
  StatusBadge,
  Table,
  Text,
} from '@medusajs/ui';
import { useState } from 'react';
import {
  type DeliveryProviderType,
  type DeliveryServiceMode,
  type DeliveryStatus,
  useDeliveryExecutions,
} from '../../hooks/api/delivery';
import { ExtensionVersion } from '../../components/common/extension-version';
import { SiteScopeBar } from '../../components/common/site-scope-bar';
import { StoreLocationFilter } from '../../components/delivery/store-location-filter';
import { ExecutionDetailDrawer } from '../../components/delivery/execution-detail-drawer';

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<DeliveryStatus, 'green' | 'orange' | 'red' | 'blue' | 'grey'> = {
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

const DeliveryPage = () => {
  const [status, setStatus] = useState<string>('all');
  const [provider, setProvider] = useState<string>('all');
  const [storeLocationId, setStoreLocationId] = useState<string | undefined>(
    undefined,
  );
  const [page, setPage] = useState(0);
  // Detalle de ejecución en Drawer (click en una fila).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (id: string) => {
    setSelectedId(id);
    setDetailOpen(true);
  };

  const { data, isLoading } = useDeliveryExecutions({
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    status: status === 'all' ? undefined : (status as DeliveryStatus),
    provider_type: provider === 'all' ? undefined : (provider as DeliveryProviderType),
    store_location_id: storeLocationId,
  });

  const executions = data?.delivery_executions ?? [];
  const count = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const canPrev = page > 0;
  const canNext = page + 1 < pageCount;

  // Reset de página al cambiar un filtro (evita quedar fuera de rango).
  const onStatusChange = (v: string) => {
    setStatus(v);
    setPage(0);
  };
  const onProviderChange = (v: string) => {
    setProvider(v);
    setPage(0);
  };
  const onStoreLocationChange = (v: string | undefined) => {
    setStoreLocationId(v);
    setPage(0);
  };

  return (
    <div className="flex flex-col gap-y-2">
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-x-2">
            <Heading>Delivery</Heading>
            <ExtensionVersion extension="delivery" />
          </div>
          <div className="flex items-center gap-2">
            <StoreLocationFilter
              value={storeLocationId}
              onChange={onStoreLocationChange}
            />
            <Select value={status} onValueChange={onStatusChange}>
              <Select.Trigger className="w-[180px]">
                <Select.Value placeholder="Estado" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">Todos los estados</Select.Item>
                {(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((s) => (
                  <Select.Item key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
            <Select value={provider} onValueChange={onProviderChange}>
              <Select.Trigger className="w-[160px]">
                <Select.Value placeholder="Proveedor" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">Todos</Select.Item>
                {(Object.keys(PROVIDER_LABELS) as DeliveryProviderType[]).map((p) => (
                  <Select.Item key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </div>

        {/*
          `scoped` con la prueba a mano: el listado es de EJECUCIONES y
          `admin/delivery/executions` mete el filtro en el WHERE (`siteFilter(…,
          DELIVERY_EXECUTION_SITE_SCOPE)`, `api/admin/delivery/executions/route.ts:34`);
          `[id]` corre `assertIdInSite`.

          No falta `siteDefaults` en ningún alta porque desde acá no se crea nada, y
          tampoco lo llevarían: en `delivery` la tienda se hereda de la sucursal por FK
          (`via_parent` sobre `store_location`), así que estampar un eje propio
          contradiría al padre. El selector de sucursal de al lado ACOTA dentro de la
          tienda, no la reemplaza: el filtro de tienda se aplica antes, en el WHERE.
        */}
        <SiteScopeBar screen="delivery.executions" />

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Orden</Table.HeaderCell>
              <Table.HeaderCell>Proveedor</Table.HeaderCell>
              <Table.HeaderCell>Modo</Table.HeaderCell>
              <Table.HeaderCell>Estado</Table.HeaderCell>
              <Table.HeaderCell>Tracking</Table.HeaderCell>
              <Table.HeaderCell>Última actualización</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {isLoading ? (
              <Table.Row>
                <Table.Cell colSpan={6}>Cargando…</Table.Cell>
              </Table.Row>
            ) : executions.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6}>No hay ejecuciones de entrega todavía.</Table.Cell>
              </Table.Row>
            ) : (
              executions.map((e) => (
                <Table.Row
                  key={e.id}
                  className="cursor-pointer"
                  onClick={() => openDetail(e.id)}
                >
                  <Table.Cell>
                    <div className="flex flex-col">
                      <Text size="small" weight="plus">
                        {e.order?.display_id != null ? `#${e.order.display_id}` : '—'}
                      </Text>
                      {e.order?.email ? (
                        <Text size="xsmall" className="text-ui-fg-subtle">
                          {e.order.email}
                        </Text>
                      ) : null}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {PROVIDER_LABELS[e.provider_type] ?? e.provider_type}
                  </Table.Cell>
                  <Table.Cell>
                    {SERVICE_MODE_LABELS[e.service_mode] ?? e.service_mode}
                  </Table.Cell>
                  <Table.Cell>
                    <StatusBadge color={STATUS_COLORS[e.status] ?? 'grey'}>
                      {STATUS_LABELS[e.status] ?? e.status}
                    </StatusBadge>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" className="font-mono">
                      {e.tracking_number || '—'}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      {fmtDateTime(e.last_event_at)}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>

        <div className="flex items-center justify-between px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">
            {count} ejecuciones · Página {page + 1} de {pageCount}
          </Text>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              variant="secondary"
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <Button
              size="small"
              variant="secondary"
              disabled={!canNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>

        <ExecutionDetailDrawer
          executionId={selectedId}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      </Container>
    </div>
  );
};

const DeliveryIcon = () => <TruckFast />;

export const config = defineRouteConfig({
  label: 'Delivery',
  icon: DeliveryIcon,
  rank: 90,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Delivery',
};

export default DeliveryPage;
