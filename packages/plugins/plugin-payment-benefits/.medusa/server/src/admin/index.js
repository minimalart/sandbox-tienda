"use strict";
const jsxRuntime = require("react/jsx-runtime");
const adminSdk = require("@medusajs/admin-sdk");
const icons = require("@medusajs/icons");
const reactRouterDom = require("react-router-dom");
const ui = require("@medusajs/ui");
const react = require("react");
const reactQuery = require("@tanstack/react-query");
const admin = require("@minimalart/mercatto-plugin-runtime/admin");
const Medusa = require("@medusajs/js-sdk");
require("@medusajs/admin-shared");
const _interopDefault = (e) => e && e.__esModule ? e : { default: e };
const Medusa__default = /* @__PURE__ */ _interopDefault(Medusa);
const PaymentBenefitsIndex = () => /* @__PURE__ */ jsxRuntime.jsx(reactRouterDom.Navigate, { to: "/payment-benefits/benefits", replace: true });
const PaymentBenefitsIcon = () => /* @__PURE__ */ jsxRuntime.jsx(icons.CreditCard, { style: { color: "#0EA5E9" } });
const config$3 = adminSdk.defineRouteConfig({
  label: "Beneficios de Pago",
  icon: PaymentBenefitsIcon,
  rank: 44
});
const handle$4 = {
  breadcrumb: () => "Beneficios de Pago"
};
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
const BASE_URL = "/admin/payment-benefits";
function toQueryString(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== void 0 && v !== "") qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}
const benefitsQK = (params) => ["payment-benefits", params ?? {}];
const benefitQK = (id) => ["payment-benefits", id];
const dashboardQK = () => ["payment-benefits", "dashboard"];
const catalogQK = () => ["payment-benefits", "catalog"];
function usePaymentBenefits(params) {
  return reactQuery.useQuery({
    queryKey: benefitsQK(params),
    queryFn: () => fetchJson(
      `${BASE_URL}${toQueryString({ ...params })}`
    )
  });
}
function usePaymentBenefit(id) {
  return reactQuery.useQuery({
    queryKey: benefitQK(id),
    queryFn: () => fetchJson(`${BASE_URL}/${id}`),
    enabled: !!id
  });
}
function usePaymentBenefitsDashboard() {
  return reactQuery.useQuery({
    queryKey: dashboardQK(),
    queryFn: () => fetchJson(`${BASE_URL}/dashboard`)
  });
}
function usePaymentMethodCatalog() {
  return reactQuery.useQuery({
    queryKey: catalogQK(),
    queryFn: () => fetchJson(`${BASE_URL}/catalog`)
  });
}
function useCreatePaymentBenefit() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (body) => fetchJson(BASE_URL, {
      method: "POST",
      body: JSON.stringify(body)
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-benefits"] });
    }
  });
}
function useUpdatePaymentBenefit(id) {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (body) => fetchJson(`${BASE_URL}/${id}`, {
      method: "POST",
      body: JSON.stringify(body)
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-benefits"] });
    }
  });
}
function useDeletePaymentBenefit() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson(`${BASE_URL}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-benefits"] });
    }
  });
}
function useSyncProvider() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (provider) => fetchJson(`${BASE_URL}/sync/${provider}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-benefits"] });
    }
  });
}
const PAGE_SIZE = 20;
const columnHelper = ui.createDataTableColumnHelper();
const TYPE_LABEL = {
  installments: "Cuotas",
  percentage_discount: "% Descuento",
  fixed_discount: "Descuento fijo",
  refund: "Reintegro",
  cashback: "Cashback",
  custom: "Personalizado"
};
const STATUS_COLOR = {
  active: "green",
  scheduled: "orange",
  draft: "grey",
  expired: "grey",
  disabled: "grey",
  sync_error: "red"
};
const STATUS_LABEL = {
  active: "Activo",
  scheduled: "Programado",
  draft: "Borrador",
  expired: "Vencido",
  disabled: "Deshabilitado",
  sync_error: "Error de sincronización"
};
const RowActions = ({ benefit }) => {
  const navigate = reactRouterDom.useNavigate();
  const prompt = ui.usePrompt();
  const updateMut = useUpdatePaymentBenefit(benefit.id);
  const deleteMut = useDeletePaymentBenefit();
  const handleDelete = async () => {
    const confirmed = await prompt({
      title: "Eliminar beneficio",
      description: `¿Eliminar "${benefit.title}"? Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar"
    });
    if (!confirmed) return;
    await deleteMut.mutateAsync(benefit.id);
    ui.toast.success("Beneficio eliminado");
  };
  return /* @__PURE__ */ jsxRuntime.jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { variant: "transparent", size: "small", children: /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, {}) }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { children: [
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { onClick: () => navigate(`/payment-benefits/benefits/${benefit.id}`), children: [
        /* @__PURE__ */ jsxRuntime.jsx(icons.PencilSquare, { className: "mr-2" }),
        benefit.read_only ? "Ver / ajustar" : "Editar"
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { onClick: () => updateMut.mutate({ hidden: !benefit.hidden }), children: [
        benefit.hidden ? /* @__PURE__ */ jsxRuntime.jsx(icons.Eye, { className: "mr-2" }) : /* @__PURE__ */ jsxRuntime.jsx(icons.EyeSlash, { className: "mr-2" }),
        benefit.hidden ? "Mostrar" : "Ocultar"
      ] }),
      !benefit.read_only && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Separator, {}),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { onClick: handleDelete, children: [
          /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "mr-2" }),
          "Eliminar"
        ] })
      ] })
    ] })
  ] }) });
};
const BenefitsPage = () => {
  const navigate = reactRouterDom.useNavigate();
  const [pagination, setPagination] = react.useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE
  });
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = usePaymentBenefits({
    limit: String(pagination.pageSize),
    offset: String(offset)
  });
  const columns = react.useMemo(
    () => [
      columnHelper.accessor("title", {
        header: "Título",
        cell: ({ row, getValue }) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col", children: [
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium", children: getValue() }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-muted", children: row.original.provider_code })
        ] })
      }),
      columnHelper.accessor("benefit_type", {
        header: "Tipo",
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: TYPE_LABEL[getValue()] ?? getValue() })
      }),
      columnHelper.accessor("status", {
        header: "Estado",
        cell: ({ row }) => {
          const s = row.original.hidden ? "disabled" : row.original.status;
          return /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: STATUS_COLOR[s] ?? "grey", children: row.original.hidden ? "Oculto" : STATUS_LABEL[row.original.status] ?? row.original.status });
        }
      }),
      columnHelper.accessor("priority", {
        header: "Prioridad",
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", children: getValue() })
      }),
      columnHelper.accessor("source", {
        header: "Origen",
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: getValue() })
      }),
      columnHelper.accessor("valid_to", {
        header: "Vence",
        cell: ({ getValue }) => {
          const v = getValue();
          return /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: v ? new Date(v).toLocaleDateString("es-AR") : "—" });
        }
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => /* @__PURE__ */ jsxRuntime.jsx(RowActions, { benefit: row.original })
      })
    ],
    []
  );
  const benefits = (data == null ? void 0 : data.payment_benefits) ?? [];
  const count = (data == null ? void 0 : data.count) ?? 0;
  const table = ui.useDataTable({
    columns,
    data: benefits,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_e, row) => navigate(`/payment-benefits/benefits/${row.id}`)
  });
  return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "p-0", children: [
    /* @__PURE__ */ jsxRuntime.jsxs(ui.DataTable, { instance: table, children: [
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DataTable.Toolbar, { className: "flex items-center justify-between px-6 py-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-x-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: "Beneficios" }),
          /* @__PURE__ */ jsxRuntime.jsx(admin.ExtensionVersion, { extension: "payment-benefits" })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "secondary", onClick: () => navigate("/payment-benefits/benefits/new"), children: "Crear beneficio" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(admin.SiteScopeBar, { screen: "payment-benefits" }),
      count > 0 || isPending ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Table, {}),
        /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Pagination, {})
      ] }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-center border-t p-6 text-center", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Todavía no hay beneficios. Creá uno manual o sincronizá Mercado Pago desde el Dashboard." }) })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] }) });
};
const BenefitsIcon = () => /* @__PURE__ */ jsxRuntime.jsx(icons.CreditCard, {});
const config$2 = adminSdk.defineRouteConfig({
  label: "Beneficios",
  icon: BenefitsIcon
});
const handle$3 = {
  breadcrumb: () => "Beneficios"
};
const CredentialsPage = () => /* @__PURE__ */ jsxRuntime.jsx(reactRouterDom.Navigate, { to: "/settings/site-credentials#payment-benefits", replace: true });
const config$1 = adminSdk.defineRouteConfig({ label: "Credenciales", rank: 99 });
const handle$2 = { breadcrumb: () => "Credenciales" };
const config = adminSdk.defineRouteConfig({
  label: "Configuración",
  icon: icons.CogSixTooth
});
const handle$1 = {
  breadcrumb: () => "Configuración"
};
const Metric = ({
  label,
  value,
  tone
}) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1 rounded-lg border border-ui-border-base p-4", children: [
  /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: label }),
  /* @__PURE__ */ jsxRuntime.jsx(
    ui.Text,
    {
      className: tone === "danger" && Number(value) > 0 ? "text-ui-fg-error" : "",
      size: "xlarge",
      weight: "plus",
      children: value
    }
  )
] });
const SettingsPage = () => {
  const { data: dash, isPending } = usePaymentBenefitsDashboard();
  const { data: catalog } = usePaymentMethodCatalog();
  const syncMut = useSyncProvider();
  const methods = (catalog == null ? void 0 : catalog.payment_methods) ?? [];
  const handleSync = async () => {
    try {
      const { result } = await syncMut.mutateAsync("mercadopago");
      if (result.status === "ok") {
        ui.toast.success(`Sincronización OK: ${result.items_synced} ítems.`);
      } else {
        ui.toast.error(`Error de sincronización: ${result.message ?? "desconocido"}`);
      }
    } catch (e) {
      ui.toast.error(e instanceof Error ? e.message : "Error al sincronizar");
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(admin.SingleColumnLayout, { children: [
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "p-0", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between border-b border-ui-border-base px-6 py-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h2", children: "Beneficios de Pago" }),
          /* @__PURE__ */ jsxRuntime.jsx(admin.ExtensionVersion, { extension: "payment-benefits" })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(admin.HelpDrawer, { slug: "payment-benefits" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", onClick: handleSync, isLoading: syncMut.isPending, children: "Sincronizar Mercado Pago" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(admin.SiteScopeBar, { screen: "payment-benefits" }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4 border-b border-ui-border-base p-6 md:grid-cols-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx(Metric, { label: "Total", value: isPending ? "—" : (dash == null ? void 0 : dash.total) ?? 0 }),
        /* @__PURE__ */ jsxRuntime.jsx(Metric, { label: "Activos", value: isPending ? "—" : (dash == null ? void 0 : dash.active) ?? 0 }),
        /* @__PURE__ */ jsxRuntime.jsx(Metric, { label: "Próximos a vencer", value: isPending ? "—" : (dash == null ? void 0 : dash.expiring_soon) ?? 0 }),
        /* @__PURE__ */ jsxRuntime.jsx(Metric, { label: "Errores de sync", value: isPending ? "—" : (dash == null ? void 0 : dash.sync_errors) ?? 0, tone: "danger" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "border-b border-ui-border-base px-6 py-4", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: [
        "Última sincronización:",
        " ",
        (dash == null ? void 0 : dash.last_sync) ? `${dash.last_sync.provider_code} · ${dash.last_sync.status} · ${dash.last_sync.finished_at ? new Date(dash.last_sync.finished_at).toLocaleString("es-AR") : "—"}` : "sin registros"
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "border-b border-ui-border-base px-6 py-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h3", className: "mb-2", children: "Proveedores" }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-col gap-2", children: ((dash == null ? void 0 : dash.providers) ?? []).map((p) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { weight: "plus", children: p.code }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: p.supports_sync ? "green" : "grey", children: p.supports_sync ? "sync automático" : "manual" })
        ] }, p.code)) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "px-6 py-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h3", className: "mb-2", children: "Catálogo de medios de pago (sincronizado)" }),
        methods.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: "Sin datos. Sincronizá Mercado Pago con el botón de arriba." }) : /* @__PURE__ */ jsxRuntime.jsxs(ui.Table, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Header, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Medio" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Tipo" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Cuotas s/interés" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Estado" })
          ] }) }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Body, { children: methods.map((m) => /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
              m.thumbnail_url && /* @__PURE__ */ jsxRuntime.jsx("img", { src: m.thumbnail_url, alt: m.name, className: "h-5 w-auto" }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { children: m.name })
            ] }) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: m.payment_type_id ?? "—" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: m.max_interest_free_installments ?? "—" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: m.status ?? "—" })
          ] }, m.id)) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(
      admin.ExtensionSettingsCard,
      {
        namespace: "extension:payment-benefits",
        title: "Credenciales del sync",
        description: "El sync reutiliza el access token de MercadoPago del checkout. No se configura desde acá."
      }
    )
  ] });
};
const sdk = new Medusa__default.default({
  baseUrl: "/",
  auth: {
    type: "session"
  }
});
const TYPES = [
  { value: "installments", label: "Cuotas" },
  { value: "percentage_discount", label: "Descuento porcentual" },
  { value: "fixed_discount", label: "Descuento fijo" },
  { value: "refund", label: "Reintegro" },
  { value: "cashback", label: "Cashback" },
  { value: "custom", label: "Personalizado" }
];
const EMPTY = {
  title: "",
  description: "",
  benefit_type: "custom",
  provider_code: "manual",
  discount_value: "",
  max_installments: "",
  max_refund: "",
  minimum_amount: "",
  maximum_amount: "",
  priority: "0",
  status: "active",
  hidden: false,
  valid_from: "",
  valid_to: "",
  eligibility_scope: "global",
  eligibility_ids: "",
  sales_channel_ids: "",
  payment_method: "",
  card_brand: "",
  admin_notes: ""
};
const numOrNull = (s) => s.trim() === "" ? null : Number(s);
const listFromCsv = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);
const BenefitDetailPage = () => {
  const { id } = reactRouterDom.useParams();
  const navigate = reactRouterDom.useNavigate();
  const isNew = id === "new";
  const { data, isPending } = usePaymentBenefit(isNew ? "" : id);
  const benefit = data == null ? void 0 : data.payment_benefit;
  const readOnly = !!(benefit == null ? void 0 : benefit.read_only);
  const createMut = useCreatePaymentBenefit();
  const updateMut = useUpdatePaymentBenefit(id ?? "");
  const [form, setForm] = react.useState(EMPTY);
  react.useEffect(() => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    if (benefit) {
      setForm({
        title: benefit.title ?? "",
        description: benefit.description ?? "",
        benefit_type: benefit.benefit_type,
        provider_code: benefit.provider_code ?? "manual",
        discount_value: ((_a = benefit.discount_value) == null ? void 0 : _a.toString()) ?? "",
        max_installments: ((_b = benefit.max_installments) == null ? void 0 : _b.toString()) ?? "",
        max_refund: ((_c = benefit.max_refund) == null ? void 0 : _c.toString()) ?? "",
        minimum_amount: ((_d = benefit.minimum_amount) == null ? void 0 : _d.toString()) ?? "",
        maximum_amount: ((_e = benefit.maximum_amount) == null ? void 0 : _e.toString()) ?? "",
        priority: ((_f = benefit.priority) == null ? void 0 : _f.toString()) ?? "0",
        status: benefit.status,
        hidden: benefit.hidden,
        valid_from: benefit.valid_from ? benefit.valid_from.slice(0, 10) : "",
        valid_to: benefit.valid_to ? benefit.valid_to.slice(0, 10) : "",
        eligibility_scope: ((_g = benefit.eligibility) == null ? void 0 : _g.scope) ?? "global",
        eligibility_ids: (((_h = benefit.eligibility) == null ? void 0 : _h.ids) ?? []).join(", "),
        sales_channel_ids: (benefit.sales_channel_ids ?? []).join(", "),
        payment_method: ((_i = benefit.conditions) == null ? void 0 : _i.payment_method) ?? "",
        card_brand: ((_j = benefit.conditions) == null ? void 0 : _j.card_brand) ?? "",
        admin_notes: benefit.admin_notes ?? ""
      });
    }
  }, [benefit]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const buildPayload = () => {
    const always = {
      priority: Number(form.priority) || 0,
      hidden: form.hidden,
      status: form.status,
      sales_channel_ids: listFromCsv(form.sales_channel_ids),
      admin_notes: form.admin_notes || null
    };
    if (readOnly) return always;
    return {
      ...always,
      title: form.title,
      description: form.description || null,
      benefit_type: form.benefit_type,
      provider_code: form.provider_code,
      discount_value: numOrNull(form.discount_value),
      max_installments: numOrNull(form.max_installments),
      max_refund: numOrNull(form.max_refund),
      minimum_amount: numOrNull(form.minimum_amount),
      maximum_amount: numOrNull(form.maximum_amount),
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      eligibility: {
        scope: form.eligibility_scope,
        ids: listFromCsv(form.eligibility_ids)
      },
      conditions: {
        payment_method: form.payment_method || null,
        card_brand: form.card_brand || null
      }
    };
  };
  const handleSave = async () => {
    try {
      if (isNew) {
        if (!form.title.trim()) {
          ui.toast.error("El título es obligatorio");
          return;
        }
        await createMut.mutateAsync(buildPayload());
        ui.toast.success("Beneficio creado");
      } else {
        await updateMut.mutateAsync(buildPayload());
        ui.toast.success("Beneficio actualizado");
      }
      navigate("/payment-benefits/benefits");
    } catch (e) {
      ui.toast.error(e instanceof Error ? e.message : "Error al guardar");
    }
  };
  const saving = createMut.isPending || updateMut.isPending;
  const disabledOfficial = readOnly;
  const heading = react.useMemo(() => {
    if (isNew) return "Nuevo beneficio";
    return (benefit == null ? void 0 : benefit.title) ?? "Beneficio";
  }, [isNew, benefit]);
  if (!isNew && isPending) {
    return /* @__PURE__ */ jsxRuntime.jsx(ui.Container, { className: "p-6", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Cargando…" }) });
  }
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "divide-y p-0", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h2", children: heading }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "secondary", onClick: () => navigate("/payment-benefits/benefits"), children: "Cancelar" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", onClick: handleSave, isLoading: saving, children: "Guardar" })
      ] })
    ] }),
    readOnly && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-3", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { size: "small", className: "text-ui-fg-muted", children: [
      "Beneficio sincronizado (",
      benefit == null ? void 0 : benefit.source,
      "). Los datos oficiales son de solo lectura; podés ajustar visibilidad, prioridad, canales y notas."
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-1 gap-4 p-6 md:grid-cols-2", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1 md:col-span-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Título" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.title, onChange: (e) => set("title", e.target.value), disabled: disabledOfficial })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1 md:col-span-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Descripción" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Textarea, { value: form.description, onChange: (e) => set("description", e.target.value), disabled: disabledOfficial })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Tipo" }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.benefit_type, onValueChange: (v) => set("benefit_type", v), disabled: disabledOfficial, children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { children: TYPES.map((t) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: t.value, children: t.label }, t.value)) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Proveedor" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.provider_code, onChange: (e) => set("provider_code", e.target.value), disabled: disabledOfficial })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Valor del descuento" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.discount_value, onChange: (e) => set("discount_value", e.target.value), disabled: disabledOfficial })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Cuotas" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.max_installments, onChange: (e) => set("max_installments", e.target.value), disabled: disabledOfficial })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Reintegro máx." }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.max_refund, onChange: (e) => set("max_refund", e.target.value), disabled: disabledOfficial })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Monto mínimo" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.minimum_amount, onChange: (e) => set("minimum_amount", e.target.value), disabled: disabledOfficial })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Monto máximo" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.maximum_amount, onChange: (e) => set("maximum_amount", e.target.value), disabled: disabledOfficial })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Vigencia desde" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "date", value: form.valid_from, onChange: (e) => set("valid_from", e.target.value), disabled: disabledOfficial })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Vigencia hasta" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "date", value: form.valid_to, onChange: (e) => set("valid_to", e.target.value), disabled: disabledOfficial })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Aplicabilidad" }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.eligibility_scope, onValueChange: (v) => set("eligibility_scope", v), disabled: disabledOfficial, children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "global", children: "Global" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "collection", children: "Colección" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "category", children: "Categoría" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "brand", children: "Marca" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "product", children: "Producto" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "IDs de aplicabilidad (coma)" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.eligibility_ids, onChange: (e) => set("eligibility_ids", e.target.value), disabled: disabledOfficial, placeholder: "prod_..., pcat_..." })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Medio de pago (condición)" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.payment_method, onChange: (e) => set("payment_method", e.target.value), disabled: disabledOfficial, placeholder: "visa, master, ..." })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Marca de tarjeta (condición)" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.card_brand, onChange: (e) => set("card_brand", e.target.value), disabled: disabledOfficial })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-1 gap-4 p-6 md:grid-cols-2", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Prioridad" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.priority, onChange: (e) => set("priority", e.target.value) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Estado" }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.status, onValueChange: (v) => set("status", v), children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "active", children: "Activo" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "draft", children: "Borrador" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "disabled", children: "Deshabilitado" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1 md:col-span-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Sales channels (coma, vacío = todos)" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.sales_channel_ids, onChange: (e) => set("sales_channel_ids", e.target.value), placeholder: "sc_..." })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Switch, { checked: form.hidden, onCheckedChange: (v) => set("hidden", v) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Oculto" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1 md:col-span-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Notas (internas)" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Textarea, { value: form.admin_notes, onChange: (e) => set("admin_notes", e.target.value) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] });
};
async function loader({ params }) {
  const id = params.id ?? "";
  if (id === "new") return { breadcrumb: "Nuevo beneficio" };
  try {
    const { payment_benefit } = await sdk.client.fetch(
      `/admin/payment-benefits/${id}`,
      { method: "GET" }
    );
    return { breadcrumb: (payment_benefit == null ? void 0 : payment_benefit.title) ?? id };
  } catch {
    return { breadcrumb: id };
  }
}
const handle = {
  breadcrumb: ({ data }) => (data == null ? void 0 : data.breadcrumb) ?? ""
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: PaymentBenefitsIndex,
      path: "/payment-benefits",
      handle: { label: config$3.label, translationNs: config$3.translationNs, ...handle$4 }
    },
    {
      Component: BenefitsPage,
      path: "/payment-benefits/benefits",
      handle: { label: config$2.label, translationNs: config$2.translationNs, ...handle$3 }
    },
    {
      Component: CredentialsPage,
      path: "/payment-benefits/credenciales",
      handle: { label: config$1.label, translationNs: config$1.translationNs, ...handle$2 }
    },
    {
      Component: SettingsPage,
      path: "/payment-benefits/settings",
      handle: { label: config.label, translationNs: config.translationNs, ...handle$1 }
    },
    {
      Component: BenefitDetailPage,
      path: "/payment-benefits/benefits/:id",
      handle,
      loader
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config$3.label,
      icon: config$3.icon,
      path: "/payment-benefits",
      nested: void 0,
      rank: 44,
      translationNs: void 0
    },
    {
      label: config$2.label,
      icon: config$2.icon,
      path: "/payment-benefits/benefits",
      nested: void 0,
      rank: void 0,
      translationNs: void 0
    },
    {
      label: config$1.label,
      icon: void 0,
      path: "/payment-benefits/credenciales",
      nested: void 0,
      rank: 99,
      translationNs: void 0
    },
    {
      label: config.label,
      icon: config.icon,
      path: "/payment-benefits/settings",
      nested: void 0,
      rank: void 0,
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
