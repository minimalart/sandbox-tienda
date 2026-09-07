import { defineRouteConfig } from '@medusajs/admin-sdk';

import {
  Badge,
  Button,
  Container,
  DatePicker,
  Heading,
  Select,
  Text,
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
import {
  useDeliveryMetrics,
  type CountByKey,
  type DeliveryMetricsFilters,
  type DriverRank,
  type TimeseriesPoint,
  type ZoneRank,
} from '../../../hooks/api/delivery-analytics';
import type { DeliveryProviderType } from '../../../hooks/api/delivery';
import { StoreLocationFilter } from '../../../components/delivery/store-location-filter';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { dateOnlyToDate, dateToDateOnly } from '../../../lib/date';

const CHART_COLOR = '#2e7d32';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

const number = (value: number) => new Intl.NumberFormat('es-AR').format(value || 0);
const percent = (value: number) =>
  `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format((value || 0) * 100)}%`;

const minutes = (value: number | null) => {
  if (value == null) return '—';
  if (value < 60) return `${Math.round(value)} min`;
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
};

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });

const STATUS_LABELS: Record<string, string> = {
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

const PROVIDER_LABELS: Record<string, string> = {
  andreani: 'Andreani',
  own_fleet: 'Flota propia',
  store_pickup: 'Retiro en tienda',
};

const SERVICE_MODE_LABELS: Record<string, string> = {
  home_delivery: 'A domicilio',
  hop: 'Punto HOP',
  branch_pickup: 'Retiro en sucursal',
  store_pickup: 'Retiro en tienda',
};

const KpiCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
    <Text size="xsmall" className="min-w-0 truncate text-ui-fg-subtle">
      {label}
    </Text>
    <div className="mt-2 flex items-end justify-between gap-3">
      <Text size="large" weight="plus">
        {value}
      </Text>
    </div>
    {hint ? (
      <Text size="xsmall" className="mt-1 text-ui-fg-muted">
        {hint}
      </Text>
    ) : null}
  </div>
);

const ChartTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
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
        {number(payload[0].value)} entregas
      </Text>
    </div>
  );
};

const DeliveriesChart = ({ rows }: { rows: TimeseriesPoint[] }) => {
  const gradientId = `delivery-fill-${useId().replace(/:/g, '')}`;

  return (
    <div className="h-56 rounded-lg border border-ui-border-base bg-ui-bg-base p-4">
      {rows.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <Text size="small" className="text-ui-fg-muted">
            Sin entregas para el rango seleccionado
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
              content={(props) => <ChartTooltip {...props} />}
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

const BreakdownBars = ({
  title,
  rows,
  labels,
}: {
  title: string;
  rows: CountByKey[];
  labels: Record<string, string>;
}) => {
  const max = Math.max(...rows.map((r) => r.count), 1);
  const visible = rows.filter((r) => r.count > 0 || labels[r.key]);

  return (
    <Container className="flex flex-col gap-3 p-6">
      <Heading level="h3">{title}</Heading>
      {visible.length === 0 ? (
        <Text size="small" className="text-ui-fg-muted">
          Sin datos para este rango.
        </Text>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((row) => (
            <div key={row.key} className="flex items-center gap-3">
              <Text size="xsmall" className="w-32 shrink-0 truncate text-ui-fg-subtle">
                {labels[row.key] ?? row.key}
              </Text>
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-ui-bg-subtle">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(row.count / max) * 100}%`,
                    backgroundColor: CHART_COLOR,
                  }}
                />
              </div>
              <Text size="xsmall" weight="plus" className="w-10 shrink-0 text-right tabular-nums">
                {number(row.count)}
              </Text>
            </div>
          ))}
        </div>
      )}
    </Container>
  );
};

const DriversTable = ({ rows }: { rows: DriverRank[] }) => (
  <Container className="p-0">
    <div className="border-b border-ui-border-base px-6 py-4">
      <Heading level="h3">Top repartidores</Heading>
    </div>
    <table className="w-full table-fixed text-left">
      <thead className="border-b border-ui-border-base bg-ui-bg-subtle">
        <tr>
          <th className="w-[52%] px-3 py-3 txt-compact-small-plus">Repartidor</th>
          <th className="w-[24%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">
            Entregadas
          </th>
          <th className="w-[24%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">
            Fallidos
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="px-3 py-6 text-ui-fg-muted txt-compact-small" colSpan={3}>
              Sin datos de flota propia.
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.driver_id} className="border-b border-ui-border-base last:border-b-0">
              <td
                className="max-w-[180px] truncate px-3 py-3 txt-compact-small-plus"
                title={row.driver_name ?? row.driver_id}
              >
                {row.driver_name ?? row.driver_id}
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                {number(row.delivered)}
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                {number(row.failed_attempts)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </Container>
);

