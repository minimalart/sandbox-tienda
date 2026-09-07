import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { FolderOpen } from "@medusajs/icons";
import { Container, Heading, Badge, Tabs, Toaster, Input, Text, Select, Button, StatusBadge, Switch, Drawer, toast } from "@medusajs/ui";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import "@medusajs/admin-shared";
const version = "1.1.0";
const pkg = {
  version
};
const BASE_URL = "/admin/database-explorer";
const DATABASE_EXPLORER_QK = ["database-explorer"];
async function fetchJson(url, init) {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init == null ? void 0 : init.headers) ?? {} }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}
function useDatabaseExplorerTables(params) {
  const qs = new URLSearchParams();
  const suffix = qs.toString() ? `?${qs}` : "";
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, "tables", false],
    queryFn: () => fetchJson(`${BASE_URL}/tables${suffix}`)
  });
}
function useDatabaseExplorerRows(args) {
  const qs = new URLSearchParams();
  qs.set("limit", String(args.limit));
  qs.set("offset", String(args.page * args.limit));
  if (args.q) qs.set("q", args.q);
  if (args.sort) qs.set("sort", args.sort);
  if (args.direction) qs.set("direction", args.direction);
  if (args.filters && Object.keys(args.filters).length) {
    qs.set("filters", JSON.stringify(args.filters));
  }
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, "rows", args.table, args.page, args.limit, args.q, args.sort, args.direction, args.filters ?? {}],
    queryFn: () => fetchJson(
      `${BASE_URL}/tables/${args.table}/rows?${qs}`
    ),
    enabled: !!args.table
  });
}
function useDatabaseExplorerRow(table, id) {
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, "row", table, id],
    queryFn: () => fetchJson(
      `${BASE_URL}/tables/${table}/rows/${id}`
    ),
    enabled: !!table && !!id
  });
}
function useDatabaseExplorerGraph() {
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, "graph"],
    queryFn: () => fetchJson(`${BASE_URL}/schema-graph`)
  });
}
function useDatabaseExplorerViews() {
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, "views"],
    queryFn: () => fetchJson(`${BASE_URL}/views`)
  });
}
function useRunDatabaseExplorerView(viewId) {
  return useMutation({
    mutationFn: (params) => {
      const qs = new URLSearchParams();
      qs.set("limit", String(params.limit ?? 25));
      qs.set("offset", String(params.offset ?? 0));
      if (params.q) qs.set("q", params.q);
      return fetchJson(
        `${BASE_URL}/views/${viewId}/run?${qs}`
      );
    }
  });
}
function useDatabaseExplorerAudit(params) {
  const qs = new URLSearchParams();
  qs.set("limit", String((params == null ? void 0 : params.limit) ?? 50));
  qs.set("offset", String((params == null ? void 0 : params.offset) ?? 0));
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, "audit", params ?? {}],
    queryFn: () => fetchJson(`${BASE_URL}/audit?${qs}`)
  });
}
function useDatabaseExplorerSettingsTables() {
  return useQuery({
    queryKey: [...DATABASE_EXPLORER_QK, "settings-tables"],
    queryFn: () => fetchJson(
      `${BASE_URL}/settings/tables`
    )
  });
}
function useSaveDatabaseExplorerTableSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => fetchJson(`${BASE_URL}/settings/tables`, {
      method: "POST",
      body: JSON.stringify(body)
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DATABASE_EXPLORER_QK })
  });
}
const PLUGIN_VERSION = pkg.version;
const PAGE_SIZE = 25;
function formatValue(value) {
  if (value === null || value === void 0) return "null";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}
