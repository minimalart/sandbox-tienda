import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Button,
  Container,
  Heading,
  Input,
  Select,
  Text,
  toast,
  Toaster,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
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
  type RecurringMetricsPoint,
  type RecurringAnalyticsResponse,
  useRebuildRecurringAnalytics,
  useRecurringAnalytics,
  useSalesChannelsList,
} from '../../../hooks/api/recurring-orders';
import { HelpDrawer } from '../../../components/common/help-drawer';
import { SiteScopeBar } from '../../../components/common/site-scope-bar';
import { fmtMoney } from '../helpers';
import { SubscriptionSectionNav } from '../section-nav';

const GLOBAL = '__global__';
const DAY_MS = 24 * 60 * 60 * 1000;

const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-ui-border-base px-4 py-3">
      <Text size="xsmall" className="text-ui-fg-subtle">
        {label}
      </Text>
      <Text size="xlarge" className="font-semibold">
        {value}
      </Text>
      {hint && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {hint}
        </Text>
      )}
    </div>
  );
}

/** Exporta la serie visible como CSV (client-side). */
function exportCsv(
  series: RecurringMetricsPoint[],
  summary: RecurringAnalyticsResponse['summary'],
) {
  if (!series.length) return;
  const cols = [
    'date',
    'active_count',
    'paused_count',
    'pending_payment_count',
    'failed_count',
    'cancelled_count',
    'new_count',
    'cancelled_today',
    'renewals_success',
    'renewals_failed',
    'renewals_skipped',
    'pending_value',
    'mrr_estimate',
    'currency_code',
  ] as const;
  const summaryLines = summary
    ? [
        ['metric', 'value'],
        ['active_count', summary.active_count],
        ['mrr_estimate', summary.mrr_estimate],
        ['gmv_recurring', summary.gmv_recurring],
        ['ltv_average', summary.ltv_average],
        ['renewals_skipped', summary.renewals_skipped],
        ['failed_payments', summary.failed_payments],
        ['recovered_payments', summary.recovered_payments],
        ['recovered_revenue', summary.recovered_revenue],
      ].map((row) => row.map((value) => JSON.stringify(value)).join(','))
    : [];
  const lines = [
    ...summaryLines,
    ...(summaryLines.length ? [''] : []),
    cols.join(','),
    ...series.map((row) =>
      cols.map((c) => JSON.stringify(row[c] ?? '')).join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `compras-recurrentes-${series[0].date}-${series[series.length - 1].date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const RecurringAnalytics = () => {
  const [channel, setChannel] = useState<string>(GLOBAL);
  const [from, setFrom] = useState<string>(toDateStr(new Date(Date.now() - 29 * DAY_MS)));
  const [to, setTo] = useState<string>(toDateStr(new Date()));

  const { data: channelsData } = useSalesChannelsList();
  const { data, isPending } = useRecurringAnalytics({
    from,
    to,
    sales_channel_id: channel === GLOBAL ? null : channel,
  });
  const rebuild = useRebuildRecurringAnalytics();

  const series = data?.series ?? [];
  const summary = data?.summary ?? null;
  const currency = summary?.currency_code ?? undefined;

  const chartData = useMemo(
    () =>
      series.map((p) => ({
        ...p,
        label: p.date.slice(5), // MM-DD
      })),
    [series],
  );

  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 1000) / 10}%`);

  return (
    <>
      {/*
        `p-0` con padding por bloque, como el tablero de Delivery: la franja de tienda
        va a sangre y adentro de un contenedor con `p-6` quedaba flotando, con el fondo
        gris sin llegar a los bordes de la card.
      */}
      <Container className="flex flex-col p-0">
        <SubscriptionSectionNav />
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <Heading>Analytics de compras recurrentes</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Snapshots diarios por canal (el job corre cada madrugada; "Recalcular"
              re-computa el rango visible).
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
            <div className="w-48">
              <Select onValueChange={setChannel} size="small" value={channel}>
                <Select.Trigger>
                  <Select.Value placeholder="Canal" />
                </Select.Trigger>
                <Select.Content>
                  {/*
                    Decía "Todas las tiendas" y ya no puede: `siteChannelFilter` acota
                    a los canales de la tienda activa cuando el parámetro viaja vacío
                    (`api/admin/recurring-orders/analytics/route.ts:38`), así que esta
                    opción no ensancha nada — sólo saca el recorte por canal DENTRO de
                    la tienda. Con la franja de arriba diciendo "filtra por tienda", el
                    rótulo viejo era la contradicción más visible de la pantalla.
                  */}
                  <Select.Item value={GLOBAL}>Todos los canales</Select.Item>
                  {(channelsData?.sales_channels ?? []).map((sc) => (
                    <Select.Item key={sc.id} value={sc.id}>
                      {sc.name}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <Button
              isLoading={rebuild.isPending}
              onClick={() =>
                rebuild.mutate(
                  { from, to },
                  {
                    onSuccess: (r) =>
                      toast.success(`Recalculado: ${r.days} días (${r.rows} filas)`),
                    onError: (e) => toast.error((e as Error).message),
                  },
                )
              }
              size="small"
              variant="secondary"
            >
              Recalcular
            </Button>
            <Button
              disabled={!series.length}
              onClick={() => exportCsv(series, summary)}
              size="small"
              variant="secondary"
            >
              Exportar CSV
            </Button>
            {/* Faltaba en la pantalla donde más falta hace: el subtítulo alcanza para
                decir QUE los datos son de un snapshot, pero no para el corolario —que
                el job de métricas es otro que el de renovaciones, así que un tablero
                atrasado no dice nada sobre si las suscripciones se están cobrando. */}
            <HelpDrawer slug="recurring-orders" />
          </div>
        </div>

        {/*
          `scoped`, verificado KPI por KPI y no por la entrada del registro —que es
          justo donde el tablero de Fidelización se quemó—: los SEIS KPIs y la serie
          salen de UNA sola consulta,
          `listRecurringMetricsDailies(siteChannelFilter(…))`
          (`api/admin/recurring-orders/analytics/route.ts:38`); el resto del handler son
          sumas sobre esas mismas filas. No hay una segunda query que se escape.

          `siteChannelFilter` y no `siteFilter` porque acá `NULL` NO es fallback global:
          una métrica diaria pertenece al canal que la generó. Y filtra por LOS DOS
          canales de una tienda B2B — con sólo el retail los números daban bajos y
          parecían un problema de negocio.
        */}
        <SiteScopeBar screen="recurring-orders.analytics" />

        {/*
          Un solo bloque con el padding y el `gap-y-4` que antes ponía el `p-6` del
          `Container`: los KPIs y los tres gráficos son el CUERPO del tablero y se
          mueven juntos. Repetir `px-6 py-4` en cada uno los habría separado con
          espacios dobles entre bloque y bloque.
        */}
        <div className="flex flex-col gap-y-4 px-6 py-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            <KpiCard label="Suscripciones activas" value={String(summary?.active_count ?? '—')} />
            <KpiCard
              label="MRR estimado"
              value={summary ? fmtMoney(summary.mrr_estimate, currency) : '—'}
              hint="Ingresos proyectados 30 días"
            />
            <KpiCard
              label="Valor pendiente"
              value={summary ? fmtMoney(summary.pending_value, currency) : '—'}
              hint="Links de pago sin confirmar"
            />
            <KpiCard
              label="Altas / bajas"
              value={summary ? `${summary.new_in_range} / ${summary.cancelled_in_range}` : '—'}
              hint="En el rango"
            />
            <KpiCard
              label="Éxito de renovaciones"
              value={pct(summary?.renewal_success_rate ?? null)}
              hint={
                summary
                  ? `${summary.renewals_success} ok · ${summary.renewals_failed} fallidas`
                  : undefined
              }
            />
            <KpiCard
              label="Churn"
              value={pct(summary?.churn_rate ?? null)}
              hint="Bajas / activos al inicio"
            />
            <KpiCard
              label="GMV recurrente"
              value={summary ? fmtMoney(summary.gmv_recurring, currency) : '—'}
              hint="Cobrado en el rango"
            />
            <KpiCard
              label="LTV promedio"
              value={summary ? fmtMoney(summary.ltv_average, currency) : '—'}
              hint="Cobros históricos por cliente"
            />
            <KpiCard
              label="Entregas omitidas"
              value={String(summary?.renewals_skipped ?? '—')}
              hint="En el rango"
            />
            <KpiCard
              label="Recuperación de pagos"
              value={summary ? fmtMoney(summary.recovered_revenue, currency) : '—'}
              hint={summary ? `${summary.recovered_payments} recuperados de ${summary.failed_payments} fallidos` : undefined}
            />
          </div>

          {/* Tendencias */}
          <div className="rounded-lg border border-ui-border-base p-4">
            <Text size="small" weight="plus">
              Suscripciones activas y MRR
            </Text>
            {series.length ? (
              <div className="mt-2 h-64">
                <ResponsiveContainer height="100%" width="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="recActive" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="recMrr" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} />
                    <YAxis fontSize={11} tickLine={false} width={48} yAxisId="left" />
                    <YAxis
                      fontSize={11}
                      orientation="right"
                      tickLine={false}
                      width={64}
                      yAxisId="right"
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) =>
                        name === 'MRR' ? [fmtMoney(value, currency), name] : [value, name]
                      }
                    />
                    <Area
                      dataKey="active_count"
                      fill="url(#recActive)"
                      name="Activas"
                      stroke="#0EA5E9"
                      type="monotone"
                      yAxisId="left"
                    />
                    <Area
                      dataKey="mrr_estimate"
                      fill="url(#recMrr)"
                      name="MRR"
                      stroke="#10B981"
                      type="monotone"
                      yAxisId="right"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Text size="small" className="mt-2 text-ui-fg-subtle">
                {isPending
                  ? 'Cargando…'
                  : 'Sin datos en el rango. Probá "Recalcular" para generar los snapshots.'}
              </Text>
            )}
          </div>

          {/* Renovaciones por día */}
          {series.length > 0 && (
            <div className="rounded-lg border border-ui-border-base p-4">
              <Text size="small" weight="plus">
                Renovaciones por día
              </Text>
              <div className="mt-2 h-48">
                <ResponsiveContainer height="100%" width="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} />
                    <YAxis allowDecimals={false} fontSize={11} tickLine={false} width={32} />
                    <RechartsTooltip />
                    <Area
                      dataKey="renewals_success"
                      fill="#10B981"
                      fillOpacity={0.25}
                      name="Exitosas"
                      stroke="#10B981"
                      type="monotone"
                    />
                    <Area
                      dataKey="renewals_failed"
                      fill="#EF4444"
                      fillOpacity={0.25}
                      name="Fallidas"
                      stroke="#EF4444"
                      type="monotone"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top productos */}
          {(summary?.top_products ?? []).length > 0 && (
            <div className="rounded-lg border border-ui-border-base p-4">
              <Text size="small" weight="plus">
                Productos más suscriptos
              </Text>
              <div className="mt-2 flex flex-col divide-y">
                {(summary?.top_products ?? []).map((p) => (
                  <div className="flex items-center justify-between py-2" key={p.product_id}>
                    <Text size="small">{p.title ?? p.product_id}</Text>
                    <Text size="small" className="text-ui-fg-subtle">
                      {p.subscriptions} suscripción(es)
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Container>
      <Toaster />
    </>
  );
};

export const config = defineRouteConfig({
  label: 'Analytics',
});

export const handle = {
  breadcrumb: () => 'Analytics',
};

export default RecurringAnalytics;
