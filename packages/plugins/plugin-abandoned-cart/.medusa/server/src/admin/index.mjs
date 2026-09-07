import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ShoppingCart, EllipsisHorizontal } from "@medusajs/icons";
import { createDataTableColumnHelper, StatusBadge, useDataTable, Container, DataTable, Heading, Badge, Select, Text, Toaster, DropdownMenu, IconButton, toast } from "@medusajs/ui";
import { SiteScopeBar } from "@minimalart/mercatto-plugin-runtime/admin";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import "@medusajs/admin-shared";
const BASE_URL = "/admin/abandoned-carts";
const ABANDONED_CARTS_QUERY_KEY = ["abandoned-carts"];
function toQueryString(params) {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === void 0 || value === null || value === "") continue;
    search.append(key, String(value));
  }
  return search.toString();
}
async function fetchJson(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init == null ? void 0 : init.headers) ?? {} },
    credentials: "include"
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}
function useAbandonedCarts(params) {
  const qs = toQueryString(params);
  const url = qs ? `${BASE_URL}?${qs}` : BASE_URL;
  return useQuery({
    queryKey: [...ABANDONED_CARTS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson(url)
  });
}
function useResendAbandonedCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars) => fetchJson(`${BASE_URL}/${vars.id}/resend`, {
      method: "POST",
      body: JSON.stringify(vars.step ? { step: vars.step } : {})
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ABANDONED_CARTS_QUERY_KEY })
  });
}
function useSalesChannels() {
  return useQuery({
    queryKey: ["plugin-abandoned-cart", "sales-channels"],
    queryFn: () => fetchJson("/admin/sales-channels?limit=100")
  });
}
const PAGE_SIZE = 20;
const STATUS = {
  pending: { label: "Pendiente", color: "orange" },
  notified: { label: "Notificado", color: "blue" },
  recovered: { label: "Recuperado", color: "green" },
  cancelled: { label: "Cancelado", color: "grey" }
};
function fmtMoney(amount, currency) {
  const value = Number(amount) || 0;
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)}${currency ? ` ${currency.toUpperCase()}` : ""}`;
}
function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(d);
}
const columnHelper = createDataTableColumnHelper();
function fmtByCurrency(byCurrency) {
  const entries = Object.entries(byCurrency ?? {}).filter(([, v]) => Number(v));
  if (!entries.length) return fmtMoney(0);
  return entries.sort(([a], [b]) => a.localeCompare(b)).map(([currency, value]) => fmtMoney(value, currency)).join(" · ");
}
const MetricsBar = ({ metrics }) => {
  var _a, _b, _c;
  if (!metrics) return null;
  const items = [
    {
      label: "Abandonados",
      value: String(metrics.total ?? 0),
      hint: `${metrics.contactable ?? 0} contactables · ${metrics.uncontactable ?? 0} sin contacto`
    },
    { label: "Pendientes", value: String(((_a = metrics.by_status) == null ? void 0 : _a.pending) ?? 0) },
    { label: "Notificados", value: String(((_b = metrics.by_status) == null ? void 0 : _b.notified) ?? 0) },
    { label: "Recuperados", value: String(((_c = metrics.by_status) == null ? void 0 : _c.recovered) ?? 0) },
    {
      label: "Valor recuperable",
      value: fmtByCurrency(metrics.recoverable_value_by_currency)
    },
    {
      label: "Valor recuperado",
      value: fmtByCurrency(metrics.recovered_value_by_currency)
    },
    {
      label: "Tasa de recuperación",
      value: `${Math.round((metrics.recovery_rate ?? 0) * 100)}%`,
      hint: "sobre contactables"
    }
  ];
  return /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-4 border-t px-6 py-4 md:grid-cols-4 xl:grid-cols-7", children: items.map((it) => /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
    /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: it.label }),
    /* @__PURE__ */ jsx(Text, { size: "large", className: "font-semibold", children: it.value }),
    it.hint ? /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: it.hint }) : null
  ] }, it.label)) });
};
const RowActions = ({ row }) => {
  const resend = useResendAbandonedCart();
  const disabled = row.status === "recovered" || row.status === "cancelled";
  const onResend = async () => {
    try {
      await resend.mutateAsync({ id: row.id });
      toast.success("Recordatorio disparado");
    } catch (e) {
      toast.error(e.message);
    }
  };
  return /* @__PURE__ */ jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [
    /* @__PURE__ */ jsx(DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsx(IconButton, { size: "small", variant: "transparent", children: /* @__PURE__ */ jsx(EllipsisHorizontal, {}) }) }),
    /* @__PURE__ */ jsx(DropdownMenu.Content, { children: /* @__PURE__ */ jsx(DropdownMenu.Item, { disabled: disabled || resend.isPending, onClick: onResend, children: "Reenviar recordatorio" }) })
  ] }) });
};
const ALL_CHANNELS = "all";
const AbandonedCarts = () => {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE
  });
  const [channel, setChannel] = useState(ALL_CHANNELS);
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useAbandonedCarts({
    limit: pagination.pageSize,
    offset,
    sales_channel_id: channel === ALL_CHANNELS ? void 0 : channel
  });
  const { data: channelsData } = useSalesChannels();
  const channels = (channelsData == null ? void 0 : channelsData.sales_channels) ?? [];
  const rows = (data == null ? void 0 : data.abandoned_carts) ?? [];
  const count = (data == null ? void 0 : data.count) ?? 0;
  const channelNames = useMemo(
    () => new Map(channels.map((c) => [c.id, c.name])),
    [channels]
  );
  const onChannelChange = (value) => {
    setChannel(value);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };
  const columns = useMemo(
    () => [
      columnHelper.accessor("email", {
        header: "Contacto",
        cell: ({ row }) => {
          const { email, phone } = row.original;
          if (!email && !phone) {
            return /* @__PURE__ */ jsx("span", { className: "text-ui-fg-muted", children: "Sin contacto" });
          }
          return /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
            /* @__PURE__ */ jsx("span", { className: "font-medium", children: email || "—" }),
            /* @__PURE__ */ jsx("span", { className: "text-ui-fg-subtle text-xs", children: phone || "" })
          ] });
        }
      }),
      columnHelper.accessor("cart_total", {
        header: "Valor",
        cell: ({ row }) => fmtMoney(row.original.cart_total, row.original.currency_code)
      }),
      columnHelper.accessor("sales_channel_id", {
        header: "Canal",
        cell: ({ getValue }) => {
          const id = getValue();
          if (!id) return "—";
          return channelNames.get(id) ?? id;
        }
      }),
      columnHelper.accessor("status", {
        header: "Estado",
        cell: ({ getValue }) => {
          const s = STATUS[getValue()] ?? STATUS.pending;
          return /* @__PURE__ */ jsx(StatusBadge, { color: s.color, children: s.label });
        }
      }),
      columnHelper.accessor("last_step_sent", {
        header: "Último paso",
        cell: ({ getValue }) => getValue() > 0 ? `#${getValue()}` : "—"
      }),
      columnHelper.accessor("next_eligible_at", {
        header: "Próxima notificación",
        cell: ({ getValue }) => fmtDate(getValue())
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => /* @__PURE__ */ jsx(RowActions, { row: row.original })
      })
    ],
    [channelNames]
  );
  const table = useDataTable({
    columns,
    data: rows,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination }
  });
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-y-2", children: [
    /* @__PURE__ */ jsxs(Container, { className: "p-0", children: [
      /* @__PURE__ */ jsx(SiteScopeBar, { screen: "abandoned-carts" }),
      /* @__PURE__ */ jsxs(DataTable, { instance: table, children: [
        /* @__PURE__ */ jsxs(DataTable.Toolbar, { className: "flex flex-col items-start justify-between gap-y-3 px-6 py-4 md:flex-row md:items-center", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-x-2", children: [
            /* @__PURE__ */ jsx(Heading, { children: "Carritos abandonados" }),
            /* @__PURE__ */ jsx(Badge, { size: "2xsmall", children: "v1.4.1" })
          ] }),
          channels.length > 1 ? /* @__PURE__ */ jsxs(Select, { value: channel, onValueChange: onChannelChange, children: [
            /* @__PURE__ */ jsx(Select.Trigger, { className: "w-full md:w-64", children: /* @__PURE__ */ jsx(Select.Value, { placeholder: "Canal de venta" }) }),
            /* @__PURE__ */ jsxs(Select.Content, { children: [
              /* @__PURE__ */ jsx(Select.Item, { value: ALL_CHANNELS, children: "Todos los canales" }),
              channels.map((c) => /* @__PURE__ */ jsx(Select.Item, { value: c.id, children: c.name }, c.id))
            ] })
          ] }) : null
        ] }),
        /* @__PURE__ */ jsx(MetricsBar, { metrics: data == null ? void 0 : data.metrics }),
        count > 0 || isPending ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(DataTable.Table, {}),
          /* @__PURE__ */ jsx(DataTable.Pagination, {})
        ] }) : /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center border-t p-6 text-center", children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: channel === ALL_CHANNELS ? "Todavía no se detectaron carritos abandonados." : "No hay carritos abandonados en este canal." }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Container, { children: [
      /* @__PURE__ */ jsx(Heading, { level: "h2", children: "Configuración" }),
      /* @__PURE__ */ jsxs(Text, { className: "text-ui-fg-subtle mt-2", children: [
        "La cadencia y los topes de la extensión se controlan por variables de entorno: ",
        /* @__PURE__ */ jsx("code", { children: "ABANDONED_CART_STEP1_HOURS" }),
        ",",
        " ",
        /* @__PURE__ */ jsx("code", { children: "ABANDONED_CART_STEP2_HOURS" }),
        ",",
        " ",
        /* @__PURE__ */ jsx("code", { children: "ABANDONED_CART_STEP3_HOURS" }),
        ",",
        " ",
        /* @__PURE__ */ jsx("code", { children: "ABANDONED_CART_MAX_AGE_HOURS" }),
        ",",
        " ",
        /* @__PURE__ */ jsx("code", { children: "ABANDONED_CART_BATCH_SIZE" }),
        ",",
        " ",
        /* @__PURE__ */ jsx("code", { children: "ABANDONED_CART_MAX_PAGES" }),
        ",",
        " ",
        /* @__PURE__ */ jsx("code", { children: "ABANDONED_CART_ENABLED" }),
        " y",
        " ",
        /* @__PURE__ */ jsx("code", { children: "ABANDONED_CART_SCAN_CRON" }),
        ". Cambiar cualquiera requiere reiniciar el backend para que el nuevo valor tome efecto."
      ] })
    ] }),
    /* @__PURE__ */ jsx(Toaster, {})
  ] });
};
const AbandonedCartsIcon = () => /* @__PURE__ */ jsx(ShoppingCart, { style: { color: "#EAB308" } });
const config = defineRouteConfig({
  label: "Carritos abandonados",
  icon: AbandonedCartsIcon,
  rank: 40
});
const handle = {
  breadcrumb: () => "Carritos abandonados"
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: AbandonedCarts,
      path: "/abandoned-carts",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config.label,
      icon: config.icon,
      path: "/abandoned-carts",
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
