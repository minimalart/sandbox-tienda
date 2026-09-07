import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { SparklesSolid, ChevronLeftMini, ChevronRightMini } from "@medusajs/icons";
import { createDataTableColumnHelper, StatusBadge, useDataTable, Container, DataTable, Heading, Button, Text, FocusModal, ProgressTabs, Label, Input, Textarea, Checkbox, toast, Drawer, Table, Badge } from "@medusajs/ui";
import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Medusa from "@medusajs/js-sdk";
import "@medusajs/admin-shared";
const sdk = new Medusa({
  baseUrl: "/",
  auth: {
    type: "session"
  }
});
const queryKeysFactory = (globalKey) => {
  const queryKeyFactory = {
    all: [globalKey],
    lists: () => [...queryKeyFactory.all, "list"],
    list: (query) => [...queryKeyFactory.lists(), { query }],
    details: () => [...queryKeyFactory.all, "detail"],
    detail: (id, query) => [
      ...queryKeyFactory.details(),
      id,
      { query }
    ]
  };
  return queryKeyFactory;
};
function toQueryString(query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === void 0 || value === null || value === "") continue;
    params.append(key, String(value));
  }
  return params.toString();
}
const catalogadorQueryKey = queryKeysFactory("catalogador");
const useExecutions = (query) => {
  const qs = toQueryString(query);
  return useQuery({
    queryKey: catalogadorQueryKey.list(query),
    queryFn: () => sdk.client.fetch(`/admin/catalogador/executions${qs ? `?${qs}` : ""}`, {
      method: "GET"
    })
  });
};
const useExecution = (id, enabled = true) => useQuery({
  queryKey: catalogadorQueryKey.detail(id),
  enabled: Boolean(id) && enabled,
  queryFn: () => sdk.client.fetch(`/admin/catalogador/executions/${id}`, { method: "GET" })
});
const useCreateExecution = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => sdk.client.fetch("/admin/catalogador/executions", {
      method: "POST",
      body
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogadorQueryKey.lists() })
  });
};
function useExecutionAction(action) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => sdk.client.fetch(
      `/admin/catalogador/executions/${id}/${action}`,
      { method: "POST", body: body ?? {} }
    ),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: catalogadorQueryKey.lists() });
      qc.invalidateQueries({ queryKey: catalogadorQueryKey.detail(vars.id) });
    }
  });
}
const useGenerateExecution = () => useExecutionAction("generate");
const useApplyExecution = () => useExecutionAction("apply");
const useCancelExecution = () => useExecutionAction("cancel");
const useDuplicateExecution = () => useExecutionAction("duplicate");
const useRefloatExecution = () => useExecutionAction("refloat");
const useRestoreExecution = () => useExecutionAction("restore");
const useReviewProduct = (executionId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pid, body }) => sdk.client.fetch(
      `/admin/catalogador/executions/${executionId}/products/${pid}`,
      { method: "POST", body }
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogadorQueryKey.detail(executionId) })
  });
};
const useReviewAsset = (executionId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ aid, decision }) => sdk.client.fetch(`/admin/catalogador/executions/${executionId}/assets/${aid}`, {
      method: "POST",
      body: { decision }
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogadorQueryKey.detail(executionId) })
  });
};
const useUpdateComposition = (executionId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ aid, composition }) => sdk.client.fetch(
      `/admin/catalogador/executions/${executionId}/assets/${aid}/composition`,
      { method: "PATCH", body: composition }
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogadorQueryKey.detail(executionId) })
  });
};
const useAdminProducts = (query) => {
  const qs = toQueryString({ ...query, fields: "id,title,thumbnail,status,*collection,variants.id" });
  return useQuery({
    queryKey: [...catalogadorQueryKey.all, "products", query],
    queryFn: () => sdk.client.fetch(`/admin/products${qs ? `?${qs}` : ""}`, { method: "GET" })
  });
};
const useAdminCategories = () => useQuery({
  queryKey: [...catalogadorQueryKey.all, "product-categories"],
  queryFn: () => sdk.client.fetch(
    "/admin/product-categories?limit=500&fields=id,name",
    { method: "GET" }
  )
});
const useAdminCollections = () => useQuery({
  queryKey: [...catalogadorQueryKey.all, "collections"],
  queryFn: () => sdk.client.fetch(
    "/admin/collections?limit=500&fields=id,title",
    { method: "GET" }
  )
});
const useAdminTags = () => useQuery({
  queryKey: [...catalogadorQueryKey.all, "product-tags"],
  queryFn: () => sdk.client.fetch(
    "/admin/product-tags?limit=500&fields=id,value",
    { method: "GET" }
  )
});
const useCatalogadorConfig = () => useQuery({
  queryKey: [...catalogadorQueryKey.all, "config"],
  queryFn: () => sdk.client.fetch("/admin/catalogador/config", { method: "GET" })
});
const useUpdateCatalogadorConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => sdk.client.fetch("/admin/catalogador/config", {
      method: "POST",
      body
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...catalogadorQueryKey.all, "config"] })
  });
};
const CATALOGADOR_NAMESPACE = "catalogador";
let registered = false;
const en = {
  TITLE: "Catalogador",
  DESCRIPTION: "Bulk-improve existing products with AI. The AI proposes, you decide.",
  NEW_EXECUTION: "New execution",
  CONFIG: "Settings",
  EMPTY_STATE: "No executions yet. Create one to start improving your catalog.",
  COLUMN_NAME: "Name",
  COLUMN_STATUS: "Status",
  COLUMN_PRODUCTS: "Products",
  COLUMN_PROGRESS: "Progress",
  COLUMN_ERRORS: "Errors",
  COLUMN_DATE: "Date",
  STEP_SELECT: "Select products",
  STEP_IMPROVE: "Choose improvements",
  STEP_GENERATE: "Generate & validate"
};
const es = {
  TITLE: "Catalogador",
  DESCRIPTION: "Mejorá masivamente productos existentes con IA. La IA propone, vos decidís.",
  NEW_EXECUTION: "Nueva ejecución",
  CONFIG: "Configuración",
  EMPTY_STATE: "Todavía no hay ejecuciones. Creá una para empezar a mejorar tu catálogo.",
  COLUMN_NAME: "Nombre",
  COLUMN_STATUS: "Estado",
  COLUMN_PRODUCTS: "Productos",
  COLUMN_PROGRESS: "Progreso",
  COLUMN_ERRORS: "Errores",
  COLUMN_DATE: "Fecha",
  STEP_SELECT: "Seleccionar productos",
  STEP_IMPROVE: "Elegir mejoras",
  STEP_GENERATE: "Generar y validar"
};
function registerCatalogadorTranslations(i18n) {
  if (registered) return;
  i18n.addResourceBundle("en", CATALOGADOR_NAMESPACE, en, true, true);
  i18n.addResourceBundle("es", CATALOGADOR_NAMESPACE, es, true, true);
  registered = true;
}
const handle$3 = { breadcrumb: () => "Catalogador" };
const PAGE_SIZE$1 = 20;
const columnHelper$1 = createDataTableColumnHelper();
const STATUS_COLOR = {
  draft: "grey",
  generating: "blue",
  pending_review: "orange",
  partially_reviewed: "orange",
  ready_to_apply: "purple",
  applying: "blue",
  applied: "green",
  partially_applied: "orange",
  error: "red",
  cancelled: "grey",
  restored: "purple"
};
const STATUS_LABEL = {
  draft: "Borrador",
  generating: "Generando",
  pending_review: "Pendiente de revisión",
  partially_reviewed: "Parcialmente revisada",
  ready_to_apply: "Lista para aplicar",
  applying: "Aplicando",
  applied: "Aplicada",
  partially_applied: "Aplicada parcialmente",
  error: "Error",
  cancelled: "Cancelada",
  restored: "Restaurada"
};
const Catalogador = () => {
  const { i18n } = useTranslation("catalogador");
  registerCatalogadorTranslations(i18n);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE$1 });
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useExecutions({
    limit: pagination.pageSize,
    offset,
    q: search || void 0
  });
  const executions = (data == null ? void 0 : data.executions) ?? [];
  const count = (data == null ? void 0 : data.count) ?? 0;
  const columns = useMemo(
    () => [
      columnHelper$1.accessor("name", {
        header: "Nombre",
        cell: ({ getValue }) => /* @__PURE__ */ jsx("span", { className: "font-medium", children: getValue() })
      }),
      columnHelper$1.accessor("status", {
        header: "Estado",
        cell: ({ getValue }) => {
          const s = getValue();
          return /* @__PURE__ */ jsx(StatusBadge, { color: STATUS_COLOR[s] ?? "grey", children: STATUS_LABEL[s] ?? s });
        }
      }),
      columnHelper$1.accessor("selection_count", {
        header: "Productos",
        cell: ({ getValue }) => /* @__PURE__ */ jsx("span", { className: "text-ui-fg-subtle", children: getValue() })
      }),
      columnHelper$1.display({
        id: "progress",
        header: "Progreso",
        cell: ({ row }) => {
          const p = row.original.progress;
          if (!p || p.total === 0) return /* @__PURE__ */ jsx("span", { className: "text-ui-fg-muted", children: "—" });
          return /* @__PURE__ */ jsxs("span", { className: "text-ui-fg-subtle", children: [
            p.processed,
            "/",
            p.total,
            " (",
            p.percent,
            "%)"
          ] });
        }
      }),
      columnHelper$1.display({
        id: "errors",
        header: "Errores",
        cell: ({ row }) => {
          var _a;
          const failed = ((_a = row.original.progress) == null ? void 0 : _a.failed) ?? 0;
          return failed > 0 ? /* @__PURE__ */ jsx(StatusBadge, { color: "red", children: failed }) : /* @__PURE__ */ jsx("span", { className: "text-ui-fg-muted", children: "0" });
        }
      }),
      columnHelper$1.display({
        id: "ai_cost",
        header: "Costo IA",
        cell: ({ row }) => {
          var _a;
          const cost = row.original.ai_cost_usd ?? 0;
          if (!cost) return /* @__PURE__ */ jsx("span", { className: "text-ui-fg-muted", children: "—" });
          return /* @__PURE__ */ jsxs("span", { className: "text-ui-fg-subtle", children: [
            "US$ ",
            cost.toFixed(cost < 1e-4 ? 6 : 4),
            ((_a = row.original.ai_usage) == null ? void 0 : _a.missing_cost) ? "+" : ""
          ] });
        }
      }),
      columnHelper$1.accessor("created_at", {
        header: "Fecha",
        cell: ({ getValue }) => /* @__PURE__ */ jsx("span", { className: "text-ui-fg-subtle", children: new Date(getValue()).toLocaleDateString() })
      })
    ],
    []
  );
  const table = useDataTable({
    columns,
    data: executions,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: setSearch },
    onRowClick: (_e, row) => navigate(`/catalogador/${row.id}`)
  });
  return /* @__PURE__ */ jsx(Container, { className: "divide-y p-0", children: /* @__PURE__ */ jsxs(DataTable, { instance: table, children: [
    /* @__PURE__ */ jsxs(DataTable.Toolbar, { className: "flex flex-col items-start justify-between gap-2 md:flex-row md:items-center", children: [
      /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: /* @__PURE__ */ jsx(Heading, { children: "Catalogador" }) }) }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(DataTable.Search, { placeholder: "Buscar ejecuciones" }),
        /* @__PURE__ */ jsx(Button, { variant: "primary", size: "small", onClick: () => navigate("/catalogador/new"), children: "Nueva ejecución" })
      ] })
    ] }),
    count === 0 && !isPending ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center gap-2 py-12", children: [
      /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Todavía no hay ejecuciones. Creá una para empezar a mejorar tu catálogo." }),
      /* @__PURE__ */ jsx(Button, { variant: "secondary", size: "small", onClick: () => navigate("/catalogador/new"), children: "Nueva ejecución" })
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(DataTable.Table, {}),
      /* @__PURE__ */ jsx(DataTable.Pagination, {})
    ] })
  ] }) });
};
const config$1 = defineRouteConfig({
  label: "Catalogador",
  icon: SparklesSolid
});
const handle$2 = { breadcrumb: () => "Nueva ejecución" };
const TEXT_FIELDS = [
  { field: "subtitle", label: "Subtítulo" },
  { field: "description", label: "Descripción" },
  { field: "meta_title", label: "Meta title (SEO)" },
  { field: "meta_description", label: "Meta description (SEO)" },
  { field: "keywords", label: "Keywords (SEO)" },
  { field: "categories", label: "Categorías (existentes)" },
  { field: "tags", label: "Tags (existentes)" },
  { field: "alt_text", label: "Texto alternativo de imagen" }
];
const IMAGE_TECH = [
  { field: "to_webp", label: "Convertir a WebP" },
  { field: "compress", label: "Comprimir" },
  { field: "resize", label: "Redimensionar" },
  { field: "normalize", label: "Normalizar (cuadrado fondo blanco)" }
];
const IMAGE_AI = [
  { field: "recreate", label: "Recrear imagen (fondo blanco)" },
  { field: "lifestyle", label: "Generar imagen lifestyle" },
  { field: "generate_missing", label: "Generar imagen faltante" },
  { field: "variation", label: "Variaciones de una imagen" }
];
const IMAGE_AI_EDITABLE = { field: "lifestyle_editable", label: "Lifestyle editable" };
const PAGE_SIZE = 20;
const columnHelper = createDataTableColumnHelper();
const allOf = (items) => new Set(items.map((i) => i.field));
const TABS = [
  { id: "details", label: "Detalles" },
  { id: "products", label: "Productos" },
  { id: "improvements", label: "Mejoras" }
];
const NewExecution = () => {
  var _a, _b;
  const navigate = useNavigate();
  const createExecution = useCreateExecution();
  const generate = useGenerateExecution();
  const [tab, setTab] = useState("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [tagId, setTagId] = useState("");
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [rowSelection, setRowSelection] = useState({});
  const { data: catData } = useAdminCategories();
  const { data: colData } = useAdminCollections();
  const { data: tagData } = useAdminTags();
  const { data: cfgData } = useCatalogadorConfig();
  const editableLifestyleEnabled = (((_b = (_a = cfgData == null ? void 0 : cfgData.config) == null ? void 0 : _a.image_ai) == null ? void 0 : _b.editable_lifestyle_enabled) ?? true) !== false;
  const imageAiItems = useMemo(
    () => editableLifestyleEnabled ? [...IMAGE_AI, IMAGE_AI_EDITABLE] : IMAGE_AI,
    [editableLifestyleEnabled]
  );
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data: prodData, isPending: prodLoading } = useAdminProducts({
    limit: pagination.pageSize,
    offset,
    q: search || void 0,
    category_id: categoryId || void 0,
    collection_id: collectionId || void 0,
    tag_id: tagId || void 0
  });
  const products = (prodData == null ? void 0 : prodData.products) ?? [];
  const productCount = (prodData == null ? void 0 : prodData.count) ?? 0;
  const [textFields, setTextFields] = useState(() => allOf(TEXT_FIELDS));
  const [techOps, setTechOps] = useState(() => allOf(IMAGE_TECH));
  const [aiOps, setAiOps] = useState(() => allOf(IMAGE_AI));
  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const totalOps = textFields.size + techOps.size + aiOps.size;
  const columns = useMemo(
    () => [
      columnHelper.select(),
      columnHelper.accessor("title", {
        header: "Producto",
        cell: ({ row }) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
          row.original.thumbnail ? /* @__PURE__ */ jsx("img", { src: row.original.thumbnail, alt: "", className: "h-8 w-8 rounded object-cover" }) : /* @__PURE__ */ jsx("div", { className: "h-8 w-8 rounded bg-ui-bg-subtle" }),
          /* @__PURE__ */ jsx("span", { className: "font-medium", children: row.original.title })
        ] })
      }),
      columnHelper.accessor("status", {
        header: "Estado",
        cell: ({ getValue }) => /* @__PURE__ */ jsx(StatusBadge, { color: getValue() === "published" ? "green" : "grey", children: getValue() })
      })
    ],
    []
  );
  const table = useDataTable({
    columns,
    data: products,
    getRowId: (row) => row.id,
    rowCount: productCount,
    isLoading: prodLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: { state: search, onSearchChange: setSearch },
    rowSelection: { state: rowSelection, onRowSelectionChange: setRowSelection }
  });
  const toggleSet = (set, setter, field) => {
    const next = new Set(set);
    next.has(field) ? next.delete(field) : next.add(field);
    setter(next);
  };
  const close = () => navigate("/catalogador");
  const create = async (generateNow) => {
    const operations = [
      ...[...textFields].map((field) => ({ type: "text_field", field })),
      ...[...techOps].map((field) => ({ type: "image_technical", field })),
      ...[...aiOps].map((field) => ({ type: "image_ai", field }))
    ];
    try {
      const { execution } = await createExecution.mutateAsync({
        name: name.trim() || `Ejecución ${(/* @__PURE__ */ new Date()).toLocaleString()}`,
        product_ids: selectedIds,
        operations,
        selection_definition: {
          q: search || void 0,
          category_id: categoryId || void 0,
          collection_id: collectionId || void 0,
          tag_id: tagId || void 0,
          description: description || void 0
        }
      });
      if (generateNow) await generate.mutateAsync({ id: execution.id });
      toast.success(generateNow ? "Ejecución creada y generación iniciada" : "Borrador guardado");
      navigate(`/catalogador/${execution.id}`);
    } catch (e) {
      toast.error(`No se pudo crear: ${e instanceof Error ? e.message : "error"}`);
    }
  };
  const detailsStatus = tab === "details" ? "in-progress" : name.trim() ? "completed" : "not-started";
  const productsStatus = tab === "products" ? "in-progress" : selectedIds.length ? "completed" : "not-started";
  const improvementsStatus = tab === "improvements" ? "in-progress" : "not-started";
  const statusFor = (id) => id === "details" ? detailsStatus : id === "products" ? productsStatus : improvementsStatus;
  const onFilterChange = (setter) => (e) => {
    setter(e.target.value);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };
  return /* @__PURE__ */ jsx(FocusModal, { open: true, onOpenChange: (o) => !o && close(), children: /* @__PURE__ */ jsxs(FocusModal.Content, { children: [
    /* @__PURE__ */ jsxs(FocusModal.Header, { className: "flex shrink-0 items-center gap-4", children: [
      /* @__PURE__ */ jsx(FocusModal.Title, { asChild: true, children: /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Crear ejecución" }) }),
      /* @__PURE__ */ jsx(ProgressTabs, { value: tab, onValueChange: (v) => setTab(v), className: "w-full min-w-0", children: /* @__PURE__ */ jsx("div", { className: "-my-2 w-full border-l", children: /* @__PURE__ */ jsx(ProgressTabs.List, { children: TABS.map((t) => /* @__PURE__ */ jsx(ProgressTabs.Trigger, { value: t.id, status: statusFor(t.id), children: t.label }, t.id)) }) }) })
    ] }),
    /* @__PURE__ */ jsxs(FocusModal.Body, { className: "min-h-0 min-w-0 flex-1 overflow-hidden p-0", children: [
      tab === "details" && /* @__PURE__ */ jsx("div", { className: "h-full min-h-0 w-full overflow-y-auto", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto flex w-full max-w-[640px] flex-col gap-8 px-8 py-10", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Heading, { children: "Crear ejecución" }),
          /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: "Dale un nombre a esta ejecución de enriquecimiento." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx(Label, { size: "small", children: "Título *" }),
          /* @__PURE__ */ jsx(Input, { value: name, onChange: (e) => setName(e.target.value), placeholder: "Ej: Completar descripciones faltantes" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx(Label, { size: "small", children: "Descripción" }),
          /* @__PURE__ */ jsx(Textarea, { value: description, onChange: (e) => setDescription(e.target.value), rows: 3, placeholder: "Opcional" })
        ] })
      ] }) }),
      tab === "products" && /* @__PURE__ */ jsx("div", { className: "flex h-full min-h-0 w-full flex-col overflow-hidden", children: /* @__PURE__ */ jsxs(DataTable, { instance: table, className: "h-full min-h-0", children: [
        /* @__PURE__ */ jsxs(DataTable.Toolbar, { className: "flex shrink-0 flex-wrap items-center gap-2 px-6 py-3", children: [
          /* @__PURE__ */ jsx(FilterSelect, { label: "Categoría", value: categoryId, onChange: onFilterChange(setCategoryId), options: ((catData == null ? void 0 : catData.product_categories) ?? []).map((c) => ({ value: c.id, label: c.name })) }),
          /* @__PURE__ */ jsx(FilterSelect, { label: "Colección", value: collectionId, onChange: onFilterChange(setCollectionId), options: ((colData == null ? void 0 : colData.collections) ?? []).map((c) => ({ value: c.id, label: c.title })) }),
          /* @__PURE__ */ jsx(FilterSelect, { label: "Etiqueta", value: tagId, onChange: onFilterChange(setTagId), options: ((tagData == null ? void 0 : tagData.product_tags) ?? []).map((t) => ({ value: t.id, label: t.value })) }),
          /* @__PURE__ */ jsxs("span", { className: "text-ui-fg-subtle text-sm", children: [
            selectedIds.length,
            " sel. · ",
            productCount
          ] }),
          /* @__PURE__ */ jsx("div", { className: "ml-auto", children: /* @__PURE__ */ jsx(DataTable.Search, { placeholder: "Buscar productos" }) })
        ] }),
        /* @__PURE__ */ jsx(DataTable.Table, {}),
        /* @__PURE__ */ jsx(DataTable.Pagination, {})
      ] }) }),
      tab === "improvements" && /* @__PURE__ */ jsx("div", { className: "h-full min-h-0 w-full overflow-y-auto", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto flex w-full max-w-[720px] flex-col gap-6 px-8 py-10", children: [
        /* @__PURE__ */ jsx(OpsGroup, { title: "Contenido y catalogación (IA)", items: TEXT_FIELDS, set: textFields, setAll: () => setTextFields(allOf(TEXT_FIELDS)), setNone: () => setTextFields(/* @__PURE__ */ new Set()), onToggle: (f) => toggleSet(textFields, setTextFields, f) }),
        /* @__PURE__ */ jsx(OpsGroup, { title: "Procesamiento técnico de imágenes", items: IMAGE_TECH, set: techOps, setAll: () => setTechOps(allOf(IMAGE_TECH)), setNone: () => setTechOps(/* @__PURE__ */ new Set()), onToggle: (f) => toggleSet(techOps, setTechOps, f) }),
        /* @__PURE__ */ jsx(OpsGroup, { title: "Generación de imágenes (IA)", items: imageAiItems, set: aiOps, setAll: () => setAiOps(allOf(imageAiItems)), setNone: () => setAiOps(/* @__PURE__ */ new Set()), onToggle: (f) => toggleSet(aiOps, setAiOps, f) })
      ] }) })
    ] }),
    /* @__PURE__ */ jsx(FocusModal.Footer, { className: "shrink-0", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-x-2", children: [
      /* @__PURE__ */ jsx(Button, { variant: "secondary", size: "small", onClick: close, children: "Cancelar" }),
      tab === "details" && /* @__PURE__ */ jsx(Button, { size: "small", disabled: !name.trim(), onClick: () => setTab("products"), children: "Continuar" }),
      tab === "products" && /* @__PURE__ */ jsxs(Button, { size: "small", disabled: selectedIds.length === 0, onClick: () => setTab("improvements"), children: [
        "Continuar (",
        selectedIds.length,
        ")"
      ] }),
      tab === "improvements" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", disabled: totalOps === 0, isLoading: createExecution.isPending, onClick: () => create(false), children: "Guardar borrador" }),
        /* @__PURE__ */ jsx(Button, { size: "small", disabled: totalOps === 0 || selectedIds.length === 0, isLoading: createExecution.isPending, onClick: () => create(true), children: "Crear y generar" })
      ] })
    ] }) })
  ] }) });
};
const FilterSelect = ({
  label,
  value,
  onChange,
  options
}) => /* @__PURE__ */ jsxs("select", { className: "bg-ui-bg-field border-ui-border-base h-8 rounded-md border px-2 text-sm", value, onChange, children: [
  /* @__PURE__ */ jsxs("option", { value: "", children: [
    label,
    ": todas"
  ] }),
  options.map((o) => /* @__PURE__ */ jsx("option", { value: o.value, children: o.label }, o.value))
] });
const OpsGroup = ({
  title,
  items,
  set,
  onToggle,
  setAll,
  setNone
}) => /* @__PURE__ */ jsxs("div", { className: "rounded-lg border p-3", children: [
  /* @__PURE__ */ jsxs("div", { className: "mb-2 flex items-center justify-between", children: [
    /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", children: title }),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-1", children: [
      /* @__PURE__ */ jsx(Button, { size: "small", variant: "transparent", onClick: setAll, children: "Todos" }),
      /* @__PURE__ */ jsx(Button, { size: "small", variant: "transparent", onClick: setNone, children: "Ninguno" })
    ] })
  ] }),
  /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-2 md:grid-cols-2", children: items.map((it) => /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2", children: [
    /* @__PURE__ */ jsx(Checkbox, { checked: set.has(it.field), onCheckedChange: () => onToggle(it.field) }),
    /* @__PURE__ */ jsx("span", { className: "text-sm", children: it.label })
  ] }, it.field)) })
] });
const handle$1 = { breadcrumb: () => "Configuración" };
const CatalogadorConfigPage = () => {
  const { data, isPending } = useCatalogadorConfig();
  const update = useUpdateCatalogadorConfig();
  const [cfg, setCfg] = useState(null);
  useEffect(() => {
    if (data == null ? void 0 : data.config) setCfg(structuredClone(data.config));
  }, [data]);
  if (isPending || !cfg) {
    return /* @__PURE__ */ jsx(Container, { children: /* @__PURE__ */ jsx(Text, { children: "Cargando configuración…" }) });
  }
  const set = (path, value) => {
    setCfg((prev) => {
      const next = structuredClone(prev);
      let node = next;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = value;
      return next;
    });
  };
  const save = () => update.mutateAsync(cfg).then(() => toast.success("Configuración guardada")).catch((e) => toast.error(e instanceof Error ? e.message : "Error"));
  const t = cfg.text ?? {};
  const ia = cfg.image_ai ?? {};
  const it = cfg.image_technical ?? {};
  const ext = cfg.external ?? {};
  const rules = cfg.rules ?? {};
  const limits = cfg.limits ?? {};
  return /* @__PURE__ */ jsx("div", { className: "mx-auto flex w-full max-w-3xl flex-col gap-5 p-6", children: /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsx(Heading, { children: "Configuración del Catalogador" }),
      /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: /* @__PURE__ */ jsx(Button, { size: "small", onClick: save, isLoading: update.isPending, children: "Guardar" }) })
    ] }),
    /* @__PURE__ */ jsxs(Section, { title: "IA de texto", children: [
      /* @__PURE__ */ jsx(Field, { label: "Modelo", children: /* @__PURE__ */ jsx(Input, { value: t.model ?? "", onChange: (e) => set(["text", "model"], e.target.value) }) }),
      /* @__PURE__ */ jsx(Field, { label: "Idioma", children: /* @__PURE__ */ jsx(Input, { value: t.language ?? "", onChange: (e) => set(["text", "language"], e.target.value) }) }),
      /* @__PURE__ */ jsx(Field, { label: "Tono", children: /* @__PURE__ */ jsx(Input, { value: t.tone ?? "", onChange: (e) => set(["text", "tone"], e.target.value) }) }),
      /* @__PURE__ */ jsx(Field, { label: "Temperatura", children: /* @__PURE__ */ jsx(Input, { type: "number", step: "0.1", value: t.temperature ?? 0.7, onChange: (e) => set(["text", "temperature"], Number(e.target.value)) }) }),
      /* @__PURE__ */ jsx(Field, { label: "Máx. tokens", children: /* @__PURE__ */ jsx(Input, { type: "number", value: t.max_tokens ?? 1500, onChange: (e) => set(["text", "max_tokens"], Number(e.target.value)) }) }),
      /* @__PURE__ */ jsx(Field, { label: "Prompt base", full: true, children: /* @__PURE__ */ jsx(Textarea, { value: t.base_prompt ?? "", onChange: (e) => set(["text", "base_prompt"], e.target.value), rows: 3 }) })
    ] }),
    /* @__PURE__ */ jsxs(Section, { title: "IA de imágenes", children: [
      /* @__PURE__ */ jsx(Field, { label: "Modelo", children: /* @__PURE__ */ jsx(Input, { value: ia.model ?? "", onChange: (e) => set(["image_ai", "model"], e.target.value) }) }),
      /* @__PURE__ */ jsx(Field, { label: "Variaciones", children: /* @__PURE__ */ jsx(Input, { type: "number", value: ia.variations ?? 2, onChange: (e) => set(["image_ai", "variations"], Number(e.target.value)) }) }),
      /* @__PURE__ */ jsx(Field, { label: "Máx. imágenes/producto", children: /* @__PURE__ */ jsx(Input, { type: "number", value: ia.max_images_per_product ?? 4, onChange: (e) => set(["image_ai", "max_images_per_product"], Number(e.target.value)) }) }),
      /* @__PURE__ */ jsx(Field, { label: "Prompt lifestyle", full: true, children: /* @__PURE__ */ jsx(Textarea, { value: ia.lifestyle_prompt ?? "", onChange: (e) => set(["image_ai", "lifestyle_prompt"], e.target.value), rows: 2 }) }),
      /* @__PURE__ */ jsx(Field, { label: "Prompt recreación", full: true, children: /* @__PURE__ */ jsx(Textarea, { value: ia.recreate_prompt ?? "", onChange: (e) => set(["image_ai", "recreate_prompt"], e.target.value), rows: 2 }) }),
      /* @__PURE__ */ jsx(Toggle, { label: "Preservar producto/packaging", checked: ia.preserve_product, onChange: (v) => set(["image_ai", "preserve_product"], v) })
    ] }),
    /* @__PURE__ */ jsxs(Section, { title: "Procesamiento técnico de imágenes", children: [
      /* @__PURE__ */ jsx(Field, { label: "Calidad WebP (40-95)", children: /* @__PURE__ */ jsx(
        Input,
        {
          type: "number",
          step: 1,
          min: 40,
          max: 95,
          value: it.webp_quality ?? 82,
          onChange: (e) => set(["image_technical", "webp_quality"], Number(e.target.value))
        }
      ) }),
      /* @__PURE__ */ jsx(Field, { label: "Peso objetivo (KB)", children: /* @__PURE__ */ jsx(
        Input,
        {
          type: "number",
          step: 1,
          min: 1,
          max: 2e4,
          value: it.max_kb ?? 200,
          onChange: (e) => set(["image_technical", "max_kb"], Number(e.target.value))
        }
      ) }),
      /* @__PURE__ */ jsx(Field, { label: "Dimensión máx (px)", children: /* @__PURE__ */ jsx(
        Input,
        {
          type: "number",
          step: 1,
          min: 16,
          max: 8e3,
          value: it.max_dimension ?? 1600,
          onChange: (e) => set(["image_technical", "max_dimension"], Number(e.target.value))
        }
      ) }),
      /* @__PURE__ */ jsx(Field, { label: "Dimensión mín (px)", children: /* @__PURE__ */ jsx(
        Input,
        {
          type: "number",
          step: 1,
          min: 0,
          max: 8e3,
          value: it.min_dimension ?? 500,
          onChange: (e) => set(["image_technical", "min_dimension"], Number(e.target.value))
        }
      ) }),
      /* @__PURE__ */ jsx(Toggle, { label: "Conservar originales", checked: it.keep_originals, onChange: (v) => set(["image_technical", "keep_originals"], v) })
    ] }),
    /* @__PURE__ */ jsxs(Section, { title: "Enriquecimiento externo", children: [
      /* @__PURE__ */ jsx(Toggle, { label: "Habilitar consulta por barcode", checked: ext.barcode_enabled, onChange: (v) => set(["external", "barcode_enabled"], v) }),
      /* @__PURE__ */ jsx(Field, { label: "Proveedor de barcode (informativo)", full: true, children: /* @__PURE__ */ jsx(
        Input,
        {
          value: ext.barcode_provider ?? "",
          placeholder: "ej. UPCitemdb (el endpoint y la key se cargan más abajo)",
          onChange: (e) => set(["external", "barcode_provider"], e.target.value)
        }
      ) }),
      /* @__PURE__ */ jsx(Toggle, { label: "Habilitar scraping / búsqueda web", checked: ext.scraping_enabled, onChange: (v) => set(["external", "scraping_enabled"], v) }),
      /* @__PURE__ */ jsx(Field, { label: "Herramienta de scraping", children: /* @__PURE__ */ jsxs(
        "select",
        {
          className: "bg-ui-bg-field border-ui-border-base h-8 w-full rounded-md border px-2 text-sm",
          value: ext.scraping_provider ?? "tavily",
          onChange: (e) => set(["external", "scraping_provider"], e.target.value),
          children: [
            /* @__PURE__ */ jsx("option", { value: "tavily", children: "Tavily (búsqueda + extracción; requiere CATALOGADOR_TAVILY_API_KEY)" }),
            /* @__PURE__ */ jsx("option", { value: "http", children: "HTTP directo (template + anti-SSRF)" })
          ]
        }
      ) }),
      /* @__PURE__ */ jsx(Field, { label: "Dominios permitidos (coma)", full: true, children: /* @__PURE__ */ jsx(
        Input,
        {
          value: (ext.allowed_domains ?? []).join(", "),
          onChange: (e) => set(["external", "allowed_domains"], e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
        }
      ) }),
      /* @__PURE__ */ jsx(Field, { label: "Dominios bloqueados (coma)", full: true, children: /* @__PURE__ */ jsx(
        Input,
        {
          value: (ext.blocked_domains ?? []).join(", "),
          onChange: (e) => set(["external", "blocked_domains"], e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
        }
      ) }),
      /* @__PURE__ */ jsx(Field, { label: "Timeout (ms)", children: /* @__PURE__ */ jsx(Input, { type: "number", value: ext.timeout_ms ?? 8e3, onChange: (e) => set(["external", "timeout_ms"], Number(e.target.value)) }) }),
      /* @__PURE__ */ jsx(Field, { label: "Máx. páginas/producto", children: /* @__PURE__ */ jsx(Input, { type: "number", value: ext.max_pages_per_product ?? 3, onChange: (e) => set(["external", "max_pages_per_product"], Number(e.target.value)) }) })
    ] }),
    /* @__PURE__ */ jsxs(Section, { title: "Reglas de catálogo", children: [
      /* @__PURE__ */ jsx(Toggle, { label: "No sobrescribir campos manuales", checked: rules.do_not_overwrite_manual, onChange: (v) => set(["rules", "do_not_overwrite_manual"], v) }),
      /* @__PURE__ */ jsx(Toggle, { label: "Sólo completar campos vacíos", checked: rules.only_fill_empty, onChange: (v) => set(["rules", "only_fill_empty"], v) }),
      /* @__PURE__ */ jsx(Toggle, { label: "Permitir mejorar existentes", checked: rules.allow_improve_existing, onChange: (v) => set(["rules", "allow_improve_existing"], v) }),
      /* @__PURE__ */ jsx(Toggle, { label: "No reemplazar imagen principal automáticamente", checked: rules.no_auto_replace_main_image, onChange: (v) => set(["rules", "no_auto_replace_main_image"], v) }),
      /* @__PURE__ */ jsx(Toggle, { label: "Crear snapshot antes de aplicar", checked: rules.snapshot_before_apply, onChange: (v) => set(["rules", "snapshot_before_apply"], v) }),
      /* @__PURE__ */ jsx(Toggle, { label: "Exigir revisión de campos con baja confianza", checked: rules.require_review_low_confidence, onChange: (v) => set(["rules", "require_review_low_confidence"], v) }),
      /* @__PURE__ */ jsx(Field, { label: "Umbral de baja confianza (0-1)", children: /* @__PURE__ */ jsx(
        Input,
        {
          type: "number",
          step: "0.05",
          min: 0,
          max: 1,
          value: rules.low_confidence_threshold ?? 0.7,
          onChange: (e) => set(["rules", "low_confidence_threshold"], Number(e.target.value))
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxs(Section, { title: "Límites operativos", children: [
      /* @__PURE__ */ jsx(Field, { label: "Máx. productos/ejecución", children: /* @__PURE__ */ jsx(Input, { type: "number", value: limits.max_products_per_execution ?? 500, onChange: (e) => set(["limits", "max_products_per_execution"], Number(e.target.value)) }) }),
      /* @__PURE__ */ jsx(Field, { label: "Generaciones simultáneas", children: /* @__PURE__ */ jsx(Input, { type: "number", value: limits.max_concurrent_generations ?? 4, onChange: (e) => set(["limits", "max_concurrent_generations"], Number(e.target.value)) }) }),
      /* @__PURE__ */ jsx(Field, { label: "Máx. regeneraciones", children: /* @__PURE__ */ jsx(Input, { type: "number", value: limits.max_regenerations ?? 5, onChange: (e) => set(["limits", "max_regenerations"], Number(e.target.value)) }) })
    ] })
  ] }) });
};
const Section = ({ title, children }) => /* @__PURE__ */ jsxs("div", { className: "rounded-lg border p-4", children: [
  /* @__PURE__ */ jsx(Heading, { level: "h2", className: "mb-3", children: title }),
  /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2", children })
] });
const Field = ({ label, full, children }) => /* @__PURE__ */ jsxs("div", { className: full ? "md:col-span-2" : "", children: [
  /* @__PURE__ */ jsx(Label, { size: "small", children: label }),
  children
] });
const Toggle = ({ label, checked, onChange }) => /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2", children: [
  /* @__PURE__ */ jsx(Checkbox, { checked: Boolean(checked), onCheckedChange: (c) => onChange(Boolean(c)) }),
  /* @__PURE__ */ jsx("span", { className: "text-sm", children: label })
] });
const config = defineRouteConfig({ label: "Configuración" });
const MIN_SCALE = 0.08;
const MAX_SCALE = 0.7;
const clamp = (n, min, max) => Number.isNaN(n) ? min : Math.min(Math.max(n, min), max);
function normalize(c, fallback) {
  return {
    x: clamp(typeof (c == null ? void 0 : c.x) === "number" ? c.x : fallback.x, 0, 1),
    y: clamp(typeof (c == null ? void 0 : c.y) === "number" ? c.y : fallback.y, 0, 1),
    scale: clamp(typeof (c == null ? void 0 : c.scale) === "number" ? c.scale : fallback.scale, MIN_SCALE, MAX_SCALE)
  };
}
function readEditableMeta(proposal) {
  return proposal.metadata ?? {};
}
const CompositionPreview = ({
  background,
  product,
  composition,
  className
}) => /* @__PURE__ */ jsxs("div", { className: `relative w-full overflow-hidden ${className ?? ""}`, children: [
  background ? /* @__PURE__ */ jsx("img", { src: background, alt: "", className: "block h-auto w-full", draggable: false }) : /* @__PURE__ */ jsx("div", { className: "aspect-square w-full bg-ui-bg-subtle" }),
  product ? /* @__PURE__ */ jsx(
    "div",
    {
      className: "absolute",
      style: {
        left: `${composition.x * 100}%`,
        top: `${composition.y * 100}%`,
        width: `${composition.scale * 100}%`,
        transform: "translate(-50%, -50%)"
      },
      children: /* @__PURE__ */ jsx("img", { src: product, alt: "", className: "block h-auto w-full", draggable: false })
    }
  ) : null
] });
const EditableLifestyleEditor = ({
  proposal,
  open,
  saving,
  onClose,
  onSave
}) => {
  var _a, _b;
  const meta = readEditableMeta(proposal);
  const backgroundUrl = (_a = meta.background) == null ? void 0 : _a.url;
  const productUrl = (_b = meta.product_layer) == null ? void 0 : _b.url;
  const initial = useMemo(
    () => normalize(meta.initial_composition ?? meta.composition, { x: 0.7, y: 0.75, scale: 0.25 }),
    [proposal.id]
  );
  const saved = useMemo(() => normalize(meta.composition, initial), [proposal.id]);
  const [comp, setComp] = useState(saved);
  const containerRef = useRef(null);
  const gestureRef = useRef(null);
  useEffect(() => {
    setComp(saved);
  }, [proposal.id, open]);
  useEffect(() => {
    const onMove = (e) => {
      const g = gestureRef.current;
      if (!g) return;
      if (g.kind === "move") {
        const dx = (e.clientX - g.startX) / g.rect.width;
        const dy = (e.clientY - g.startY) / g.rect.height;
        setComp((c) => ({ ...c, x: clamp(g.baseX + dx, 0, 1), y: clamp(g.baseY + dy, 0, 1) }));
      } else {
        const halfW = Math.abs(e.clientX - g.centerX);
        const scale = clamp(2 * halfW / g.rect.width, MIN_SCALE, MAX_SCALE);
        setComp((c) => ({ ...c, scale }));
      }
    };
    const onUp = () => {
      gestureRef.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);
  const startMove = (e) => {
    var _a2;
    const rect = (_a2 = containerRef.current) == null ? void 0 : _a2.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    gestureRef.current = { kind: "move", startX: e.clientX, startY: e.clientY, baseX: comp.x, baseY: comp.y, rect };
  };
  const startResize = (e) => {
    var _a2;
    const rect = (_a2 = containerRef.current) == null ? void 0 : _a2.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    gestureRef.current = {
      kind: "resize",
      centerX: rect.left + comp.x * rect.width,
      centerY: rect.top + comp.y * rect.height,
      rect
    };
  };
  const dirty = comp.x !== saved.x || comp.y !== saved.y || comp.scale !== saved.scale;
  const handleSave = async () => {
    try {
      await onSave({ x: comp.x, y: comp.y, scale: comp.scale });
      toast.success("Composición guardada");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    }
  };
  return /* @__PURE__ */ jsx(Drawer, { open, onOpenChange: (v) => !v && onClose(), children: /* @__PURE__ */ jsxs(Drawer.Content, { children: [
    /* @__PURE__ */ jsx(Drawer.Header, { children: /* @__PURE__ */ jsx(Drawer.Title, { children: "Ajustar lifestyle editable" }) }),
    /* @__PURE__ */ jsx(Drawer.Body, { className: "overflow-y-auto", children: !backgroundUrl || !productUrl ? /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Esta propuesta no tiene fondo o producto para ajustar." }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3", children: [
      /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: "Arrastrá el producto para moverlo y usá el tirador de la esquina para cambiar el tamaño. Las proporciones se mantienen." }),
      /* @__PURE__ */ jsxs(
        "div",
        {
          ref: containerRef,
          className: "relative w-full touch-none select-none overflow-hidden rounded-lg border bg-ui-bg-subtle",
          children: [
            /* @__PURE__ */ jsx("img", { src: backgroundUrl, alt: "", className: "block h-auto w-full", draggable: false }),
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: "absolute",
                style: {
                  left: `${comp.x * 100}%`,
                  top: `${comp.y * 100}%`,
                  width: `${comp.scale * 100}%`,
                  transform: "translate(-50%, -50%)"
                },
                children: [
                  /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute inset-0 rounded-sm outline-dashed outline-1 outline-ui-fg-interactive" }),
                  /* @__PURE__ */ jsx(
                    "img",
                    {
                      src: productUrl,
                      alt: "",
                      className: "block h-auto w-full cursor-move",
                      draggable: false,
                      onPointerDown: startMove
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "div",
                    {
                      role: "button",
                      "aria-label": "Cambiar tamaño",
                      onPointerDown: startResize,
                      className: "absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-ui-bg-base bg-ui-fg-interactive"
                    }
                  )
                ]
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-ui-fg-muted text-xs", children: [
        /* @__PURE__ */ jsxs("span", { children: [
          "Escala: ",
          Math.round(comp.scale * 100),
          "%"
        ] }),
        /* @__PURE__ */ jsxs("span", { children: [
          "Posición: ",
          Math.round(comp.x * 100),
          "% / ",
          Math.round(comp.y * 100),
          "%"
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(Drawer.Footer, { children: /* @__PURE__ */ jsxs("div", { className: "flex w-full items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsx(
        Button,
        {
          size: "small",
          variant: "secondary",
          disabled: !dirty && comp.x === initial.x && comp.y === initial.y && comp.scale === initial.scale,
          onClick: () => setComp(initial),
          children: "Restaurar"
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(Button, { size: "small", variant: "transparent", onClick: onClose, children: "Cancelar" }),
        /* @__PURE__ */ jsx(Button, { size: "small", isLoading: saving, disabled: !backgroundUrl || !productUrl, onClick: handleSave, children: "Guardar" })
      ] })
    ] }) })
  ] }) });
};
const handle = { breadcrumb: () => "Ejecución" };
const ACTIVE_STATUSES = ["generating", "applying"];
const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.7;
const FREETEXT_FIELDS = ["subtitle", "description", "meta_title", "meta_description", "alt_text"];
const FIELD_LABELS = {
  subtitle: "Subtítulo",
  description: "Descripción",
  meta_title: "Meta title",
  meta_description: "Meta description",
  keywords: "Keywords",
  categories: "Categorías",
  tags: "Tags",
  alt_text: "Alt text"
};
const EXECUTION_STATUS_LABELS = {
  draft: "Borrador",
  generating: "Generando",
  pending_review: "Pendiente de revisión",
  partially_reviewed: "Parcialmente revisada",
  ready_to_apply: "Lista para aplicar",
  applying: "Aplicando",
  applied: "Aplicada",
  partially_applied: "Parcialmente aplicada",
  error: "Error",
  cancelled: "Cancelada",
  restored: "Restaurada"
};
const PRODUCT_STATUS_LABELS = {
  pending: "Pendiente",
  generating: "Generando",
  proposed: "Con propuesta",
  no_changes: "Sin cambios",
  accepted: "Aceptada",
  rejected: "Rechazada",
  excluded: "Excluida",
  applied: "Aplicada",
  apply_failed: "Falló al aplicar",
  error: "Error"
};
const ASSET_STATUS_LABELS = {
  pending: "Pendiente",
  proposed: "Propuesta",
  accepted: "Aceptada",
  rejected: "Rechazada",
  applied: "Aplicada",
  error: "Error"
};
const ACTIVITY_LABELS = {
  created: "Creada",
  generation_started: "Generación iniciada",
  generation_completed: "Generación completada",
  apply_started: "Aplicación iniciada",
  applied: "Aplicada",
  apply_failed: "Falló al aplicar",
  reviewed: "Revisada",
  edited: "Editada",
  cancelled: "Cancelada",
  duplicated: "Duplicada",
  refloated: "Reflotada",
  restored: "Restaurada",
  error: "Error",
  "catalogador.lifestyle_editable.generated": "Lifestyle editable generado",
  "catalogador.lifestyle_editable.edited": "Lifestyle editable ajustado",
  "catalogador.lifestyle_editable.applied": "Lifestyle editable aplicado",
  "catalogador.lifestyle_editable.failed": "Lifestyle editable falló",
  "catalogador.image.skipped": "Imagen salteada"
};
const IMAGE_SKIP_REASONS = {
  scraping_disabled: "búsqueda web deshabilitada en la configuración",
  no_candidates: "la búsqueda web no encontró imágenes del producto",
  candidates_unusable: "ninguna imagen encontrada es utilizable (muy chicas o no descargan)",
  no_reference_image: "sin imagen propia ni imagen real en la web"
};
const OPERATION_STATUS_LABELS = {
  pending: "Pendiente",
  running: "Corriendo",
  done: "Hecha",
  error: "Error"
};
const OPERATION_TYPE_LABELS = {
  text_field: "Texto",
  image_technical: "Imagen (técnica)",
  image_ai: "Imagen (IA)"
};
const labelFor = (map, value) => map[value] ?? value;
const messagesOf = (value) => Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
const pct = (value) => `${Math.round(value * 100)}%`;
const formatUsd = (usd) => {
  const decimals = usd > 0 && usd < 1e-4 ? 6 : 4;
  return `US$ ${usd.toFixed(decimals)}`;
};
const TECH_OP_LABELS = {
  to_webp: "WebP",
  compress: "Comprimir",
  resize: "Redimensionar",
  normalize: "Normalizar"
};
const asNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
const formatBytes = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const formatDims = (info) => {
  const width = asNumber(info.width);
  const height = asNumber(info.height);
  return width && height ? `${width}×${height}` : null;
};
const TechnicalDelta = ({ metadata }) => {
  const meta = metadata ?? {};
  const before = meta.before ?? null;
  const after = meta.after ?? null;
  if (!before || !after) return null;
  const beforeBytes = asNumber(before.bytes);
  const afterBytes = asNumber(after.bytes);
  const ops = Array.isArray(meta.ops) ? meta.ops.filter((o) => typeof o === "string") : [];
  const grew = beforeBytes !== null && afterBytes !== null && afterBytes > beforeBytes;
  const delta = beforeBytes && afterBytes ? Math.round((afterBytes - beforeBytes) / beforeBytes * 100) : null;
  const side = (info, bytes) => [formatDims(info), bytes !== null ? formatBytes(bytes) : null].filter(Boolean).join(" · ");
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
    /* @__PURE__ */ jsxs(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: [
      side(before, beforeBytes),
      " → ",
      /* @__PURE__ */ jsx("span", { className: "font-medium text-ui-fg-base", children: side(after, afterBytes) }),
      delta !== null && /* @__PURE__ */ jsx("span", { className: grew ? " text-ui-fg-error" : " text-ui-fg-interactive", children: ` (${delta > 0 ? "+" : ""}${delta}%)` })
    ] }),
    ops.length > 0 && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1", children: ops.map((op) => /* @__PURE__ */ jsx(Badge, { size: "2xsmall", children: TECH_OP_LABELS[op] ?? op }, op)) }),
    grew && /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-error", children: "El resultado quedó más pesado que el original." }),
    meta.target_kb_missed === true && /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-error", children: "No se alcanzó el peso objetivo, ya en la calidad mínima." })
  ] });
};
const AiCostLine = ({ usage, cost }) => {
  if (!usage || usage.calls === 0) return null;
  const parts = [
    usage.text_usd > 0 ? `texto ${formatUsd(usage.text_usd)}` : null,
    usage.image_usd > 0 ? `imágenes ${formatUsd(usage.image_usd)}` : null,
    `${usage.calls} ${usage.calls === 1 ? "llamada" : "llamadas"} a OpenRouter`
  ].filter(Boolean);
  return /* @__PURE__ */ jsxs(Text, { size: "xsmall", className: "text-ui-fg-muted", children: [
    "Costo IA: ",
    formatUsd(cost),
    usage.missing_cost ? " (mínimo: alguna llamada no informó costo)" : "",
    " · ",
    parts.join(" · ")
  ] });
};
const activityDetail = (a) => {
  var _a, _b, _c;
  if (a.type === "catalogador.image.skipped") {
    const reason = typeof ((_a = a.metadata) == null ? void 0 : _a.reason) === "string" ? a.metadata.reason : null;
    return reason ? IMAGE_SKIP_REASONS[reason] ?? reason : null;
  }
  const conflicts = (_b = a.metadata) == null ? void 0 : _b.conflicts;
  if (Array.isArray(conflicts) && conflicts.length) {
    const names = conflicts.map((f) => labelFor(FIELD_LABELS, String(f))).join(", ");
    return `no se aplicó por conflicto (el producto cambió después de generar): ${names}`;
  }
  const deferred = (_c = a.metadata) == null ? void 0 : _c.deferred_low_confidence_fields;
  if (Array.isArray(deferred) && deferred.length) {
    const names = deferred.map((f) => labelFor(FIELD_LABELS, String(f.field ?? ""))).join(", ");
    return deferred.length === 1 ? `1 campo diferido por baja confianza: ${names}` : `${deferred.length} campos diferidos por baja confianza: ${names}`;
  }
  return null;
};
const ExecutionDetail = () => {
  var _a;
  const { id = "" } = useParams();
  const { data, isPending } = useExecution(id);
  const { data: cfgData } = useCatalogadorConfig();
  const { data: catData } = useAdminCategories();
  const categoryNameById = useMemo(() => {
    const map = {};
    for (const c of (catData == null ? void 0 : catData.product_categories) ?? []) map[c.id] = c.name;
    return map;
  }, [catData]);
  const generate = useGenerateExecution();
  const apply = useApplyExecution();
  const cancel = useCancelExecution();
  const duplicate = useDuplicateExecution();
  const refloat = useRefloatExecution();
  const restore = useRestoreExecution();
  const reviewProduct = useReviewProduct(id);
  const reviewAsset = useReviewAsset(id);
  const updateComposition = useUpdateComposition(id);
  const rules = ((_a = cfgData == null ? void 0 : cfgData.config) == null ? void 0 : _a.rules) ?? {};
  const lowConfidenceThreshold = typeof rules.low_confidence_threshold === "number" ? rules.low_confidence_threshold : DEFAULT_LOW_CONFIDENCE_THRESHOLD;
  const requireReviewLowConfidence = rules.require_review_low_confidence !== false;
  const [drawerPid, setDrawerPid] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const execution = data == null ? void 0 : data.execution;
  const products = (data == null ? void 0 : data.products) ?? [];
  const assets = (data == null ? void 0 : data.asset_proposals) ?? [];
  const activity = (data == null ? void 0 : data.activity) ?? [];
  const operations = (data == null ? void 0 : data.operations) ?? [];
  if (isPending || !execution) {
    return /* @__PURE__ */ jsx(Container, { children: /* @__PURE__ */ jsx(Text, { children: "Cargando…" }) });
  }
  const isActive = ACTIVE_STATUSES.includes(execution.status);
  const p = execution.progress;
  const assetsByProduct = /* @__PURE__ */ new Map();
  for (const a of assets) {
    const arr = assetsByProduct.get(a.execution_product_id) ?? [];
    arr.push(a);
    assetsByProduct.set(a.execution_product_id, arr);
  }
  const act = (fn, ok) => fn().then(() => toast.success(ok)).catch((e) => toast.error(e instanceof Error ? e.message : "Error"));
  const reviewSuccessMessage = (body) => {
    if (body.action === "accept_all") return "Se aceptaron todos los cambios propuestos";
    if (body.action === "reject_all") return "Se rechazaron todos los cambios propuestos";
    if (body.action === "exclude") return "Producto excluido de la ejecución";
    if (body.action === "include") return "Producto incluido en la ejecución";
    const label = labelFor(FIELD_LABELS, String(body.field ?? ""));
    if (body.decision === "edit") return `${label}: se guardó tu edición`;
    if (body.decision === "accept") return `${label}: propuesta aceptada`;
    return `${label}: propuesta rechazada`;
  };
  const onFieldDecision = (pid, body) => reviewProduct.mutateAsync({ pid, body }).then((res) => {
    const deferred = res == null ? void 0 : res.deferred_low_confidence;
    if (!(deferred == null ? void 0 : deferred.count)) {
      toast.success(reviewSuccessMessage(body));
      return;
    }
    const detail = deferred.fields.map((f) => `${labelFor(FIELD_LABELS, f.field)} (${pct(f.confidence)})`).join(", ");
    const n = deferred.count;
    toast.warning(
      n === 1 ? "1 campo quedó pendiente por baja confianza" : `${n} campos quedaron pendientes por baja confianza`,
      {
        description: `${detail}: ${n === 1 ? "está" : "están"} por debajo del umbral configurado (${pct(deferred.threshold)}), así que no se auto-${n === 1 ? "aceptó" : "aceptaron"}. ${n === 1 ? "Falta decidirlo" : "Faltan decidirlos"} campo por campo.`
      }
    );
  }).catch((e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar la decisión"));
  const canGenerate = ["draft", "pending_review", "partially_reviewed", "error"].includes(execution.status);
  const canApply = ["pending_review", "partially_reviewed", "ready_to_apply", "partially_applied", "applied"].includes(execution.status);
  const canCancel = !["applied", "partially_applied", "applying", "restored", "cancelled"].includes(execution.status);
  const canRestore = ["applied", "partially_applied"].includes(execution.status);
  const drawerProduct = products.find((pr) => pr.id === drawerPid) ?? null;
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-y-3", children: [
    /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(Heading, { children: execution.name }),
          /* @__PURE__ */ jsx(StatusBadge, { color: isActive ? "blue" : execution.status === "applied" ? "green" : "grey", children: labelFor(EXECUTION_STATUS_LABELS, execution.status) })
        ] }),
        /* @__PURE__ */ jsxs(Text, { size: "small", className: "text-ui-fg-subtle", children: [
          execution.selection_count,
          " productos",
          p ? ` · ${p.processed}/${p.total} procesados (${p.percent}%)` : "",
          p && p.failed > 0 ? ` · ${p.failed} con error` : "",
          execution.applied_at ? ` · aplicada ${new Date(execution.applied_at).toLocaleString()}` : ""
        ] }),
        /* @__PURE__ */ jsx(AiCostLine, { usage: execution.ai_usage, cost: execution.ai_cost_usd ?? 0 }),
        isActive && /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: "Procesando en segundo plano… actualizá la página para ver el avance." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
        canGenerate && /* @__PURE__ */ jsx(Button, { size: "small", onClick: () => act(() => generate.mutateAsync({ id }), "Generación iniciada"), children: "Generar propuestas" }),
        canApply && /* @__PURE__ */ jsx(Button, { size: "small", variant: "primary", onClick: () => act(() => apply.mutateAsync({ id }), "Aplicación iniciada"), children: "Aplicar cambios" }),
        canCancel && /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", onClick: () => act(() => cancel.mutateAsync({ id }), "Cancelada"), children: "Cancelar" }),
        /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", onClick: () => act(() => duplicate.mutateAsync({ id }), "Duplicada"), children: "Duplicar" }),
        /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", onClick: () => act(() => refloat.mutateAsync({ id, body: { use_current_config: true } }), "Reflotada"), children: "Reflotar" }),
        canRestore && /* @__PURE__ */ jsx(Button, { size: "small", variant: "danger", onClick: () => act(() => restore.mutateAsync({ id }), "Restauración creada"), children: "Restaurar" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-3", children: [
      /* @__PURE__ */ jsx(Heading, { level: "h2", children: "Productos y cambios" }),
      /* @__PURE__ */ jsx("div", { className: "overflow-x-auto rounded-lg border", children: /* @__PURE__ */ jsxs(Table, { children: [
        /* @__PURE__ */ jsx(Table.Header, { children: /* @__PURE__ */ jsxs(Table.Row, { children: [
          /* @__PURE__ */ jsx(Table.HeaderCell, { className: "min-w-[260px]", children: "Producto" }),
          /* @__PURE__ */ jsx(Table.HeaderCell, { children: "Cambios" }),
          /* @__PURE__ */ jsx(Table.HeaderCell, { children: "Estado" }),
          /* @__PURE__ */ jsx(Table.HeaderCell, { children: "Acciones" })
        ] }) }),
        /* @__PURE__ */ jsxs(Table.Body, { children: [
          products.map((prod) => {
            const fieldCount = Object.keys(prod.proposed_changes ?? {}).length;
            const imgCount = (assetsByProduct.get(prod.id) ?? []).length;
            const applied = prod.status === "applied";
            return /* @__PURE__ */ jsxs(Table.Row, { children: [
              /* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                prod.product_thumbnail ? /* @__PURE__ */ jsx("img", { src: prod.product_thumbnail, alt: "", className: "h-9 w-9 rounded object-cover" }) : /* @__PURE__ */ jsx("div", { className: "h-9 w-9 rounded bg-ui-bg-subtle" }),
                /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-col", children: [
                  /* @__PURE__ */ jsx("span", { className: "max-w-[220px] truncate text-sm", children: prod.product_title ?? prod.product_id }),
                  messagesOf(prod.errors).map((m) => /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "max-w-[260px] text-ui-fg-error", children: m }, m)),
                  messagesOf(prod.warnings).map((m) => /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "max-w-[260px] text-ui-fg-subtle", children: m }, m))
                ] })
              ] }) }),
              /* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsxs("span", { className: "text-ui-fg-subtle text-xs", children: [
                fieldCount > 0 ? `${fieldCount} campos` : "sin campos",
                imgCount > 0 ? ` · ${imgCount} imágenes` : ""
              ] }) }),
              /* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsx(StatusBadge, { color: applied ? "green" : prod.status === "accepted" ? "blue" : prod.status === "error" || prod.status === "apply_failed" ? "red" : "grey", children: labelFor(PRODUCT_STATUS_LABELS, prod.status) }) }),
              /* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsxs("div", { className: "flex gap-1", children: [
                /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", onClick: () => setDrawerPid(prod.id), children: "Revisar" }),
                !applied && /* @__PURE__ */ jsx(Button, { size: "small", variant: "transparent", onClick: () => act(() => reviewProduct.mutateAsync({ pid: prod.id, body: { action: "exclude" } }), "Excluido"), children: "Excluir" })
              ] }) })
            ] }, prod.id);
          }),
          products.length === 0 && /* @__PURE__ */ jsx(Table.Row, { children: /* @__PURE__ */ jsx(Table.Cell, { children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Sin productos." }) }) })
        ] })
      ] }) })
    ] }),
    /* @__PURE__ */ jsx(OperationsPanel, { operations }),
    /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-3", children: [
      /* @__PURE__ */ jsx(Heading, { level: "h2", children: "Actividad" }),
      /* @__PURE__ */ jsxs("div", { className: "max-h-64 overflow-y-auto rounded-lg border p-3 text-sm", children: [
        activity.length === 0 && /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Sin actividad." }),
        activity.map((a) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-b py-1", children: [
          /* @__PURE__ */ jsx("span", { className: "text-ui-fg-muted text-xs", children: new Date(a.created_at).toLocaleString() }),
          /* @__PURE__ */ jsx(Badge, { size: "2xsmall", children: labelFor(ACTIVITY_LABELS, a.type) }),
          activityDetail(a) && /* @__PURE__ */ jsx("span", { className: "text-ui-fg-subtle text-xs", children: activityDetail(a) })
        ] }, a.id))
      ] })
    ] }),
    drawerProduct && /* @__PURE__ */ jsx(
      ProductReviewDrawer,
      {
        product: drawerProduct,
        assets: assetsByProduct.get(drawerProduct.id) ?? [],
        categoryNameById,
        open: Boolean(drawerPid),
        onClose: () => setDrawerPid(null),
        onField: (body) => onFieldDecision(drawerProduct.id, body),
        lowConfidenceThreshold,
        requireReviewLowConfidence,
        onAsset: (aid, decision) => reviewAsset.mutate({ aid, decision }),
        onAdjust: (asset) => setEditingAsset(asset)
      },
      drawerProduct.id
    ),
    editingAsset && /* @__PURE__ */ jsx(
      EditableLifestyleEditor,
      {
        proposal: editingAsset,
        open: Boolean(editingAsset),
        saving: updateComposition.isPending,
        onClose: () => setEditingAsset(null),
        onSave: (composition) => updateComposition.mutateAsync({ aid: editingAsset.id, composition })
      },
      editingAsset.id
    )
  ] });
};
const OperationsPanel = ({ operations }) => {
  if (operations.length === 0) return null;
  const color = (status) => status === "done" ? "green" : status === "error" ? "red" : status === "running" ? "blue" : "grey";
  return /* @__PURE__ */ jsxs(Container, { className: "flex flex-col gap-2", children: [
    /* @__PURE__ */ jsx(Heading, { level: "h2", children: "Operaciones" }),
    /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-2", children: operations.map((op) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5 rounded-md border px-2 py-1", children: [
      /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-base", children: labelFor(FIELD_LABELS, op.field) }),
      /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-muted", children: labelFor(OPERATION_TYPE_LABELS, op.type) }),
      /* @__PURE__ */ jsx(StatusBadge, { color: color(op.status), children: labelFor(OPERATION_STATUS_LABELS, op.status) })
    ] }, op.id)) })
  ] });
};
const ProductReviewDrawer = ({
  product,
  assets,
  categoryNameById,
  open,
  onClose,
  onField,
  onAsset,
  onAdjust,
  lowConfidenceThreshold,
  requireReviewLowConfidence
}) => {
  var _a;
  const displayVal = (field, value) => field === "categories" ? formatCategories(value, categoryNameById) : formatVal(value);
  const proposed = product.proposed_changes ?? {};
  const accepted = product.accepted_changes ?? {};
  const snapshot = product.current_snapshot ?? {};
  const fields = Object.keys(proposed);
  const applied = product.status === "applied";
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState("");
  const tabDefs = [
    ...fields.map((f) => ({ id: f, label: `${FIELD_LABELS[f] ?? f}${f in accepted ? " ✓" : ""}` })),
    ...assets.length ? [{ id: "images", label: "Imágenes" }] : []
  ];
  const firstTab = ((_a = tabDefs[0]) == null ? void 0 : _a.id) ?? "";
  const [activeTab, setActiveTab] = useState(firstTab);
  const currentTab = tabDefs.some((t) => t.id === activeTab) ? activeTab : firstTab;
  return /* @__PURE__ */ jsx(Drawer, { open, onOpenChange: (v) => !v && onClose(), children: /* @__PURE__ */ jsxs(Drawer.Content, { children: [
    /* @__PURE__ */ jsx(Drawer.Header, { children: /* @__PURE__ */ jsxs("div", { className: "flex w-full items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsx(Drawer.Title, { className: "truncate", children: product.product_title ?? product.product_id }),
      /* @__PURE__ */ jsx(Link, { to: `/products/${product.product_id}`, className: "shrink-0", children: /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", children: "Ver producto" }) })
    ] }) }),
    /* @__PURE__ */ jsxs(Drawer.Body, { className: "overflow-y-auto", children: [
      /* @__PURE__ */ jsx("div", { className: "pb-2", children: /* @__PURE__ */ jsx(AiCostLine, { usage: product.ai_usage, cost: product.ai_cost_usd ?? 0 }) }),
      fields.length === 0 && assets.length === 0 ? /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Sin propuestas para este producto." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(ReviewTabsBar, { tabs: tabDefs, tab: currentTab, setTab: setActiveTab }),
        currentTab === "images" ? /* @__PURE__ */ jsxs("div", { className: "py-2", children: [
          /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-4 md:grid-cols-3", children: assets.map((a) => {
            var _a2, _b, _c, _d, _e, _f, _g, _h;
            const isEditable = a.operation_type === "lifestyle_editable";
            const editMeta = isEditable ? readEditableMeta(a) : null;
            const canAdjust = isEditable && a.status !== "error" && Boolean(((_a2 = editMeta == null ? void 0 : editMeta.background) == null ? void 0 : _a2.url) && ((_b = editMeta == null ? void 0 : editMeta.product_layer) == null ? void 0 : _b.url));
            return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2 rounded-lg border p-2", children: [
              isEditable && ((_c = editMeta == null ? void 0 : editMeta.background) == null ? void 0 : _c.url) && ((_d = editMeta == null ? void 0 : editMeta.product_layer) == null ? void 0 : _d.url) ? /* @__PURE__ */ jsx(
                CompositionPreview,
                {
                  background: editMeta.background.url,
                  product: editMeta.product_layer.url,
                  composition: {
                    x: ((_e = editMeta.composition) == null ? void 0 : _e.x) ?? 0.7,
                    y: ((_f = editMeta.composition) == null ? void 0 : _f.y) ?? 0.75,
                    scale: ((_g = editMeta.composition) == null ? void 0 : _g.scale) ?? 0.25
                  },
                  className: "rounded"
                }
              ) : /* @__PURE__ */ jsx("a", { href: a.generated_asset_id ?? "#", target: "_blank", rel: "noreferrer", className: "block", children: a.generated_asset_id ? /* @__PURE__ */ jsx("img", { src: a.generated_asset_id, alt: "", className: "h-40 w-full rounded object-contain" }) : /* @__PURE__ */ jsx("div", { className: "flex h-40 w-full items-center justify-center rounded bg-ui-bg-subtle text-center text-[10px] text-ui-fg-muted", children: a.status === "error" ? "No se pudo generar" : "" }) }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-1", children: [
                /* @__PURE__ */ jsx(Badge, { size: "2xsmall", color: isEditable ? "blue" : void 0, children: isEditable ? "Lifestyle editable" : a.operation_type }),
                a.is_ai_generated && !isEditable && /* @__PURE__ */ jsx(Badge, { size: "2xsmall", color: "purple", children: "IA" }),
                /* @__PURE__ */ jsx("span", { className: "ml-auto text-[10px] text-ui-fg-muted", children: labelFor(ASSET_STATUS_LABELS, a.status) })
              ] }),
              /* @__PURE__ */ jsx(TechnicalDelta, { metadata: a.metadata }),
              a.status === "error" && typeof ((_h = a.metadata) == null ? void 0 : _h.error) === "string" && /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-error", children: String(a.metadata.error) }),
              !applied && a.status !== "error" && /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-1", children: [
                canAdjust && /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", onClick: () => onAdjust(a), children: "Ajustar" }),
                /* @__PURE__ */ jsx(Button, { size: "small", variant: a.status === "accepted" ? "primary" : "secondary", onClick: () => onAsset(a.id, "accept"), children: a.status === "accepted" ? "Elegida" : "Elegir" }),
                /* @__PURE__ */ jsx(Button, { size: "small", variant: "transparent", onClick: () => onAsset(a.id, "reject"), children: "Descartar" })
              ] })
            ] }, a.id);
          }) }),
          /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "mt-2 text-ui-fg-muted", children: "Clic en una imagen para verla en tamaño completo." })
        ] }) : (() => {
          const f = currentTab;
          const prop = proposed[f];
          const isAccepted = f in accepted;
          const editable = FREETEXT_FIELDS.includes(f);
          const isEditing = editField === f;
          return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 py-2", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
              /* @__PURE__ */ jsx(Text, { size: "xsmall", weight: "plus", className: "text-ui-fg-muted", children: "Actual" }),
              /* @__PURE__ */ jsx("div", { className: "rounded-lg border bg-ui-bg-subtle p-2 text-sm", children: displayVal(f, snapshot[f]) })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx(Text, { size: "xsmall", weight: "plus", className: "text-ui-fg-muted", children: "Propuesta" }),
                typeof (prop == null ? void 0 : prop.confidence) === "number" && /* @__PURE__ */ jsxs(
                  Badge,
                  {
                    size: "2xsmall",
                    color: prop.confidence < lowConfidenceThreshold ? "orange" : "green",
                    children: [
                      "Confianza ",
                      pct(prop.confidence)
                    ]
                  }
                ),
                typeof (prop == null ? void 0 : prop.confidence) === "number" && prop.confidence < lowConfidenceThreshold && requireReviewLowConfidence && /* @__PURE__ */ jsxs(Badge, { size: "2xsmall", color: "orange", children: [
                  "Requiere revisión (umbral ",
                  pct(lowConfidenceThreshold),
                  ")"
                ] })
              ] }),
              isEditing ? /* @__PURE__ */ jsx(Textarea, { value: editValue, onChange: (e) => setEditValue(e.target.value), rows: 5 }) : /* @__PURE__ */ jsx("div", { className: `rounded-lg border p-2 text-sm ${isAccepted ? "bg-ui-tag-green-bg ring-1 ring-ui-tag-green-border" : ""}`, children: displayVal(f, prop == null ? void 0 : prop.value) })
            ] }),
            !applied && /* @__PURE__ */ jsx("div", { className: "flex gap-2", children: isEditing ? /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  onClick: () => {
                    onField({ action: "field", field: f, decision: "edit", value: editValue });
                    setEditField(null);
                  },
                  children: "Guardar"
                }
              ),
              /* @__PURE__ */ jsx(Button, { size: "small", variant: "transparent", onClick: () => setEditField(null), children: "Cancelar" })
            ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(Button, { size: "small", variant: isAccepted ? "primary" : "secondary", onClick: () => onField({ action: "field", field: f, decision: "accept" }), children: isAccepted ? "Aceptado" : "Aceptar" }),
              /* @__PURE__ */ jsx(Button, { size: "small", variant: "transparent", onClick: () => onField({ action: "field", field: f, decision: "reject" }), children: "Rechazar" }),
              editable && /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  variant: "transparent",
                  onClick: () => {
                    setEditField(f);
                    setEditValue(String((prop == null ? void 0 : prop.value) ?? ""));
                  },
                  children: "Editar"
                }
              )
            ] }) })
          ] });
        })()
      ] })
    ] }),
    /* @__PURE__ */ jsx(Drawer.Footer, { children: /* @__PURE__ */ jsxs("div", { className: "flex w-full items-center justify-end gap-2", children: [
      !applied && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", onClick: () => onField({ action: "reject_all" }), children: "Rechazar todo" }),
        /* @__PURE__ */ jsx(Button, { size: "small", onClick: () => onField({ action: "accept_all" }), children: "Aceptar todo" })
      ] }),
      /* @__PURE__ */ jsx(Button, { size: "small", variant: "transparent", onClick: onClose, children: "Cerrar" })
    ] }) })
  ] }) });
};
const ReviewTabsBar = ({
  tabs,
  tab,
  setTab
}) => {
  const ref = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const sync = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    sync();
    const onResize = () => sync();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [tabs.length]);
  const nudge = (dir) => {
    var _a;
    return (_a = ref.current) == null ? void 0 : _a.scrollBy({ left: dir * 180, behavior: "smooth" });
  };
  return /* @__PURE__ */ jsxs("div", { className: "relative mb-4 border-ui-border-base border-b", children: [
    canLeft ? /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        "aria-label": "Tabs anteriores",
        onClick: () => nudge(-1),
        className: "absolute inset-y-0 left-0 z-10 flex items-center bg-gradient-to-r from-ui-bg-base via-ui-bg-base to-transparent pr-6 text-ui-fg-subtle transition-colors hover:text-ui-fg-base",
        children: /* @__PURE__ */ jsx(ChevronLeftMini, {})
      }
    ) : null,
    /* @__PURE__ */ jsx(
      "div",
      {
        ref,
        onScroll: sync,
        className: "flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        children: tabs.map((tDef) => /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: (e) => {
              setTab(tDef.id);
              e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
            },
            className: `shrink-0 whitespace-nowrap px-3 py-2 text-sm ${tab === tDef.id ? "border-ui-fg-base border-b-2 font-medium text-ui-fg-base" : "text-ui-fg-subtle"}`,
            children: tDef.label
          },
          tDef.id
        ))
      }
    ),
    canRight ? /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        "aria-label": "Tabs siguientes",
        onClick: () => nudge(1),
        className: "absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-l from-ui-bg-base via-ui-bg-base to-transparent pl-6 text-ui-fg-subtle transition-colors hover:text-ui-fg-base",
        children: /* @__PURE__ */ jsx(ChevronRightMini, {})
      }
    ) : null
  ] });
};
function formatVal(v) {
  if (v === null || v === void 0 || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function formatCategories(v, nameById) {
  if (v === null || v === void 0 || v === "") return "—";
  const ids = (Array.isArray(v) ? v : String(v).split(",")).map((x) => String(x).trim()).filter(Boolean);
  if (ids.length === 0) return "—";
  return ids.map((id) => nameById[id] ?? id).join(", ");
}
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: Catalogador,
      path: "/catalogador",
      handle: { label: config$1.label, translationNs: config$1.translationNs, ...handle$3 }
    },
    {
      Component: NewExecution,
      path: "/catalogador/new",
      handle: handle$2
    },
    {
      Component: CatalogadorConfigPage,
      path: "/catalogador/config",
      handle: { label: config.label, translationNs: config.translationNs, ...handle$1 }
    },
    {
      Component: ExecutionDetail,
      path: "/catalogador/:id",
      handle
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config$1.label,
      icon: config$1.icon,
      path: "/catalogador",
      nested: void 0,
      rank: void 0,
      translationNs: void 0
    },
    {
      label: config.label,
      icon: void 0,
      path: "/catalogador/config",
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
export {
  plugin as default
};
