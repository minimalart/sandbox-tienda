"use strict";
const jsxRuntime = require("react/jsx-runtime");
const adminSdk = require("@medusajs/admin-sdk");
const icons = require("@medusajs/icons");
const ui = require("@medusajs/ui");
const admin = require("@minimalart/mercatto-plugin-runtime/admin");
const react = require("react");
const reactQuery = require("@tanstack/react-query");
require("@medusajs/admin-shared");
const BASE_URL = "/admin/dynamic-groups";
const DYNAMIC_GROUPS_QK = ["dynamic-groups"];
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
function useDynamicGroups(params) {
  const qs = new URLSearchParams();
  if ((params == null ? void 0 : params.limit) != null) qs.set("limit", String(params.limit));
  if ((params == null ? void 0 : params.offset) != null) qs.set("offset", String(params.offset));
  const url = qs.toString() ? `${BASE_URL}?${qs}` : BASE_URL;
  return reactQuery.useQuery({
    queryKey: [...DYNAMIC_GROUPS_QK, params ?? {}],
    queryFn: () => fetchJson(url)
  });
}
function useCreateDynamicGroup() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (body) => fetchJson(BASE_URL, {
      method: "POST",
      body: JSON.stringify(body)
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DYNAMIC_GROUPS_QK })
  });
}
function useUpdateDynamicGroup(id) {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (body) => fetchJson(`${BASE_URL}/${id}`, {
      method: "POST",
      body: JSON.stringify(body)
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DYNAMIC_GROUPS_QK })
  });
}
function useDeleteDynamicGroup() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson(`${BASE_URL}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DYNAMIC_GROUPS_QK })
  });
}
function useRecalculateDynamicGroup() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson(
      `${BASE_URL}/${id}/recalculate`,
      { method: "POST" }
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: DYNAMIC_GROUPS_QK })
  });
}
function useDynamicGroupLogs(id, enabled = true) {
  return reactQuery.useQuery({
    queryKey: [...DYNAMIC_GROUPS_QK, id, "logs"],
    queryFn: () => fetchJson(
      `${BASE_URL}/${id}/logs?limit=100`
    ),
    enabled
  });
}
const FIELDS = [
  { value: "orders_count", label: "Cantidad de compras", kind: "number" },
  { value: "total_spend", label: "Gasto total ($)", kind: "number" },
  { value: "spend_last_days", label: "Gasto en últimos N días ($)", kind: "number", windowed: true },
  { value: "orders_last_days", label: "Compras en últimos N días", kind: "number", windowed: true },
  { value: "days_since_last_order", label: "Días sin comprar", kind: "number" },
  { value: "aov", label: "Ticket promedio ($)", kind: "number" },
  { value: "province", label: "Provincia (ej. CABA)", kind: "text" },
  { value: "country", label: "País (código, ej. ar)", kind: "text" },
  { value: "is_wholesale", label: "Es mayorista", kind: "boolean" },
  { value: "registered_no_purchase", label: "Registrado sin compra", kind: "boolean" },
  { value: "account_age_days", label: "Antigüedad de la cuenta (días)", kind: "number" },
  { value: "birthday_this_month", label: "Cumpleaños este mes", kind: "boolean" }
];
const OPERATORS = [
  { value: "gte", label: "≥ mayor o igual" },
  { value: "lte", label: "≤ menor o igual" },
  { value: "eq", label: "= igual" },
  { value: "neq", label: "≠ distinto" },
  { value: "in", label: "en lista (coma)" },
  { value: "contains", label: "contiene" }
];
const fieldKind = (field) => {
  var _a;
  return ((_a = FIELDS.find((f) => f.value === field)) == null ? void 0 : _a.kind) ?? "text";
};
const isWindowed = (field) => {
  var _a;
  return !!((_a = FIELDS.find((f) => f.value === field)) == null ? void 0 : _a.windowed);
};
const emptyRow = () => ({
  field: "orders_count",
  operator: "gte",
  value: "",
  days: ""
});
const toRow = (c) => ({
  field: c.field,
  operator: c.operator,
  value: Array.isArray(c.value) ? c.value.join(", ") : String(c.value ?? ""),
  days: c.days != null ? String(c.days) : ""
});
function rowToCondition(r) {
  const kind = fieldKind(r.field);
  let value;
  if (r.operator === "in") {
    value = r.value.split(",").map((v) => v.trim()).filter(Boolean);
  } else if (kind === "number") {
    value = Number(r.value) || 0;
  } else if (kind === "boolean") {
    value = r.value === "true";
  } else {
    value = r.value;
  }
  const cond = { field: r.field, operator: r.operator, value };
  if (isWindowed(r.field) && r.days) cond.days = Number(r.days) || void 0;
  return cond;
}
const DynamicGroupForm = ({ open, onClose, group }) => {
  const isEdit = !!group;
  const [name, setName] = react.useState("");
  const [description, setDescription] = react.useState("");
  const [isActive, setIsActive] = react.useState(true);
  const [match, setMatch] = react.useState("all");
  const [updateMode, setUpdateMode] = react.useState("realtime");
  const [rows, setRows] = react.useState([emptyRow()]);
  const createMut = useCreateDynamicGroup();
  const updateMut = useUpdateDynamicGroup((group == null ? void 0 : group.id) ?? "");
  const isPending = createMut.isPending || updateMut.isPending;
  react.useEffect(() => {
    var _a;
    if (!open) return;
    setName((group == null ? void 0 : group.name) ?? "");
    setDescription((group == null ? void 0 : group.description) ?? "");
    setIsActive((group == null ? void 0 : group.is_active) ?? true);
    setMatch((group == null ? void 0 : group.match) ?? "all");
    setUpdateMode((group == null ? void 0 : group.update_mode) ?? "realtime");
    setRows(
      ((_a = group == null ? void 0 : group.conditions) == null ? void 0 : _a.length) ? group.conditions.map(toRow) : [emptyRow()]
    );
  }, [open, group]);
  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addRow = () => setRows((rs) => [...rs, emptyRow()]);
  const removeRow = (i) => setRows((rs) => rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs);
  const submit = async () => {
    if (name.trim().length < 2) {
      ui.toast.error("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    const conditions = rows.filter((r) => r.field).map(rowToCondition);
    const body = {
      name: name.trim(),
      description: description || null,
      is_active: isActive,
      match,
      update_mode: updateMode,
      conditions
    };
    try {
      if (isEdit) {
        await updateMut.mutateAsync(body);
        ui.toast.success("Grupo actualizado");
      } else {
        await createMut.mutateAsync(body);
        ui.toast.success("Grupo creado");
      }
      onClose();
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal, { open, onOpenChange: (v) => !v && onClose(), children: /* @__PURE__ */ jsxRuntime.jsxs(ui.FocusModal.Content, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", onClick: submit, isLoading: isPending, children: isEdit ? "Guardar cambios" : "Crear grupo" }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Body, { className: "flex flex-col items-center overflow-y-auto py-8", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex w-full max-w-2xl flex-col gap-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "large", weight: "plus", children: isEdit ? "Editar grupo dinámico" : "Nuevo grupo dinámico" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: "Un grupo es una regla viva: los clientes entran/salen automáticamente según las condiciones." })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Nombre" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: name, onChange: (e) => setName(e.target.value), placeholder: "Ej: Clientes VIP" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Descripción (opcional)" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Textarea, { value: description, onChange: (e) => setDescription(e.target.value), rows: 2 })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between rounded-lg border border-ui-border-base p-3", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Activo" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: "Los grupos inactivos no se evalúan." })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Switch, { checked: isActive, onCheckedChange: setIsActive })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Coincidencia" }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: match, onValueChange: (v) => setMatch(v), children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "all", children: "Cumple TODAS las condiciones" }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "any", children: "Cumple ALGUNA condición" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Actualización" }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: updateMode, onValueChange: (v) => setUpdateMode(v), children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "realtime", children: "Tiempo real (eventos)" }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "manual", children: "Manual" })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-3", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Condiciones" }),
        rows.map((r, i) => {
          const kind = fieldKind(r.field);
          return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap items-end gap-2 rounded-lg border border-ui-border-base p-3", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex min-w-[180px] flex-1 flex-col gap-1", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: "Campo" }),
              /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: r.field, onValueChange: (v) => setRow(i, { field: v }), children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { children: FIELDS.map((f) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: f.value, children: f.label }, f.value)) })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex w-[150px] flex-col gap-1", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: "Operador" }),
              /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: r.operator, onValueChange: (v) => setRow(i, { operator: v }), children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { children: OPERATORS.map((o) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: o.value, children: o.label }, o.value)) })
              ] })
            ] }),
            isWindowed(r.field) && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex w-[90px] flex-col gap-1", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: "Días" }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: r.days, onChange: (e) => setRow(i, { days: e.target.value }), placeholder: "90" })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex w-[140px] flex-col gap-1", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: "Valor" }),
              kind === "boolean" ? /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: r.value || "true", onValueChange: (v) => setRow(i, { value: v }), children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
                /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { children: [
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "true", children: "Sí" }),
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "false", children: "No" })
                ] })
              ] }) : /* @__PURE__ */ jsxRuntime.jsx(
                ui.Input,
                {
                  type: kind === "number" && r.operator !== "in" ? "number" : "text",
                  value: r.value,
                  onChange: (e) => setRow(i, { value: e.target.value })
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { variant: "transparent", onClick: () => removeRow(i), type: "button", children: /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, {}) })
          ] }, i);
        }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Button, { variant: "secondary", size: "small", onClick: addRow, type: "button", children: [
          /* @__PURE__ */ jsxRuntime.jsx(icons.Plus, {}),
          " Agregar condición"
        ] })
      ] })
    ] }) })
  ] }) });
};
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const LogsDrawer = ({ group, onClose }) => {
  const { data, isLoading } = useDynamicGroupLogs((group == null ? void 0 : group.id) ?? "", !!group);
  return /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open: !!group, onOpenChange: (v) => !v && onClose(), children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Heading, { children: [
      "Historial — ",
      group == null ? void 0 : group.name
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Body, { className: "overflow-y-auto", children: isLoading ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Cargando…" }) : !(data == null ? void 0 : data.logs.length) ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Sin movimientos todavía." }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-col gap-2", children: data.logs.map((l) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between rounded-lg border border-ui-border-base p-2", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: l.action === "added" ? "green" : "red", children: l.action === "added" ? "Entró" : "Salió" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "font-mono", children: l.customer_id })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: fmtDate(l.created_at) })
    ] }, l.id)) }) })
  ] }) });
};
const DynamicGroupsPage = () => {
  const { data, isLoading } = useDynamicGroups({ limit: 100 });
  const [formOpen, setFormOpen] = react.useState(false);
  const [editing, setEditing] = react.useState(null);
  const [logsFor, setLogsFor] = react.useState(null);
  const recalc = useRecalculateDynamicGroup();
  const del = useDeleteDynamicGroup();
  const prompt = ui.usePrompt();
  const groups = (data == null ? void 0 : data.dynamic_groups) ?? [];
  const onRecalc = async (g) => {
    try {
      const { stats } = await recalc.mutateAsync(g.id);
      ui.toast.success(`Recalculado: ${(stats == null ? void 0 : stats.members) ?? 0} miembros (+${(stats == null ? void 0 : stats.added) ?? 0} / -${(stats == null ? void 0 : stats.removed) ?? 0})`);
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  const onDelete = async (g) => {
    const ok = await prompt({
      title: "Eliminar grupo",
      description: `¿Eliminar "${g.name}"? Se borra también su customer group nativo.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      variant: "danger"
    });
    if (!ok) return;
    try {
      await del.mutateAsync(g.id);
      ui.toast.success("Grupo eliminado");
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "p-0", children: [
      /* @__PURE__ */ jsxRuntime.jsx(admin.SiteScopeBar, { screen: "dynamic-groups" }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-x-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: "Grupos Dinámicos" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", children: "v1.3.1" })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "secondary", onClick: () => {
          setEditing(null);
          setFormOpen(true);
        }, children: "Crear" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Table, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Header, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Nombre" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Condiciones" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Miembros" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Modo" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Estado" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Último recálculo" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: " " })
        ] }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Body, { children: isLoading ? /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Row, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { colSpan: 7, children: "Cargando…" }) }) : groups.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Row, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { colSpan: 7, children: "No hay grupos dinámicos. Creá el primero." }) }) : groups.map((g) => {
          var _a, _b;
          return /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", children: g.name }) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Badge, { size: "2xsmall", children: [
              ((_a = g.conditions) == null ? void 0 : _a.length) ?? 0,
              " · ",
              g.match === "all" ? "TODAS" : "ALGUNA"
            ] }) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: ((_b = g.last_run_stats) == null ? void 0 : _b.members) ?? "—" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: g.update_mode === "realtime" ? "blue" : "grey", children: g.update_mode === "realtime" ? "Tiempo real" : "Manual" }) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: g.is_active ? "green" : "grey", children: g.is_active ? "Activo" : "Inactivo" }) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: fmtDate(g.last_run_at) }) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex justify-end", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { variant: "transparent", children: /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, {}) }) }),
              /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Item, { onClick: () => {
                  setEditing(g);
                  setFormOpen(true);
                }, children: "Ver" }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Item, { onClick: () => {
                  setEditing(g);
                  setFormOpen(true);
                }, children: "Editar" }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Item, { onClick: () => setLogsFor(g), children: "Historial" }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Item, { onClick: () => onRecalc(g), children: "Recalcular" }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Separator, {}),
                /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Item, { className: "text-ui-fg-error", onClick: () => onDelete(g), children: "Eliminar" })
              ] })
            ] }) }) })
          ] }, g.id);
        }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Container, { className: "mt-4", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2 px-6 py-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h2", children: "Barrido periódico" }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: [
        "El recálculo en tiempo real lo hacen los subscribers; este cron sólo barre las reglas temporales (inactividad, cumpleaños, antigüedad). Configurable con la variable de entorno",
        " ",
        /* @__PURE__ */ jsxRuntime.jsx("code", { children: "DYNAMIC_GROUPS_RECALC_CRON" }),
        " (default: ",
        /* @__PURE__ */ jsxRuntime.jsx("code", { children: "0 3 * * *" }),
        "). Requiere reiniciar el backend después de cambiarla."
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(DynamicGroupForm, { open: formOpen, onClose: () => setFormOpen(false), group: editing }),
    /* @__PURE__ */ jsxRuntime.jsx(LogsDrawer, { group: logsFor, onClose: () => setLogsFor(null) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] });
};
const DynamicGroupsIcon = () => /* @__PURE__ */ jsxRuntime.jsx(icons.Users, { style: { color: "#7C3AED" } });
const config = adminSdk.defineRouteConfig({
  label: "Grupos Dinámicos",
  icon: DynamicGroupsIcon,
  rank: 90
});
const handle = {
  breadcrumb: () => "Grupos Dinámicos"
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: DynamicGroupsPage,
      path: "/dynamic-groups",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config.label,
      icon: config.icon,
      path: "/dynamic-groups",
      nested: void 0,
      rank: 90,
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
module.exports = plugin;
