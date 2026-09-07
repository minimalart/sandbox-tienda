"use strict";
const jsxRuntime = require("react/jsx-runtime");
const adminSdk = require("@medusajs/admin-sdk");
const ui = require("@medusajs/ui");
const reactQuery = require("@tanstack/react-query");
const icons = require("@medusajs/icons");
const reactRouterDom = require("react-router-dom");
const react = require("react");
const admin = require("@minimalart/mercatto-plugin-runtime/admin");
require("@medusajs/admin-shared");
const version = "1.1.0";
const pkg = {
  version
};
const PLUGIN_VERSION = pkg.version;
const ExtensionVersion = (_props) => /* @__PURE__ */ jsxRuntime.jsxs(ui.Badge, { size: "2xsmall", color: "grey", rounded: "full", title: "Plugin version", children: [
  "v",
  PLUGIN_VERSION
] });
function toQueryString(query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === void 0 || value === null || value === "") continue;
    params.append(key, String(value));
  }
  return params.toString();
}
const PROGRAMS_URL = "/admin/loyalty/programs";
const RULES_URL = "/admin/loyalty/rules";
const REWARDS_URL = "/admin/loyalty/rewards";
const GRANTS_URL = "/admin/loyalty/grants";
const TIERS_URL = "/admin/loyalty/tiers";
const CAMPAIGNS_URL = "/admin/loyalty/campaigns";
const ACTIVE_SITE_STORAGE_KEY$1 = "ms:active-site";
const SITE_ID_HEADER$1 = "x-site-id";
function siteHeader$1() {
  var _a;
  try {
    const raw = typeof globalThis !== "undefined" ? (_a = globalThis.localStorage) == null ? void 0 : _a.getItem(ACTIVE_SITE_STORAGE_KEY$1) : null;
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      const id = typeof (parsed == null ? void 0 : parsed.id) === "string" ? parsed.id.trim() : "";
      return id ? { [SITE_ID_HEADER$1]: id } : {};
    } catch {
      const id = raw.trim();
      return id ? { [SITE_ID_HEADER$1]: id } : {};
    }
  } catch {
    return {};
  }
}
const LOYALTY_QUERY_KEY = ["loyalty"];
async function fetchJson$1(url, init) {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...siteHeader$1(),
      ...(init == null ? void 0 : init.headers) ?? {}
    },
    credentials: "include"
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}
function useLoyaltyPrograms() {
  return reactQuery.useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, "programs"],
    queryFn: () => fetchJson$1(PROGRAMS_URL)
  });
}
function useCreateProgram() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (body) => fetchJson$1(PROGRAMS_URL, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useUpdateProgram() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: ({ id, ...body }) => fetchJson$1(`${PROGRAMS_URL}/${id}`, {
      method: "POST",
      body: JSON.stringify(body)
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useEarnRules(params) {
  const qs = toQueryString(params);
  const url = qs ? `${RULES_URL}?${qs}` : RULES_URL;
  return reactQuery.useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, "rules", params ?? {}],
    queryFn: () => fetchJson$1(url)
  });
}
function useCreateRule() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (body) => fetchJson$1(RULES_URL, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useUpdateRule() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: ({ id, ...body }) => fetchJson$1(`${RULES_URL}/${id}`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useDeleteRule() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson$1(`${RULES_URL}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useRewards(params) {
  const qs = toQueryString(params);
  const url = qs ? `${REWARDS_URL}?${qs}` : REWARDS_URL;
  return reactQuery.useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, "rewards", params ?? {}],
    queryFn: () => fetchJson$1(url)
  });
}
function useCreateReward() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (body) => fetchJson$1(REWARDS_URL, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useUpdateReward() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: ({ id, ...body }) => fetchJson$1(`${REWARDS_URL}/${id}`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useDeleteReward() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson$1(`${REWARDS_URL}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useGrants(params) {
  const qs = toQueryString(params);
  const url = qs ? `${GRANTS_URL}?${qs}` : GRANTS_URL;
  return reactQuery.useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, "grants", {}],
    queryFn: () => fetchJson$1(url)
  });
}
function useTiers(params) {
  const qs = toQueryString(params);
  const url = qs ? `${TIERS_URL}?${qs}` : TIERS_URL;
  return reactQuery.useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, "tiers", params ?? {}],
    queryFn: () => fetchJson$1(url)
  });
}
function useCreateTier() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (body) => fetchJson$1(TIERS_URL, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useUpdateTier() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: ({ id, ...body }) => fetchJson$1(`${TIERS_URL}/${id}`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useDeleteTier() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson$1(`${TIERS_URL}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useCampaigns(params) {
  const qs = toQueryString(params);
  const url = qs ? `${CAMPAIGNS_URL}?${qs}` : CAMPAIGNS_URL;
  return reactQuery.useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, "campaigns", params ?? {}],
    queryFn: () => fetchJson$1(url)
  });
}
function useCreateCampaign() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (body) => fetchJson$1(CAMPAIGNS_URL, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useUpdateCampaign() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: ({ id, ...body }) => fetchJson$1(`${CAMPAIGNS_URL}/${id}`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useDeleteCampaign() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson$1(`${CAMPAIGNS_URL}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LOYALTY_QUERY_KEY })
  });
}
function useLoyaltyDashboard() {
  return reactQuery.useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, "dashboard"],
    queryFn: () => fetchJson$1("/admin/loyalty/dashboard")
  });
}
function useMovements(params) {
  const qs = toQueryString(params);
  const url = qs ? `/admin/loyalty/movements?${qs}` : "/admin/loyalty/movements";
  return reactQuery.useQuery({
    queryKey: [...LOYALTY_QUERY_KEY, "movements", params ?? {}],
    queryFn: () => fetchJson$1(url)
  });
}
function useCustomerLoyalty(customerId) {
  return reactQuery.useQuery({
    enabled: Boolean(customerId),
    queryKey: [...LOYALTY_QUERY_KEY, "customer", customerId],
    queryFn: () => fetchJson$1(`/admin/loyalty/customers/${customerId}`)
  });
}
const TYPE_LABEL$1 = {
  earn: "Acumulación",
  redeem: "Canje",
  adjust: "Ajuste",
  reverse: "Reversión",
  expire: "Vencimiento"
};
const CustomerLoyaltyWidget = ({ data: customer }) => {
  var _a, _b;
  const { data, isLoading } = useCustomerLoyalty(customer.id);
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "divide-y p-0", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h2", children: "Fidelización" }),
      /* @__PURE__ */ jsxRuntime.jsx(ExtensionVersion, { extension: "loyalty-engine" })
    ] }),
    isLoading || !data ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-4", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", size: "small", children: "Cargando…" }) }) : /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-4 px-6 py-4", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap items-center gap-6", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", size: "small", children: "Saldo de puntos" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "font-semibold", size: "large", children: (data.balance ?? 0).toLocaleString("es-AR") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", size: "small", children: "Nivel" }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-0.5", children: ((_a = data.tier) == null ? void 0 : _a.name) ? /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { color: "green", size: "small", children: data.tier.name }) : /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-muted", children: "—" }) })
        ] }),
        ((_b = data.progress) == null ? void 0 : _b.next) && /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", size: "small", children: "Próximo nivel" }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { size: "small", children: [
            data.progress.next.name,
            " · faltan ",
            data.progress.toNext
          ] })
        ] })
      ] }),
      data.grants.filter((g) => g.status === "available").length > 0 && /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "mb-1 text-ui-fg-subtle", size: "small", children: "Beneficios disponibles" }),
        /* @__PURE__ */ jsxRuntime.jsx("ul", { className: "flex flex-col gap-1", children: data.grants.filter((g) => g.status === "available").map((g) => {
          var _a2;
          return /* @__PURE__ */ jsxRuntime.jsxs("li", { className: "text-sm text-ui-fg-base", children: [
            ((_a2 = g.reward) == null ? void 0 : _a2.name) ?? "Beneficio",
            g.benefit_type === "promotion" && g.benefit_ref ? ` · ${g.benefit_ref}` : ""
          ] }, g.id);
        }) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "mb-1 text-ui-fg-subtle", size: "small", children: "Últimos movimientos" }),
        data.transactions.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-muted", children: "Sin movimientos." }) : /* @__PURE__ */ jsxRuntime.jsx("ul", { className: "flex flex-col gap-1", children: data.transactions.slice(0, 6).map((t) => /* @__PURE__ */ jsxRuntime.jsxs("li", { className: "flex justify-between text-sm", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("span", { className: "text-ui-fg-subtle", children: [
            new Date(t.created_at).toLocaleDateString("es-AR"),
            " · ",
            TYPE_LABEL$1[t.type] ?? t.type
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx("span", { className: t.amount < 0 ? "text-rose-600" : "text-emerald-600", children: t.amount > 0 ? `+${t.amount}` : t.amount })
        ] }, t.id)) })
      ] })
    ] })
  ] });
};
adminSdk.defineWidgetConfig({
  zone: "customer.details.after"
});
const LoyaltyIndex = () => /* @__PURE__ */ jsxRuntime.jsx(reactRouterDom.Navigate, { to: "/loyalty/dashboard", replace: true });
const LoyaltyIcon = () => /* @__PURE__ */ jsxRuntime.jsx(icons.Trophy, { style: { color: "#D97706" } });
const config$9 = adminSdk.defineRouteConfig({
  label: "Fidelización",
  icon: LoyaltyIcon,
  rank: 50
});
const handle$9 = {
  breadcrumb: () => "Fidelización"
};
const ACTIVE_SITE_STORAGE_KEY = "ms:active-site";
const ACTIVE_SITE_QUERY_PARAM = "site";
const SITE_ID_HEADER = "x-site-id";
let pinnedFromUrl;
const listeners = /* @__PURE__ */ new Set();
const safeStorage = () => {
  try {
    return typeof globalThis !== "undefined" ? globalThis.localStorage ?? null : null;
  } catch {
    return null;
  }
};
function readPinnedFromUrl() {
  var _a;
  if (pinnedFromUrl !== void 0) return pinnedFromUrl;
  try {
    const search = (_a = globalThis.location) == null ? void 0 : _a.search;
    const value = search ? new URLSearchParams(search).get(ACTIVE_SITE_QUERY_PARAM) : null;
    pinnedFromUrl = value && value.trim() ? value.trim() : null;
  } catch {
    pinnedFromUrl = null;
  }
  return pinnedFromUrl;
}
function getActiveSiteId() {
  var _a;
  const pinned = readPinnedFromUrl();
  if (pinned) return pinned;
  try {
    return ((_a = safeStorage()) == null ? void 0 : _a.getItem(ACTIVE_SITE_STORAGE_KEY)) ?? null;
  } catch {
    return null;
  }
}
function getActiveSiteSnapshot() {
  var _a;
  try {
    const raw = (_a = safeStorage()) == null ? void 0 : _a.getItem(`${ACTIVE_SITE_STORAGE_KEY}:snapshot`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed == null ? void 0 : parsed.id) === getActiveSiteId() ? parsed : null;
  } catch {
    return null;
  }
}
function siteHeader() {
  const id = getActiveSiteId();
  return id ? { [SITE_ID_HEADER]: id } : {};
}
function setActiveSite(site, options = {}) {
  var _a, _b;
  const id = typeof site === "string" ? site : (site == null ? void 0 : site.id) ?? null;
  try {
    const storage = safeStorage();
    if (!storage) return;
    if (id) {
      storage.setItem(ACTIVE_SITE_STORAGE_KEY, id);
      if (typeof site === "object" && site) {
        storage.setItem(`${ACTIVE_SITE_STORAGE_KEY}:snapshot`, JSON.stringify(site));
      }
    } else {
      storage.removeItem(ACTIVE_SITE_STORAGE_KEY);
      storage.removeItem(`${ACTIVE_SITE_STORAGE_KEY}:snapshot`);
    }
  } catch {
  }
  if (options.reload === false) {
    for (const listener of [...listeners]) listener();
    return;
  }
  try {
    (_b = (_a = globalThis.location) == null ? void 0 : _a.reload) == null ? void 0 : _b.call(_a);
  } catch {
  }
}
function subscribeActiveSite(onChange) {
  var _a;
  listeners.add(onChange);
  const onStorage = (event) => {
    if (event.key === ACTIVE_SITE_STORAGE_KEY) onChange();
  };
  const target = globalThis;
  (_a = target.addEventListener) == null ? void 0 : _a.call(target, "storage", onStorage);
  return () => {
    var _a2;
    listeners.delete(onChange);
    (_a2 = target.removeEventListener) == null ? void 0 : _a2.call(target, "storage", onStorage);
  };
}
async function fetchJson(url, init) {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...siteHeader(),
      // Los headers del caller ganan: alguno manda `Content-Type` propio para subir
      // archivos, y pisarlo desde acá rompería esos uploads.
      ...{}
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? res.statusText);
  }
  return res.json();
}
const MULTISTORE_MANIFEST_QUERY_KEY = ["multistore", "manifest"];
function useActiveSite() {
  const activeId = react.useSyncExternalStore(
    subscribeActiveSite,
    getActiveSiteId,
    () => null
    // Primer render del bundle: todavía sin tienda.
  );
  const { data, isPending } = reactQuery.useQuery({
    queryKey: MULTISTORE_MANIFEST_QUERY_KEY,
    queryFn: () => fetchJson("/admin/multistore/manifest"),
    // El registro de tiendas cambia rarísimo y esto lo pide cada pantalla.
    staleTime: 5 * 60 * 1e3,
    retry: false
  });
  const sites = (data == null ? void 0 : data.sites) ?? [];
  const activeSite = activeId ? sites.find((site) => site.id === activeId) ?? null : null;
  const staleSelection = Boolean(activeId) && !isPending && sites.length > 0 && !activeSite;
  return {
    activeId,
    activeSite,
    /** Para pintar el nombre antes de que resuelva el manifest, sin flash de "…". */
    snapshot: getActiveSiteSnapshot(),
    sites,
    isPending,
    enabled: Boolean(data == null ? void 0 : data.enabled),
    staleSelection,
    setActiveSite
  };
}
const SCREEN_SITE_SCOPE = {
  "loyalty/dashboard": "scoped",
  "loyalty/programs": "scoped",
  "loyalty/rules": "scoped",
  "loyalty/rewards": "scoped",
  "loyalty/tiers": "scoped",
  "loyalty/grants": "scoped",
  "loyalty/campaigns": "scoped",
  "loyalty/movimientos": "scoped",
  // Configuration is a per-tenant screen too when a program is scoped by site.
  "loyalty/configuracion": "scoped"
};
const resolveScreenScope = (screen) => SCREEN_SITE_SCOPE[screen] ?? "unscoped";
const SHELL = {
  bar: "justify-between gap-2 border-b border-ui-border-base px-6 py-2",
  card: "mb-3 justify-between gap-x-3 gap-y-2 rounded-lg border border-ui-border-base px-4 py-2.5"
};
const INSTANCE_OPTION = "__instance__";
const SCOPE_COPY = {
  scoped: {
    label: "Filtra por tienda",
    detail: "Lo que ves y lo que edites acá pertenece a la tienda seleccionada.",
    color: "green"
  },
  unscoped: {
    label: "Todavía no filtra",
    detail: "Esta pantalla muestra datos de todas las tiendas, y lo que edites acá aplica a todas. Su migración está pendiente.",
    color: "orange"
  },
  instance: {
    label: "Configuración de la instancia",
    detail: "Esto es único para todo el backoffice, por diseño. No cambia según la tienda seleccionada.",
    color: "grey"
  }
};
const SiteScopeBar = ({
  screen,
  reloadOnChange = true,
  allowInstance = false,
  variant = "bar"
}) => {
  const { activeSite, snapshot, sites, isPending, enabled, staleSelection, setActiveSite: setActiveSite2 } = useActiveSite();
  const scope = resolveScreenScope(screen);
  const copy = SCOPE_COPY[scope];
  if (!isPending && (!enabled || sites.length <= 1)) return null;
  const selected = (activeSite == null ? void 0 : activeSite.id) ?? (snapshot == null ? void 0 : snapshot.id) ?? (allowInstance ? INSTANCE_OPTION : "");
  const selectedName = (activeSite == null ? void 0 : activeSite.name) ?? (snapshot == null ? void 0 : snapshot.name) ?? (allowInstance ? "Configuración de la instancia" : "Todas las tiendas");
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `flex flex-wrap items-center bg-ui-bg-subtle ${SHELL[variant]}`, children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsxRuntime.jsx(icons.Buildings, { className: "text-ui-fg-subtle" }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: "Tienda" }),
      /* @__PURE__ */ jsxRuntime.jsxs(
        ui.Select,
        {
          size: "small",
          value: selected,
          onValueChange: (value) => {
            const next = sites.find((site) => site.id === value);
            setActiveSite2(next ? { id: next.id, slug: next.slug, name: next.name } : null, {
              reload: reloadOnChange
            });
          },
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { className: "min-w-[190px]", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, { placeholder: selectedName }) }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { children: [
              allowInstance && /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: INSTANCE_OPTION, children: "Configuración de la instancia" }),
              sites.map((site) => /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Item, { value: site.id, children: [
                site.name,
                site.is_main ? " · principal" : ""
              ] }, site.id))
            ] })
          ]
        }
      ),
      staleSelection && /* @__PURE__ */ jsxRuntime.jsx(ui.Tooltip, { content: "La tienda que tenías seleccionada ya no existe. Elegí otra para volver a filtrar.", children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: "inline-flex items-center", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: "red", rounded: "full", children: "tienda no encontrada" }) }) })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Tooltip, { content: copy.detail, children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: "inline-flex cursor-help items-center", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: copy.color, rounded: "full", children: copy.label }) }) })
  ] });
};
const toLocalInput = (iso) => iso ? new Date(iso).toISOString().slice(0, 16) : "";
const empty$1 = { name: "", status: "active", starts_at: "", ends_at: "", multiplier: "2", priority: "0" };
const LoyaltyCampaignsPage = () => {
  var _a, _b;
  const { data: programsData } = useLoyaltyPrograms();
  const program = ((_a = programsData == null ? void 0 : programsData.programs) == null ? void 0 : _a.find((p) => p.status === "active")) ?? ((_b = programsData == null ? void 0 : programsData.programs) == null ? void 0 : _b[0]);
  const { data, isLoading } = useCampaigns(program ? { program_id: program.id } : void 0);
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const prompt = ui.usePrompt();
  const [open, setOpen] = react.useState(false);
  const [form, setForm] = react.useState(empty$1);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const openCreate = () => {
    setForm(empty$1);
    setOpen(true);
  };
  const openEdit = (c) => {
    setForm({
      id: c.id,
      name: c.name,
      status: c.status,
      starts_at: toLocalInput(c.starts_at),
      ends_at: toLocalInput(c.ends_at),
      multiplier: String(c.multiplier),
      priority: String(c.priority)
    });
    setOpen(true);
  };
  const onSave = async () => {
    if (!program) return;
    const body = {
      program_id: program.id,
      name: form.name,
      status: form.status,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      multiplier: Number(form.multiplier) || 1,
      priority: Number(form.priority) || 0
    };
    try {
      if (form.id) await updateCampaign.mutateAsync({ id: form.id, ...body });
      else await createCampaign.mutateAsync(body);
      ui.toast.success("Campaña guardada");
      setOpen(false);
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  const onDelete = async (c) => {
    if (!await prompt({ title: "Eliminar campaña", description: `¿Eliminar "${c.name}"?` })) return;
    try {
      await deleteCampaign.mutateAsync(c.id);
      ui.toast.success("Campaña eliminada");
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  const campaigns = (data == null ? void 0 : data.campaigns) ?? [];
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "divide-y p-0", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h1", children: "Campañas" }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ExtensionVersion, { extension: "loyalty" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", onClick: openCreate, disabled: !program, children: "Nueva campaña" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(SiteScopeBar, { screen: "loyalty/campaigns" }),
    !program ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-8", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Creá el programa en Configuración primero." }) }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-4", children: isLoading ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Cargando…" }) : campaigns.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "No hay campañas todavía." }) : /* @__PURE__ */ jsxRuntime.jsxs(ui.Table, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Header, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Nombre" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Multiplicador" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Prioridad" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Vigencia" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Estado" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, {})
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Body, { children: campaigns.map((c) => /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: c.name }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Cell, { children: [
          "x",
          c.multiplier
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: c.priority }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Cell, { children: [
          c.starts_at ? new Date(c.starts_at).toLocaleDateString("es-AR") : "—",
          " → ",
          c.ends_at ? new Date(c.ends_at).toLocaleDateString("es-AR") : "—"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { color: c.status === "active" ? "green" : "grey", size: "2xsmall", children: c.status === "active" ? "Activa" : "Inactiva" }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { variant: "transparent", children: /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, {}) }) }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { children: [
            /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { onClick: () => openEdit(c), children: [
              /* @__PURE__ */ jsxRuntime.jsx(icons.PencilSquare, { className: "mr-2" }),
              " Editar"
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { onClick: () => onDelete(c), children: [
              /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "mr-2" }),
              " Eliminar"
            ] })
          ] })
        ] }) })
      ] }, c.id)) })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open, onOpenChange: setOpen, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Title, { children: form.id ? "Editar campaña" : "Nueva campaña" }) }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Body, { className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Nombre" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.name, onChange: (e) => set("name", e.target.value) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Multiplicador" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.multiplier, onChange: (e) => set("multiplier", e.target.value) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Prioridad" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.priority, onChange: (e) => set("priority", e.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Desde" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "datetime-local", value: form.starts_at, onChange: (e) => set("starts_at", e.target.value) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Hasta" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "datetime-local", value: form.ends_at, onChange: (e) => set("ends_at", e.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Estado" }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.status, onValueChange: (v) => set("status", v), children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { className: "z-[60]", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "active", children: "Activa" }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "inactive", children: "Inactiva" })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", onClick: () => setOpen(false), children: "Cancelar" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: onSave, isLoading: createCampaign.isPending || updateCampaign.isPending, children: "Guardar" })
      ] })
    ] }) })
  ] });
};
const config$8 = adminSdk.defineRouteConfig({ label: "Campañas" });
const handle$8 = { breadcrumb: () => "Campañas" };
const STATUS = {
  pending: { label: "Pendiente", color: "orange" },
  available: { label: "Disponible", color: "green" },
  used: { label: "Utilizado", color: "grey" },
  expired: { label: "Expirado", color: "red" },
  cancelled: { label: "Cancelado", color: "red" }
};
const LoyaltyGrantsPage = () => {
  const { data, isLoading } = useGrants();
  const grants = (data == null ? void 0 : data.grants) ?? [];
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "divide-y p-0", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h1", children: "Canjes" }),
      /* @__PURE__ */ jsxRuntime.jsx(ExtensionVersion, { extension: "loyalty" })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(SiteScopeBar, { screen: "loyalty/grants" }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-4", children: isLoading ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Cargando…" }) : grants.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Todavía no hay canjes." }) : /* @__PURE__ */ jsxRuntime.jsxs(ui.Table, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Header, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Recompensa" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Cliente" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Beneficio" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Puntos" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Estado" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Fecha" })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Body, { children: grants.map((g) => {
        var _a, _b, _c;
        return /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: ((_a = g.reward) == null ? void 0 : _a.name) ?? "—" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { className: "font-mono text-xs", children: g.customer_id }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: g.benefit_type === "promotion" ? `Cupón ${g.benefit_ref ?? ""}` : g.benefit_type === "store_credit" ? "Store credit" : "—" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: g.points_spent }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { color: ((_b = STATUS[g.status]) == null ? void 0 : _b.color) ?? "grey", size: "2xsmall", children: ((_c = STATUS[g.status]) == null ? void 0 : _c.label) ?? g.status }) }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: new Date(g.created_at).toLocaleDateString("es-AR") })
        ] }, g.id);
      }) })
    ] }) })
  ] });
};
const config$7 = adminSdk.defineRouteConfig({
  label: "Canjes"
});
const handle$7 = {
  breadcrumb: () => "Canjes"
};
const fromProgram = (p) => {
  var _a, _b;
  return {
    name: p.name ?? "",
    points_name: p.points_name ?? "puntos",
    currency_code: p.currency_code ?? "ars",
    status: p.status ?? "active",
    expiration_type: ((_a = p.expiration_policy) == null ? void 0 : _a.type) ?? "none",
    expiration_days: ((_b = p.expiration_policy) == null ? void 0 : _b.days) ? String(p.expiration_policy.days) : ""
  };
};
const LoyaltyConfigPage = () => {
  var _a, _b;
  const { data, isLoading } = useLoyaltyPrograms();
  const createProgram = useCreateProgram();
  const updateProgram = useUpdateProgram();
  const program = ((_a = data == null ? void 0 : data.programs) == null ? void 0 : _a.find((p) => p.status === "active")) ?? ((_b = data == null ? void 0 : data.programs) == null ? void 0 : _b[0]);
  const [form, setForm] = react.useState(null);
  react.useEffect(() => {
    if (program) setForm(fromProgram(program));
  }, [program == null ? void 0 : program.id]);
  const set = (key, value) => setForm((f) => f ? { ...f, [key]: value } : f);
  const buildPolicy = (f) => {
    if (f.expiration_type === "fixed_days") return { type: "fixed_days", days: Number(f.expiration_days) || 0 };
    return { type: f.expiration_type };
  };
  const onCreate = async () => {
    try {
      await createProgram.mutateAsync({
        name: "Programa de fidelización",
        points_name: "puntos",
        currency_code: "ars",
        status: "active",
        expiration_policy: { type: "none" }
      });
      ui.toast.success("Programa creado");
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  const onSave = async () => {
    if (!program || !form) return;
    try {
      await updateProgram.mutateAsync({
        id: program.id,
        name: form.name,
        points_name: form.points_name,
        currency_code: form.currency_code,
        status: form.status,
        expiration_policy: buildPolicy(form)
      });
      ui.toast.success("Configuración guardada");
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-y-2", children: [
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "divide-y p-0", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h1", children: "Programa de fidelización" }),
        /* @__PURE__ */ jsxRuntime.jsx(ExtensionVersion, { extension: "loyalty" })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(SiteScopeBar, { screen: "loyalty/configuracion" }),
      isLoading && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-8", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Cargando…" }) }),
      !isLoading && !program && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col items-start gap-3 px-6 py-8", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Todavía no hay un programa. Creá uno para empezar a acumular puntos." }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: onCreate, isLoading: createProgram.isPending, children: "Crear programa" })
      ] }),
      !isLoading && program && form && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex max-w-2xl flex-col gap-4 px-6 py-6", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Nombre" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.name, onChange: (e) => set("name", e.target.value) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Nombre de los puntos" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.points_name, onChange: (e) => set("points_name", e.target.value) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Moneda" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.currency_code, onChange: (e) => set("currency_code", e.target.value) })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Estado" }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.status, onValueChange: (v) => set("status", v), children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
              /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "active", children: "Activo" }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "inactive", children: "Inactivo" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Vencimiento de puntos" }),
            /* @__PURE__ */ jsxRuntime.jsxs(
              ui.Select,
              {
                value: form.expiration_type,
                onValueChange: (v) => set("expiration_type", v),
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
                  /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { children: [
                    /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "none", children: "No vencen" }),
                    /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "fixed_days", children: "A los N días" }),
                    /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "end_of_year", children: "Fin de año" })
                  ] })
                ]
              }
            )
          ] })
        ] }),
        form.expiration_type === "fixed_days" && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Días hasta el vencimiento" }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              type: "number",
              value: form.expiration_days,
              onChange: (e) => set("expiration_days", e.target.value)
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2 pt-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: onSave, isLoading: updateProgram.isPending, children: "Guardar" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { color: form.status === "active" ? "green" : "grey", size: "2xsmall", children: form.status === "active" ? "Activo" : "Inactivo" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(
      admin.ExtensionSettingsCard,
      {
        namespace: "extension:loyalty-engine",
        title: "Acumulación legacy y entorno",
        description: "La tasa de acumulación anterior al motor de reglas: se usa SÓLO mientras no haya un programa activo. Apenas exista uno, mandan sus reglas y este número deja de mirarse."
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] });
};
const config$6 = adminSdk.defineRouteConfig({
  label: "Configuración"
});
const handle$6 = {
  breadcrumb: () => "Configuración"
};
const CredentialsPage = () => /* @__PURE__ */ jsxRuntime.jsx(reactRouterDom.Navigate, { to: "/settings/site-credentials#loyalty", replace: true });
const config$5 = adminSdk.defineRouteConfig({ label: "Credenciales", rank: 99 });
const handle$5 = { breadcrumb: () => "Credenciales" };
const fmt = (n) => (Number(n) || 0).toLocaleString("es-AR");
const Kpi = ({ label, value }) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "rounded-xl border border-ui-border-base bg-ui-bg-subtle px-4 py-3", children: [
  /* @__PURE__ */ jsxRuntime.jsx("p", { className: "text-ui-fg-subtle text-xs", children: label }),
  /* @__PURE__ */ jsxRuntime.jsx("p", { className: "mt-1 text-xl font-semibold text-ui-fg-base", children: value })
] });
const LoyaltyDashboardPage = () => {
  const { data, isLoading } = useLoyaltyDashboard();
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "divide-y p-0", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h1", children: "Dashboard" }),
      /* @__PURE__ */ jsxRuntime.jsx(ExtensionVersion, { extension: "loyalty" })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(SiteScopeBar, { screen: "loyalty/dashboard" }),
    isLoading || !data ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-8", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Cargando…" }) }) : /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-6 px-6 py-6", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-3 md:grid-cols-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx(Kpi, { label: "Puntos emitidos", value: fmt(data.issued) }),
        /* @__PURE__ */ jsxRuntime.jsx(Kpi, { label: "Puntos canjeados", value: fmt(data.redeemed) }),
        /* @__PURE__ */ jsxRuntime.jsx(Kpi, { label: "Puntos vencidos", value: fmt(data.expired) }),
        /* @__PURE__ */ jsxRuntime.jsx(Kpi, { label: "Clientes activos", value: fmt(data.active_customers) }),
        /* @__PURE__ */ jsxRuntime.jsx(Kpi, { label: "Balance promedio", value: fmt(data.avg_balance) }),
        /* @__PURE__ */ jsxRuntime.jsx(Kpi, { label: "Canjes totales", value: fmt(data.total_redemptions) }),
        /* @__PURE__ */ jsxRuntime.jsx(Kpi, { label: "Canjes pendientes", value: fmt(data.pending_redemptions) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h2", className: "mb-2 text-base", children: "Top recompensas" }),
        data.top_rewards.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Todavía no hay canjes." }) : /* @__PURE__ */ jsxRuntime.jsxs(ui.Table, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Header, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Recompensa" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Canjes" })
          ] }) }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Body, { children: data.top_rewards.map((r) => /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: r.name }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: r.count })
          ] }, r.name)) })
        ] })
      ] })
    ] })
  ] });
};
const config$4 = adminSdk.defineRouteConfig({ label: "Dashboard" });
const handle$4 = { breadcrumb: () => "Dashboard" };
const TYPE_LABEL = {
  earn: "Acumulación",
  redeem: "Canje",
  adjust: "Ajuste",
  reverse: "Reversión",
  expire: "Vencimiento"
};
const STATUS_COLOR = {
  available: "green",
  pending: "orange",
  expired: "grey",
  reversed: "red"
};
const PAGE = 50;
const LoyaltyMovementsPage = () => {
  const [offset, setOffset] = react.useState(0);
  const { data, isLoading } = useMovements({ limit: PAGE, offset });
  const movements = (data == null ? void 0 : data.movements) ?? [];
  const count = (data == null ? void 0 : data.count) ?? 0;
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "divide-y p-0", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h1", children: "Movimientos" }),
      /* @__PURE__ */ jsxRuntime.jsx(ExtensionVersion, { extension: "loyalty" })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(SiteScopeBar, { screen: "loyalty/movimientos" }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-4", children: isLoading ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Cargando…" }) : movements.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "No hay movimientos." }) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Table, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Header, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Fecha" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Tipo" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Monto" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Estado" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Referencia" })
        ] }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Body, { children: movements.map((m) => /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: new Date(m.created_at).toLocaleString("es-AR") }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: TYPE_LABEL[m.type] ?? m.type }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { className: m.amount < 0 ? "text-rose-600" : "text-emerald-600", children: m.amount > 0 ? `+${m.amount}` : m.amount }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { color: STATUS_COLOR[m.status] ?? "grey", size: "2xsmall", children: m.status }) }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Cell, { className: "text-xs text-ui-fg-subtle", children: [
            m.reference ?? "—",
            m.reference_id ? ` · ${m.reference_id}` : ""
          ] })
        ] }, m.id)) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mt-4 flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: [
          offset + 1,
          "–",
          Math.min(offset + PAGE, count),
          " de ",
          count
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "secondary", disabled: offset === 0, onClick: () => setOffset(Math.max(0, offset - PAGE)), children: "Anterior" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "secondary", disabled: offset + PAGE >= count, onClick: () => setOffset(offset + PAGE), children: "Siguiente" })
        ] })
      ] })
    ] }) })
  ] });
};
const config$3 = adminSdk.defineRouteConfig({ label: "Movimientos" });
const handle$3 = { breadcrumb: () => "Movimientos" };
const TYPE_LABELS = {
  fixed_discount: "Descuento fijo",
  percent_discount: "Descuento %",
  free_shipping: "Envío gratis",
  free_product: "Producto gratis",
  store_credit: "Store credit",
  custom: "Personalizada"
};
const emptyForm$1 = {
  name: "",
  description: "",
  type: "percent_discount",
  cost_points: "500",
  value: "10",
  product_id: "",
  stock: "",
  status: "active"
};
const usesValue = (t) => t === "fixed_discount" || t === "percent_discount" || t === "store_credit";
const LoyaltyRewardsPage = () => {
  var _a, _b;
  const { data: programsData } = useLoyaltyPrograms();
  const program = ((_a = programsData == null ? void 0 : programsData.programs) == null ? void 0 : _a.find((p) => p.status === "active")) ?? ((_b = programsData == null ? void 0 : programsData.programs) == null ? void 0 : _b[0]);
  const { data, isLoading } = useRewards(program ? { program_id: program.id } : void 0);
  const createReward = useCreateReward();
  const updateReward = useUpdateReward();
  const deleteReward = useDeleteReward();
  const prompt = ui.usePrompt();
  const [open, setOpen] = react.useState(false);
  const [form, setForm] = react.useState(emptyForm$1);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const openCreate = () => {
    setForm(emptyForm$1);
    setOpen(true);
  };
  const openEdit = (r) => {
    var _a2, _b2;
    setForm({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      type: r.type,
      cost_points: String(r.cost_points),
      value: ((_a2 = r.config) == null ? void 0 : _a2.value) != null ? String(r.config.value) : "",
      product_id: ((_b2 = r.config) == null ? void 0 : _b2.product_id) ?? "",
      stock: r.stock != null ? String(r.stock) : "",
      status: r.status
    });
    setOpen(true);
  };
  const onSave = async () => {
    if (!program) return;
    const config2 = {};
    if (usesValue(form.type)) config2.value = Number(form.value) || 0;
    if (form.type === "store_credit") config2.currency_code = program.currency_code;
    if (form.type === "free_product" && form.product_id) config2.product_id = form.product_id;
    const body = {
      program_id: program.id,
      name: form.name,
      description: form.description || null,
      type: form.type,
      cost_points: Number(form.cost_points) || 0,
      config: config2,
      stock: form.stock === "" ? null : Number(form.stock),
      status: form.status
    };
    try {
      if (form.id) await updateReward.mutateAsync({ id: form.id, ...body });
      else await createReward.mutateAsync(body);
      ui.toast.success("Recompensa guardada");
      setOpen(false);
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  const onDelete = async (r) => {
    const ok = await prompt({ title: "Eliminar recompensa", description: `¿Eliminar "${r.name}"?` });
    if (!ok) return;
    try {
      await deleteReward.mutateAsync(r.id);
      ui.toast.success("Recompensa eliminada");
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  const rewards = (data == null ? void 0 : data.rewards) ?? [];
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "divide-y p-0", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h1", children: "Recompensas" }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ExtensionVersion, { extension: "loyalty" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", onClick: openCreate, disabled: !program, children: "Nueva recompensa" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(SiteScopeBar, { screen: "loyalty/rewards" }),
    !program && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-8", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Creá el programa en Configuración antes de agregar recompensas." }) }),
    program && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-4", children: isLoading ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Cargando…" }) : rewards.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "No hay recompensas todavía." }) : /* @__PURE__ */ jsxRuntime.jsxs(ui.Table, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Header, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Nombre" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Tipo" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Costo" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Stock" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Estado" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, {})
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Body, { children: rewards.map((r) => /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: r.name }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: TYPE_LABELS[r.type] }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Cell, { children: [
          r.cost_points,
          " pts"
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: r.stock == null ? "∞" : r.stock }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { color: r.status === "active" ? "green" : "grey", size: "2xsmall", children: r.status === "active" ? "Activa" : "Inactiva" }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { variant: "transparent", children: /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, {}) }) }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { children: [
            /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { onClick: () => openEdit(r), children: [
              /* @__PURE__ */ jsxRuntime.jsx(icons.PencilSquare, { className: "mr-2" }),
              " Editar"
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { onClick: () => onDelete(r), children: [
              /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "mr-2" }),
              " Eliminar"
            ] })
          ] })
        ] }) })
      ] }, r.id)) })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open, onOpenChange: setOpen, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Title, { children: form.id ? "Editar recompensa" : "Nueva recompensa" }) }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Body, { className: "flex flex-col gap-4 overflow-y-auto", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Nombre" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.name, onChange: (e) => set("name", e.target.value) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Descripción" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Textarea, { value: form.description, onChange: (e) => set("description", e.target.value) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Tipo" }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.type, onValueChange: (v) => set("type", v), children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { className: "z-[60]", children: Object.entries(TYPE_LABELS).map(([value, label]) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value, children: label }, value)) })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Costo (puntos)" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.cost_points, onChange: (e) => set("cost_points", e.target.value) })
          ] })
        ] }),
        usesValue(form.type) && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: form.type === "percent_discount" ? "Porcentaje (%)" : form.type === "store_credit" ? "Monto de crédito" : "Monto del descuento" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.value, onChange: (e) => set("value", e.target.value) })
        ] }),
        form.type === "free_product" && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Product ID gratis" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.product_id, onChange: (e) => set("product_id", e.target.value), placeholder: "prod_..." })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Stock (vacío = ilimitado)" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.stock, onChange: (e) => set("stock", e.target.value) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Estado" }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.status, onValueChange: (v) => set("status", v), children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
              /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { className: "z-[60]", children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "active", children: "Activa" }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "inactive", children: "Inactiva" })
              ] })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", onClick: () => setOpen(false), children: "Cancelar" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: onSave, isLoading: createReward.isPending || updateReward.isPending, children: "Guardar" })
      ] })
    ] }) })
  ] });
};
const config$2 = adminSdk.defineRouteConfig({
  label: "Recompensas"
});
const handle$2 = {
  breadcrumb: () => "Recompensas"
};
const EVENT_LABELS = {
  purchase: "Compra",
  signup: "Registro",
  first_purchase: "Primera compra",
  order_delivered: "Pedido entregado",
  birthday: "Cumpleaños",
  referral: "Referido",
  comment: "Comentario"
};
const CALC_LABELS = {
  fixed: "Puntos fijos",
  percentage: "Porcentaje",
  multiplier: "Multiplicador"
};
const emptyForm = {
  name: "",
  event: "purchase",
  calc_type: "percentage",
  calc_value: "10",
  priority: "0",
  status: "active"
};
const describeCalc = (r) => {
  if (r.calc_type === "fixed") return `${r.calc_value} pts`;
  if (r.calc_type === "percentage") return `${r.calc_value}%`;
  return `x${r.calc_value}`;
};
const LoyaltyRulesPage = () => {
  var _a, _b;
  const { data: programsData } = useLoyaltyPrograms();
  const program = ((_a = programsData == null ? void 0 : programsData.programs) == null ? void 0 : _a.find((p) => p.status === "active")) ?? ((_b = programsData == null ? void 0 : programsData.programs) == null ? void 0 : _b[0]);
  const { data, isLoading } = useEarnRules(program ? { program_id: program.id } : void 0);
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const prompt = ui.usePrompt();
  const [open, setOpen] = react.useState(false);
  const [form, setForm] = react.useState(emptyForm);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (r) => {
    setForm({
      id: r.id,
      name: r.name,
      event: r.event,
      calc_type: r.calc_type,
      calc_value: String(r.calc_value),
      priority: String(r.priority ?? 0),
      status: r.status
    });
    setOpen(true);
  };
  const onSave = async () => {
    if (!program) return;
    const body = {
      program_id: program.id,
      name: form.name,
      event: form.event,
      calc_type: form.calc_type,
      calc_value: Number(form.calc_value) || 0,
      priority: Number(form.priority) || 0,
      status: form.status
    };
    try {
      if (form.id) await updateRule.mutateAsync({ id: form.id, ...body });
      else await createRule.mutateAsync(body);
      ui.toast.success("Regla guardada");
      setOpen(false);
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  const onDelete = async (r) => {
    const ok = await prompt({
      title: "Eliminar regla",
      description: `¿Eliminar la regla "${r.name}"?`
    });
    if (!ok) return;
    try {
      await deleteRule.mutateAsync(r.id);
      ui.toast.success("Regla eliminada");
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  const rules = (data == null ? void 0 : data.rules) ?? [];
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "divide-y p-0", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h1", children: "Reglas de acumulación" }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ExtensionVersion, { extension: "loyalty" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", onClick: openCreate, disabled: !program, children: "Nueva regla" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(SiteScopeBar, { screen: "loyalty/rules" }),
    !program && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-8", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Creá el programa en Configuración antes de agregar reglas." }) }),
    program && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-4", children: isLoading ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Cargando…" }) : rules.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "No hay reglas todavía." }) : /* @__PURE__ */ jsxRuntime.jsxs(ui.Table, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Header, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Nombre" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Evento" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Cálculo" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Prioridad" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Estado" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, {})
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Body, { children: rules.map((r) => /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: r.name }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: EVENT_LABELS[r.event] }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Cell, { children: [
          CALC_LABELS[r.calc_type],
          " · ",
          describeCalc(r)
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: r.priority }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { color: r.status === "active" ? "green" : "grey", size: "2xsmall", children: r.status === "active" ? "Activa" : "Inactiva" }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { variant: "transparent", children: /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, {}) }) }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { children: [
            /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { onClick: () => openEdit(r), children: [
              /* @__PURE__ */ jsxRuntime.jsx(icons.PencilSquare, { className: "mr-2" }),
              " Editar"
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { onClick: () => onDelete(r), children: [
              /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "mr-2" }),
              " Eliminar"
            ] })
          ] })
        ] }) })
      ] }, r.id)) })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open, onOpenChange: setOpen, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Title, { children: form.id ? "Editar regla" : "Nueva regla" }) }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Body, { className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Nombre" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.name, onChange: (e) => set("name", e.target.value) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Evento" }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.event, onValueChange: (v) => set("event", v), children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { className: "z-[60]", children: Object.entries(EVENT_LABELS).map(([value, label]) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value, children: label }, value)) })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Tipo de cálculo" }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.calc_type, onValueChange: (v) => set("calc_type", v), children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { className: "z-[60]", children: Object.entries(CALC_LABELS).map(([value, label]) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value, children: label }, value)) })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Valor" }),
            /* @__PURE__ */ jsxRuntime.jsx(
              ui.Input,
              {
                type: "number",
                value: form.calc_value,
                onChange: (e) => set("calc_value", e.target.value)
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: [
          form.calc_type === "fixed" && "Puntos fijos otorgados.",
          form.calc_type === "percentage" && "Porcentaje del monto elegible (10 = 10% ≈ 1 punto por $10).",
          form.calc_type === "multiplier" && "Puntos por unidad de moneda (1 = 1 punto por $1)."
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Prioridad" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.priority, onChange: (e) => set("priority", e.target.value) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Estado" }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.status, onValueChange: (v) => set("status", v), children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
              /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { className: "z-[60]", children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "active", children: "Activa" }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "inactive", children: "Inactiva" })
              ] })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", onClick: () => setOpen(false), children: "Cancelar" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: onSave, isLoading: createRule.isPending || updateRule.isPending, children: "Guardar" })
      ] })
    ] }) })
  ] });
};
const config$1 = adminSdk.defineRouteConfig({
  label: "Reglas"
});
const handle$1 = {
  breadcrumb: () => "Reglas"
};
const COND_LABELS = {
  spend: "Gasto acumulado",
  points: "Puntos obtenidos",
  orders: "Cantidad de pedidos"
};
const empty = { name: "", condition_type: "points", threshold: "0", multiplier: "1" };
const LoyaltyTiersPage = () => {
  var _a, _b;
  const { data: programsData } = useLoyaltyPrograms();
  const program = ((_a = programsData == null ? void 0 : programsData.programs) == null ? void 0 : _a.find((p) => p.status === "active")) ?? ((_b = programsData == null ? void 0 : programsData.programs) == null ? void 0 : _b[0]);
  const { data, isLoading } = useTiers(program ? { program_id: program.id } : void 0);
  const createTier = useCreateTier();
  const updateTier = useUpdateTier();
  const deleteTier = useDeleteTier();
  const prompt = ui.usePrompt();
  const [open, setOpen] = react.useState(false);
  const [form, setForm] = react.useState(empty);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const openCreate = () => {
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (t) => {
    setForm({ id: t.id, name: t.name, condition_type: t.condition_type, threshold: String(t.threshold), multiplier: String(t.multiplier) });
    setOpen(true);
  };
  const onSave = async () => {
    if (!program) return;
    const body = {
      program_id: program.id,
      name: form.name,
      condition_type: form.condition_type,
      threshold: Number(form.threshold) || 0,
      multiplier: Number(form.multiplier) || 1
    };
    try {
      if (form.id) await updateTier.mutateAsync({ id: form.id, ...body });
      else await createTier.mutateAsync(body);
      ui.toast.success("Nivel guardado");
      setOpen(false);
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  const onDelete = async (t) => {
    if (!await prompt({ title: "Eliminar nivel", description: `¿Eliminar "${t.name}"?` })) return;
    try {
      await deleteTier.mutateAsync(t.id);
      ui.toast.success("Nivel eliminado");
    } catch (e) {
      ui.toast.error(e.message);
    }
  };
  const tiers = (data == null ? void 0 : data.tiers) ?? [];
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "divide-y p-0", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h1", children: "Niveles" }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ExtensionVersion, { extension: "loyalty" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", onClick: openCreate, disabled: !program, children: "Nuevo nivel" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(SiteScopeBar, { screen: "loyalty/tiers" }),
    !program ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-8", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Creá el programa en Configuración primero." }) }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-6 py-4", children: isLoading ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "Cargando…" }) : tiers.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: "No hay niveles todavía." }) : /* @__PURE__ */ jsxRuntime.jsxs(ui.Table, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Header, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Nombre" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Condición" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Umbral" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, { children: "Multiplicador" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.HeaderCell, {})
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Body, { children: tiers.map((t) => /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Row, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: t.name }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: COND_LABELS[t.condition_type] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: t.threshold }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Table.Cell, { children: [
          "x",
          t.multiplier
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Table.Cell, { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { variant: "transparent", children: /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, {}) }) }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { children: [
            /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { onClick: () => openEdit(t), children: [
              /* @__PURE__ */ jsxRuntime.jsx(icons.PencilSquare, { className: "mr-2" }),
              " Editar"
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { onClick: () => onDelete(t), children: [
              /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "mr-2" }),
              " Eliminar"
            ] })
          ] })
        ] }) })
      ] }, t.id)) })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open, onOpenChange: setOpen, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Title, { children: form.id ? "Editar nivel" : "Nuevo nivel" }) }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Body, { className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Nombre" }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { value: form.name, onChange: (e) => set("name", e.target.value) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Condición de acceso" }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.condition_type, onValueChange: (v) => set("condition_type", v), children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { className: "z-[60]", children: Object.entries(COND_LABELS).map(([value, label]) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value, children: label }, value)) })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-2 gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Umbral" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.threshold, onChange: (e) => set("threshold", e.target.value) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", children: "Multiplicador de puntos" }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { type: "number", value: form.multiplier, onChange: (e) => set("multiplier", e.target.value) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", onClick: () => setOpen(false), children: "Cancelar" }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: onSave, isLoading: createTier.isPending || updateTier.isPending, children: "Guardar" })
      ] })
    ] }) })
  ] });
};
const config = adminSdk.defineRouteConfig({ label: "Niveles" });
const handle = { breadcrumb: () => "Niveles" };
const widgetModule = { widgets: [
  {
    Component: CustomerLoyaltyWidget,
    zone: ["customer.details.after"],
    widgetId: "Widget-89fc"
  }
] };
const routeModule = {
  routes: [
    {
      Component: LoyaltyIndex,
      path: "/loyalty",
      handle: { label: config$9.label, translationNs: config$9.translationNs, ...handle$9 }
    },
    {
      Component: LoyaltyCampaignsPage,
      path: "/loyalty/campanas",
      handle: { label: config$8.label, translationNs: config$8.translationNs, ...handle$8 }
    },
    {
      Component: LoyaltyGrantsPage,
      path: "/loyalty/canjes",
      handle: { label: config$7.label, translationNs: config$7.translationNs, ...handle$7 }
    },
    {
      Component: LoyaltyConfigPage,
      path: "/loyalty/configuracion",
      handle: { label: config$6.label, translationNs: config$6.translationNs, ...handle$6 }
    },
    {
      Component: CredentialsPage,
      path: "/loyalty/credenciales",
      handle: { label: config$5.label, translationNs: config$5.translationNs, ...handle$5 }
    },
    {
      Component: LoyaltyDashboardPage,
      path: "/loyalty/dashboard",
      handle: { label: config$4.label, translationNs: config$4.translationNs, ...handle$4 }
    },
    {
      Component: LoyaltyMovementsPage,
      path: "/loyalty/movimientos",
      handle: { label: config$3.label, translationNs: config$3.translationNs, ...handle$3 }
    },
    {
      Component: LoyaltyRewardsPage,
      path: "/loyalty/recompensas",
      handle: { label: config$2.label, translationNs: config$2.translationNs, ...handle$2 }
    },
    {
      Component: LoyaltyRulesPage,
      path: "/loyalty/reglas",
      handle: { label: config$1.label, translationNs: config$1.translationNs, ...handle$1 }
    },
    {
      Component: LoyaltyTiersPage,
      path: "/loyalty/niveles",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config$9.label,
      icon: config$9.icon,
      path: "/loyalty",
      nested: void 0,
      rank: 50,
      translationNs: void 0
    },
    {
      label: config$8.label,
      icon: void 0,
      path: "/loyalty/campanas",
      nested: void 0,
      rank: void 0,
      translationNs: void 0
    },
    {
      label: config$6.label,
      icon: void 0,
      path: "/loyalty/configuracion",
      nested: void 0,
      rank: void 0,
      translationNs: void 0
    },
    {
      label: config$5.label,
      icon: void 0,
      path: "/loyalty/credenciales",
      nested: void 0,
      rank: 99,
      translationNs: void 0
    },
    {
      label: config$4.label,
      icon: void 0,
      path: "/loyalty/dashboard",
      nested: void 0,
      rank: void 0,
      translationNs: void 0
    },
    {
      label: config$7.label,
      icon: void 0,
      path: "/loyalty/canjes",
      nested: void 0,
      rank: void 0,
      translationNs: void 0
    },
    {
      label: config$3.label,
      icon: void 0,
      path: "/loyalty/movimientos",
      nested: void 0,
      rank: void 0,
      translationNs: void 0
    },
    {
      label: config$1.label,
      icon: void 0,
      path: "/loyalty/reglas",
      nested: void 0,
      rank: void 0,
      translationNs: void 0
    },
    {
      label: config$2.label,
      icon: void 0,
      path: "/loyalty/recompensas",
      nested: void 0,
      rank: void 0,
      translationNs: void 0
    },
    {
      label: config.label,
      icon: void 0,
      path: "/loyalty/niveles",
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