const ZonesTable = ({ rows }: { rows: ZoneRank[] }) => (
  <Container className="p-0">
    <div className="border-b border-ui-border-base px-6 py-4">
      <Heading level="h3">Por zona</Heading>
    </div>
    <table className="w-full table-fixed text-left">
      <thead className="border-b border-ui-border-base bg-ui-bg-subtle">
        <tr>
          <th className="w-[34%] px-3 py-3 txt-compact-small-plus">Zona</th>
          <th className="w-[16%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">
            Total
          </th>
          <th className="w-[16%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">
            Entregadas
          </th>
          <th className="w-[16%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">
            Tasa
          </th>
          <th className="w-[18%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus">
            SLA
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="px-3 py-6 text-ui-fg-muted txt-compact-small" colSpan={5}>
              Sin datos por zona.
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.zone_id} className="border-b border-ui-border-base last:border-b-0">
              <td
                className="max-w-[180px] truncate px-3 py-3 txt-compact-small-plus"
                title={row.zone_name ?? row.zone_id}
              >
                {row.zone_name ?? row.zone_id}
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                {number(row.total)}
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                {number(row.delivered)}
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                {percent(row.delivery_rate)}
              </td>
              <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small">
                {row.sla_compliance == null ? '—' : percent(row.sla_compliance)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </Container>
);

