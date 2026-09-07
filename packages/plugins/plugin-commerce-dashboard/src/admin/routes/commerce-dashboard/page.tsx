import { defineRouteConfig } from '@medusajs/admin-sdk';
import { CurrencyDollar, InformationCircle } from '@medusajs/icons';
import {
  Badge,
  Button,
  Container,
  DatePicker,
  Heading,
  Input,
  Select,
  Text,
  Tooltip,
  toast,
} from '@medusajs/ui';
import { useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import pkg from '../../../../package.json';
import {
  useAggregateCommerceMetrics,
  useCommerceDashboard,
  useDashboardSalesChannels,
  type BreakdownMetric,
  type CommercialCalendar as CommercialCalendarData,
  type CommerceDashboardFilters,
  type RankedMetric,
} from '../../hooks/api/commerce-dashboard';
import { dateOnlyToDate, dateToDateOnly } from '../../lib/date';

const PLUGIN_VERSION = pkg.version;

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const money = (value: number, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(value || 0);

const number = (value: number) => new Intl.NumberFormat('es-AR').format(value || 0);

const percent = (value: number) =>
  `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value || 0)}%`;

const ratio = (value: number) => percent((value || 0) * 100);

const dateTime = (value?: string | null) => {
  if (!value) return 'Sin snapshots';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const metricHints: Record<string, string> = {
  Revenue: 'Total vendido en el rango seleccionado, expresado en la moneda filtrada.',
  'Órdenes': 'Cantidad de órdenes incluidas en los snapshots del rango seleccionado.',
  AOV: 'Ticket promedio: revenue dividido por cantidad de órdenes.',
  Unidades: 'Total de unidades vendidas en el rango seleccionado.',
  'Unidades vendidas': 'Evolución de unidades vendidas por período.',
  'Clientes nuevos': 'Clientes cuya primera orden registrada cae dentro del rango seleccionado.',
  'Clientes recurrentes': 'Clientes con compras previas antes del rango seleccionado.',
  Refunds: 'Monto total devuelto o reembolsado en el rango seleccionado.',
  'Conversion proxy': 'Indicador proxy calculado desde órdenes agregadas; no reemplaza analytics de sesiones.',
  'Repeat purchase rate': 'Porcentaje de clientes con más de una compra sobre clientes con órdenes.',
  'Clientes con órdenes': 'Clientes únicos que realizaron al menos una orden en el rango.',
  'Clientes repiten': 'Clientes del rango que acumulan más de una compra.',
  'Repeat purchase': 'Clientes que repiten dividido por clientes con órdenes.',
  'Returning share': 'Participación de clientes recurrentes sobre clientes con órdenes.',
  'Calendario comercial': 'Distribución de ventas por día u hora para detectar picos comerciales.',
  'Sales channels': 'Revenue, órdenes y unidades agrupadas por canal de venta.',
  Países: 'Revenue, órdenes y unidades agrupadas por país.',
  Monedas: 'Revenue, órdenes y unidades agrupadas por moneda.',
  'Top products': 'Productos con mayor revenue en el rango seleccionado.',
  'Top collections': 'Colecciones con mayor revenue en el rango seleccionado.',
  'Top categories': 'Categorías con mayor revenue en el rango seleccionado.',
};

const CardHeading = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="flex min-w-0 items-center gap-2">
    <Heading level="h3" className="min-w-0 truncate">
      {title}
    </Heading>
    {hint ? (
      <Tooltip content={hint}>
        <InformationCircle
          aria-label={`Ayuda: ${title}`}
          className="shrink-0 cursor-help text-ui-fg-muted transition-colors hover:text-ui-fg-subtle"
        />
      </Tooltip>
    ) : null}
  </div>
);

const KpiCard = ({
  label,
  value,
  delta,
  format = number,
  hint,
}: {
  label: string;
  value: number;
  delta: number;
  format?: (value: number) => string;
  hint?: string;
}) => (
  <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
    <div className="flex items-center gap-2">
      <Text size="xsmall" className="min-w-0 truncate text-ui-fg-subtle">
        {label}
      </Text>
      {hint || metricHints[label] ? (
        <Tooltip content={hint ?? metricHints[label]}>
          <InformationCircle
            aria-label={`Ayuda: ${label}`}
            className="shrink-0 cursor-help text-ui-fg-muted transition-colors hover:text-ui-fg-subtle"
          />
        </Tooltip>
      ) : null}
    </div>
    <div className="mt-2 flex items-end justify-between gap-3">
      <Text size="large" weight="plus">
        {format(value)}
      </Text>
      <Badge size="2xsmall" color={delta >= 0 ? 'green' : 'red'}>
        {delta >= 0 ? '+' : ''}
        {percent(delta)}
      </Badge>
    </div>
  </div>
);

const CHART_COLOR = '#2e7d32';

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

const ChartTooltip = ({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  format: (value: number) => string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2 shadow-elevation-tooltip">
      <Text size="xsmall" className="text-ui-fg-subtle">
        {label
          ? new Date(label).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
          : ''}
      </Text>
      <Text size="small" weight="plus">
        {format(payload[0].value)}
      </Text>
    </div>
  );
};

const LineChart = ({
  rows,
  format,
}: {
  rows: Array<{ period: string; value: number }>;
  format: (value: number) => string;
}) => {
  const gradientId = `metric-fill-${useId().replace(/:/g, '')}`;

  return (
    <div className="h-56 rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
      {rows.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <Text size="small" className="text-ui-fg-muted">
            Sin snapshots para el rango seleccionado
          </Text>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLOR} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CHART_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border-base)" />
            <XAxis
              dataKey="period"
              tickFormatter={shortDate}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tickMargin={8}
              tick={{ fontSize: 11, fill: 'var(--fg-muted)' }}
            />
            <YAxis hide domain={[0, 'auto']} />
            <RechartsTooltip
              cursor={{ stroke: CHART_COLOR, strokeOpacity: 0.25 }}
              content={(props) => <ChartTooltip {...props} format={format} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={CHART_COLOR}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={rows.length === 1 ? { r: 4, fill: CHART_COLOR, strokeWidth: 0 } : false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

const heatColor = (value: number, max: number) => {
  if (max <= 0 || value <= 0) return 'rgba(46, 125, 50, 0.08)';
  const opacity = Math.max(0.18, Math.min(0.9, value / max));
  return `rgba(46, 125, 50, ${opacity})`;
};

const CalendarCell = ({
  label,
  revenue,
  orders,
  units,
  max,
  currency,
}: {
  label: string;
  revenue: number;
  orders: number;
  units: number;
  max: number;
  currency: string;
}) => (
  <div
    className="min-h-[74px] rounded-md border border-ui-border-base p-2"
    style={{ backgroundColor: heatColor(revenue, max) }}
    title={`${label}: ${money(revenue, currency)} · ${number(orders)} órdenes · ${number(units)} unidades`}
  >
    <Text size="xsmall" weight="plus">
      {label}
    </Text>
    <Text size="xsmall" className="mt-1 text-ui-fg-subtle">
      {money(revenue, currency)}
    </Text>
    <Text size="xsmall" className="text-ui-fg-muted">
      {number(orders)} ord.
    </Text>
  </div>
);

const CommercialCalendar = ({
  calendar,
  currency,
}: {
  calendar?: CommercialCalendarData;
  currency: string;
}) => {
  const rows = calendar?.rows ?? [];
  const max = Math.max(...rows.map((row) => row.revenue), 1);
  const weekdays = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

  return (
    <Container className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardHeading title="Calendario comercial" hint={metricHints['Calendario comercial']} />
        <Badge size="2xsmall">{calendar?.mode === 'hourly' ? 'Por hora' : 'Diario'}</Badge>
      </div>
      {rows.length === 0 ? (
        <Text size="small" className="text-ui-fg-muted">
          Sin datos agregados para este rango.
        </Text>
      ) : calendar?.mode === 'hourly' ? (
        <div className="overflow-hidden">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            {calendar.rows.map((row) => (
              <CalendarCell
                key={`${row.day_of_week}-${row.hour}`}
                label={`${weekdays[row.day_of_week] ?? row.day_of_week} ${row.hour}:00`}
                revenue={row.revenue}
                orders={row.orders}
                units={row.units_sold}
                max={max}
                currency={currency}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
          {calendar.rows.map((row) => {
            const weekday = new Date(row.date).getUTCDay();
            return (
              <CalendarCell
                key={row.date}
                label={`${weekdays[weekday] ?? ''} ${row.day_of_month}`}
                revenue={row.revenue}
                orders={row.orders}
                units={row.units_sold}
                max={max}
                currency={currency}
              />
            );
          })}
        </div>
      )}
    </Container>
  );
};

const BreakdownTable = ({
  title,
  rows,
  currency,
  labels,
}: {
  title: string;
  rows: BreakdownMetric[];
  currency: string;
  labels?: Record<string, string>;
}) => (
  <Container className="p-0">
    <div className="border-b border-ui-border-base px-6 py-4">
      <CardHeading title={title} hint={metricHints[title]} />
    </div>
    <div className="overflow-hidden">
      <table className="w-full table-fixed text-left">
        <thead className="border-b border-ui-border-base bg-ui-bg-subtle">
          <tr>
            <th className="w-[34%] px-3 py-3 txt-compact-small-plus">Segmento</th>
            <th className="w-[24%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">
              Revenue
            </th>
            <th className="w-[14%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">Share</th>
            <th className="w-[14%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">
              Órdenes
            </th>
            <th className="w-[14%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">Unid.</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-ui-fg-muted txt-compact-small" colSpan={5}>
                Sin datos agregados.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.key} className="border-b border-ui-border-base last:border-b-0">
                <td
                  className="max-w-[180px] truncate px-3 py-3 txt-compact-small-plus"
                  title={labels?.[row.key] ?? row.key}
                >
                  {labels?.[row.key] ?? row.key}
                </td>
                <td className="truncate whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                  {money(row.revenue, currency)}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                  {ratio(row.revenue_share)}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                  {number(row.orders)}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                  {number(row.units_sold)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </Container>
);

const TopTable = ({
  title,
  rows,
  currency,
}: {
  title: string;
  rows: RankedMetric[];
  currency: string;
}) => (
  <Container className="p-0">
    <div className="border-b border-ui-border-base px-6 py-4">
      <CardHeading title={title} hint={metricHints[title]} />
    </div>
    <div className="overflow-hidden">
      <table className="w-full table-fixed text-left">
        <thead className="border-b border-ui-border-base bg-ui-bg-subtle">
          <tr>
            <th className="w-[30%] px-3 py-3 txt-compact-small-plus">Nombre</th>
            <th className="w-[20%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">
              Revenue
            </th>
            <th className="w-[12%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">Share</th>
            <th className="w-[12%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">
              Órdenes
            </th>
            <th className="w-[10%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">Unid.</th>
            <th className="w-[16%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">
              Prom. unid.
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-ui-fg-muted txt-compact-small" colSpan={6}>
                Sin datos agregados.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-ui-border-base last:border-b-0">
                <td
                  className="max-w-[180px] truncate px-3 py-3 txt-compact-small-plus"
                  title={row.title}
                >
                  {row.title}
                </td>
                <td className="truncate whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                  {money(row.revenue, currency)}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                  {ratio(row.revenue_share)}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                  {number(row.orders)}
                </td>
                <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                  {number(row.units_sold)}
                </td>
                <td className="truncate whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                  {money(row.avg_unit_price, currency)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </Container>
);

const CommerceDashboardPage = () => {
  const [filters, setFilters] = useState<CommerceDashboardFilters>({
    from: daysAgo(29),
    to: today(),
    bucket: 'daily',
    currency_code: 'ars',
  });

  const { data, isLoading, error } = useCommerceDashboard(filters);
  const { data: salesChannelsData } = useDashboardSalesChannels();
  const aggregate = useAggregateCommerceMetrics();
  const dashboard = data?.dashboard;
  const currency = filters.currency_code || 'ars';

  const kpis = dashboard?.kpis;
  const tables = dashboard?.tables;
  const charts = dashboard?.charts;
  const customer = dashboard?.customers;
  const breakdowns = dashboard?.breakdowns;

  const channelLabels = useMemo(
    () =>
      Object.fromEntries(
        (salesChannelsData?.sales_channels ?? []).map((channel) => [channel.id, channel.name])
      ) as Record<string, string>,
    [salesChannelsData?.sales_channels]
  );

  const responseBadge = useMemo(() => {
    const ms = data?.meta?.response_time_ms;
    if (ms == null) return null;
    return <Badge color={ms <= 200 ? 'green' : 'orange'}>{ms}ms</Badge>;
  }, [data?.meta?.response_time_ms]);

  const lastUpdatedText = useMemo(
    () => dateTime(data?.meta?.last_aggregated_at),
    [data?.meta?.last_aggregated_at]
  );

  const set = (key: keyof CommerceDashboardFilters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));

  const setSalesChannel = (value: string) =>
    setFilters((prev) => ({
      ...prev,
      sales_channel_id: value === '__all' ? undefined : value,
    }));

  const runAggregation = async () => {
    try {
      await aggregate.mutateAsync({
        ...filters,
        from: `${filters.from}T00:00:00.000Z`,
        to: `${filters.to}T23:59:59.999Z`,
      });
      toast.success('Snapshots actualizados');
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar métricas');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Heading>Métricas</Heading>
            <Badge size="2xsmall" color="grey" rounded="full" title="Plugin version">
              v{PLUGIN_VERSION}
            </Badge>
            {responseBadge}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Text size="xsmall" className="text-ui-fg-subtle">
              Última actualización: {lastUpdatedText}
            </Text>
            <Button
              size="small"
              variant="primary"
              onClick={runAggregation}
              isLoading={aggregate.isPending}
            >
              Sincronizar
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <DatePicker
            granularity="day"
            value={dateOnlyToDate(filters.from)}
            onChange={(date) => set('from', dateToDateOnly(date))}
          />
          <DatePicker
            granularity="day"
            value={dateOnlyToDate(filters.to)}
            onChange={(date) => set('to', dateToDateOnly(date))}
          />
          <Select value={filters.sales_channel_id ?? '__all'} onValueChange={setSalesChannel}>
            <Select.Trigger>
              <Select.Value placeholder="Sales channel" />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="__all">Todos los sales channels</Select.Item>
              {(salesChannelsData?.sales_channels ?? []).map((channel) => (
                <Select.Item key={channel.id} value={channel.id}>
                  {channel.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Input
            placeholder="Country"
            value={filters.country_code ?? ''}
            onChange={(event) => set('country_code', event.target.value.toLowerCase())}
          />
          <div className="flex gap-2">
            <Input
              placeholder="Currency"
              value={filters.currency_code ?? ''}
              onChange={(event) => set('currency_code', event.target.value.toLowerCase())}
            />
            <Select
              value={filters.bucket ?? 'daily'}
              onValueChange={(value) => set('bucket', value)}
            >
              <Select.Trigger className="w-32">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="daily">Diario</Select.Item>
                <Select.Item value="hourly">Por hora</Select.Item>
              </Select.Content>
            </Select>
          </div>
        </div>
      </Container>

      {error ? (
        <Container className="p-6">
          <Text className="text-ui-fg-error">{error.message}</Text>
        </Container>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          label="Revenue"
          value={kpis?.revenue.value ?? 0}
          delta={kpis?.revenue.delta ?? 0}
          format={(value) => money(value, currency)}
        />
        <KpiCard label="Órdenes" value={kpis?.orders.value ?? 0} delta={kpis?.orders.delta ?? 0} />
        <KpiCard
          label="AOV"
          value={kpis?.aov.value ?? 0}
          delta={kpis?.aov.delta ?? 0}
          format={(value) => money(value, currency)}
        />
        <KpiCard
          label="Unidades"
          value={kpis?.units_sold.value ?? 0}
          delta={kpis?.units_sold.delta ?? 0}
        />
        <KpiCard
          label="Clientes nuevos"
          value={kpis?.new_customers.value ?? 0}
          delta={kpis?.new_customers.delta ?? 0}
        />
        <KpiCard
          label="Clientes recurrentes"
          value={kpis?.returning_customers.value ?? 0}
          delta={kpis?.returning_customers.delta ?? 0}
        />
        <KpiCard
          label="Refunds"
          value={kpis?.refunds.value ?? 0}
          delta={kpis?.refunds.delta ?? 0}
          format={(value) => money(value, currency)}
        />
        <KpiCard
          label="Conversion proxy"
          value={kpis?.conversion_proxy.value ?? 0}
          delta={kpis?.conversion_proxy.delta ?? 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Container className="flex flex-col gap-3 p-6">
          <CardHeading title="Revenue" hint={metricHints.Revenue} />
          <LineChart
            rows={charts?.revenue_over_time ?? []}
            format={(value) => money(value, currency)}
          />
        </Container>
        <Container className="flex flex-col gap-3 p-6">
          <CardHeading title="Órdenes" hint={metricHints['Órdenes']} />
          <LineChart rows={charts?.orders_over_time ?? []} format={number} />
        </Container>
        <Container className="flex flex-col gap-3 p-6">
          <CardHeading title="Unidades vendidas" hint={metricHints['Unidades vendidas']} />
          <LineChart rows={charts?.units_sold_over_time ?? []} format={number} />
        </Container>
        <Container className="flex flex-col gap-3 p-6">
          <CardHeading title="AOV" hint={metricHints.AOV} />
          <LineChart
            rows={charts?.aov_over_time ?? []}
            format={(value) => money(value, currency)}
          />
        </Container>
        <Container className="flex flex-col gap-3 p-6">
          <CardHeading title="Repeat purchase rate" hint={metricHints['Repeat purchase rate']} />
          <LineChart rows={charts?.repeat_purchase_rate_over_time ?? []} format={ratio} />
        </Container>
      </div>

      <CommercialCalendar calendar={charts?.commercial_calendar} currency={currency} />

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Clientes con órdenes"
          value={customer?.customers_with_orders.value ?? 0}
          delta={customer?.customers_with_orders.delta ?? 0}
        />
        <KpiCard
          label="Clientes nuevos"
          value={customer?.new_customers.value ?? 0}
          delta={customer?.new_customers.delta ?? 0}
        />
        <KpiCard
          label="Clientes recurrentes"
          value={customer?.returning_customers.value ?? 0}
          delta={customer?.returning_customers.delta ?? 0}
        />
        <KpiCard
          label="Clientes repiten"
          value={customer?.repeat_customers.value ?? 0}
          delta={customer?.repeat_customers.delta ?? 0}
        />
        <KpiCard
          label="Repeat purchase"
          value={customer?.repeat_purchase_rate.value ?? 0}
          delta={customer?.repeat_purchase_rate.delta ?? 0}
          format={ratio}
        />
        <KpiCard
          label="Returning share"
          value={customer?.returning_share.value ?? 0}
          delta={customer?.returning_share.delta ?? 0}
          format={ratio}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownTable
          title="Sales channels"
          rows={breakdowns?.sales_channels ?? []}
          currency={currency}
          labels={channelLabels}
        />
        <BreakdownTable title="Países" rows={breakdowns?.countries ?? []} currency={currency} />
        <BreakdownTable title="Monedas" rows={breakdowns?.currencies ?? []} currency={currency} />
      </div>

      {isLoading ? (
        <Container className="p-6">
          <Text size="small" className="text-ui-fg-subtle">
            Cargando snapshots...
          </Text>
        </Container>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <TopTable title="Top products" rows={tables?.top_products ?? []} currency={currency} />
        <TopTable
          title="Top collections"
          rows={tables?.top_collections ?? []}
          currency={currency}
        />
        <TopTable title="Top categories" rows={tables?.top_categories ?? []} currency={currency} />
      </div>
    </div>
  );
};

const CommerceDashboardIcon = () => <CurrencyDollar style={{ color: '#2e7d32' }} />;

export const config = defineRouteConfig({
  label: 'Métricas',
  icon: CommerceDashboardIcon,
  rank: 40,
});

// Breadcrumb in the top header (next to the notification bell), matching
// Medusa's built-in pages.
export const handle = {
  breadcrumb: () => 'Métricas',
};

export default CommerceDashboardPage;
