import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ArrowPath, EllipsisHorizontal } from '@medusajs/icons';
import {
  Container,
  Button,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  DropdownMenu,
  Heading,
  IconButton,
  Input,
  Select,
  StatusBadge,
  Text,
  toast,
  Toaster,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExtensionVersion } from '../../components/common/extension-version';
import {
  type RecurringOrder,
  type RecurringOrderMetrics,
  useCancelRecurringOrder,
  usePauseRecurringOrder,
  useRecurringOrders,
  useResumeRecurringOrder,
} from '../../hooks/api/recurring-orders';
import { fmtDate, fmtMoney, frequencyLabel, STATUS } from './helpers';
import { SiteScopeBar } from '../../components/common/site-scope-bar';
import { SubscriptionSectionNav } from './section-nav';
import { siteHeaders } from '../../lib/http';

const PAGE_SIZE = 20;

const columnHelper = createDataTableColumnHelper<RecurringOrder>();

const MetricsBar = ({ metrics }: { metrics?: RecurringOrderMetrics }) => {
  if (!metrics) return null;
  const items = [
    { label: 'Total', value: String(metrics.total) },
    { label: 'Activas', value: String(metrics.by_status.active ?? 0) },
    { label: 'Esperando pago', value: String(metrics.pending_payment_count ?? 0) },
    { label: 'Valor pendiente', value: fmtMoney(metrics.pending_payment_value) },
    { label: 'Vencen en 7 días', value: String(metrics.due_next_7d ?? 0) },
    { label: 'Ciclos fallidos (30d)', value: String(metrics.failed_cycles_30d ?? 0) },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 px-6 py-4 md:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col">
          <Text size="xsmall" className="text-ui-fg-subtle">
            {it.label}
          </Text>
          <Text size="large" className="font-semibold">
            {it.value}
          </Text>
        </div>
      ))}
    </div>
  );
};