function shortValue(value) {
  const formatted = formatValue(value);
  return formatted.length > 96 ? `${formatted.slice(0, 96)}...` : formatted;
}
function labelForTable(table) {
  return table.display_name || table.table_name;
}
function primaryValue(table, row) {
  const key = table.primary_label_column || "id";
  return row[key] ?? row.id ?? table.table_name;
}
function DataRowsTable({
  table,
  rows,
  onOpen
}) {
  const columns = table.columns.filter((column) => column.visible !== false).slice(0, 10);
  return /* @__PURE__ */ jsx("div", { className: "overflow-x-auto border-t border-ui-border-base", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[760px] table-fixed", children: [
    /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-ui-border-base bg-ui-bg-subtle", children: [
      columns.map((column) => /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
        /* @__PURE__ */ jsx(Text, { size: "xsmall", weight: "plus", children: column.display_name || column.column_name }),
        column.masked || column.sensitive ? /* @__PURE__ */ jsx(Badge, { size: "2xsmall", color: "orange", children: "masked" }) : null
      ] }) }, column.column_name)),
      /* @__PURE__ */ jsx("th", { className: "w-24 px-3 py-2 text-right", children: /* @__PURE__ */ jsx(Text, { size: "xsmall", weight: "plus", children: "Acciones" }) })
    ] }) }),
    /* @__PURE__ */ jsx("tbody", { children: rows.map((row, index) => {
      const id = String(row.id ?? "");
      return /* @__PURE__ */ jsxs("tr", { className: "border-b border-ui-border-base", children: [
        columns.map((column) => /* @__PURE__ */ jsx("td", { className: "px-3 py-2 align-top", children: /* @__PURE__ */ jsx(
          Text,
          {
            size: "small",
            className: "block truncate text-ui-fg-subtle",
            title: formatValue(row[column.column_name]),
            children: shortValue(row[column.column_name])
          }
        ) }, column.column_name)),
        /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-right", children: /* @__PURE__ */ jsx(
          Button,
          {
            size: "small",
            variant: "transparent",
            disabled: !id,
            onClick: () => onOpen(id),
            children: "Ver"
          }
        ) })
      ] }, id || index);
    }) })
  ] }) });
}
function RecordDrawer({
  table,
  id,
  onClose
}) {
  const { data, isLoading } = useDatabaseExplorerRow(table, id);
  const row = data == null ? void 0 : data.row;
  const copyJson = async () => {
    if (!row) return;
    await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    toast.success("JSON copiado");
  };
  return /* @__PURE__ */ jsx(Drawer, { open: !!id, onOpenChange: (open) => !open && onClose(), children: /* @__PURE__ */ jsxs(Drawer.Content, { children: [
    /* @__PURE__ */ jsx(Drawer.Header, { children: /* @__PURE__ */ jsx(Drawer.Title, { children: data ? `${labelForTable(data.table)}: ${primaryValue(data.table, data.row)}` : "Registro" }) }),
    /* @__PURE__ */ jsx(Drawer.Body, { className: "overflow-y-auto", children: isLoading ? /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Cargando..." }) : row ? /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: Object.entries(row).map(([key, value]) => /* @__PURE__ */ jsxs("div", { className: "rounded border border-ui-border-base p-3", children: [
      /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", children: key }),
      /* @__PURE__ */ jsx("pre", { className: "mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-ui-fg-subtle", children: formatValue(value) })
    ] }, key)) }) : /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "No se pudo cargar el registro." }) }),
    /* @__PURE__ */ jsxs(Drawer.Footer, { children: [
      /* @__PURE__ */ jsx(Button, { variant: "secondary", onClick: copyJson, disabled: !row, children: "Copiar JSON" }),
      /* @__PURE__ */ jsx(Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsx(Button, { children: "Cerrar" }) })
    ] })
  ] }) });
}
function ExplorerTab() {
  var _a;
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const { data: tablesData, isLoading: loadingTables } = useDatabaseExplorerTables();
  const tables = (tablesData == null ? void 0 : tablesData.tables) ?? [];
  const [selectedTable, setSelectedTable] = useState(null);
  const activeTable = useMemo(
    () => tables.find((table) => {
      var _a2;
      return table.table_name === (selectedTable ?? ((_a2 = tables[0]) == null ? void 0 : _a2.table_name));
    }),
    [selectedTable, tables]
  );
  const rows = useDatabaseExplorerRows({
    table: activeTable == null ? void 0 : activeTable.table_name,
    page,
    limit: PAGE_SIZE,
    q,
    sort,
    direction: "desc"
  });
  const totalPages = Math.max(1, Math.ceil((((_a = rows.data) == null ? void 0 : _a.count) ?? 0) / PAGE_SIZE));
  const sortableColumns = (activeTable == null ? void 0 : activeTable.columns.filter((column) => column.sortable)) ?? [];
  return /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-0 lg:grid-cols-[260px_1fr]", children: [
    /* @__PURE__ */ jsxs("aside", { className: "border-b border-ui-border-base p-4 lg:border-b-0 lg:border-r", children: [
      /* @__PURE__ */ jsx(
        Input,
        {
          placeholder: "Buscar tabla...",
          value: selectedTable ?? "",
          onChange: (event) => {
            setSelectedTable(event.target.value || null);
            setPage(0);
          }
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "mt-3 flex max-h-[520px] flex-col gap-1 overflow-y-auto", children: [
        loadingTables ? /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Cargando..." }) : null,
        tables.filter(
          (table) => selectedTable ? table.table_name.includes(selectedTable) || (table.display_name ?? "").toLowerCase().includes(selectedTable.toLowerCase()) : true
        ).map((table) => /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            className: `rounded px-3 py-2 text-left ${table.table_name === (activeTable == null ? void 0 : activeTable.table_name) ? "bg-ui-bg-subtle" : "hover:bg-ui-bg-subtle"}`,
            onClick: () => {
              setSelectedTable(table.table_name);
              setPage(0);
            },
            children: [
              /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", children: labelForTable(table) }),
              /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: table.table_name })
            ]
          },
          table.table_name
        ))
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "min-w-0", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 px-6 py-4", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Heading, { children: activeTable ? labelForTable(activeTable) : "Explorador" }),
          /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: (activeTable == null ? void 0 : activeTable.description) ?? "Tablas habilitadas para diagnostico read-only." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(
            Input,
            {
              placeholder: "Buscar...",
              value: q,
              onChange: (event) => {
                setQ(event.target.value);
                setPage(0);
              },
              className: "w-48"
            }
          ),
          /* @__PURE__ */ jsxs(
            Select,
            {
              value: sort ?? (activeTable == null ? void 0 : activeTable.default_sort_column) ?? "",
              onValueChange: (value) => setSort(value || null),
              size: "small",
              children: [
                /* @__PURE__ */ jsx(Select.Trigger, { className: "w-44", children: /* @__PURE__ */ jsx(Select.Value, { placeholder: "Orden" }) }),
                /* @__PURE__ */ jsx(Select.Content, { children: sortableColumns.map((column) => /* @__PURE__ */ jsx(Select.Item, { value: column.column_name, children: column.display_name || column.column_name }, column.column_name)) })
              ]
            }
          )
        ] })
      ] }),
      rows.isLoading ? /* @__PURE__ */ jsx("div", { className: "px-6 py-8", children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Cargando registros..." }) }) : rows.data && activeTable ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(DataRowsTable, { table: activeTable, rows: rows.data.rows, onOpen: setSelectedRow }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
          /* @__PURE__ */ jsxs(Text, { size: "small", className: "text-ui-fg-subtle", children: [
            rows.data.count,
            " registros"
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(
              Button,
              {
                size: "small",
                variant: "secondary",
                disabled: page <= 0,
                onClick: () => setPage((current) => Math.max(0, current - 1)),
                children: "Anterior"
              }
            ),
            /* @__PURE__ */ jsxs(Text, { size: "small", className: "text-ui-fg-subtle", children: [
              page + 1,
              " / ",
              totalPages
            ] }),
            /* @__PURE__ */ jsx(
              Button,
              {
                size: "small",
                variant: "secondary",
                disabled: page >= totalPages - 1,
                onClick: () => setPage((current) => Math.min(totalPages - 1, current + 1)),
                children: "Siguiente"
              }
            )
          ] })
        ] })
      ] }) : /* @__PURE__ */ jsx("div", { className: "px-6 py-8", children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "No hay tablas habilitadas." }) })
    ] }),
    /* @__PURE__ */ jsx(
      RecordDrawer,
      {
        table: activeTable == null ? void 0 : activeTable.table_name,
        id: selectedRow,
        onClose: () => setSelectedRow(null)
      }
    )
  ] });
}
function VisualTab() {
  const { data, isLoading } = useDatabaseExplorerGraph();
  const graph = data == null ? void 0 : data.graph;
  const [selected, setSelected] = useState(null);
  const node = (graph == null ? void 0 : graph.nodes.find((candidate) => candidate.id === selected)) ?? (graph == null ? void 0 : graph.nodes[0]);
  const edges = graph == null ? void 0 : graph.edges.filter(
    (edge) => edge.source_table === (node == null ? void 0 : node.id) || edge.target_table === (node == null ? void 0 : node.id)
  );
  return /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-0 lg:grid-cols-[1fr_320px]", children: [
    /* @__PURE__ */ jsx("div", { className: "p-6", children: isLoading ? /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Cargando vista visual..." }) : /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3", children: graph == null ? void 0 : graph.nodes.map((item) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: `rounded border p-4 text-left ${item.id === (node == null ? void 0 : node.id) ? "border-ui-border-interactive bg-ui-bg-subtle" : "border-ui-border-base"}`,
        onClick: () => setSelected(item.id),
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-2", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(Text, { weight: "plus", children: item.label }),
              /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: item.table_name })
            ] }),
            item.has_sensitive_fields ? /* @__PURE__ */ jsx(Badge, { size: "2xsmall", color: "orange", children: "sensible" }) : null
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-3 flex flex-wrap gap-1", children: item.fields.slice(0, 5).map((field) => /* @__PURE__ */ jsx(Badge, { size: "2xsmall", color: field.masked ? "orange" : "grey", children: field.column_name }, field.column_name)) })
        ]
      },
      item.id
    )) }) }),
    /* @__PURE__ */ jsxs("aside", { className: "border-t border-ui-border-base p-6 lg:border-l lg:border-t-0", children: [
      /* @__PURE__ */ jsx(Heading, { level: "h2", children: (node == null ? void 0 : node.label) ?? "Tabla" }),
      /* @__PURE__ */ jsx(Text, { size: "small", className: "mt-1 text-ui-fg-subtle", children: (node == null ? void 0 : node.description) ?? (node == null ? void 0 : node.table_name) }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-col gap-3", children: [
        /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", children: "Relaciones" }),
        (edges == null ? void 0 : edges.length) ? edges.map((edge) => /* @__PURE__ */ jsxs("div", { className: "rounded border border-ui-border-base p-3", children: [
          /* @__PURE__ */ jsxs(Text, { size: "small", children: [
            edge.source_table,
            ".",
            edge.source_column
          ] }),
          /* @__PURE__ */ jsxs(Text, { size: "small", className: "text-ui-fg-subtle", children: [
            "a ",
            edge.target_table,
            ".",
            edge.target_column
          ] }),
          /* @__PURE__ */ jsx(Badge, { size: "2xsmall", color: edge.inferred ? "blue" : "green", children: edge.inferred ? "inferida" : "configurada" })
        ] }, edge.id)) : /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: "Sin relaciones detectadas en el subconjunto habilitado." })
      ] })
    ] })
  ] });
}
function ViewsTab() {
  var _a;
  const { data } = useDatabaseExplorerViews();
  const [active, setActive] = useState(null);
  const runner = useRunDatabaseExplorerView(active);
  return /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-0 lg:grid-cols-[320px_1fr]", children: [
    /* @__PURE__ */ jsx("aside", { className: "border-b border-ui-border-base p-4 lg:border-b-0 lg:border-r", children: /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-2", children: data == null ? void 0 : data.views.map((view) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "rounded border border-ui-border-base p-3 text-left hover:bg-ui-bg-subtle",
        onClick: () => {
          setActive(view.id);
          runner.mutate({ limit: PAGE_SIZE, offset: 0 });
        },
        children: [
          /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", children: view.name }),
          /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: view.description })
        ]
      },
      view.id
    )) }) }),
    /* @__PURE__ */ jsxs("section", { className: "min-w-0", children: [
      /* @__PURE__ */ jsxs("div", { className: "px-6 py-4", children: [
        /* @__PURE__ */ jsx(Heading, { children: ((_a = runner.data) == null ? void 0 : _a.view.name) ?? "Vistas guardadas" }),
        /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: "Accesos operativos curados para soporte." })
      ] }),
      runner.data ? /* @__PURE__ */ jsx(DataRowsTable, { table: runner.data.table, rows: runner.data.rows, onOpen: () => void 0 }) : /* @__PURE__ */ jsx("div", { className: "px-6 py-8", children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Selecciona una vista para ejecutarla." }) })
    ] })
  ] });
}
function AuditTab() {
  const { data, isLoading } = useDatabaseExplorerAudit({ limit: 50, offset: 0 });
  return /* @__PURE__ */ jsx("div", { className: "p-6", children: isLoading ? /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Cargando auditoria..." }) : /* @__PURE__ */ jsx("div", { className: "overflow-x-auto rounded border border-ui-border-base", children: /* @__PURE__ */ jsxs("table", { className: "w-full min-w-[760px]", children: [
    /* @__PURE__ */ jsx("thead", { className: "bg-ui-bg-subtle", children: /* @__PURE__ */ jsx("tr", { children: ["Fecha", "Usuario", "Accion", "Tabla", "Resultado", "Duracion"].map((header) => /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left", children: /* @__PURE__ */ jsx(Text, { size: "xsmall", weight: "plus", children: header }) }, header)) }) }),
    /* @__PURE__ */ jsx("tbody", { children: data == null ? void 0 : data.audit_logs.map((log) => /* @__PURE__ */ jsxs("tr", { className: "border-t border-ui-border-base", children: [
      /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx(Text, { size: "small", children: log.created_at ? new Date(log.created_at).toLocaleString("es-AR") : "-" }) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: log.user_id ?? "-" }) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx(Text, { size: "small", children: log.action }) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx(Text, { size: "small", children: log.table_name ?? "-" }) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx(StatusBadge, { color: log.success ? "green" : "red", children: log.success ? "ok" : "error" }) }),
      /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsxs(Text, { size: "small", children: [
        log.duration_ms ?? 0,
        " ms"
      ] }) })
    ] }, log.id)) })
  ] }) }) });
}
function SettingsTab() {
  const { data, isLoading } = useDatabaseExplorerSettingsTables();
  const saveTable = useSaveDatabaseExplorerTableSettings();
  const toggle = async (table) => {
    try {
      await saveTable.mutateAsync({
        table_name: table.table_name,
        enabled: !table.enabled,
        show_in_visual: true,
        display_name: table.table_name
      });
      toast.success("Configuracion actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "p-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-4", children: [
      /* @__PURE__ */ jsx(Heading, { level: "h2", children: "Configuracion" }),
      /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: "Habilita tablas de forma explicita. Las columnas visibles se controlan por defaults seguros o por configuracion." })
    ] }),
    isLoading ? /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Cargando tablas..." }) : /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3", children: data == null ? void 0 : data.tables.slice(0, 120).map((table) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded border border-ui-border-base p-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", className: "truncate", children: table.table_name }),
        /* @__PURE__ */ jsxs(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: [
          table.columns.length,
          " columnas"
        ] })
      ] }),
      /* @__PURE__ */ jsx(Switch, { checked: table.enabled, onCheckedChange: () => toggle(table) })
    ] }, table.table_name)) })
  ] });
}
const DataPage = () => {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(Container, { className: "p-0", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 px-6 py-4", children: [
        /* @__PURE__ */ jsx(Heading, { children: "Datos" }),
        /* @__PURE__ */ jsxs(Badge, { size: "2xsmall", color: "grey", rounded: "full", title: "Plugin version", children: [
          "v",
          PLUGIN_VERSION
        ] })
      ] }),
      /* @__PURE__ */ jsxs(Tabs, { defaultValue: "explorer", children: [
        /* @__PURE__ */ jsx("div", { className: "border-y border-ui-border-base px-6 py-2", children: /* @__PURE__ */ jsxs(Tabs.List, { children: [
          /* @__PURE__ */ jsx(Tabs.Trigger, { value: "explorer", children: "Explorador" }),
          /* @__PURE__ */ jsx(Tabs.Trigger, { value: "visual", children: "Visual" }),
          /* @__PURE__ */ jsx(Tabs.Trigger, { value: "views", children: "Vistas" }),
          /* @__PURE__ */ jsx(Tabs.Trigger, { value: "audit", children: "Auditoria" }),
          /* @__PURE__ */ jsx(Tabs.Trigger, { value: "settings", children: "Configuracion" })
        ] }) }),
        /* @__PURE__ */ jsx(Tabs.Content, { value: "explorer", children: /* @__PURE__ */ jsx(ExplorerTab, {}) }),
        /* @__PURE__ */ jsx(Tabs.Content, { value: "visual", children: /* @__PURE__ */ jsx(VisualTab, {}) }),
        /* @__PURE__ */ jsx(Tabs.Content, { value: "views", children: /* @__PURE__ */ jsx(ViewsTab, {}) }),
        /* @__PURE__ */ jsx(Tabs.Content, { value: "audit", children: /* @__PURE__ */ jsx(AuditTab, {}) }),
        /* @__PURE__ */ jsx(Tabs.Content, { value: "settings", children: /* @__PURE__ */ jsx(SettingsTab, {}) })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Toaster, {})
  ] });
};
const DataIcon = () => /* @__PURE__ */ jsx(FolderOpen, { style: { color: "#2563EB" } });
const config = defineRouteConfig({
  label: "Datos",
  icon: DataIcon,
  rank: 38
});
const handle = {
  breadcrumb: () => "Datos"
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: DataPage,
      path: "/data",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config.label,
      icon: config.icon,
      path: "/data",
      nested: void 0,
      rank: 38,
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
