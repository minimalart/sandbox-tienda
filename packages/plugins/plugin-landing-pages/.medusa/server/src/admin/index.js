"use strict";
const jsxRuntime = require("react/jsx-runtime");
const adminSdk = require("@medusajs/admin-sdk");
const icons = require("@medusajs/icons");
const ui = require("@medusajs/ui");
const react = require("react");
const reactI18next = require("react-i18next");
const reactRouterDom = require("react-router-dom");
const reactQuery = require("@tanstack/react-query");
const puck = require("@measured/puck");
require("@measured/puck/puck.css");
const Medusa = require("@medusajs/js-sdk");
require("@medusajs/admin-shared");
const _interopDefault = (e) => e && e.__esModule ? e : { default: e };
const Medusa__default = /* @__PURE__ */ _interopDefault(Medusa);
const BASE_URL = "/admin/landing-pages";
const LANDING_PAGES_QUERY_KEY = ["landing-pages"];
const landingPageQueryKey = (id) => ["landing-pages", id];
async function fetchJson(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init == null ? void 0 : init.headers) ?? {} }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}
function useLandingPages(params) {
  const qs = new URLSearchParams();
  if ((params == null ? void 0 : params.limit) != null) qs.set("limit", String(params.limit));
  if ((params == null ? void 0 : params.offset) != null) qs.set("offset", String(params.offset));
  if (params == null ? void 0 : params.status) qs.set("status", params.status);
  if (params == null ? void 0 : params.q) qs.set("q", params.q);
  const url = qs.toString() ? `${BASE_URL}?${qs.toString()}` : BASE_URL;
  return reactQuery.useQuery({
    queryKey: [...LANDING_PAGES_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson(url)
  });
}
function useLandingPage(id) {
  return reactQuery.useQuery({
    queryKey: landingPageQueryKey(id),
    queryFn: () => fetchJson(`${BASE_URL}/${id}`).then(
      (d) => d.landing_page
    ),
    enabled: !!id
  });
}
function useCreateLandingPage() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (data) => fetchJson(BASE_URL, {
      method: "POST",
      body: JSON.stringify(data)
    }).then((d) => d.landing_page),
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY })
  });
}
function useUpdateLandingPage(id) {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (data) => fetchJson(`${BASE_URL}/${id}`, {
      method: "POST",
      body: JSON.stringify(data)
    }).then((d) => d.landing_page),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: landingPageQueryKey(id) });
    }
  });
}
function useDeleteLandingPage() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson(`${BASE_URL}/${id}`, {
      method: "DELETE"
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY })
  });
}
function usePublishLandingPage() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson(`${BASE_URL}/${id}/publish`, {
      method: "POST"
    }).then((d) => d.landing_page),
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY })
  });
}
function useUnpublishLandingPage() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson(`${BASE_URL}/${id}/unpublish`, {
      method: "POST"
    }).then((d) => d.landing_page),
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY })
  });
}
function useDuplicateLandingPage() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson(`${BASE_URL}/${id}/duplicate`, {
      method: "POST"
    }).then((d) => d.landing_page),
    onSuccess: () => qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY })
  });
}
function useInvalidateLanding(id) {
  const qc = reactQuery.useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: LANDING_PAGES_QUERY_KEY });
    qc.invalidateQueries({ queryKey: landingPageQueryKey(id) });
  };
}
function useGenerateLandingPageAI(id) {
  const invalidate = useInvalidateLanding(id);
  return reactQuery.useMutation({
    mutationFn: (input) => fetchJson(`${BASE_URL}/${id}/ai-generate`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
    onSuccess: (res) => {
      if (res.saved) invalidate();
    }
  });
}
function useImproveLandingPageCopyAI(id) {
  const invalidate = useInvalidateLanding(id);
  return reactQuery.useMutation({
    mutationFn: (input) => fetchJson(`${BASE_URL}/${id}/ai-improve-copy`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
    onSuccess: () => invalidate()
  });
}
function useTranslateLandingPageAI(id) {
  const invalidate = useInvalidateLanding(id);
  return reactQuery.useMutation({
    mutationFn: (input) => fetchJson(`${BASE_URL}/${id}/ai-translate`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
    onSuccess: () => invalidate()
  });
}
function useGenerateLandingPageImageAI(id) {
  const invalidate = useInvalidateLanding(id);
  return reactQuery.useMutation({
    mutationFn: (input) => fetchJson(`${BASE_URL}/${id}/ai-image`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
    onSuccess: (res) => {
      if (res.saved) invalidate();
    }
  });
}
function useGenerateLandingPageSeoAI(id) {
  const invalidate = useInvalidateLanding(id);
  return reactQuery.useMutation({
    mutationFn: (input) => fetchJson(`${BASE_URL}/${id}/ai-seo`, {
      method: "POST",
      body: JSON.stringify(input)
    }),
    onSuccess: () => invalidate()
  });
}
const LANDING_PAGES_NAMESPACE = "landingPages";
let registered = false;
const en = {
  TITLE: "Landings",
  SUBTITLE: "Build and manage visual landing pages.",
  CREATE_BUTTON: "Create",
  EDIT: "Edit",
  DUPLICATE: "Duplicate",
  PUBLISH: "Publish",
  UNPUBLISH: "Unpublish",
  ARCHIVE: "Archive",
  DELETE: "Delete",
  EMPTY_STATE: "No landings yet. Create your first one to get started.",
  COLUMN_TITLE: "Title",
  COLUMN_SLUG: "Slug",
  COLUMN_STATUS: "Status",
  COLUMN_LOCALE: "Locale",
  COLUMN_UPDATED: "Updated",
  COLUMN_ACTIONS: "Actions",
  STATUS_DRAFT: "Draft",
  STATUS_PUBLISHED: "Published",
  STATUS_ARCHIVED: "Archived",
  CREATE_TITLE: "Create landing",
  EDIT_TITLE: "Edit landing",
  FIELD_TITLE: "Title *",
  FIELD_TITLE_PLACEHOLDER: "Landing title",
  FIELD_SLUG: "Slug",
  FIELD_SLUG_PLACEHOLDER: "my-landing",
  FIELD_SLUG_HELP: "URL identifier. Generated from the title if left empty.",
  FIELD_STATUS: "Status",
  FIELD_LOCALE: "Locale",
  FIELD_LOCALE_PLACEHOLDER: "es-AR",
  FIELD_SEO_TITLE: "SEO title",
  FIELD_SEO_DESCRIPTION: "SEO description",
  CONTENT_EDITOR_HINT: "The visual content editor (Puck) opens from “Edit content”. Here you manage the page settings.",
  EDIT_CONTENT: "Edit content",
  SAVE: "Save",
  CANCEL: "Cancel",
  CREATE_SUCCESS: "Landing created",
  UPDATE_SUCCESS: "Landing updated",
  DELETE_SUCCESS: "Landing deleted",
  PUBLISH_SUCCESS: "Landing published",
  UNPUBLISH_SUCCESS: "Landing moved to draft",
  DUPLICATE_SUCCESS: "Landing duplicated",
  ACTION_ERROR: "Action failed: {{msg}}",
  VALIDATION_TITLE_REQUIRED: "Title is required",
  DELETE_CONFIRM: "Delete this landing? This cannot be undone."
};
const es = {
  TITLE: "Landings",
  SUBTITLE: "Creá y gestioná landing pages visuales.",
  CREATE_BUTTON: "Crear",
  EDIT: "Editar",
  DUPLICATE: "Duplicar",
  PUBLISH: "Publicar",
  UNPUBLISH: "Despublicar",
  ARCHIVE: "Archivar",
  DELETE: "Eliminar",
  EMPTY_STATE: "Todavía no hay landings. Creá la primera para empezar.",
  COLUMN_TITLE: "Título",
  COLUMN_SLUG: "Slug",
  COLUMN_STATUS: "Estado",
  COLUMN_LOCALE: "Idioma",
  COLUMN_UPDATED: "Actualizada",
  COLUMN_ACTIONS: "Acciones",
  STATUS_DRAFT: "Borrador",
  STATUS_PUBLISHED: "Publicada",
  STATUS_ARCHIVED: "Archivada",
  CREATE_TITLE: "Crear landing",
  EDIT_TITLE: "Editar landing",
  FIELD_TITLE: "Título *",
  FIELD_TITLE_PLACEHOLDER: "Título de la landing",
  FIELD_SLUG: "Slug",
  FIELD_SLUG_PLACEHOLDER: "mi-landing",
  FIELD_SLUG_HELP: "Identificador de URL. Se genera del título si lo dejás vacío.",
  FIELD_STATUS: "Estado",
  FIELD_LOCALE: "Idioma",
  FIELD_LOCALE_PLACEHOLDER: "es-AR",
  FIELD_SEO_TITLE: "Título SEO",
  FIELD_SEO_DESCRIPTION: "Descripción SEO",
  CONTENT_EDITOR_HINT: "El editor visual de contenido (Puck) se abre desde “Editar contenido”. Acá gestionás la configuración de la página.",
  EDIT_CONTENT: "Editar contenido",
  SAVE: "Guardar",
  CANCEL: "Cancelar",
  CREATE_SUCCESS: "Landing creada",
  UPDATE_SUCCESS: "Landing actualizada",
  DELETE_SUCCESS: "Landing eliminada",
  PUBLISH_SUCCESS: "Landing publicada",
  UNPUBLISH_SUCCESS: "Landing pasada a borrador",
  DUPLICATE_SUCCESS: "Landing duplicada",
  ACTION_ERROR: "La acción falló: {{msg}}",
  VALIDATION_TITLE_REQUIRED: "El título es obligatorio",
  DELETE_CONFIRM: "¿Eliminar esta landing? No se puede deshacer."
};
const registerLandingPagesTranslations = (i18n) => {
  if (registered || typeof (i18n == null ? void 0 : i18n.addResourceBundle) !== "function") {
    return;
  }
  i18n.addResourceBundle("en", LANDING_PAGES_NAMESPACE, en, true, true);
  i18n.addResourceBundle("es", LANDING_PAGES_NAMESPACE, es, true, true);
  void i18n.loadNamespaces(LANDING_PAGES_NAMESPACE);
  registered = true;
};
const PAGE_SIZE = 20;
const STATUSES = ["draft", "published", "archived"];
const columnHelper = ui.createDataTableColumnHelper();
const EMPTY_FORM = {
  title: "",
  slug: "",
  status: "draft",
  locale: "",
  seo_title: "",
  seo_description: ""
};
function statusColor(status) {
  if (status === "published") return "green";
  if (status === "archived") return "grey";
  return "orange";
}
const LandingPagesPage = () => {
  const { t, i18n } = reactI18next.useTranslation("landingPages");
  registerLandingPagesTranslations(i18n);
  const prompt = ui.usePrompt();
  const navigate = reactRouterDom.useNavigate();
  const [pagination, setPagination] = react.useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE
  });
  const { data, isLoading } = useLandingPages({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize
  });
  const landingPages = (data == null ? void 0 : data.landing_pages) ?? [];
  const count = (data == null ? void 0 : data.count) ?? 0;
  const [drawerOpen, setDrawerOpen] = react.useState(false);
  const [editing, setEditing] = react.useState(null);
  const [form, setForm] = react.useState(EMPTY_FORM);
  const createMut = useCreateLandingPage();
  const updateMut = useUpdateLandingPage((editing == null ? void 0 : editing.id) ?? "");
  const deleteMut = useDeleteLandingPage();
  const publishMut = usePublishLandingPage();
  const unpublishMut = useUnpublishLandingPage();
  const duplicateMut = useDuplicateLandingPage();
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  };
  const openEdit = (lp) => {
    var _a, _b;
    setEditing(lp);
    setForm({
      title: lp.title,
      slug: lp.slug,
      status: lp.status,
      locale: lp.locale ?? "",
      seo_title: ((_a = lp.seo) == null ? void 0 : _a.title) ?? "",
      seo_description: ((_b = lp.seo) == null ? void 0 : _b.description) ?? ""
    });
    setDrawerOpen(true);
  };
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const handleSave = async () => {
    if (!form.title.trim()) {
      ui.toast.error(t("VALIDATION_TITLE_REQUIRED"));
      return;
    }
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || void 0,
      status: form.status,
      locale: form.locale.trim() || null,
      seo: form.seo_title || form.seo_description ? {
        title: form.seo_title || void 0,
        description: form.seo_description || void 0
      } : null
    };
    try {
      if (editing) {
        await updateMut.mutateAsync(payload);
        ui.toast.success(t("UPDATE_SUCCESS"));
      } else {
        await createMut.mutateAsync(payload);
        ui.toast.success(t("CREATE_SUCCESS"));
      }
      setDrawerOpen(false);
    } catch (error) {
      ui.toast.error(t("ACTION_ERROR", { msg: (error == null ? void 0 : error.message) ?? "" }));
    }
  };
  const runAction = async (fn, successKey) => {
    try {
      await fn();
      ui.toast.success(t(successKey));
    } catch (error) {
      ui.toast.error(t("ACTION_ERROR", { msg: (error == null ? void 0 : error.message) ?? "" }));
    }
  };
  const handleDelete = async (lp) => {
    const confirmed = await prompt({
      title: t("DELETE"),
      description: t("DELETE_CONFIRM"),
      confirmText: "Eliminar",
      cancelText: "Cancelar"
    });
    if (!confirmed) return;
    await runAction(() => deleteMut.mutateAsync(lp.id), "DELETE_SUCCESS");
  };
  const columns = react.useMemo(
    () => [
      columnHelper.accessor("title", {
        header: t("COLUMN_TITLE"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium", children: getValue() })
      }),
      columnHelper.accessor("slug", {
        header: t("COLUMN_SLUG"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-subtle", children: getValue() })
      }),
      columnHelper.accessor("status", {
        header: t("COLUMN_STATUS"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: statusColor(getValue()), children: t(`STATUS_${getValue().toUpperCase()}`) })
      }),
      columnHelper.accessor("locale", {
        header: t("COLUMN_LOCALE"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-subtle", children: getValue() ?? "—" })
      }),
      columnHelper.accessor("updated_at", {
        header: t("COLUMN_UPDATED"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-subtle", children: getValue() ? new Date(getValue()).toLocaleDateString() : "—" })
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const lp = row.original;
          return /* @__PURE__ */ jsxRuntime.jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { variant: "transparent", children: /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, {}) }) }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Item, { onClick: () => navigate(`/landing-pages/${lp.id}`), children: t("EDIT_CONTENT") }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Item, { onClick: () => openEdit(lp), children: t("EDIT") }),
              lp.status === "published" ? /* @__PURE__ */ jsxRuntime.jsx(
                ui.DropdownMenu.Item,
                {
                  onClick: () => runAction(() => unpublishMut.mutateAsync(lp.id), "UNPUBLISH_SUCCESS"),
                  children: t("UNPUBLISH")
                }
              ) : /* @__PURE__ */ jsxRuntime.jsx(
                ui.DropdownMenu.Item,
                {
                  onClick: () => runAction(() => publishMut.mutateAsync(lp.id), "PUBLISH_SUCCESS"),
                  children: t("PUBLISH")
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsx(
                ui.DropdownMenu.Item,
                {
                  onClick: () => runAction(() => duplicateMut.mutateAsync(lp.id), "DUPLICATE_SUCCESS"),
                  children: t("DUPLICATE")
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Separator, {}),
              /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Item, { onClick: () => handleDelete(lp), children: t("DELETE") })
            ] })
          ] }) });
        }
      })
    ],
    [t]
  );
  const table = ui.useDataTable({
    columns,
    data: landingPages,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading,
    pagination: { state: pagination, onPaginationChange: setPagination },
    onRowClick: (_e, row) => navigate(`/landing-pages/${row.id}`)
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Container, { className: "p-0", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DataTable, { instance: table, children: [
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DataTable.Toolbar, { className: "flex items-center justify-between px-6 py-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx("div", { children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center gap-x-2", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t("TITLE") }) }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "secondary", onClick: openCreate, children: t("CREATE_BUTTON") })
      ] }),
      count > 0 || isLoading ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Table, {}),
        /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Pagination, {})
      ] }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-center border-t p-6 text-center", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: t("EMPTY_STATE") }) })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open: drawerOpen, onOpenChange: setDrawerOpen, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Title, { children: editing ? t("EDIT_TITLE") : t("CREATE_TITLE") }) }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Body, { className: "flex flex-col gap-4 overflow-y-auto", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_TITLE") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              value: form.title,
              onChange: (e) => set("title", e.target.value),
              placeholder: t("FIELD_TITLE_PLACEHOLDER")
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_SLUG") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              value: form.slug,
              onChange: (e) => set("slug", e.target.value),
              placeholder: t("FIELD_SLUG_PLACEHOLDER")
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: t("FIELD_SLUG_HELP") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_STATUS") }),
          /* @__PURE__ */ jsxRuntime.jsxs(
            ui.Select,
            {
              value: form.status,
              onValueChange: (v) => set("status", v),
              children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { children: STATUSES.map((s) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: s, children: t(`STATUS_${s.toUpperCase()}`) }, s)) })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_LOCALE") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              value: form.locale,
              onChange: (e) => set("locale", e.target.value),
              placeholder: t("FIELD_LOCALE_PLACEHOLDER")
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_SEO_TITLE") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              value: form.seo_title,
              onChange: (e) => set("seo_title", e.target.value)
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_SEO_DESCRIPTION") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Textarea,
            {
              value: form.seo_description,
              onChange: (e) => set("seo_description", e.target.value),
              rows: 3
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx("div", { className: "rounded-lg bg-ui-bg-subtle p-3", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: t("CONTENT_EDITOR_HINT") }) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", children: t("CANCEL") }) }),
        /* @__PURE__ */ jsxRuntime.jsx(
          ui.Button,
          {
            onClick: handleSave,
            isLoading: createMut.isPending || updateMut.isPending,
            children: t("SAVE")
          }
        )
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] });
};
const LandingsIcon = () => /* @__PURE__ */ jsxRuntime.jsx(icons.Window, { style: { color: "#4B8EEF" } });
const config$2 = adminSdk.defineRouteConfig({
  label: "Landings",
  icon: LandingsIcon,
  rank: 40
});
const handle$2 = {
  breadcrumb: () => "Landings"
};
const CredentialsPage = () => /* @__PURE__ */ jsxRuntime.jsx(reactRouterDom.Navigate, { to: "/settings/site-credentials#landing-pages", replace: true });
const config$1 = adminSdk.defineRouteConfig({ label: "Credenciales", rank: 99 });
const handle$1 = { breadcrumb: () => "Credenciales" };
const sdk = new Medusa__default.default({
  baseUrl: "/",
  auth: {
    type: "session"
  }
});
const accent = "#2e7d32";
const wrap = {
  maxWidth: 1024,
  margin: "0 auto",
  padding: "24px 24px"
};
const ColorInput = ({
  value,
  onChange
}) => {
  const v = value ?? "";
  const swatch = /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#000000";
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
    /* @__PURE__ */ jsxRuntime.jsx(
      "input",
      {
        type: "color",
        value: swatch,
        onChange: (e) => onChange(e.target.value),
        style: {
          width: 36,
          height: 32,
          padding: 0,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          background: "none",
          cursor: "pointer",
          flexShrink: 0
        }
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(
      "input",
      {
        type: "text",
        value: v,
        placeholder: "auto",
        onChange: (e) => onChange(e.target.value),
        style: {
          flex: 1,
          minWidth: 0,
          height: 32,
          padding: "0 8px",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          fontSize: 13
        }
      }
    ),
    v ? /* @__PURE__ */ jsxRuntime.jsx(
      "button",
      {
        type: "button",
        onClick: () => onChange(""),
        title: "Auto (sin color)",
        style: {
          height: 32,
          padding: "0 8px",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          background: "#fff",
          cursor: "pointer",
          color: "#6b7280",
          flexShrink: 0
        },
        children: "×"
      }
    ) : null
  ] });
};
const colorField = (label) => ({
  type: "custom",
  label,
  render: ({ onChange, value, field }) => /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
    /* @__PURE__ */ jsxRuntime.jsx("span", { style: { fontSize: 12, color: "#6b7280" }, children: (field == null ? void 0 : field.label) ?? label }),
    /* @__PURE__ */ jsxRuntime.jsx(ColorInput, { value, onChange })
  ] })
});
const bgFgFields = {
  background: colorField("Background color"),
  textColor: colorField("Text color")
};
const config = {
  components: {
    Hero: {
      label: "Hero",
      fields: {
        title: { type: "text", label: "Title" },
        subtitle: { type: "textarea", label: "Subtitle" },
        image: { type: "text", label: "Background image URL" },
        ctaLabel: { type: "text", label: "Button label" },
        ctaHref: { type: "text", label: "Button link" },
        ...bgFgFields,
        accentColor: colorField("Button color")
      },
      defaultProps: {
        title: "Título principal",
        subtitle: "Subtítulo descriptivo de la landing.",
        image: "",
        ctaLabel: "",
        ctaHref: "",
        background: "",
        textColor: "",
        accentColor: ""
      },
      render: ({
        title,
        subtitle,
        image,
        ctaLabel,
        ctaHref,
        background,
        textColor,
        accentColor
      }) => /* @__PURE__ */ jsxRuntime.jsxs(
        "section",
        {
          style: {
            position: "relative",
            minHeight: 280,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            textAlign: "center",
            padding: "64px 24px",
            background: image ? `url(${image}) center/cover` : background || "#f3f4f6"
          },
          children: [
            image ? /* @__PURE__ */ jsxRuntime.jsx(
              "div",
              {
                "aria-hidden": "true",
                style: {
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.4), rgba(0,0,0,0.6))"
                }
              }
            ) : null,
            title ? /* @__PURE__ */ jsxRuntime.jsx(
              "h1",
              {
                style: {
                  position: "relative",
                  fontSize: 44,
                  fontWeight: 700,
                  margin: 0,
                  color: textColor || (image ? "#fff" : void 0)
                },
                children: title
              }
            ) : null,
            subtitle ? /* @__PURE__ */ jsxRuntime.jsx(
              "p",
              {
                style: {
                  position: "relative",
                  fontSize: 18,
                  color: textColor || (image ? "rgba(255,255,255,0.9)" : "#4b5563"),
                  maxWidth: 640
                },
                children: subtitle
              }
            ) : null,
            ctaLabel && ctaHref ? /* @__PURE__ */ jsxRuntime.jsx(
              "span",
              {
                style: {
                  position: "relative",
                  background: accentColor || accent,
                  color: "#fff",
                  padding: "12px 24px",
                  borderRadius: 999,
                  fontWeight: 600
                },
                children: ctaLabel
              }
            ) : null
          ]
        }
      )
    },
    RichText: {
      label: "Rich text",
      fields: {
        heading: { type: "text", label: "Heading" },
        text: { type: "textarea", label: "Text" },
        ...bgFgFields
      },
      defaultProps: {
        heading: "",
        text: "Escribí tu contenido acá.",
        background: "",
        textColor: ""
      },
      render: ({ heading, text, background, textColor }) => /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { ...wrap, background: background || void 0 }, children: [
        heading ? /* @__PURE__ */ jsxRuntime.jsx("h2", { style: { fontSize: 24, fontWeight: 600, color: textColor || void 0 }, children: heading }) : null,
        /* @__PURE__ */ jsxRuntime.jsx(
          "p",
          {
            style: {
              color: textColor || "#374151",
              whiteSpace: "pre-line",
              lineHeight: 1.6
            },
            children: text
          }
        )
      ] })
    },
    ImageBlock: {
      label: "Image",
      fields: {
        src: { type: "text", label: "Image URL" },
        alt: { type: "text", label: "Alt text" },
        caption: { type: "text", label: "Caption" },
        ...bgFgFields
      },
      defaultProps: { src: "", alt: "", caption: "", background: "", textColor: "" },
      render: ({ src, alt, caption, background, textColor }) => /* @__PURE__ */ jsxRuntime.jsxs("figure", { style: { ...wrap, background: background || void 0 }, children: [
        src ? /* @__PURE__ */ jsxRuntime.jsx(
          "img",
          {
            src,
            alt,
            style: { width: "100%", borderRadius: 16, display: "block" }
          }
        ) : /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            style: {
              background: "#e5e7eb",
              borderRadius: 16,
              height: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9ca3af"
            },
            children: "Image URL"
          }
        ),
        caption ? /* @__PURE__ */ jsxRuntime.jsx(
          "figcaption",
          {
            style: { textAlign: "center", color: textColor || "#6b7280", marginTop: 8 },
            children: caption
          }
        ) : null
      ] })
    },
    CTA: {
      label: "CTA",
      fields: {
        title: { type: "text", label: "Title" },
        description: { type: "textarea", label: "Description" },
        buttonLabel: { type: "text", label: "Button label" },
        buttonHref: { type: "text", label: "Button link" },
        ...bgFgFields,
        accentColor: colorField("Button color")
      },
      defaultProps: {
        title: "¿Listo para empezar?",
        description: "",
        buttonLabel: "Comprar ahora",
        buttonHref: "/store",
        background: "",
        textColor: "",
        accentColor: ""
      },
      render: ({
        title,
        description,
        buttonLabel,
        buttonHref,
        background,
        textColor,
        accentColor
      }) => /* @__PURE__ */ jsxRuntime.jsx("section", { style: wrap, children: /* @__PURE__ */ jsxRuntime.jsxs(
        "div",
        {
          style: {
            background: background || "rgba(46,125,50,0.06)",
            borderRadius: 24,
            padding: "48px 24px",
            textAlign: "center"
          },
          children: [
            title ? /* @__PURE__ */ jsxRuntime.jsx("h2", { style: { fontSize: 24, fontWeight: 700, color: textColor || void 0 }, children: title }) : null,
            description ? /* @__PURE__ */ jsxRuntime.jsx("p", { style: { color: textColor || "#4b5563" }, children: description }) : null,
            buttonLabel && buttonHref ? /* @__PURE__ */ jsxRuntime.jsx(
              "span",
              {
                style: {
                  display: "inline-block",
                  marginTop: 8,
                  background: accentColor || accent,
                  color: "#fff",
                  padding: "12px 24px",
                  borderRadius: 999,
                  fontWeight: 600
                },
                children: buttonLabel
              }
            ) : null
          ]
        }
      ) })
    },
    FAQ: {
      label: "FAQ",
      fields: {
        heading: { type: "text", label: "Heading" },
        items: {
          type: "array",
          label: "Questions",
          arrayFields: {
            q: { type: "text", label: "Question" },
            a: { type: "textarea", label: "Answer" }
          },
          defaultItemProps: { q: "Pregunta", a: "Respuesta" }
        },
        ...bgFgFields
      },
      defaultProps: { heading: "Preguntas frecuentes", items: [], background: "", textColor: "" },
      render: ({ heading, items, background, textColor }) => /* @__PURE__ */ jsxRuntime.jsxs("section", { style: { ...wrap, background: background || void 0 }, children: [
        heading ? /* @__PURE__ */ jsxRuntime.jsx("h2", { style: { fontSize: 24, fontWeight: 600, marginBottom: 16, color: textColor || void 0 }, children: heading }) : null,
        (items ?? []).map((item, i) => /* @__PURE__ */ jsxRuntime.jsxs(
          "details",
          {
            style: {
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 16,
              marginBottom: 8
            },
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("summary", { style: { fontWeight: 500, cursor: "pointer", color: textColor || void 0 }, children: item.q }),
              /* @__PURE__ */ jsxRuntime.jsx("p", { style: { color: textColor || "#4b5563", whiteSpace: "pre-line" }, children: item.a })
            ]
          },
          i
        ))
      ] })
    },
    Testimonials: {
      label: "Testimonials",
      fields: {
        heading: { type: "text", label: "Heading" },
        items: {
          type: "array",
          label: "Testimonials",
          arrayFields: {
            quote: { type: "textarea", label: "Quote" },
            author: { type: "text", label: "Author" }
          },
          defaultItemProps: { quote: "Excelente.", author: "Cliente" }
        },
        ...bgFgFields
      },
      defaultProps: { heading: "Testimonios", items: [], background: "", textColor: "" },
      render: ({ heading, items, background, textColor }) => /* @__PURE__ */ jsxRuntime.jsxs("section", { style: { ...wrap, background: background || void 0 }, children: [
        heading ? /* @__PURE__ */ jsxRuntime.jsx("h2", { style: { fontSize: 24, fontWeight: 600, marginBottom: 16, color: textColor || void 0 }, children: heading }) : null,
        /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            style: {
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            },
            children: (items ?? []).map((item, i) => /* @__PURE__ */ jsxRuntime.jsxs(
              "blockquote",
              {
                style: {
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  padding: 20,
                  margin: 0
                },
                children: [
                  /* @__PURE__ */ jsxRuntime.jsxs("p", { style: { fontStyle: "italic", color: textColor || "#374151" }, children: [
                    "“",
                    item.quote,
                    "”"
                  ] }),
                  item.author ? /* @__PURE__ */ jsxRuntime.jsxs("footer", { style: { fontWeight: 600, marginTop: 12, color: textColor || void 0 }, children: [
                    "— ",
                    item.author
                  ] }) : null
                ]
              },
              i
            ))
          }
        )
      ] })
    },
    CollectionGrid: {
      label: "Collection grid",
      fields: {
        heading: { type: "text", label: "Heading" },
        items: {
          type: "array",
          label: "Collections",
          arrayFields: {
            label: { type: "text", label: "Label" },
            handle: { type: "text", label: "Category handle" },
            href: { type: "text", label: "Custom link (optional)" }
          },
          defaultItemProps: { label: "Categoría", handle: "", href: "" }
        },
        ...bgFgFields
      },
      defaultProps: { heading: "Comprá por categoría", items: [], background: "", textColor: "" },
      render: ({ heading, items, background, textColor }) => /* @__PURE__ */ jsxRuntime.jsxs("section", { style: { ...wrap, background: background || void 0 }, children: [
        heading ? /* @__PURE__ */ jsxRuntime.jsx("h2", { style: { fontSize: 24, fontWeight: 600, marginBottom: 16, color: textColor || void 0 }, children: heading }) : null,
        /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            style: {
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))"
            },
            children: (items ?? []).map((item, i) => /* @__PURE__ */ jsxRuntime.jsx(
              "div",
              {
                style: {
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  padding: "40px 16px",
                  textAlign: "center",
                  fontWeight: 500,
                  color: textColor || void 0
                },
                children: item.label || item.handle
              },
              i
            ))
          }
        )
      ] })
    },
    ProductGrid: {
      label: "Product grid",
      fields: {
        heading: { type: "text", label: "Heading" },
        href: { type: "text", label: "Link" },
        ctaLabel: { type: "text", label: "Button label" },
        ...bgFgFields
      },
      defaultProps: {
        heading: "Productos destacados",
        href: "/store",
        ctaLabel: "Ver productos",
        background: "",
        textColor: ""
      },
      render: ({ heading, ctaLabel, background, textColor }) => /* @__PURE__ */ jsxRuntime.jsxs("section", { style: { ...wrap, textAlign: "center", background: background || void 0 }, children: [
        heading ? /* @__PURE__ */ jsxRuntime.jsx("h2", { style: { fontSize: 24, fontWeight: 600, marginBottom: 12, color: textColor || void 0 }, children: heading }) : null,
        /* @__PURE__ */ jsxRuntime.jsx(
          "span",
          {
            style: {
              display: "inline-block",
              border: "1px solid #d1d5db",
              borderRadius: 999,
              padding: "12px 24px",
              fontWeight: 600,
              color: textColor || void 0
            },
            children: ctaLabel
          }
        )
      ] })
    },
    ProductsList: {
      label: "Lista de productos (Typesense)",
      fields: {
        heading: { type: "text", label: "Título" },
        source: {
          type: "select",
          label: "Qué traer",
          options: [
            { label: "Novedades (más recientes)", value: "newest" },
            { label: "Con promoción activa", value: "promotions" },
            { label: "Por categoría", value: "category" },
            { label: "Por colección", value: "collection" },
            { label: "Por tag", value: "tag" },
            { label: "Búsqueda libre", value: "query" }
          ]
        },
        value: {
          type: "text",
          label: "Valor (categoría / colección / tag / búsqueda)"
        },
        limit: { type: "number", label: "Cantidad (1-24)" },
        sortBy: {
          type: "select",
          label: "Orden",
          options: [
            { label: "Por defecto", value: "" },
            { label: "Más recientes", value: "created_at" },
            { label: "Precio: menor a mayor", value: "price_asc" },
            { label: "Precio: mayor a menor", value: "price_desc" },
            { label: "Relevancia", value: "relevance" }
          ]
        },
        ctaLabel: { type: "text", label: "Texto del botón (opcional)" },
        href: { type: "text", label: "Link del botón (opcional)" },
        ...bgFgFields
      },
      defaultProps: {
        heading: "Productos",
        source: "newest",
        value: "",
        limit: 8,
        sortBy: "",
        ctaLabel: "",
        href: "",
        background: "",
        textColor: ""
      },
      render: ({ heading, source, value, limit, background, textColor }) => {
        const sourceLabels = {
          newest: "Novedades",
          promotions: "Con promoción activa",
          category: `Categoría: ${value || "—"}`,
          collection: `Colección: ${value || "—"}`,
          tag: `Tag: ${value || "—"}`,
          query: `Búsqueda: ${value || "—"}`
        };
        const count = Math.min(Math.max(Number(limit) || 8, 1), 24);
        return /* @__PURE__ */ jsxRuntime.jsxs("section", { style: { ...wrap, background: background || void 0 }, children: [
          heading ? /* @__PURE__ */ jsxRuntime.jsx("h2", { style: { fontSize: 24, fontWeight: 600, marginBottom: 8, color: textColor || void 0 }, children: heading }) : null,
          /* @__PURE__ */ jsxRuntime.jsxs("div", { style: { fontSize: 12, color: "#6b7280", marginBottom: 12 }, children: [
            sourceLabels[source] ?? "Novedades",
            " · ",
            count,
            " productos · se cargan desde Typesense en el sitio"
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12
              },
              children: Array.from({ length: Math.min(count, 8) }).map((_, i) => /* @__PURE__ */ jsxRuntime.jsx(
                "div",
                {
                  style: {
                    border: "1px dashed #d1d5db",
                    borderRadius: 8,
                    background: "#f9fafb",
                    aspectRatio: "3 / 4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#9ca3af",
                    fontSize: 11
                  },
                  children: "producto"
                },
                i
              ))
            }
          )
        ] });
      }
    },
    Spacer: {
      label: "Spacer",
      fields: {
        size: { type: "number", label: "Height (px)" },
        background: colorField("Background color")
      },
      defaultProps: { size: 32, background: "" },
      render: ({ size, background }) => /* @__PURE__ */ jsxRuntime.jsx("div", { style: { height: `${Number(size) || 32}px`, background: background || void 0 } })
    }
  }
};
const __vite_import_meta_env__ = {};
const EMPTY_DATA = { content: [], root: { props: {} } };
const AI_COMPONENTS = [
  "Hero",
  "RichText",
  "ImageBlock",
  "CTA",
  "FAQ",
  "Testimonials",
  "CollectionGrid",
  "ProductGrid",
  "Spacer"
];
const getStorefrontUrl = () => {
  var _a;
  const env = __vite_import_meta_env__;
  const url = ((_a = env == null ? void 0 : env.VITE_STOREFRONT_URL) == null ? void 0 : _a.trim()) || "http://localhost:3000";
  return url.replace(/\/+$/, "");
};
const LandingPageEditor = () => {
  const { t, i18n } = reactI18next.useTranslation("landingPages");
  registerLandingPagesTranslations(i18n);
  const navigate = reactRouterDom.useNavigate();
  const prompt = ui.usePrompt();
  const { id = "" } = reactRouterDom.useParams();
  const { data: landing, isLoading } = useLandingPage(id);
  const updateMut = useUpdateLandingPage(id);
  const generateMut = useGenerateLandingPageAI(id);
  const improveMut = useImproveLandingPageCopyAI(id);
  const translateMut = useTranslateLandingPageAI(id);
  const seoMut = useGenerateLandingPageSeoAI(id);
  const imageMut = useGenerateLandingPageImageAI(id);
  const [editorData, setEditorData] = react.useState(null);
  const [puckKey, setPuckKey] = react.useState(0);
  const [aiOpen, setAiOpen] = react.useState(false);
  const [brief, setBrief] = react.useState("");
  const [tone, setTone] = react.useState("");
  const [goal, setGoal] = react.useState("");
  const [audience, setAudience] = react.useState("");
  const [aiLocale, setAiLocale] = react.useState("es-AR");
  const [mode, setMode] = react.useState("replace");
  const [components, setComponents] = react.useState([]);
  const [promptCfg, setPromptCfg] = react.useState(null);
  const [promptValue, setPromptValue] = react.useState("");
  const openPrompt = (cfg, initial = "") => {
    setPromptValue(initial);
    setPromptCfg(cfg);
  };
  const closePrompt = () => setPromptCfg(null);
  const confirmPrompt = () => {
    if (!promptCfg) return;
    if (promptCfg.required && !promptValue.trim()) {
      ui.toast.error("Completá el campo para continuar.");
      return;
    }
    const { onConfirm } = promptCfg;
    const value = promptValue;
    closePrompt();
    onConfirm(value);
  };
  const [storefrontUrl, setStorefrontUrl] = react.useState(getStorefrontUrl());
  react.useEffect(() => {
    fetch("/admin/store-config/storefront-url", { credentials: "include" }).then((r) => r.ok ? r.json() : null).then((d) => {
      if (d == null ? void 0 : d.url) setStorefrontUrl(String(d.url).replace(/\/+$/, ""));
    }).catch(() => {
    });
  }, []);
  if (isLoading) {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-center p-12", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "…" }) });
  }
  if (!landing) {
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col items-center gap-3 p-12", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Landing not found" }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "secondary", onClick: () => navigate("/landing-pages"), children: t("CANCEL") })
    ] });
  }
  const currentData = editorData ?? landing.puck_data ?? EMPTY_DATA;
  const aiBusy = generateMut.isPending || improveMut.isPending || translateMut.isPending || seoMut.isPending || imageMut.isPending;
  const applyToEditor = (puckData) => {
    setEditorData(puckData);
    setPuckKey((k) => k + 1);
  };
  const handleSave = async (data) => {
    try {
      await updateMut.mutateAsync({ puck_data: data });
      setEditorData(data);
      ui.toast.success(t("UPDATE_SUCCESS"));
    } catch (error) {
      ui.toast.error(t("ACTION_ERROR", { msg: (error == null ? void 0 : error.message) ?? "" }));
    }
  };
  const PuckSaveButton = () => {
    const { appState } = puck.usePuck();
    return /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", onClick: () => handleSave(appState.data), children: "Guardar cambios" });
  };
  const toggleComponent = (name) => setComponents(
    (prev) => prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
  );
  const handleGenerate = async () => {
    if (!brief.trim()) {
      ui.toast.error("Escribí un brief para generar la landing.");
      return;
    }
    const input = {
      brief: brief.trim(),
      tone: tone.trim() || void 0,
      goal: goal.trim() || void 0,
      audience: audience.trim() || void 0,
      locale: aiLocale.trim() || void 0,
      components: components.length ? components : void 0,
      mode
    };
    try {
      const res = await generateMut.mutateAsync(input);
      applyToEditor(res.puck_data);
      setAiOpen(false);
      ui.toast.success(
        res.saved ? "Landing generada y guardada. Revisá y publicá desde el editor." : "Borrador generado en el editor. Publicá si te gusta."
      );
    } catch (error) {
      ui.toast.error((error == null ? void 0 : error.message) ?? "Falló la generación AI.");
    }
  };
  const handleImprove = () => {
    openPrompt(
      {
        title: "Mejorar textos con IA",
        description: "Se conservan la estructura y los links; solo se reescriben los textos.",
        label: "Instrucción",
        placeholder: "Ej: hacer el tono más premium y claro",
        multiline: true,
        required: true,
        confirmText: "Mejorar",
        onConfirm: async (instruction) => {
          try {
            const res = await improveMut.mutateAsync({
              instruction: instruction.trim(),
              locale: aiLocale
            });
            applyToEditor(res.puck_data);
            ui.toast.success("Textos mejorados y guardados.");
          } catch (error) {
            ui.toast.error((error == null ? void 0 : error.message) ?? "Falló la mejora de copy.");
          }
        }
      },
      "Hacer el tono más premium y claro"
    );
  };
  const handleTranslate = () => {
    openPrompt(
      {
        title: "Traducir landing con IA",
        description: "Se traducen solo los textos visibles; links e imágenes se conservan.",
        label: "Locale destino",
        placeholder: "en-US",
        required: true,
        confirmText: "Traducir",
        onConfirm: async (target) => {
          try {
            const res = await translateMut.mutateAsync({ target_locale: target.trim() });
            applyToEditor(res.puck_data);
            ui.toast.success(`Traducido a ${target.trim()} y guardado.`);
          } catch (error) {
            ui.toast.error((error == null ? void 0 : error.message) ?? "Falló la traducción.");
          }
        }
      },
      "en-US"
    );
  };
  const runImageGeneration = async (ids, overwrite, styleHint) => {
    let lastPuck = null;
    let ok = 0;
    const fails = [];
    for (let i = 0; i < ids.length; i++) {
      const blockId = ids[i];
      ui.toast.loading(`Generando imagen ${i + 1}/${ids.length}…`, { id: "ai-image" });
      try {
        const res = await imageMut.mutateAsync({
          blockId,
          styleHint: styleHint.trim() || void 0,
          overwrite
        });
        lastPuck = res.puck_data;
        if (!res.skipped) ok += 1;
      } catch (error) {
        fails.push((error == null ? void 0 : error.message) ?? "error");
      }
    }
    ui.toast.dismiss("ai-image");
    if (lastPuck) applyToEditor(lastPuck);
    if (fails.length === 0) {
      ui.toast.success(`${ok} imagen(es) generada(s) y guardada(s).`);
    } else {
      ui.toast.error(`${ok} generada(s), ${fails.length} fallaron: ${fails[0]}`);
    }
  };
  const handleGenerateImages = async () => {
    const data = currentData;
    const blocks = [
      ...data.content ?? [],
      ...Object.values(data.zones ?? {}).flat()
    ];
    const imageBlocks = blocks.filter(
      (b) => (b == null ? void 0 : b.type) === "Hero" || (b == null ? void 0 : b.type) === "ImageBlock"
    );
    const allIds = imageBlocks.map((b) => {
      var _a;
      return String(((_a = b.props) == null ? void 0 : _a.id) ?? "");
    }).filter(Boolean);
    if (allIds.length === 0) {
      ui.toast.info("No hay bloques de imagen (Hero / ImageBlock) en la landing.");
      return;
    }
    const emptyIds = imageBlocks.filter((b) => {
      var _a, _b;
      if ((b == null ? void 0 : b.type) === "Hero") return !String(((_a = b.props) == null ? void 0 : _a.image) ?? "").trim();
      return !String(((_b = b.props) == null ? void 0 : _b.src) ?? "").trim();
    }).map((b) => {
      var _a;
      return String(((_a = b.props) == null ? void 0 : _a.id) ?? "");
    }).filter(Boolean);
    let ids = emptyIds;
    let overwrite = false;
    if (emptyIds.length === 0) {
      const confirmed = await prompt({
        title: "Regenerar imágenes",
        description: `Ya están todas las imágenes generadas (${allIds.length}). ¿Querés regenerarlas? Se reemplazan las actuales por unas nuevas.`,
        confirmText: "Regenerar",
        cancelText: t("CANCEL")
      });
      if (!confirmed) return;
      ids = allIds;
      overwrite = true;
    }
    openPrompt({
      title: overwrite ? "Regenerar imágenes con IA" : "Generar imágenes con IA",
      description: "Las imágenes se generan sin texto (el copy se superpone aparte) y con buen contraste para que el texto se lea. El estilo es opcional; dejalo vacío para automático.",
      label: "Estilo para las imágenes (opcional)",
      placeholder: "Ej: minimalista, colores cálidos",
      confirmText: overwrite ? "Regenerar" : "Generar",
      onConfirm: (styleHint) => runImageGeneration(ids, overwrite, styleHint)
    });
  };
  const handleSeo = () => {
    openPrompt({
      title: "Generar SEO con IA",
      description: "Se generará title/description y se guardará en el SEO de la landing.",
      label: "Keywords (separadas por coma, opcional)",
      placeholder: "ofertas, envío gratis, …",
      confirmText: "Generar",
      onConfirm: async (kw) => {
        try {
          const keywords = kw.split(",").map((k) => k.trim()).filter(Boolean);
          await seoMut.mutateAsync({
            locale: aiLocale,
            keywords: keywords.length ? keywords : void 0
          });
          ui.toast.success("SEO generado y guardado.");
        } catch (error) {
          ui.toast.error((error == null ? void 0 : error.message) ?? "Falló la generación de SEO.");
        }
      }
    });
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex h-[calc(100vh-57px)] flex-col", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between border-ui-border-base border-b bg-ui-bg-base px-4 py-2", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Button, { size: "small", variant: "transparent", onClick: () => navigate("/landing-pages"), children: [
          "← ",
          t("CANCEL")
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h2", className: "text-base", children: landing.title }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: [
          "/",
          landing.slug
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "secondary", onClick: () => setAiOpen(true), disabled: aiBusy, children: "✨ Generar con IA" }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "transparent", disabled: aiBusy, children: "IA ▾" }) }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Item, { onClick: handleGenerateImages, children: "Generar imágenes" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Item, { onClick: handleImprove, children: "Mejorar textos" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Item, { onClick: handleTranslate, children: "Traducir" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Item, { onClick: handleSeo, children: "Generar SEO" })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(
          "a",
          {
            href: `${storefrontUrl}/l/${landing.slug}`,
            target: "_blank",
            rel: "noreferrer",
            className: "text-sm text-ui-fg-interactive",
            children: "Vista previa ↗"
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "min-h-0 flex-1", children: /* @__PURE__ */ jsxRuntime.jsx(
      puck.Puck,
      {
        config,
        data: currentData,
        onPublish: handleSave,
        overrides: { headerActions: () => /* @__PURE__ */ jsxRuntime.jsx(PuckSaveButton, {}) }
      },
      puckKey
    ) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open: aiOpen, onOpenChange: setAiOpen, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Title, { children: "Generar landing con IA" }) }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Body, { className: "flex flex-col gap-4 overflow-y-auto", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "ai-brief", children: "Brief *" }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Textarea,
            {
              id: "ai-brief",
              placeholder: "Ej: Landing de Black Friday para indumentaria urbana, con productos destacados y FAQ.",
              rows: 3,
              value: brief,
              onChange: (e) => setBrief(e.target.value)
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "ai-goal", children: "Objetivo" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { id: "ai-goal", placeholder: "ventas", value: goal, onChange: (e) => setGoal(e.target.value) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "ai-tone", children: "Tono" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { id: "ai-tone", placeholder: "premium, directo", value: tone, onChange: (e) => setTone(e.target.value) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "ai-audience", children: "Audiencia" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              ui.Input,
              {
                id: "ai-audience",
                placeholder: "clientes recurrentes",
                value: audience,
                onChange: (e) => setAudience(e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "ai-locale", children: "Idioma" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { id: "ai-locale", value: aiLocale, onChange: (e) => setAiLocale(e.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: "Modo" }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: mode, onValueChange: (v) => setMode(v), children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "replace", children: "Reemplazar todo" }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "append", children: "Agregar al final" }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "draft_only", children: "Solo previsualizar (no guarda)" })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: "Componentes a priorizar (opcional)" }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "grid grid-cols-2 gap-2", children: AI_COMPONENTS.map((name) => /* @__PURE__ */ jsxRuntime.jsxs(
            ui.Label,
            {
              className: "flex cursor-pointer items-center gap-2 font-normal",
              children: [
                /* @__PURE__ */ jsxRuntime.jsx(
                  ui.Checkbox,
                  {
                    checked: components.includes(name),
                    onCheckedChange: () => toggleComponent(name)
                  }
                ),
                name
              ]
            },
            name
          )) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: "Se aplica sobre el contenido guardado; los cambios sin guardar del editor se reemplazan." })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", children: t("CANCEL") }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: handleGenerate, isLoading: generateMut.isPending, children: "Generar" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open: !!promptCfg, onOpenChange: (open) => !open && closePrompt(), children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Title, { children: promptCfg == null ? void 0 : promptCfg.title }) }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Body, { className: "flex flex-col gap-3", children: [
        (promptCfg == null ? void 0 : promptCfg.description) ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: promptCfg.description }) : null,
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "prompt-input", children: promptCfg == null ? void 0 : promptCfg.label }),
          (promptCfg == null ? void 0 : promptCfg.multiline) ? /* @__PURE__ */ jsxRuntime.jsx(
            ui.Textarea,
            {
              id: "prompt-input",
              rows: 3,
              autoFocus: true,
              placeholder: promptCfg == null ? void 0 : promptCfg.placeholder,
              value: promptValue,
              onChange: (e) => setPromptValue(e.target.value)
            }
          ) : /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              id: "prompt-input",
              autoFocus: true,
              placeholder: promptCfg == null ? void 0 : promptCfg.placeholder,
              value: promptValue,
              onChange: (e) => setPromptValue(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmPrompt();
                }
              }
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", onClick: closePrompt, children: t("CANCEL") }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: confirmPrompt, children: (promptCfg == null ? void 0 : promptCfg.confirmText) ?? "Aplicar" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] });
};
async function loader({ params }) {
  const id = params.id ?? "";
  if (id === "new") return { breadcrumb: "Nueva landing" };
  try {
    const { landing_page } = await sdk.client.fetch(
      `/admin/landing-pages/${id}`,
      { method: "GET" }
    );
    return { breadcrumb: (landing_page == null ? void 0 : landing_page.title) ?? id };
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
      Component: LandingPagesPage,
      path: "/landing-pages",
      handle: { label: config$2.label, translationNs: config$2.translationNs, ...handle$2 }
    },
    {
      Component: CredentialsPage,
      path: "/landing-pages/credenciales",
      handle: { label: config$1.label, translationNs: config$1.translationNs, ...handle$1 }
    },
    {
      Component: LandingPageEditor,
      path: "/landing-pages/:id",
      handle,
      loader
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config$2.label,
      icon: config$2.icon,
      path: "/landing-pages",
      nested: void 0,
      rank: 40,
      translationNs: void 0
    },
    {
      label: config$1.label,
      icon: void 0,
      path: "/landing-pages/credenciales",
      nested: void 0,
      rank: 99,
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
