import { defineRouteConfig } from '@medusajs/admin-sdk';
import { ShoppingCart, EllipsisHorizontal } from '@medusajs/icons';
import {
  Badge,
  Container,
  createDataTableColumnHelper,
  DataTable,
  type DataTablePaginationState,
  DropdownMenu,
  Heading,
  IconButton,
  Select,
  StatusBadge,
  Text,
  toast,
  Toaster,
  useDataTable,
} from '@medusajs/ui';
import { SiteScopeBar } from '@minimalart/mercatto-plugin-runtime/admin';
import { useMemo, useState } from 'react';
import {
  type AbandonedCart,
  type AbandonedCartMetrics,
  useAbandonedCarts,
  useResendAbandonedCart,
  useSalesChannels,
} from '../../hooks/api/abandoned-carts';

const PAGE_SIZE = 20;

const STATUS: Record<
  AbandonedCart['status'],
  { label: string; color: 'green' | 'orange' | 'red' | 'grey' | 'blue' }
> = {
  pending: { label: 'Pendiente', color: 'orange' },
  notified: { label: 'Notificado', color: 'blue' },
  recovered: { label: 'Recuperado', color: 'green' },
  cancelled: { label: 'Cancelado', color: 'grey' },
};

function fmtMoney(amount?: number | null, currency?: string | null): string {
  const value = Number(amount) || 0;
  return `${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}${currency ? ` ${currency.toUpperCase()}` : ''}`;
}

function fmtDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

const columnHelper = createDataTableColumnHelper<AbandonedCart>();

/**
 * Los montos van por moneda: sumar ARS + CLP + USD en un solo número da un valor
 * que no significa nada. Con una sola moneda se ve igual que antes.
 */
function fmtByCurrency(byCurrency?: Record<string, number>): string {
  const entries = Object.entries(byCurrency ?? {}).filter(([, v]) => Number(v));
  if (!entries.length) return fmtMoney(0);
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, value]) => fmtMoney(value, currency))
    .join(' · ');
}

const MetricsBar = ({ metrics }: { metrics?: AbandonedCartMetrics }) => {
  if (!metrics) return null;
  const items = [
    {
      label: 'Abandonados',
      value: String(metrics.total ?? 0),
      hint: `${metrics.contactable ?? 0} contactables · ${metrics.uncontactable ?? 0} sin contacto`,
    },
    { label: 'Pendientes', value: String(metrics.by_status?.pending ?? 0) },
    { label: 'Notificados', value: String(metrics.by_status?.notified ?? 0) },
    { label: 'Recuperados', value: String(metrics.by_status?.recovered ?? 0) },
    {
      label: 'Valor recuperable',
      value: fmtByCurrency(metrics.recoverable_value_by_currency),
    },
    {
      label: 'Valor recuperado',
      value: fmtByCurrency(metrics.recovered_value_by_currency),
    },
    {
      label: 'Tasa de recuperación',
      value: `${Math.round((metrics.recovery_rate ?? 0) * 100)}%`,
      hint: 'sobre contactables',
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 border-t px-6 py-4 md:grid-cols-4 xl:grid-cols-7">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col">
          <Text size="xsmall" className="text-ui-fg-subtle">
            {it.label}
          </Text>
          <Text size="large" className="font-semibold">
            {it.value}
          </Text>
          {it.hint ? (
            <Text size="xsmall" className="text-ui-fg-muted">
              {it.hint}
            </Text>
          ) : null}
        </div>
      ))}
    </div>
  );
};

