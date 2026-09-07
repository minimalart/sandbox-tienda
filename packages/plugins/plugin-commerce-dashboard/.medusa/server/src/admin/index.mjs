import { jsx, jsxs } from "react/jsx-runtime";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { CurrencyDollar, InformationCircle } from "@medusajs/icons";
import { Badge, Container, Heading, Text, Button, DatePicker, Select, Input, toast, Tooltip } from "@medusajs/ui";
import { useState, useMemo, useId } from "react";
import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip as Tooltip$1, Area } from "recharts";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Medusa from "@medusajs/js-sdk";
import "@medusajs/admin-shared";
const version = "1.3.0";
const pkg = {
  version
};
const sdk = new Medusa({
  baseUrl: "/",
  auth: {
    type: "session"
  }
});
const COMMERCE_DASHBOARD_QUERY_KEY = ["commerce-dashboard"];
const buildQuery = (filters) => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) qs.set(key, value);
  }
  return qs.toString();
};
function useCommerceDashboard(filters) {
  return useQuery({
    queryKey: [...COMMERCE_DASHBOARD_QUERY_KEY, filters],
    queryFn: async () => {
      const qs = buildQuery(filters);
      return await sdk.client.fetch(`/admin/commerce-dashboard${qs ? `?${qs}` : ""}`, {
        method: "GET"
      });
    },
    staleTime: 3e4,
    refetchOnWindowFocus: false
  });
}
function useDashboardSalesChannels() {
  return useQuery({
    queryKey: ["commerce-dashboard", "sales-channels"],
    queryFn: async () => await sdk.client.fetch("/admin/sales-channels?limit=100", {
      method: "GET"
    }),
    staleTime: 5 * 6e4,
    refetchOnWindowFocus: false
  });
}
function useAggregateCommerceMetrics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      const res = await fetch("/admin/commerce-dashboard/aggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(body.message ?? "Error aggregating commerce metrics");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: COMMERCE_DASHBOARD_QUERY_KEY })
  });
}
const pad = (n) => String(n).padStart(2, "0");
function dateOnlyToDate(value) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}
function dateToDateOnly(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
const PLUGIN_VERSION = pkg.version;
const today = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
const daysAgo = (days) => {
  const date = /* @__PURE__ */ new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};
const money = (value, currency = "ARS") => new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: currency.toUpperCase(),
  maximumFractionDigits: 0
}).format(value || 0);
const number = (value) => new Intl.NumberFormat("es-AR").format(value || 0);
const percent = (value) => `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value || 0)}%`;
const ratio = (value) => percent((value || 0) * 100);
const dateTime = (value) => {
  if (!value) return "Sin snapshots";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
};
const metricHints = {
  Revenue: "Total vendido en el rango seleccionado, expresado en la moneda filtrada.",
  "Órdenes": "Cantidad de órdenes incluidas en los snapshots del rango seleccionado.",
  AOV: "Ticket promedio: revenue dividido por cantidad de órdenes.",
  Unidades: "Total de unidades vendidas en el rango seleccionado.",
  "Unidades vendidas": "Evolución de unidades vendidas por período.",
  "Clientes nuevos": "Clientes cuya primera orden registrada cae dentro del rango seleccionado.",
  "Clientes recurrentes": "Clientes con compras previas antes del rango seleccionado.",
  Refunds: "Monto total devuelto o reembolsado en el rango seleccionado.",
  "Conversion proxy": "Indicador proxy calculado desde órdenes agregadas; no reemplaza analytics de sesiones.",
  "Repeat purchase rate": "Porcentaje de clientes con más de una compra sobre clientes con órdenes.",
  "Clientes con órdenes": "Clientes únicos que realizaron al menos una orden en el rango.",
  "Clientes repiten": "Clientes del rango que acumulan más de una compra.",
  "Repeat purchase": "Clientes que repiten dividido por clientes con órdenes.",
  "Returning share": "Participación de clientes recurrentes sobre clientes con órdenes.",
  "Calendario comercial": "Distribución de ventas por día u hora para detectar picos comerciales.",
  "Sales channels": "Revenue, órdenes y unidades agrupadas por canal de venta.",
  Países: "Revenue, órdenes y unidades agrupadas por país.",
  Monedas: "Revenue, órdenes y unidades agrupadas por moneda.",
  "Top products": "Productos con mayor revenue en el rango seleccionado.",
  "Top collections": "Colecciones con mayor revenue en el rango seleccionado.",
  "Top categories": "Categorías con mayor revenue en el rango seleccionado."
};
const CardHeading = ({ title, hint }) => /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 items-center gap-2", children: [
  /* @__PURE__ */ jsx(Heading, { level: "h3", className: "min-w-0 truncate", children: title }),
  hint ? /* @__PURE__ */ jsx(Tooltip, { content: hint, children: /* @__PURE__ */ jsx(
    InformationCircle,
    {
      "aria-label": `Ayuda: ${title}`,
      className: "shrink-0 cursor-help text-ui-fg-muted transition-colors hover:text-ui-fg-subtle"
    }
  ) }) : null
] });
const KpiCard = ({
  label,
  value,
  delta,
  format = number,
  hint
}) => /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-ui-border-base bg-ui-bg-base p-4", children: [
  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
    /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "min-w-0 truncate text-ui-fg-subtle", children: label }),
    hint || metricHints[label] ? /* @__PURE__ */ jsx(Tooltip, { content: hint ?? metricHints[label], children: /* @__PURE__ */ jsx(
      InformationCircle,
      {
        "aria-label": `Ayuda: ${label}`,
        className: "shrink-0 cursor-help text-ui-fg-muted transition-colors hover:text-ui-fg-subtle"
      }
    ) }) : null
  ] }),
  /* @__PURE__ */ jsxs("div", { className: "mt-2 flex items-end justify-between gap-3", children: [
    /* @__PURE__ */ jsx(Text, { size: "large", weight: "plus", children: format(value) }),
    /* @__PURE__ */ jsxs(Badge, { size: "2xsmall", color: delta >= 0 ? "green" : "red", children: [
      delta >= 0 ? "+" : "",
      percent(delta)
    ] })
  ] })
] });
const CHART_COLOR = "#2e7d32";
const shortDate = (value) => new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
const ChartTooltip = ({
  active,
  payload,
  label,
  format
}) => {
  if (!active || !(payload == null ? void 0 : payload.length)) return null;
  return /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-ui-border-base bg-ui-bg-base px-3 py-2 shadow-elevation-tooltip", children: [
    /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: label ? new Date(label).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) : "" }),
    /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", children: format(payload[0].value) })
  ] });
};
const LineChart = ({
  rows,
  format
}) => {
  const gradientId = `metric-fill-${useId().replace(/:/g, "")}`;
  return /* @__PURE__ */ jsx("div", { className: "h-56 rounded-lg border border-ui-border-base bg-ui-bg-base p-4", children: rows.length === 0 ? /* @__PURE__ */ jsx("div", { className: "flex h-full items-center justify-center", children: /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-muted", children: "Sin snapshots para el rango seleccionado" }) }) : /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: "100%", children: /* @__PURE__ */ jsxs(AreaChart, { data: rows, margin: { top: 8, right: 8, bottom: 0, left: 0 }, children: [
    /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: gradientId, x1: "0", y1: "0", x2: "0", y2: "1", children: [
      /* @__PURE__ */ jsx("stop", { offset: "5%", stopColor: CHART_COLOR, stopOpacity: 0.35 }),
      /* @__PURE__ */ jsx("stop", { offset: "95%", stopColor: CHART_COLOR, stopOpacity: 0 })
    ] }) }),
    /* @__PURE__ */ jsx(CartesianGrid, { vertical: false, strokeDasharray: "3 3", stroke: "var(--border-base)" }),
    /* @__PURE__ */ jsx(
      XAxis,
      {
        dataKey: "period",
        tickFormatter: shortDate,
        tickLine: false,
        axisLine: false,
        minTickGap: 24,
        tickMargin: 8,
        tick: { fontSize: 11, fill: "var(--fg-muted)" }
      }
    ),
    /* @__PURE__ */ jsx(YAxis, { hide: true, domain: [0, "auto"] }),
    /* @__PURE__ */ jsx(
      Tooltip$1,
      {
        cursor: { stroke: CHART_COLOR, strokeOpacity: 0.25 },
        content: (props) => /* @__PURE__ */ jsx(ChartTooltip, { ...props, format })
      }
    ),
    /* @__PURE__ */ jsx(
      Area,
      {
        type: "monotone",
        dataKey: "value",
        stroke: CHART_COLOR,
        strokeWidth: 2,
        fill: `url(#${gradientId})`,
        dot: rows.length === 1 ? { r: 4, fill: CHART_COLOR, strokeWidth: 0 } : false,
        activeDot: { r: 4, strokeWidth: 0 },
        isAnimationActive: false
      }
    )
  ] }) }) });
};
const heatColor = (value, max) => {
  if (max <= 0 || value <= 0) return "rgba(46, 125, 50, 0.08)";
  const opacity = Math.max(0.18, Math.min(0.9, value / max));
  return `rgba(46, 125, 50, ${opacity})`;
};
const CalendarCell = ({
  label,
  revenue,
  orders,
  units,
  max,
  currency
}) => /* @__PURE__ */ jsxs(
  "div",
  {
    className: "min-h-[74px] rounded-md border border-ui-border-base p-2",
    style: { backgroundColor: heatColor(revenue, max) },
    title: `${label}: ${money(revenue, currency)} · ${number(orders)} órdenes · ${number(units)} unidades`,
    children: [
      /* @__PURE__ */ jsx(Text, { size: "xsmall", weight: "plus", children: label }),
      /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "mt-1 text-ui-fg-subtle", children: money(revenue, currency) }),
      /* @__PURE__ */ jsxs(Text, { size: "xsmall", className: "text-ui-fg-muted", children: [
        number(orders),
        " ord."
      ] })
    ]
  }
);
const CommercialCalendar = ({
  calendar,
  currency
}) => {
  const rows = (calendar == null ? void 0 : calendar.rows) ?? [];
  const max = Math.max(...rows.map((row) => row.revenue), 1);
  const weekdays = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  return /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-4 p-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsx(CardHeading, { title: "Calendario comercial", hint: metricHints["Calendario comercial"] }),
      /* @__PURE__ */ jsx(Badge, { size: "2xsmall", children: (calendar == null ? void 0 : calendar.mode) === "hourly" ? "Por hora" : "Diario" })
    ] }),
    rows.length === 0 ? /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-muted", children: "Sin datos agregados para este rango." }) : (calendar == null ? void 0 : calendar.mode) === "hourly" ? /* @__PURE__ */ jsx("div", { className: "overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6", children: calendar.rows.map((row) => /* @__PURE__ */ jsx(
      CalendarCell,
      {
        label: `${weekdays[row.day_of_week] ?? row.day_of_week} ${row.hour}:00`,
        revenue: row.revenue,
        orders: row.orders,
        units: row.units_sold,
        max,
        currency
      },
      `${row.day_of_week}-${row.hour}`
    )) }) }) : /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7", children: calendar.rows.map((row) => {
      const weekday = new Date(row.date).getUTCDay();
      return /* @__PURE__ */ jsx(
        CalendarCell,
        {
          label: `${weekdays[weekday] ?? ""} ${row.day_of_month}`,
          revenue: row.revenue,
          orders: row.orders,
          units: row.units_sold,
          max,
          currency
        },
        row.date
      );
    }) })
  ] });
};
const BreakdownTable = ({
  title,
  rows,
  currency,
  labels
}) => /* @__PURE__ */ jsxs(Container, { className: "p-0", children: [
  /* @__PURE__ */ jsx("div", { className: "border-b border-ui-border-base px-6 py-4", children: /* @__PURE__ */ jsx(CardHeading, { title, hint: metricHints[title] }) }),
  /* @__PURE__ */ jsx("div", { className: "overflow-hidden", children: /* @__PURE__ */ jsxs("table", { className: "w-full table-fixed text-left", children: [
    /* @__PURE__ */ jsx("thead", { className: "border-b border-ui-border-base bg-ui-bg-subtle", children: /* @__PURE__ */ jsxs("tr", { children: [
      /* @__PURE__ */ jsx("th", { className: "w-[34%] px-3 py-3 txt-compact-small-plus", children: "Segmento" }),
      /* @__PURE__ */ jsx("th", { className: "w-[24%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus", children: "Revenue" }),
      /* @__PURE__ */ jsx("th", { className: "w-[14%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus", children: "Share" }),
      /* @__PURE__ */ jsx("th", { className: "w-[14%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus", children: "Órdenes" }),
      /* @__PURE__ */ jsx("th", { className: "w-[14%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus", children: "Unid." })
    ] }) }),
    /* @__PURE__ */ jsx("tbody", { children: rows.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { className: "px-3 py-6 text-ui-fg-muted txt-compact-small", colSpan: 5, children: "Sin datos agregados." }) }) : rows.map((row) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-ui-border-base last:border-b-0", children: [
      /* @__PURE__ */ jsx(
        "td",
        {
          className: "max-w-[180px] truncate px-3 py-3 txt-compact-small-plus",
          title: (labels == null ? void 0 : labels[row.key]) ?? row.key,
          children: (labels == null ? void 0 : labels[row.key]) ?? row.key
        }
      ),
      /* @__PURE__ */ jsx("td", { className: "truncate whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small", children: money(row.revenue, currency) }),
      /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small", children: ratio(row.revenue_share) }),
      /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small", children: number(row.orders) }),
      /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small", children: number(row.units_sold) })
    ] }, row.key)) })
  ] }) })
] });
const TopTable = ({
  title,
  rows,
  currency
}) => /* @__PURE__ */ jsxs(Container, { className: "p-0", children: [
  /* @__PURE__ */ jsx("div", { className: "border-b border-ui-border-base px-6 py-4", children: /* @__PURE__ */ jsx(CardHeading, { title, hint: metricHints[title] }) }),
  /* @__PURE__ */ jsx("div", { className: "overflow-hidden", children: /* @__PURE__ */ jsxs("table", { className: "w-full table-fixed text-left", children: [
    /* @__PURE__ */ jsx("thead", { className: "border-b border-ui-border-base bg-ui-bg-subtle", children: /* @__PURE__ */ jsxs("tr", { children: [
      /* @__PURE__ */ jsx("th", { className: "w-[30%] px-3 py-3 txt-compact-small-plus", children: "Nombre" }),
      /* @__PURE__ */ jsx("th", { className: "w-[20%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus", children: "Revenue" }),
      /* @__PURE__ */ jsx("th", { className: "w-[12%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus", children: "Share" }),
      /* @__PURE__ */ jsx("th", { className: "w-[12%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus", children: "Órdenes" }),
      /* @__PURE__ */ jsx("th", { className: "w-[10%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus", children: "Unid." }),
      /* @__PURE__ */ jsx("th", { className: "w-[16%] whitespace-nowrap px-2 py-3 text-right txt-compact-small-plus", children: "Prom. unid." })
    ] }) }),
    /* @__PURE__ */ jsx("tbody", { children: rows.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { className: "px-3 py-6 text-ui-fg-muted txt-compact-small", colSpan: 6, children: "Sin datos agregados." }) }) : rows.map((row) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-ui-border-base last:border-b-0", children: [
      /* @__PURE__ */ jsx(
        "td",
        {
          className: "max-w-[180px] truncate px-3 py-3 txt-compact-small-plus",
          title: row.title,
          children: row.title
        }
      ),
      /* @__PURE__ */ jsx("td", { className: "truncate whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small", children: money(row.revenue, currency) }),
      /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small", children: ratio(row.revenue_share) }),
      /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small", children: number(row.orders) }),
      /* @__PURE__ */ jsx("td", { className: "whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small", children: number(row.units_sold) }),
      /* @__PURE__ */ jsx("td", { className: "truncate whitespace-nowrap px-2 py-3 text-right tabular-nums txt-compact-small", children: money(row.avg_unit_price, currency) })
    ] }, row.id)) })
  ] }) })
] });
const CommerceDashboardPage = () => {
  var _a, _b;
  const [filters, setFilters] = useState({
    from: daysAgo(29),
    to: today(),
    bucket: "daily",
    currency_code: "ars"
  });
  const { data, isLoading, error } = useCommerceDashboard(filters);
  const { data: salesChannelsData } = useDashboardSalesChannels();
  const aggregate = useAggregateCommerceMetrics();
  const dashboard = data == null ? void 0 : data.dashboard;
  const currency = filters.currency_code || "ars";
  const kpis = dashboard == null ? void 0 : dashboard.kpis;
  const tables = dashboard == null ? void 0 : dashboard.tables;
  const charts = dashboard == null ? void 0 : dashboard.charts;
  const customer = dashboard == null ? void 0 : dashboard.customers;
  const breakdowns = dashboard == null ? void 0 : dashboard.breakdowns;
  const channelLabels = useMemo(
    () => Object.fromEntries(
      ((salesChannelsData == null ? void 0 : salesChannelsData.sales_channels) ?? []).map((channel) => [channel.id, channel.name])
    ),
    [salesChannelsData == null ? void 0 : salesChannelsData.sales_channels]
  );
  const responseBadge = useMemo(() => {
    var _a2;
    const ms = (_a2 = data == null ? void 0 : data.meta) == null ? void 0 : _a2.response_time_ms;
    if (ms == null) return null;
    return /* @__PURE__ */ jsxs(Badge, { color: ms <= 200 ? "green" : "orange", children: [
      ms,
      "ms"
    ] });
  }, [(_a = data == null ? void 0 : data.meta) == null ? void 0 : _a.response_time_ms]);
  const lastUpdatedText = useMemo(
    () => {
      var _a2;
      return dateTime((_a2 = data == null ? void 0 : data.meta) == null ? void 0 : _a2.last_aggregated_at);
    },
    [(_b = data == null ? void 0 : data.meta) == null ? void 0 : _b.last_aggregated_at]
  );
  const set = (key, value) => setFilters((prev) => ({ ...prev, [key]: value || void 0 }));
  const setSalesChannel = (value) => setFilters((prev) => ({
    ...prev,
    sales_channel_id: value === "__all" ? void 0 : value
  }));
  const runAggregation = async () => {
    try {
      await aggregate.mutateAsync({
        ...filters,
        from: `${filters.from}T00:00:00.000Z`,
        to: `${filters.to}T23:59:59.999Z`
      });
      toast.success("Snapshots actualizados");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar métricas");
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4", children: [
    /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-4 p-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(Heading, { children: "Métricas" }),
          /* @__PURE__ */ jsxs(Badge, { size: "2xsmall", color: "grey", rounded: "full", title: "Plugin version", children: [
            "v",
            PLUGIN_VERSION
          ] }),
          responseBadge
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-end gap-3", children: [
          /* @__PURE__ */ jsxs(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: [
            "Última actualización: ",
            lastUpdatedText
          ] }),
          /* @__PURE__ */ jsx(
            Button,
            {
              size: "small",
              variant: "primary",
              onClick: runAggregation,
              isLoading: aggregate.isPending,
              children: "Sincronizar"
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-3 md:grid-cols-5", children: [
        /* @__PURE__ */ jsx(
          DatePicker,
          {
            granularity: "day",
            value: dateOnlyToDate(filters.from),
            onChange: (date) => set("from", dateToDateOnly(date))
          }
        ),
        /* @__PURE__ */ jsx(
          DatePicker,
          {
            granularity: "day",
            value: dateOnlyToDate(filters.to),
            onChange: (date) => set("to", dateToDateOnly(date))
          }
        ),
        /* @__PURE__ */ jsxs(Select, { value: filters.sales_channel_id ?? "__all", onValueChange: setSalesChannel, children: [
          /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, { placeholder: "Sales channel" }) }),
          /* @__PURE__ */ jsxs(Select.Content, { children: [
            /* @__PURE__ */ jsx(Select.Item, { value: "__all", children: "Todos los sales channels" }),
            ((salesChannelsData == null ? void 0 : salesChannelsData.sales_channels) ?? []).map((channel) => /* @__PURE__ */ jsx(Select.Item, { value: channel.id, children: channel.name }, channel.id))
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          Input,
          {
            placeholder: "Country",
            value: filters.country_code ?? "",
            onChange: (event) => set("country_code", event.target.value.toLowerCase())
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx(
            Input,
            {
              placeholder: "Currency",
              value: filters.currency_code ?? "",
              onChange: (event) => set("currency_code", event.target.value.toLowerCase())
            }
          ),
          /* @__PURE__ */ jsxs(
            Select,
            {
              value: filters.bucket ?? "daily",
              onValueChange: (value) => set("bucket", value),
              children: [
                /* @__PURE__ */ jsx(Select.Trigger, { className: "w-32", children: /* @__PURE__ */ jsx(Select.Value, {}) }),
                /* @__PURE__ */ jsxs(Select.Content, { children: [
                  /* @__PURE__ */ jsx(Select.Item, { value: "daily", children: "Diario" }),
                  /* @__PURE__ */ jsx(Select.Item, { value: "hourly", children: "Por hora" })
                ] })
              ]
            }
          )
        ] })
      ] })
    ] }),
    error ? /* @__PURE__ */ jsx(Container, { className: "p-6", children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-error", children: error.message }) }) : null,
    /* @__PURE__ */ jsxs("div", { className: "grid gap-4 md:grid-cols-4", children: [
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "Revenue",
          value: (kpis == null ? void 0 : kpis.revenue.value) ?? 0,
          delta: (kpis == null ? void 0 : kpis.revenue.delta) ?? 0,
          format: (value) => money(value, currency)
        }
      ),
      /* @__PURE__ */ jsx(KpiCard, { label: "Órdenes", value: (kpis == null ? void 0 : kpis.orders.value) ?? 0, delta: (kpis == null ? void 0 : kpis.orders.delta) ?? 0 }),
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "AOV",
          value: (kpis == null ? void 0 : kpis.aov.value) ?? 0,
          delta: (kpis == null ? void 0 : kpis.aov.delta) ?? 0,
          format: (value) => money(value, currency)
        }
      ),
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "Unidades",
          value: (kpis == null ? void 0 : kpis.units_sold.value) ?? 0,
          delta: (kpis == null ? void 0 : kpis.units_sold.delta) ?? 0
        }
      ),
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "Clientes nuevos",
          value: (kpis == null ? void 0 : kpis.new_customers.value) ?? 0,
          delta: (kpis == null ? void 0 : kpis.new_customers.delta) ?? 0
        }
      ),
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "Clientes recurrentes",
          value: (kpis == null ? void 0 : kpis.returning_customers.value) ?? 0,
          delta: (kpis == null ? void 0 : kpis.returning_customers.delta) ?? 0
        }
      ),
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "Refunds",
          value: (kpis == null ? void 0 : kpis.refunds.value) ?? 0,
          delta: (kpis == null ? void 0 : kpis.refunds.delta) ?? 0,
          format: (value) => money(value, currency)
        }
      ),
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "Conversion proxy",
          value: (kpis == null ? void 0 : kpis.conversion_proxy.value) ?? 0,
          delta: (kpis == null ? void 0 : kpis.conversion_proxy.delta) ?? 0
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [
      /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-3 p-6", children: [
        /* @__PURE__ */ jsx(CardHeading, { title: "Revenue", hint: metricHints.Revenue }),
        /* @__PURE__ */ jsx(
          LineChart,
          {
            rows: (charts == null ? void 0 : charts.revenue_over_time) ?? [],
            format: (value) => money(value, currency)
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-3 p-6", children: [
        /* @__PURE__ */ jsx(CardHeading, { title: "Órdenes", hint: metricHints["Órdenes"] }),
        /* @__PURE__ */ jsx(LineChart, { rows: (charts == null ? void 0 : charts.orders_over_time) ?? [], format: number })
      ] }),
      /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-3 p-6", children: [
        /* @__PURE__ */ jsx(CardHeading, { title: "Unidades vendidas", hint: metricHints["Unidades vendidas"] }),
        /* @__PURE__ */ jsx(LineChart, { rows: (charts == null ? void 0 : charts.units_sold_over_time) ?? [], format: number })
      ] }),
      /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-3 p-6", children: [
        /* @__PURE__ */ jsx(CardHeading, { title: "AOV", hint: metricHints.AOV }),
        /* @__PURE__ */ jsx(
          LineChart,
          {
            rows: (charts == null ? void 0 : charts.aov_over_time) ?? [],
            format: (value) => money(value, currency)
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-3 p-6", children: [
        /* @__PURE__ */ jsx(CardHeading, { title: "Repeat purchase rate", hint: metricHints["Repeat purchase rate"] }),
        /* @__PURE__ */ jsx(LineChart, { rows: (charts == null ? void 0 : charts.repeat_purchase_rate_over_time) ?? [], format: ratio })
      ] })
    ] }),
    /* @__PURE__ */ jsx(CommercialCalendar, { calendar: charts == null ? void 0 : charts.commercial_calendar, currency }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-4 md:grid-cols-3 xl:grid-cols-6", children: [
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "Clientes con órdenes",
          value: (customer == null ? void 0 : customer.customers_with_orders.value) ?? 0,
          delta: (customer == null ? void 0 : customer.customers_with_orders.delta) ?? 0
        }
      ),
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "Clientes nuevos",
          value: (customer == null ? void 0 : customer.new_customers.value) ?? 0,
          delta: (customer == null ? void 0 : customer.new_customers.delta) ?? 0
        }
      ),
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "Clientes recurrentes",
          value: (customer == null ? void 0 : customer.returning_customers.value) ?? 0,
          delta: (customer == null ? void 0 : customer.returning_customers.delta) ?? 0
        }
      ),
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "Clientes repiten",
          value: (customer == null ? void 0 : customer.repeat_customers.value) ?? 0,
          delta: (customer == null ? void 0 : customer.repeat_customers.delta) ?? 0
        }
      ),
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "Repeat purchase",
          value: (customer == null ? void 0 : customer.repeat_purchase_rate.value) ?? 0,
          delta: (customer == null ? void 0 : customer.repeat_purchase_rate.delta) ?? 0,
          format: ratio
        }
      ),
      /* @__PURE__ */ jsx(
        KpiCard,
        {
          label: "Returning share",
          value: (customer == null ? void 0 : customer.returning_share.value) ?? 0,
          delta: (customer == null ? void 0 : customer.returning_share.delta) ?? 0,
          format: ratio
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [
      /* @__PURE__ */ jsx(
        BreakdownTable,
        {
          title: "Sales channels",
          rows: (breakdowns == null ? void 0 : breakdowns.sales_channels) ?? [],
          currency,
          labels: channelLabels
        }
      ),
      /* @__PURE__ */ jsx(BreakdownTable, { title: "Países", rows: (breakdowns == null ? void 0 : breakdowns.countries) ?? [], currency }),
      /* @__PURE__ */ jsx(BreakdownTable, { title: "Monedas", rows: (breakdowns == null ? void 0 : breakdowns.currencies) ?? [], currency })
    ] }),
    isLoading ? /* @__PURE__ */ jsx(Container, { className: "p-6", children: /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: "Cargando snapshots..." }) }) : null,
    /* @__PURE__ */ jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [
      /* @__PURE__ */ jsx(TopTable, { title: "Top products", rows: (tables == null ? void 0 : tables.top_products) ?? [], currency }),
      /* @__PURE__ */ jsx(
        TopTable,
        {
          title: "Top collections",
          rows: (tables == null ? void 0 : tables.top_collections) ?? [],
          currency
        }
      ),
      /* @__PURE__ */ jsx(TopTable, { title: "Top categories", rows: (tables == null ? void 0 : tables.top_categories) ?? [], currency })
    ] })
  ] });
};
const CommerceDashboardIcon = () => /* @__PURE__ */ jsx(CurrencyDollar, { style: { color: "#2e7d32" } });
const config = defineRouteConfig({
  label: "Métricas",
  icon: CommerceDashboardIcon,
  rank: 40
});
const handle = {
  breadcrumb: () => "Métricas"
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: CommerceDashboardPage,
      path: "/commerce-dashboard",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config.label,
      icon: config.icon,
      path: "/commerce-dashboard",
      nested: void 0,
      rank: 40,
      translationNs: void 0
    }
  ]
};
const formModule = { customFields: {} };
const displayModule = {
  displays: {}
};
const i18nModule = { resources: {} };
const cellRendererModule = {};
const layoutModule = { layouts: [] };
const plugin = {
  widgetModule,
  routeModule,
  menuItemModule,
  formModule,
  displayModule,
  i18nModule,
  cellRendererModule,
  layoutModule
};
export {
  plugin as default
};