const DeliveryAnalyticsPage = () => {
  const [filters, setFilters] = useState<DeliveryMetricsFilters>({
    from: daysAgo(29),
    to: today(),
  });

  const { data, isLoading, error } = useDeliveryMetrics(filters);
  const metrics = data?.metrics;

  const responseBadge = useMemo(() => {
    const ms = data?.meta?.response_time_ms;
    if (ms == null) return null;
    return <Badge color={ms <= 300 ? 'green' : 'orange'}>{ms}ms</Badge>;
  }, [data?.meta?.response_time_ms]);

  const setRange = (key: 'from' | 'to', value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const applyPreset = (days: number) =>
    setFilters((prev) => ({ ...prev, from: daysAgo(days), to: today() }));

  const setProvider = (value: string) =>
    setFilters((prev) => ({
      ...prev,
      provider_type:
        value === '__all' ? undefined : (value as DeliveryProviderType),
    }));

  const setStoreLocation = (value: string | undefined) =>
    setFilters((prev) => ({
      ...prev,
      store_location_id: value,
    }));

  return (
    <div className="flex flex-col gap-4">
      {/*
        `p-0` y padding por bloque en vez del `p-6` del contenedor: la franja de tienda
        va a sangre —su `variant` por defecto ya trae `border-b px-6 py-2`— y adentro de
        un contenedor con padding quedaba flotando, con un fondo gris que no llegaba a
        los bordes de la card. Alternativa descartada: el `variant="card"`, que es el de
        las pantallas de AJUSTES, donde no hay header propio; acá sí lo hay y la barra
        tiene que leerse colgada de él.
      */}
      <Container className="flex flex-col p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-2">
            <Heading>Tablero</Heading>
            {responseBadge}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="small" variant="secondary" onClick={() => applyPreset(0)}>
              Hoy
            </Button>
            <Button size="small" variant="secondary" onClick={() => applyPreset(6)}>
              7 días
            </Button>
            <Button size="small" variant="secondary" onClick={() => applyPreset(29)}>
              30 días
            </Button>
          </div>
        </div>

        {/*
          Un tablero declarado `scoped` es justo donde este registro ya se quemó: el de
          Fidelización está `scoped` en `scoped-routes.ts` y filtra tres de siete KPIs.
          Así que acá la afirmación se verificó KPI por KPI, no por la entrada del
          registro.

          `admin/delivery/analytics` resuelve las sucursales de la tienda con
          `siteFilter(…, STORE_LOCATION_SITE_SCOPE)` y le pasa los ids al agregado
          (`api/admin/delivery/analytics/route.ts:36-51`). El predicado entra en
          `applyExecutionFilters` (`modules/delivery/analytics.ts:176`), y por ahí pasan
          las SEIS consultas del board: `countBy` (:224), totales (:248), SLA (:298),
          serie temporal (:347), top de repartidores (:370) y por zona (:401). Ninguna
          se computa por afuera.

          Las ejecuciones sin sucursal se incluyen a propósito —el CD nacional y las
          anteriores a M10—: es la semántica `empty: 'all'` del descriptor, y esconderlas
          haría que los KPIs no cierren contra las órdenes.
        */}
        <SiteScopeBar screen="delivery.analytics" />

        <div className="grid gap-3 px-6 py-4 md:grid-cols-4">
          <DatePicker
            granularity="day"
            value={dateOnlyToDate(filters.from)}
            onChange={(date) => setRange('from', dateToDateOnly(date))}
          />
          <DatePicker
            granularity="day"
            value={dateOnlyToDate(filters.to)}
            onChange={(date) => setRange('to', dateToDateOnly(date))}
          />
          <Select value={filters.provider_type ?? '__all'} onValueChange={setProvider}>
            <Select.Trigger>
              <Select.Value placeholder="Proveedor" />
            </Select.Trigger>
            <Select.Content className="z-[60]">
              <Select.Item value="__all">Todos los proveedores</Select.Item>
              <Select.Item value="andreani">Andreani</Select.Item>
              <Select.Item value="own_fleet">Flota propia</Select.Item>
              <Select.Item value="store_pickup">Retiro en tienda</Select.Item>
            </Select.Content>
          </Select>
          <StoreLocationFilter
            value={filters.store_location_id}
            onChange={setStoreLocation}
            className="w-full"
          />
        </div>
      </Container>

      {error ? (
        <Container className="p-6">
          <Text className="text-ui-fg-error">{error.message}</Text>
        </Container>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard
          label="Tasa de entrega"
          value={percent(metrics?.totals.delivery_rate ?? 0)}
          hint={`${number(metrics?.totals.delivered ?? 0)} entregadas`}
        />
        <KpiCard label="Total ejecuciones" value={number(metrics?.totals.total ?? 0)} />
        <KpiCard
          label="Intentos fallidos"
          value={percent(metrics?.totals.failed_attempt_rate ?? 0)}
          hint={`Prom. ${number(
            Math.round((metrics?.totals.avg_attempt_count ?? 0) * 10) / 10,
          )} intentos`}
        />
        <KpiCard
          label="SLA promedio"
          value={minutes(metrics?.sla.avg_minutes ?? null)}
          hint={
            metrics?.sla.median_minutes != null
              ? `Mediana ${minutes(metrics.sla.median_minutes)}`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="En curso" value={number(metrics?.totals.in_flight ?? 0)} />
        <KpiCard label="Canceladas" value={number(metrics?.totals.canceled ?? 0)} />
        <KpiCard
          label="Cumplimiento SLA"
          value={
            metrics?.sla.sla_compliance == null
              ? '—'
              : percent(metrics.sla.sla_compliance)
          }
          hint={`${number(metrics?.sla.within_sla ?? 0)} / ${number(
            metrics?.sla.sla_eligible ?? 0,
          )} en plazo`}
        />
        <KpiCard
          label="Entregadas (mediana SLA)"
          value={minutes(metrics?.sla.median_minutes ?? null)}
        />
      </div>

      <Container className="flex flex-col gap-3 p-6">
        <Heading level="h3">Entregas por día</Heading>
        <DeliveriesChart rows={metrics?.timeseries ?? []} />
      </Container>

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownBars
          title="Por estado"
          rows={metrics?.by_status ?? []}
          labels={STATUS_LABELS}
        />
        <BreakdownBars
          title="Por proveedor"
          rows={metrics?.by_provider ?? []}
          labels={PROVIDER_LABELS}
        />
        <BreakdownBars
          title="Por modalidad"
          rows={metrics?.by_service_mode ?? []}
          labels={SERVICE_MODE_LABELS}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ZonesTable rows={metrics?.by_zone ?? []} />
        <DriversTable rows={metrics?.top_drivers ?? []} />
      </div>

      {isLoading ? (
        <Container className="p-6">
          <Text size="small" className="text-ui-fg-subtle">
            Cargando métricas...
          </Text>
        </Container>
      ) : null}
    </div>
  );
};

export const config = defineRouteConfig({
  label: 'Tablero',
});

export const handle = {
  breadcrumb: () => 'Tablero',
};

export default DeliveryAnalyticsPage;