const RowActions = ({ row }: { row: AbandonedCart }) => {
  const resend = useResendAbandonedCart();
  const disabled = row.status === 'recovered' || row.status === 'cancelled';

  const onResend = async () => {
    try {
      await resend.mutateAsync({ id: row.id });
      toast.success('Recordatorio disparado');
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
          <DropdownMenu.Item disabled={disabled || resend.isPending} onClick={onResend}>
            Reenviar recordatorio
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};

const ALL_CHANNELS = 'all';

const AbandonedCarts = () => {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: PAGE_SIZE,
  });
  const [channel, setChannel] = useState<string>(ALL_CHANNELS);
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useAbandonedCarts({
    limit: pagination.pageSize,
    offset,
    sales_channel_id: channel === ALL_CHANNELS ? undefined : channel,
  });
  const { data: channelsData } = useSalesChannels();
  const channels = channelsData?.sales_channels ?? [];

  const rows = data?.abandoned_carts ?? [];
  const count = data?.count ?? 0;

  const channelNames = useMemo(
    () => new Map(channels.map((c) => [c.id, c.name])),
    [channels],
  );

  const onChannelChange = (value: string) => {
    setChannel(value);
    // Volver a la primera página: el offset viejo puede caer fuera del recorte nuevo.
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('email', {
        header: 'Contacto',
        cell: ({ row }) => {
          const { email, phone } = row.original;
          // Ahora se trackean carritos sin contacto: se marcan explícitamente en
          // vez de mostrar un guión ambiguo, porque son los que NO se pueden notificar.
          if (!email && !phone) {
            return <span className="text-ui-fg-muted">Sin contacto</span>;
          }
          return (
            <div className="flex flex-col">
              <span className="font-medium">{email || '—'}</span>
              <span className="text-ui-fg-subtle text-xs">{phone || ''}</span>
            </div>
          );
        },
      }),
      columnHelper.accessor('cart_total', {
        header: 'Valor',
        cell: ({ row }) => fmtMoney(row.original.cart_total, row.original.currency_code),
      }),
      columnHelper.accessor('sales_channel_id', {
        header: 'Canal',
        cell: ({ getValue }) => {
          const id = getValue();
          if (!id) return '—';
          return channelNames.get(id) ?? id;
        },
      }),
      columnHelper.accessor('status', {
        header: 'Estado',
        cell: ({ getValue }) => {
          const s = STATUS[getValue()] ?? STATUS.pending;
          return <StatusBadge color={s.color}>{s.label}</StatusBadge>;
        },
      }),
      columnHelper.accessor('last_step_sent', {
        header: 'Último paso',
        cell: ({ getValue }) => (getValue() > 0 ? `#${getValue()}` : '—'),
      }),
      columnHelper.accessor('next_eligible_at', {
        header: 'Próxima notificación',
        cell: ({ getValue }) => fmtDate(getValue()),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => <RowActions row={row.original} />,
      }),
    ],
    [channelNames],
  );

  const table = useDataTable({
    columns,
    data: rows,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
  });

  return (
    <div className="flex flex-col gap-y-2">
      <Container className="p-0">
        <SiteScopeBar screen="abandoned-carts" />
        <DataTable instance={table}>
          <DataTable.Toolbar className="flex flex-col items-start justify-between gap-y-3 px-6 py-4 md:flex-row md:items-center">
            <div className="flex items-center gap-x-2">
              <Heading>Carritos abandonados</Heading>
              <Badge size="2xsmall">v1.4.1</Badge>
            </div>
            {channels.length > 1 ? (
              <Select value={channel} onValueChange={onChannelChange}>
                <Select.Trigger className="w-full md:w-64">
                  <Select.Value placeholder="Canal de venta" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value={ALL_CHANNELS}>Todos los canales</Select.Item>
                  {channels.map((c) => (
                    <Select.Item key={c.id} value={c.id}>
                      {c.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            ) : null}
          </DataTable.Toolbar>
          <MetricsBar metrics={data?.metrics} />
          {count > 0 || isPending ? (
            <>
              <DataTable.Table />
              <DataTable.Pagination />
            </>
          ) : (
            <div className="flex items-center justify-center border-t p-6 text-center">
              <Text className="text-ui-fg-subtle">
                {channel === ALL_CHANNELS
                  ? 'Todavía no se detectaron carritos abandonados.'
                  : 'No hay carritos abandonados en este canal.'}
              </Text>
            </div>
          )}
        </DataTable>
      </Container>

      <Container>
        <Heading level="h2">Configuración</Heading>
        <Text className="text-ui-fg-subtle mt-2">
          La cadencia y los topes de la extensión se controlan por variables de
          entorno: <code>ABANDONED_CART_STEP1_HOURS</code>,{' '}
          <code>ABANDONED_CART_STEP2_HOURS</code>,{' '}
          <code>ABANDONED_CART_STEP3_HOURS</code>,{' '}
          <code>ABANDONED_CART_MAX_AGE_HOURS</code>,{' '}
          <code>ABANDONED_CART_BATCH_SIZE</code>,{' '}
          <code>ABANDONED_CART_MAX_PAGES</code>,{' '}
          <code>ABANDONED_CART_ENABLED</code> y{' '}
          <code>ABANDONED_CART_SCAN_CRON</code>. Cambiar cualquiera requiere
          reiniciar el backend para que el nuevo valor tome efecto.
        </Text>
      </Container>

      <Toaster />
    </div>
  );
};

const AbandonedCartsIcon = () => <ShoppingCart style={{ color: '#EAB308' }} />;

export const config = defineRouteConfig({
  label: 'Carritos abandonados',
  icon: AbandonedCartsIcon,
  rank: 40,
});

export const handle = {
  breadcrumb: () => 'Carritos abandonados',
};

export default AbandonedCarts;
