import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Button,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  Heading,
  Input,
  Select,
  StatusBadge,
  Text,
  toast,
  Toaster,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  type RenewalQueueRow,
  useForceRenewalCycle,
  useRenewalCyclesQueue,
} from '../../../hooks/api/recurring-orders';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { fmtDate, fmtMoney, frequencyLabel } from '../helpers';
import { SubscriptionSectionNav } from '../section-nav';

const PAGE_SIZE = 20;

const CYCLE_STATUS: Record<
  RenewalQueueRow['status'],
  { label: string; color: 'green' | 'orange' | 'red' | 'grey' | 'blue' }
> = {
  scheduled: { label: 'Programado', color: 'grey' },
  forecasted: { label: 'Proyectado', color: 'blue' },
  quoted: { label: 'Cotizado', color: 'blue' },
  inventory_reserved: { label: 'Stock reservado', color: 'blue' },
  awaiting_authorization: { label: 'Esperando autorización', color: 'orange' },
  awaiting_charge: { label: 'Esperando cobro', color: 'blue' },
  paid: { label: 'Pagado', color: 'green' },
  order_created: { label: 'Pedido creado', color: 'green' },
  retrying_stock: { label: 'Reintentando stock', color: 'orange' },
  past_due: { label: 'Pago vencido', color: 'red' },
  refunded: { label: 'Reembolsado', color: 'grey' },
  canceled: { label: 'Cancelado', color: 'grey' },
  processing: { label: 'En proceso', color: 'blue' },
  pending_payment: { label: 'Esperando pago', color: 'blue' },
  success: { label: 'Exitoso', color: 'green' },
  failed: { label: 'Fallido', color: 'red' },
  skipped: { label: 'Omitido', color: 'grey' },
};

const columnHelper = createDataTableColumnHelper<RenewalQueueRow>();

const ForceButton = ({ row }: { row: RenewalQueueRow }) => {
  const force = useForceRenewalCycle();
  if (row.status !== 'scheduled' && row.status !== 'failed') return null;
  return (
    <Button
      disabled={force.isPending}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          const { result } = await force.mutateAsync({
            id: row.recurring_order_id,
            cycleId: row.id,
          });
          if (result.outcome === 'pending_payment') {
            toast.success('Renovación generada: se envió el link de pago.');
          } else {
            toast.error(result.reason ?? `Resultado: ${result.outcome}`);
          }
        } catch (err) {
          toast.error((err as Error).message);
        }
      }}
      size="small"
      variant="secondary"
    >
      Forzar
    </Button>
  );
};

const RenewalsQueue = () => {
  const navigate = useNavigate();
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const offset = pagination.pageIndex * pagination.pageSize;

  const { data, isPending } = useRenewalCyclesQueue({
    limit: pagination.pageSize,
    offset,
    ...(status !== 'all' ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  const rows = data?.cycles ?? [];
  const count = data?.count ?? 0;

  const columns = useMemo(
    () => [
      columnHelper.accessor('scheduled_at', {
        header: 'Programada',
        cell: ({ getValue }) => fmtDate(getValue()),
      }),
      columnHelper.display({
        id: 'customer',
        header: 'Cliente',
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.subscription?.email ?? '—'}</span>
            <span className="text-ui-fg-subtle text-xs">
              {row.original.subscription
                ? frequencyLabel(
                    row.original.subscription.frequency_interval,
                    row.original.subscription.frequency_count,
                  )
                : ''}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor('status', {
        header: 'Estado',
        cell: ({ getValue }) => {
          const s = CYCLE_STATUS[getValue()] ?? CYCLE_STATUS.scheduled;
          return <StatusBadge color={s.color}>{s.label}</StatusBadge>;
        },
      }),
      columnHelper.display({
        id: 'total',
        header: 'Total',
        cell: ({ row }) =>
          row.original.totals?.total != null
            ? fmtMoney(row.original.totals.total, row.original.totals.currency_code)
            : '—',
      }),
      columnHelper.accessor('attempt_count', {
        header: 'Intentos',
        cell: ({ getValue, row }) => (
          <div className="flex flex-col">
            <span>{getValue() || '—'}</span>
            {row.original.last_error && (
              <span className="max-w-40 truncate text-ui-fg-error text-xs">
                {row.original.last_error}
              </span>
            )}
          </div>
        ),
      }),
      columnHelper.display({
        id: 'order',
        header: 'Orden',
        cell: ({ row }) =>
          row.original.generated_order_id ? (
            <Link
              className="text-ui-fg-interactive text-sm hover:underline"
              onClick={(e) => e.stopPropagation()}
              to={`/orders/${row.original.generated_order_id}`}
            >
              Ver pedido
            </Link>
          ) : (
            '—'
          ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => <ForceButton row={row.original} />,
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
    onRowClick: (_, row) => navigate(`/recurring-orders/${row.recurring_order_id}`),
  });

  return (
    <>
      <Container className="p-0">
        <SubscriptionSectionNav />
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div>
              <Heading>Cola de renovaciones</Heading>
              <Text size="small" className="text-ui-fg-subtle">
                Todas las suscripciones, cronológico. Click en la fila abre la suscripción.
              </Text>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Desde"
                onChange={(e) => setFrom(e.target.value)}
                size="small"
                type="date"
                value={from}
              />
              <Input
                aria-label="Hasta"
                onChange={(e) => setTo(e.target.value)}
                size="small"
                type="date"
                value={to}
              />
              <div className="w-44">
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
                    {Object.entries(CYCLE_STATUS).map(([key, s]) => (
                      <Select.Item key={key} value={key}>
                        {s.label}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
            </div>
          </DataTable.Toolbar>

          {/*
            `scoped`: `admin/recurring-orders/cycles` mete el filtro en el WHERE
            (`siteFilter(…, RENEWAL_CYCLE_SITE_SCOPE)`, descriptor en
            `modules/recurring-order/site-scope.ts`). El ciclo no tiene eje
            propio: lo hereda de su suscripción por `recurring_order_id`, con
            `empty: 'unassigned'` porque un ciclo huérfano no es global, no existe.

            La segunda consulta del handler —`listRecurringOrders({ id: subIds })`, para
            la columna de cliente— no repite el filtro y no hace falta: sus ids salen del
            resultado ya filtrado.

            Entrada propia y no la de `recurring-orders`: esta cola lista CICLOS y
            aquella suscripciones, con dos rutas y dos descriptores distintos.
          */}
          <SiteScopeBar screen="recurring-orders.renewals" />

          {count > 0 || isPending ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex items-center justify-center border-t p-6 text-center">
              <Text className="text-ui-fg-subtle">Sin renovaciones en el filtro.</Text>
            </div>
          )}
        </DataTable>
      </Container>
      <Toaster />
    </>
  );
};

export const config = defineRouteConfig({
  label: 'Renovaciones',
});

export const handle = {
  breadcrumb: () => 'Renovaciones',
};

export default RenewalsQueue;
