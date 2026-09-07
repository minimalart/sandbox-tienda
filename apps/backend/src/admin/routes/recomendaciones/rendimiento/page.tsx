import { defineRouteConfig } from '@medusajs/admin-sdk';
import {
  Badge,
  Button,
  Container,
  DataTable,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Toaster,
  createDataTableColumnHelper,
  toast,
  useDataTable,
} from '@medusajs/ui';
import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ExtensionVersion } from '../../../components/common/extension-version';
import { HelpDrawer } from '../../../components/common/help-drawer';
import {
  useAggregateRecommendationMetrics,
  useRebuildRecommendations,
  useRecommendationPlacements,
  useRecommendationVersions,
  useRecommendationsPerformance,
  type PerformanceTotals,
} from '../../../hooks/api/recommendations';

export const config = defineRouteConfig({ label: 'Rendimiento' });
export const handle = { breadcrumb: () => 'Rendimiento' };

const toDateInput = (date: Date): string => date.toISOString().slice(0, 10);

const formatMoney = (amount: number): string =>
  `$${Math.round(amount).toLocaleString('es-AR')}`;

const formatPercent = (ratio: number): string => `${(ratio * 100).toFixed(1)}%`;

const formatInt = (value: number): string => Math.round(value).toLocaleString('es-AR');

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-ui-border-base p-4">
      <Text size="small" className="text-ui-fg-subtle">
        {label}
      </Text>
      <Text size="xlarge" weight="plus">
        {value}
      </Text>
      {hint ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {hint}
        </Text>
      ) : null}
    </div>
  );
}

type BreakdownRow = { key: string } & PerformanceTotals;

const columnHelper = createDataTableColumnHelper<BreakdownRow>();

const breakdownColumns = [
  columnHelper.accessor('key', { header: 'Nombre' }),
  columnHelper.accessor('viewed', { header: 'Vistas', cell: (c) => formatInt(c.getValue()) }),
  columnHelper.accessor('clicked', { header: 'Clics', cell: (c) => formatInt(c.getValue()) }),
  columnHelper.accessor('ctr', { header: 'CTR', cell: (c) => formatPercent(c.getValue()) }),
  columnHelper.accessor('added_to_cart', {
    header: 'Al carrito',
    cell: (c) => formatInt(c.getValue()),
  }),
  columnHelper.accessor('purchased', { header: 'Compras', cell: (c) => formatInt(c.getValue()) }),
  columnHelper.accessor('conversion_rate', {
    header: 'Conversión',
    cell: (c) => formatPercent(c.getValue()),
  }),
  columnHelper.accessor('attributed_revenue', {
    header: 'Revenue atribuido',
    cell: (c) => formatMoney(c.getValue()),
  }),
  columnHelper.accessor('assisted_revenue', {
    header: 'Revenue asistido',
    cell: (c) => formatMoney(c.getValue()),
  }),
];