const RowActions = ({ row }: { row: RecurringOrder }) => {
  const navigate = useNavigate();
  const pause = usePauseRecurringOrder();
  const resume = useResumeRecurringOrder();
  const cancel = useCancelRecurringOrder();

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <IconButton size="small" variant="transparent">
            <EllipsisHorizontal />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Item onClick={() => navigate(`/recurring-orders/${row.id}`)}>
            Ver detalle
          </DropdownMenu.Item>
          {row.status === 'active' && (
            <DropdownMenu.Item
              disabled={pause.isPending}
              onClick={() =>
                run(() => pause.mutateAsync({ id: row.id }), 'Suscripción pausada')
              }
            >
              Pausar
            </DropdownMenu.Item>
          )}
          {(row.status === 'paused' || row.status === 'failed') && (
            <DropdownMenu.Item
              disabled={resume.isPending}
              onClick={() =>
                run(() => resume.mutateAsync({ id: row.id }), 'Suscripción reanudada')
              }
            >
              Reanudar
            </DropdownMenu.Item>
          )}
          {row.status !== 'cancelled' && row.status !== 'completed' && (
            <DropdownMenu.Item
              disabled={cancel.isPending}
              onClick={() => {
                if (!window.confirm('¿Cancelar esta suscripción?')) return;
                run(() => cancel.mutateAsync({ id: row.id }), 'Suscripción cancelada');
              }}
            >
              Cancelar
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};

const RecurringOrders = () => {
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [status, setStatus] = useState<string>('all');
  const [q, setQ] = useState('');
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useRecurringOrders({
    limit: pagination.pageSize,
    offset,
    ...(status !== 'all' ? { status } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  });

  const rows = data?.recurring_orders ?? [];
  const count = data?.count ?? 0;

  const exportSubscriptions = async () => {
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (q.trim()) params.set('q', q.trim());
      const response = await fetch(`/admin/recurring-orders/export?${params.toString()}`, {
        credentials: 'include',
        headers: siteHeaders(),
      });
      if (!response.ok) throw new Error('No se pudo generar el CSV.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `suscripciones-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('email', {
        header: 'Cliente',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.email || '—'}</span>
            <span className="text-ui-fg-subtle text-xs">{row.original.phone || ''}</span>
          </div>
        ),
      }),
      columnHelper.display({
        id: 'items',
        header: 'Productos',
        cell: ({ row }) => {
          const items = row.original.items ?? [];
          const first = items[0]?.product_snapshot?.title ?? '—';
          return (
            <div className="flex flex-col">
              <span className="max-w-48 truncate">{first}</span>
              {items.length > 1 && (
                <span className="text-ui-fg-subtle text-xs">
                  y {items.length - 1} más
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('frequency_interval', {
        header: 'Frecuencia',
        cell: ({ row }) =>
          frequencyLabel(row.original.frequency_interval, row.original.frequency_count),
      }),
      columnHelper.accessor('next_execution_at', {
        header: 'Próxima ejecución',
        cell: ({ getValue }) => fmtDate(getValue()),
      }),
      columnHelper.accessor('status', {
        header: 'Estado',
        cell: ({ getValue }) => {
          const s = STATUS[getValue()] ?? STATUS.active;
          return <StatusBadge color={s.color}>{s.label}</StatusBadge>;
        },
      }),
      columnHelper.accessor('payment_mode', {
        header: 'Cobro',
        cell: ({ getValue }) =>
          getValue() === 'manual_link' ? 'Link de pago' : getValue(),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => <RowActions row={row.original} />,
      }),
    ],
    [],
  );

  const table = useDataTable({
    columns,
    data: rows,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_, row) => navigate(`/recurring-orders/${row.id}`),
  });

  return (
    <>
      <Container className="p-0">
        <SubscriptionSectionNav />
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex items-center justify-between border-b border-ui-border-base px-6 py-4">
            <div className="flex items-center gap-x-2">
              <Heading>Compras recurrentes</Heading>
              <ExtensionVersion extension="recurring-orders" />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
            <Input
              aria-label="Buscar suscripciones"
              className="w-64"
              onChange={(event) => {
                setQ(event.target.value);
                setPagination((current) => ({ ...current, pageIndex: 0 }));
              }}
              placeholder="Email, ID, plan o pedido"
              size="small"
              value={q}
            />
            <div className="w-48">
              <Select
                onValueChange={(v) => {
                  setStatus(v);
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                }}
                size="small"
                value={status}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Estado" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">Todos los estados</Select.Item>
                  {Object.entries(STATUS).map(([key, s]) => (
                    <Select.Item key={key} value={key}>
                      {s.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <Button onClick={exportSubscriptions} size="small" variant="secondary">
              Exportar CSV
            </Button>
            </div>
          </DataTable.Toolbar>

          {/*
            La barra va DENTRO de la card y debajo del título, no flotando arriba:
            misma posición que la franja de tienda de las pantallas de ajustes. Suelta
            sobre la card se lee como si hablara de la página; adentro y bajo el header
            se lee como lo que es: de qué tienda son ESTAS suscripciones.

            El `border-b` pasó al header y `MetricsBar` perdió su `border-t`: la barra
            ya trae el suyo y dos líneas de 1px pegadas se leen como una costura de
            2px. Va en el header y no en la barra porque `SiteScopeBar` devuelve null
            en instalaciones mono-tienda —la mayoría—, y ahí el separador entre el
            título y las métricas tiene que seguir estando.
          */}
          <SiteScopeBar screen="recurring-orders" />

          <MetricsBar metrics={data?.metrics} />
          {count > 0 || isPending ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex items-center justify-center border-t p-6 text-center">
              <Text className="text-ui-fg-subtle">
                Todavía no hay compras recurrentes.
              </Text>
            </div>
          )}
        </DataTable>
      </Container>
      <Toaster />
    </>
  );
};

const RecurringOrdersIcon = () => <ArrowPath style={{ color: '#0EA5E9' }} />;

export const config = defineRouteConfig({
  label: 'Compras recurrentes',
  icon: RecurringOrdersIcon,
  rank: 41,
});

export const handle = {
  breadcrumb: () => 'Compras recurrentes',
};

export default RecurringOrders;