function BreakdownTable({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const table = useDataTable({
    columns: breakdownColumns,
    data: rows,
    getRowId: (row) => row.key,
    rowCount: rows.length,
  });

  return (
    <Container className="p-0">
      <DataTable instance={table}>
        <DataTable.Toolbar className="px-6 py-4">
          <Heading level="h2">{title}</Heading>
        </DataTable.Toolbar>
        {rows.length ? (
          <DataTable.Table />
        ) : (
          <div className="px-6 pb-6">
            <Text className="text-ui-fg-subtle">Sin datos en el rango elegido.</Text>
          </div>
        )}
      </DataTable>
    </Container>
  );
}

const PerformancePage = () => {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() =>
    toDateInput(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000)),
  );
  const [to, setTo] = useState(() => toDateInput(today));
  const [placement, setPlacement] = useState<string>('all');

  const placements = useRecommendationPlacements();
  const aggregate = useAggregateRecommendationMetrics();
  const rebuild = useRebuildRecommendations();
  const versions = useRecommendationVersions({ limit: 10 });

  const { data, isPending } = useRecommendationsPerformance({
    from: new Date(`${from}T00:00:00.000Z`).toISOString(),
    to: new Date(`${to}T23:59:59.999Z`).toISOString(),
    bucket: 'daily',
    ...(placement !== 'all' ? { placement } : {}),
  });

  const totals = data?.totals;

  return (
    <div className="flex flex-col gap-4">
      <Container className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Heading level="h1">Rendimiento</Heading>
            <ExtensionVersion extension="recommendation-engine" />
            {/* Mismo criterio que en Relaciones: el drawer va donde se sacó texto,
                no sólo en Configuración. */}
            <HelpDrawer slug="recommendation-engine" />
          </div>
          <Button
            size="small"
            variant="secondary"
            isLoading={aggregate.isPending}
            onClick={() =>
              aggregate.mutate(undefined, {
                onSuccess: (result) =>
                  toast.success(`Métricas recalculadas (${result.rows_inserted} filas)`),
                onError: (error: Error) => toast.error(error.message),
              })
            }
          >
            Recalcular métricas
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label size="small" weight="plus">
              Desde
            </Label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label size="small" weight="plus">
              Hasta
            </Label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label size="small" weight="plus">
              Placement
            </Label>
            <Select value={placement} onValueChange={setPlacement}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">Todos</Select.Item>
                {(placements.data?.placements ?? []).map((item) => (
                  <Select.Item key={item.key} value={item.key}>
                    {item.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
        </div>

        {/*
          El caso más común de "la pantalla está vacía" no es que no haya eventos, sino
          que todavía no corrió la agregación. Se dice explícitamente en lugar de mostrar
          ceros sin explicación.
        */}
        {data?.meta.hint ? (
          <div className="rounded-lg border border-ui-border-base border-dashed p-4">
            <Text>{data.meta.hint}</Text>
            <Text size="small" className="text-ui-fg-subtle">
              Las métricas se agregan cada hora. Si acabás de recibir tráfico, usá
              "Recalcular métricas".
            </Text>
          </div>
        ) : null}
      </Container>

      {isPending || !totals ? (
        <Container>
          <Text className="text-ui-fg-subtle">Cargando…</Text>
        </Container>
      ) : (
        <>
          <Container className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Kpi label="Recomendaciones servidas" value={formatInt(totals.served)} />
            <Kpi
              label="Productos vistos"
              value={formatInt(totals.viewed)}
              hint="Sólo cuando el widget entró al viewport"
            />
            <Kpi label="Clics" value={formatInt(totals.clicked)} />
            <Kpi label="CTR" value={formatPercent(totals.ctr)} hint="clics / vistas" />
            <Kpi label="Agregados al carrito" value={formatInt(totals.added_to_cart)} />
            <Kpi label="Compras" value={formatInt(totals.purchased)} />
            <Kpi
              label="Conversión"
              value={formatPercent(totals.conversion_rate)}
              hint="compras / clics"
            />
            <Kpi label="Unidades vendidas" value={formatInt(totals.units_purchased)} />
            <Kpi
              label="Revenue atribuido"
              value={formatMoney(totals.attributed_revenue)}
              hint="clic → carrito → compra"
            />
            <Kpi
              label="Revenue asistido"
              value={formatMoney(totals.assisted_revenue)}
              hint="visto → compra (NO se suma al atribuido)"
            />
            <Kpi
              label="Órdenes influenciadas"
              value={formatInt(totals.influenced_orders)}
            />
            <Kpi
              label="Ticket promedio influenciado"
              value={formatMoney(totals.influenced_aov)}
            />
          </Container>

          <Container className="flex flex-col gap-4">
            <Heading level="h2">Evolución</Heading>
            <div className="h-72 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart
                  data={(data?.series ?? []).map((point) => ({
                    ...point,
                    label: point.period.slice(0, 10),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line dataKey="clicked" name="Clics" stroke="#7C3AED" strokeWidth={2} dot={false} />
                  <Line
                    dataKey="added_to_cart"
                    name="Al carrito"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    dataKey="purchased"
                    name="Compras"
                    stroke="#16A34A"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Container>

          <BreakdownTable rows={data?.by_placement ?? []} title="Por placement" />
          <BreakdownTable rows={data?.by_strategy ?? []} title="Por estrategia que respondió" />
        </>
      )}

      <Container className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Heading level="h2">Estado de los cálculos</Heading>
          <Button
            size="small"
            variant="secondary"
            isLoading={rebuild.isPending}
            onClick={() =>
              rebuild.mutate(undefined, {
                onSuccess: (result) =>
                  toast.success(
                    result.enqueued.length
                      ? `Encoladas: ${result.enqueued.join(', ')}`
                      : 'No había recálculos pendientes por encolar',
                  ),
                onError: (error: Error) => toast.error(error.message),
              })
            }
          >
            Recalcular recomendaciones
          </Button>
        </div>
        {/* Acá vivía la explicación de una corrida "ready" que no pasa a "active"
            (no se alcanzó el mínimo de órdenes analizadas). Está en el drawer,
            sección "Cómo funciona el recálculo", junto al resto del ciclo —el
            presupuesto por corrida, el cursor, la reconciliación—, que es el
            contexto que le faltaba. Es cierto SIEMPRE, no cuando pasa: colgaba
            debajo del botón aunque la lista de versiones estuviera vacía. */}
        {(versions.data?.versions ?? []).length === 0 ? (
          <Text className="text-ui-fg-subtle">Todavía no corrió ningún recálculo.</Text>
        ) : (
          <div className="flex flex-col gap-2">
            {(versions.data?.versions ?? []).map((version) => (
              <div
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ui-border-base p-3"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    size="2xsmall"
                    color={
                      version.status === 'active'
                        ? 'green'
                        : version.status === 'failed'
                          ? 'red'
                          : version.status === 'building'
                            ? 'orange'
                            : 'grey'
                    }
                  >
                    {version.status}
                  </Badge>
                  <Text size="small" weight="plus">
                    {version.strategy_key}
                  </Text>
                </div>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  {formatInt(version.orders_analyzed)} órdenes ·{' '}
                  {formatInt(version.relations_generated)} relaciones ·{' '}
                  {formatInt(version.relations_discarded)} descartadas
                  {version.duration_ms ? ` · ${Math.round(version.duration_ms / 1000)}s` : ''}
                </Text>
                {version.error_summary?.message || version.error_summary?.reason ? (
                  <Text size="xsmall" className="text-ui-fg-error">
                    {version.error_summary.message ?? version.error_summary.reason}
                  </Text>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Container>

      <Toaster />
    </div>
  );
};

export default PerformancePage;
