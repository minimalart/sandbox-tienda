"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const jsxRuntime = require("react/jsx-runtime");
const adminSdk = require("@medusajs/admin-sdk");
const icons = require("@medusajs/icons");
const reactRouterDom = require("react-router-dom");
const ui = require("@medusajs/ui");
const react = require("react");
const reactI18next = require("react-i18next");
const reactQuery = require("@tanstack/react-query");
require("@medusajs/admin-shared");
const Ga4Redirect = () => /* @__PURE__ */ jsxRuntime.jsx(reactRouterDom.Navigate, { to: "/ga4/events", replace: true });
const Ga4Icon = () => /* @__PURE__ */ jsxRuntime.jsx(icons.ChartBar, { style: { color: "#7270F5" } });
const config$2 = adminSdk.defineRouteConfig({
  label: "GA4",
  icon: Ga4Icon,
  rank: 90
});
const handle$2 = {
  breadcrumb: () => "GA4"
};
class FetchError extends Error {
  constructor(message, status) {
    super(message);
    __publicField(this, "status");
    this.status = status;
    this.name = "FetchError";
  }
}
async function adminFetch(url, opts = {}) {
  const init = {
    method: opts.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...opts.headers ?? {}
    }
  };
  if (opts.body !== void 0) {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new FetchError(`${res.status} ${res.statusText}`, res.status);
  }
  return res.json();
}
const sdk = {
  client: {
    fetch: adminFetch
  }
};
function queryKeysFactory(globalKey) {
  const factory = {
    all: [globalKey],
    lists: () => [...factory.all, "list"],
    list: (query) => [...factory.lists(), { query }],
    details: () => [...factory.all, "detail"],
    detail: (id, query) => [...factory.details(), id, { query }]
  };
  return factory;
}
const ga4MappingQueryKey = queryKeysFactory("ga4-mapping");
const ga4SupportedEventsQueryKey = queryKeysFactory("ga4-supported-events");
const ga4BuiltinQueryKey = queryKeysFactory("ga4-builtin");
const ga4ConfigQueryKey = queryKeysFactory("ga4-config");
const useGa4Mappings = (query, options) => {
  const filterQuery = new URLSearchParams(query).toString();
  const fetchMappings = async () => sdk.client.fetch(
    `/admin/ga4-mappings${filterQuery ? `?${filterQuery}` : ""}`,
    {
      method: "GET"
    }
  );
  return reactQuery.useQuery({
    queryKey: ga4MappingQueryKey.list(query),
    queryFn: fetchMappings,
    ...options
  });
};
const useGa4Mapping = (id, query, options) => {
  const filterQuery = new URLSearchParams(query).toString();
  const fetchMapping = async () => sdk.client.fetch(
    `/admin/ga4-mappings/${id}${filterQuery ? `?${filterQuery}` : ""}`,
    {
      method: "GET"
    }
  );
  return reactQuery.useQuery({
    queryKey: ga4MappingQueryKey.detail(id),
    queryFn: fetchMapping,
    enabled: !!id,
    ...options
  });
};
const useCreateGa4Mapping = (options) => {
  const queryClient = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (mapping) => sdk.client.fetch("/admin/ga4-mappings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: mapping
    }),
    // `...options` va ANTES del onSuccess para que el wrapper (con la
    // invalidación) gane y llame él mismo al onSuccess del caller.
    ...options,
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({
        queryKey: ga4MappingQueryKey.lists()
      });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    }
  });
};
const useUpdateGa4Mapping = (id, options) => {
  const queryClient = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (mapping) => sdk.client.fetch(`/admin/ga4-mappings/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: mapping
    }),
    ...options,
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({
        queryKey: ga4MappingQueryKey.lists()
      });
      queryClient.invalidateQueries({
        queryKey: ga4MappingQueryKey.detail(id)
      });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    }
  });
};
const useDeleteGa4Mapping = (id, options) => {
  const queryClient = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: () => sdk.client.fetch(`/admin/ga4-mappings/${id}`, {
      method: "DELETE"
    }),
    ...options,
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({
        queryKey: ga4MappingQueryKey.lists()
      });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    }
  });
};
const useSupportedEvents = (options) => {
  const fetchEvents = async () => sdk.client.fetch("/admin/ga4-mappings/events", {
    method: "GET"
  });
  return reactQuery.useQuery({
    queryKey: ga4SupportedEventsQueryKey.lists(),
    queryFn: fetchEvents,
    ...options
  });
};
const useGa4Builtins = (options) => {
  const fetchBuiltins = async () => sdk.client.fetch("/admin/ga4-builtins", {
    method: "GET"
  });
  return reactQuery.useQuery({
    queryKey: ga4BuiltinQueryKey.lists(),
    queryFn: fetchBuiltins,
    ...options
  });
};
const useUpdateGa4Builtin = (builtinKey, options) => {
  const queryClient = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (patch) => sdk.client.fetch(`/admin/ga4-builtins/${builtinKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: patch
    }),
    ...options,
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({
        queryKey: ga4BuiltinQueryKey.lists()
      });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    }
  });
};
const useGa4Config = (options) => {
  const fetchConfig = async () => sdk.client.fetch("/admin/ga4-config", { method: "GET" });
  return reactQuery.useQuery({
    queryKey: ga4ConfigQueryKey.lists(),
    queryFn: fetchConfig,
    ...options
  });
};
const useTestGa4Config = (options) => reactQuery.useMutation({
  mutationFn: () => sdk.client.fetch("/admin/ga4-config/test", {
    method: "POST"
  }),
  ...options
});
const GA4_EVENTS_NAMESPACE = "ga4Events";
let registered = false;
const eventI18nKey = (medusaEvent) => medusaEvent.replace(/\./g, "_");
const en = {
  // List page
  TITLE: "GA4 Events",
  // Config panel (server-side status: checklist, GA link, test event)
  CONFIG_TITLE: "GA4 configuration",
  CONFIG_MEASUREMENT_ID: "GA4 Measurement ID",
  CONFIG_DISPATCH_ACTIVE: "Server-side active",
  CONFIG_DISPATCH_INACTIVE: "Server-side inactive",
  CONFIG_DISPATCH_HINT: "Set GA_MEASUREMENT_ID and GA_API_SECRET on the backend to send events to GA4.",
  CONFIG_DEBUG: "Debug",
  CONFIG_OPEN_GA4: "Open Google Analytics",
  CONFIG_TEST_BUTTON: "Send test event",
  CONFIG_TEST_HELP: "The test sends this event to GA4’s validation endpoint — it does not record a real hit in your property:",
  CONFIG_TEST_SUCCESS: "Connection OK — GA4 validated “{{event}}” with no errors.",
  CONFIG_TEST_INVALID: "GA4 rejected the test event:",
  CONFIG_TEST_NOT_CONFIGURED: "Not configured — set GA_MEASUREMENT_ID and GA_API_SECRET on the backend first.",
  CONFIG_TEST_DISABLED_TOOLTIP: "Set GA_MEASUREMENT_ID and GA_API_SECRET on the backend to enable the test event.",
  CONFIG_CHECKLIST_TITLE: "To activate server-side sending:",
  CONFIG_CHECKLIST_API_SECRET: "Measurement Protocol API Secret (GA_API_SECRET)",
  // Config form (editable fields + save)
  CONFIG_SAVE: "Save",
  CONFIG_SAVED: "Configuration saved successfully",
  CONFIG_SAVE_ERROR: "Failed to save the configuration: {{msg}}",
  CONFIG_FIELD_MEASUREMENT: "GA4 Measurement ID",
  CONFIG_FIELD_SECRET: "Measurement Protocol API Secret",
  CONFIG_FIELD_GTM: "Google Tag Manager ID",
  CONFIG_FIELD_DEBUG: "Debug mode",
  CONFIG_SECRET_SET_PLACEHOLDER: "Already set — leave blank to keep it",
  // Why this mapping (rationale based on Google's recommended events)
  WHY_LABEL: "Why this mapping",
  WHY_SOURCE: "Google's recommended events",
  WHY: {
    customer_created: "Google recommends sign_up to measure user registrations. Fires when the customer account is created.",
    contact_submission_created: "Google recommends generate_lead for lead capture (interest form submissions). A contact form is a direct lead capture.",
    company_created: "Creating a company is a B2B account sign-up; sign_up is Google’s recommended event for registrations.",
    company_member_joined: "Google recommends join_group when a user joins a group. A member joining a company is exactly that (group_id = the company).",
    corporate_created: "A corporate registration is a qualified B2B lead; generate_lead is Google’s lead-capture event.",
    corporate_activated: "Activation makes the corporate account live — mapped to sign_up (the effective account creation).",
    corporate_member_joined: "A member joining a corporate account → join_group (group_id = the corporate account).",
    purchase: "purchase is GA4’s core ecommerce conversion (revenue, transactions). Google recommends it to measure sales; fires when the order is placed.",
    refund: "refund is Google’s recommended ecommerce event to measure returned revenue. Fires when a payment is refunded; sends the refunded value and items.",
    add_to_cart: "A purchase-funnel event Google recommends; marks buying intent when a product is added to the cart.",
    remove_from_cart: "A funnel event Google recommends; measures friction/abandonment when items are removed from the cart.",
    add_shipping_info: "A checkout step Google recommends measuring; fires when shipping details are set.",
    add_payment_info: "A checkout step Google recommends measuring; fires when payment starts (payment session created).",
    begin_checkout: "Google recommends begin_checkout when checkout starts. It’s a navigation event (fired by the storefront) with no backend equivalent."
  },
  COLUMN_TITLE: "Title",
  COLUMN_TYPE: "Type",
  COLUMN_MEDUSA_EVENT: "Medusa event",
  COLUMN_GA4_EVENT: "GA4 event",
  COLUMN_STATUS: "Status",
  COLUMN_ACTIONS: "Actions",
  STATUS_ACTIVE: "Active",
  STATUS_INACTIVE: "Inactive",
  STATUS_REMOVED: "Removed",
  // "Status" table filter (radio). No filter = removed are hidden.
  FILTER_STATUS: "Status",
  FILTER_STATUS_ACTIVE: "Active",
  FILTER_STATUS_INACTIVE: "Inactive",
  FILTER_STATUS_REMOVED: "Removed",
  FILTER_CLEAR_ALL: "Clear all",
  // Row type (how each event is managed)
  TYPE: {
    builtin: "Automatic",
    generic: "Custom",
    readonly: "Storefront"
  },
  // Tooltip on the type badge explaining what each type means
  TYPE_HINT: {
    builtin: "Ecommerce funnel event sent by the backend. Its payload (items, value) is computed automatically — you can only turn it on/off and rename the GA4 event.",
    generic: "A mapping you fully control: pick the Medusa event, the GA4 event name and its parameters.",
    readonly: "Fired by the storefront in the browser (gtag.js). Shown for context — it can’t be managed from here."
  },
  // Customer-journey stage (groups the list into a funnel)
  STAGE: {
    funnel: "Ecommerce funnel",
    acquisition: "Acquisition & leads",
    b2b: "B2B lifecycle"
  },
  EMPTY_STATE: "No event mappings yet. Create your first mapping to start sending events to GA4.",
  CREATE_BUTTON: "Create",
  SEARCH_PLACEHOLDER: "Search mappings",
  // Form fields (shared by create & edit)
  FIELD_MEDUSA_EVENT_LABEL: "Medusa event *",
  FIELD_MEDUSA_EVENT_PLACEHOLDER: "Select an event",
  FIELD_MEDUSA_EVENT_SEARCH: "Search events…",
  SEARCH_NO_RESULTS: "No results",
  FIELD_MEDUSA_EVENT_HELP: "The Medusa event that triggers this mapping",
  FIELD_GA4_EVENT_LABEL: "GA4 event name *",
  FIELD_GA4_EVENT_PLACEHOLDER: "purchase",
  FIELD_GA4_EVENT_HELP: "The event name reported to Google Analytics 4",
  FIELD_DESCRIPTION_LABEL: "Description",
  FIELD_DESCRIPTION_PLACEHOLDER: "What this mapping is for",
  FIELD_ACTIVE_LABEL: "Active",
  FIELD_ACTIVE_HELP: "Inactive mappings will not send events to GA4",
  // Advanced section
  ADVANCED_TITLE: "Advanced options",
  // Param mappings editor
  PARAMS_TITLE: "Parameter mappings",
  PARAMS_HELP: "Map GA4 parameters to a value taken from the event payload or a fixed value.",
  PARAMS_SUGGESTED: "Suggested parameters: {{params}}",
  PARAMS_EXAMPLE: 'Example: a "Source path" of order.total reads that field from the event payload; a "Static value" of USD always sends that exact value. Use one or the other per row — static value wins if both are set.',
  PARAM_GA4_PARAM_LABEL: "GA4 param",
  PARAM_GA4_PARAM_PLACEHOLDER: "value",
  PARAM_SOURCE_PATH_LABEL: "Source path",
  PARAM_SOURCE_PATH_PLACEHOLDER: "order.total",
  PARAM_STATIC_VALUE_LABEL: "Static value",
  PARAM_STATIC_VALUE_PLACEHOLDER: "fixed value",
  PARAM_REMOVE: "Remove",
  PARAM_ADD: "Add parameter",
  // Create drawer
  CREATE_TITLE: "Create mapping",
  CREATE_SUBMIT: "Create mapping",
  CREATE_SUCCESS: "Mapping created successfully",
  CREATE_ERROR: "Failed to create mapping: {{msg}}",
  VALIDATION_REQUIRED: "Medusa event and GA4 event name are required",
  // Edit drawer
  EDIT_TITLE: "Edit mapping",
  EDIT_SUBMIT: "Save changes",
  UPDATE_SUCCESS: "Mapping updated successfully",
  UPDATE_ERROR: "Failed to update mapping: {{msg}}",
  // Common buttons
  CANCEL: "Cancel",
  // Actions menu
  ACTION_EDIT: "Edit",
  ACTION_DELETE: "Delete",
  ACTION_VIEW: "View detail",
  ACTION_RESTORE: "Restore",
  DELETE_PROMPT_TITLE: "Delete mapping",
  DELETE_PROMPT_DESCRIPTION: 'Are you sure you want to delete the mapping for "{{event}}"? This action cannot be undone.',
  DELETE_PROMPT_CONFIRM: "Delete",
  DELETE_PROMPT_CANCEL: "Cancel",
  DELETE_SUCCESS: "Mapping deleted successfully",
  DELETE_ERROR: "Failed to delete mapping: {{msg}}",
  DELETE_DISABLED_MANAGED: "Storefront events are fired by the browser; they aren’t managed from the backend.",
  HIDE_BUILTIN_PROMPT_TITLE: "Remove this event?",
  HIDE_BUILTIN_PROMPT_DESC: "It will disappear from the list and stop being sent to GA4. You can restore it later.",
  HIDE_BUILTIN_SUCCESS: "Event removed",
  RESTORE_SUCCESS: "Event restored",
  // Event category labels (keyed by category)
  CATEGORIES: {
    recomendados: "Recommended",
    b2b: "Companies & corporate (B2B)"
  },
  // Ecommerce events already tracked elsewhere (read-only rows)
  STATUS_TRACKED: "Active",
  MANAGED_REASON: "Already sent automatically by {{source}} — managed outside this module to avoid duplicate events.",
  SOURCE: {
    plugin: "Plugin (server)",
    storefront: "Storefront (client)"
  },
  // Built-in ecommerce events (server-side; payload computed automatically)
  BUILTIN_NOTE: "The event content (items, value, currency) is computed automatically.",
  BUILTIN: {
    purchase: {
      TITLE: "Purchase",
      DESC: "When an order is placed. Sends items, value, tax and shipping."
    },
    refund: {
      TITLE: "Refund",
      DESC: "When a payment is refunded. Sends the refunded value, currency and items."
    },
    add_to_cart: { TITLE: "Add to cart", DESC: "When items are added to the cart." },
    remove_from_cart: { TITLE: "Remove from cart", DESC: "When items are removed from the cart." },
    add_shipping_info: {
      TITLE: "Add shipping info",
      DESC: "When a shipping address is set on the cart."
    },
    add_payment_info: { TITLE: "Add payment info", DESC: "When a payment session is created." }
  },
  MANAGED: {
    begin_checkout: {
      TITLE: "Checkout started",
      DESC: "Fires when the shopper reaches the checkout page. Tracked by the storefront (gtag.js) in the browser."
    }
  },
  MANAGED_MEDUSA_NONE: "None — browser event (no Medusa backend event)",
  MANAGED_WHY: {
    storefront: "This is a client-side navigation event fired by the storefront when the shopper enters checkout. There is no equivalent Medusa backend event, so it can’t be managed from this extension.",
    plugin: "This event is sent automatically by an external integration, not by this module, so it can’t be managed here."
  },
  DETAIL_TITLE: "Event details",
  DETAIL_SOURCE_LABEL: "Source",
  DETAIL_WHY_LABEL: "Why it can’t be edited",
  // Friendly event titles & descriptions (keyed by eventI18nKey(medusa_event))
  EVENTS: {
    customer_created: {
      TITLE: "Customer sign-up",
      DESC: "When a new customer creates an account in the store."
    },
    contact_submission_created: {
      TITLE: "Contact form submitted",
      DESC: "When a visitor submits the contact form — captured as a lead."
    },
    company_created: {
      TITLE: "Company created",
      DESC: "When a company (B2B) is created (direct sign-up, no approval step)."
    },
    company_member_joined: {
      TITLE: "Member joined company",
      DESC: "When a user joins an existing company."
    },
    corporate_created: {
      TITLE: "Corporate registration submitted",
      DESC: "When a corporate registration form is submitted (stays pending until approved) — a lead."
    },
    corporate_member_joined: {
      TITLE: "Member joined corporate",
      DESC: "When a user accepts the invitation and joins the corporate account."
    },
    corporate_activated: {
      TITLE: "Corporate account activated",
      DESC: "When a corporate account becomes active."
    },
    corporate_suspended: {
      TITLE: "Corporate account suspended",
      DESC: "When a corporate account is suspended."
    },
    corporate_member_invited: {
      TITLE: "Corporate invitation",
      DESC: "When a user is invited to a corporate account."
    },
    corporate_rule_updated: {
      TITLE: "Corporate rule updated",
      DESC: "When a rule of the corporate account is modified."
    },
    billing_profile_created: {
      TITLE: "Billing profile created",
      DESC: "When a customer creates a billing profile."
    },
    billing_profile_updated: {
      TITLE: "Billing profile updated",
      DESC: "When a billing profile is modified."
    },
    billing_profile_deleted: {
      TITLE: "Billing profile deleted",
      DESC: "When a billing profile is deleted."
    },
    billing_profile_default_changed: {
      TITLE: "Default billing profile changed",
      DESC: "When the customer changes their default billing profile."
    },
    order_fulfillment_created: {
      TITLE: "Order shipped",
      DESC: "When a fulfillment is created for an order."
    },
    order_fulfillment_canceled: {
      TITLE: "Shipment canceled",
      DESC: "When an order fulfillment is canceled."
    },
    product_created: {
      TITLE: "Product created",
      DESC: "When a product is created in the catalog (admin event, no user)."
    },
    product_updated: {
      TITLE: "Product updated",
      DESC: "When a product is modified in the catalog (admin event)."
    },
    product_deleted: {
      TITLE: "Product deleted",
      DESC: "When a product is deleted from the catalog (admin event)."
    }
  }
};
const es = {
  // List page
  TITLE: "Eventos GA4",
  // Panel de configuración (estado server-side: checklist, link a GA, prueba)
  CONFIG_TITLE: "Configuración de GA4",
  CONFIG_MEASUREMENT_ID: "Measurement ID de GA4",
  CONFIG_DISPATCH_ACTIVE: "Envío server-side activo",
  CONFIG_DISPATCH_INACTIVE: "Envío server-side inactivo",
  CONFIG_DISPATCH_HINT: "Configurá GA_MEASUREMENT_ID y GA_API_SECRET en el backend para enviar eventos a GA4.",
  CONFIG_DEBUG: "Debug",
  CONFIG_OPEN_GA4: "Abrir Google Analytics",
  CONFIG_TEST_BUTTON: "Enviar evento de prueba",
  CONFIG_TEST_HELP: "La prueba envía este evento al endpoint de validación de GA4 — no registra un hit real en tu propiedad:",
  CONFIG_TEST_SUCCESS: "Conexión OK — GA4 validó “{{event}}” sin errores.",
  CONFIG_TEST_INVALID: "GA4 rechazó el evento de prueba:",
  CONFIG_TEST_NOT_CONFIGURED: "Sin configurar — primero seteá GA_MEASUREMENT_ID y GA_API_SECRET en el backend.",
  CONFIG_TEST_DISABLED_TOOLTIP: "Configurá GA_MEASUREMENT_ID y GA_API_SECRET en el backend para habilitar el evento de prueba.",
  CONFIG_CHECKLIST_TITLE: "Para activar el envío server-side:",
  CONFIG_CHECKLIST_API_SECRET: "API Secret del Measurement Protocol (GA_API_SECRET)",
  // Formulario de configuración (campos editables + guardar)
  CONFIG_SAVE: "Guardar",
  CONFIG_SAVED: "Configuración guardada correctamente",
  CONFIG_SAVE_ERROR: "Error al guardar la configuración: {{msg}}",
  CONFIG_FIELD_MEASUREMENT: "Measurement ID de GA4",
  CONFIG_FIELD_SECRET: "API Secret del Measurement Protocol",
  CONFIG_FIELD_GTM: "ID de Google Tag Manager",
  CONFIG_FIELD_DEBUG: "Modo debug",
  CONFIG_SECRET_SET_PLACEHOLDER: "Ya está configurado — dejalo vacío para conservarlo",
  // Por qué esta asociación (rationale basado en los eventos recomendados de Google)
  WHY_LABEL: "Por qué esta asociación",
  WHY_SOURCE: "Eventos recomendados de Google",
  WHY: {
    customer_created: "Google recomienda sign_up para medir altas de usuarios. Se dispara cuando el cliente crea su cuenta.",
    contact_submission_created: "Google recomienda generate_lead para la captura de leads (envío de formularios de interés). El form de contacto es una captura de lead directa.",
    company_created: "El alta de una empresa es la creación de una cuenta B2B; sign_up es el evento que Google recomienda para registros.",
    company_member_joined: "Google recomienda join_group cuando un usuario se une a un grupo. Un miembro sumándose a una empresa es exactamente eso (group_id = la empresa).",
    corporate_created: "El registro corporativo es un lead calificado B2B; generate_lead es el evento de captura de leads de Google.",
    corporate_activated: "La activación deja la cuenta corporativa operativa — se mapea a sign_up (el alta efectiva de la cuenta).",
    corporate_member_joined: "Un miembro que se suma a un corporativo → join_group (group_id = el corporativo).",
    purchase: "purchase es la conversión central de ecommerce en GA4 (revenue, transacciones). Google lo recomienda para medir ventas; se dispara al confirmarse la orden.",
    refund: "refund es el evento de ecommerce que Google recomienda para medir revenue devuelto. Se dispara al reembolsar un pago; envía el valor reembolsado y los ítems.",
    add_to_cart: "Evento del embudo de compra que Google recomienda; marca la intención de compra al agregar un producto al carrito.",
    remove_from_cart: "Evento del embudo recomendado por Google; mide fricción/abandono al quitar productos del carrito.",
    add_shipping_info: "Paso del checkout que Google recomienda medir; se dispara al cargar los datos de envío.",
    add_payment_info: "Paso del checkout que Google recomienda medir; se dispara al iniciar el pago (sesión de pago creada).",
    begin_checkout: "Google recomienda begin_checkout al iniciar el checkout. Es un evento de navegación (lo dispara el storefront); no tiene equivalente de backend."
  },
  COLUMN_TITLE: "Título",
  COLUMN_TYPE: "Tipo",
  COLUMN_MEDUSA_EVENT: "Evento de Medusa",
  COLUMN_GA4_EVENT: "Evento de GA4",
  COLUMN_STATUS: "Estado",
  COLUMN_ACTIONS: "Acciones",
  STATUS_ACTIVE: "Activo",
  STATUS_INACTIVE: "Inactivo",
  STATUS_REMOVED: "Eliminado",
  // Filtro "Estado" de la tabla (radio). Sin filtro = los eliminados se ocultan.
  FILTER_STATUS: "Estado",
  FILTER_STATUS_ACTIVE: "Activo",
  FILTER_STATUS_INACTIVE: "Inactivo",
  FILTER_STATUS_REMOVED: "Eliminado",
  FILTER_CLEAR_ALL: "Limpiar todo",
  // Tipo de fila (cómo se gestiona cada evento)
  TYPE: {
    builtin: "Automático",
    generic: "Personalizable",
    readonly: "Storefront"
  },
  // Tooltip del badge de tipo, explicando qué significa cada uno
  TYPE_HINT: {
    builtin: "Evento del embudo ecommerce que envía el backend. El payload (ítems, valor) se calcula solo — solo podés activarlo/desactivarlo y renombrar el evento GA4.",
    generic: "Un mapeo que controlás por completo: elegís el evento de Medusa, el nombre del evento GA4 y sus parámetros.",
    readonly: "Lo dispara el storefront en el navegador (gtag.js). Se muestra como referencia — no se puede gestionar desde acá."
  },
  // Etapa del recorrido del cliente (agrupa la lista como un embudo)
  STAGE: {
    funnel: "Embudo ecommerce",
    acquisition: "Adquisición y leads",
    b2b: "Ciclo de vida B2B"
  },
  EMPTY_STATE: "Todavía no hay mapeos de eventos. Creá tu primer mapeo para empezar a enviar eventos a GA4.",
  CREATE_BUTTON: "Crear",
  SEARCH_PLACEHOLDER: "Buscar mapeos",
  // Form fields (shared by create & edit)
  FIELD_MEDUSA_EVENT_LABEL: "Evento de Medusa *",
  FIELD_MEDUSA_EVENT_PLACEHOLDER: "Elegí un evento",
  FIELD_MEDUSA_EVENT_SEARCH: "Buscar eventos…",
  SEARCH_NO_RESULTS: "Sin resultados",
  FIELD_MEDUSA_EVENT_HELP: "El evento de Medusa que dispara este mapeo",
  FIELD_GA4_EVENT_LABEL: "Nombre del evento de GA4 *",
  FIELD_GA4_EVENT_PLACEHOLDER: "purchase",
  FIELD_GA4_EVENT_HELP: "El nombre del evento que se reporta a Google Analytics 4",
  FIELD_DESCRIPTION_LABEL: "Descripción",
  FIELD_DESCRIPTION_PLACEHOLDER: "Para qué sirve este mapeo",
  FIELD_ACTIVE_LABEL: "Activo",
  FIELD_ACTIVE_HELP: "Los mapeos inactivos no envían eventos a GA4",
  // Advanced section
  ADVANCED_TITLE: "Opciones avanzadas",
  // Param mappings editor
  PARAMS_TITLE: "Mapeo de parámetros",
  PARAMS_HELP: "Asociá parámetros de GA4 a un valor tomado del payload del evento o a un valor fijo.",
  PARAMS_SUGGESTED: "Parámetros sugeridos: {{params}}",
  PARAMS_EXAMPLE: 'Ejemplo: una "Ruta de origen" order.total toma ese campo del payload del evento; un "Valor fijo" USD manda siempre ese valor exacto. Usá uno u otro por fila — si ponés los dos, gana el valor fijo.',
  PARAM_GA4_PARAM_LABEL: "Parámetro GA4",
  PARAM_GA4_PARAM_PLACEHOLDER: "value",
  PARAM_SOURCE_PATH_LABEL: "Ruta de origen",
  PARAM_SOURCE_PATH_PLACEHOLDER: "order.total",
  PARAM_STATIC_VALUE_LABEL: "Valor fijo",
  PARAM_STATIC_VALUE_PLACEHOLDER: "valor fijo",
  PARAM_REMOVE: "Quitar",
  PARAM_ADD: "Agregar parámetro",
  // Create drawer
  CREATE_TITLE: "Crear mapeo",
  CREATE_SUBMIT: "Crear mapeo",
  CREATE_SUCCESS: "Mapeo creado correctamente",
  CREATE_ERROR: "Error al crear el mapeo: {{msg}}",
  VALIDATION_REQUIRED: "El evento de Medusa y el nombre del evento de GA4 son obligatorios",
  // Edit drawer
  EDIT_TITLE: "Editar mapeo",
  EDIT_SUBMIT: "Guardar cambios",
  UPDATE_SUCCESS: "Mapeo actualizado correctamente",
  UPDATE_ERROR: "Error al actualizar el mapeo: {{msg}}",
  // Common buttons
  CANCEL: "Cancelar",
  // Actions menu
  ACTION_EDIT: "Editar",
  ACTION_DELETE: "Eliminar",
  ACTION_VIEW: "Ver detalle",
  ACTION_RESTORE: "Restaurar",
  DELETE_PROMPT_TITLE: "Eliminar mapeo",
  DELETE_PROMPT_DESCRIPTION: '¿Estás seguro de que querés eliminar el mapeo de "{{event}}"? Esta acción no se puede deshacer.',
  DELETE_PROMPT_CONFIRM: "Eliminar",
  DELETE_PROMPT_CANCEL: "Cancelar",
  DELETE_SUCCESS: "Mapeo eliminado correctamente",
  DELETE_ERROR: "Error al eliminar el mapeo: {{msg}}",
  DELETE_DISABLED_MANAGED: "Los eventos del storefront los dispara el navegador; no se gestionan desde el backend.",
  HIDE_BUILTIN_PROMPT_TITLE: "¿Eliminar este evento?",
  HIDE_BUILTIN_PROMPT_DESC: "Desaparecerá de la lista y dejará de enviarse a GA4. Podés restaurarlo después.",
  HIDE_BUILTIN_SUCCESS: "Evento eliminado",
  RESTORE_SUCCESS: "Evento restaurado",
  // Etiquetas de categoría (por clave de categoría)
  CATEGORIES: {
    recomendados: "Recomendados",
    b2b: "Empresas y corporativo (B2B)"
  },
  // Eventos de ecommerce ya trackeados en otro lado (filas de solo lectura)
  STATUS_TRACKED: "Ya activo",
  MANAGED_REASON: "Ya lo envía {{source}} automáticamente — se gestiona fuera de este módulo para no duplicar eventos.",
  SOURCE: {
    plugin: "Plugin (servidor)",
    storefront: "Storefront (cliente)"
  },
  // Eventos ecommerce built-in (server-side; payload calculado automáticamente)
  BUILTIN_NOTE: "El contenido del evento (ítems, valor, moneda) se calcula automáticamente.",
  BUILTIN: {
    purchase: {
      TITLE: "Compra",
      DESC: "Cuando se coloca una orden. Envía ítems, valor, impuestos y envío."
    },
    refund: {
      TITLE: "Reembolso",
      DESC: "Cuando se reembolsa un pago. Envía el valor reembolsado, la moneda y los ítems."
    },
    add_to_cart: { TITLE: "Agregar al carrito", DESC: "Cuando se agregan ítems al carrito." },
    remove_from_cart: { TITLE: "Quitar del carrito", DESC: "Cuando se quitan ítems del carrito." },
    add_shipping_info: {
      TITLE: "Datos de envío",
      DESC: "Cuando se establece una dirección de envío en el carrito."
    },
    add_payment_info: { TITLE: "Datos de pago", DESC: "Cuando se crea una sesión de pago." }
  },
  MANAGED: {
    begin_checkout: {
      TITLE: "Inicio de checkout",
      DESC: "Se dispara cuando el cliente llega a la página de checkout. Lo trackea el storefront (gtag.js) en el navegador."
    }
  },
  MANAGED_MEDUSA_NONE: "Ninguno — evento del navegador (no hay evento de Medusa)",
  MANAGED_WHY: {
    storefront: "Es un evento de navegación del lado del cliente que dispara el storefront cuando el cliente entra al checkout. No existe un evento de Medusa equivalente en el backend, así que no se puede gestionar desde esta extensión.",
    plugin: "Este evento lo envía automáticamente una integración externa, no este módulo, así que no se puede gestionar acá."
  },
  DETAIL_TITLE: "Detalle del evento",
  DETAIL_SOURCE_LABEL: "Fuente",
  DETAIL_WHY_LABEL: "Por qué no se puede editar",
  // Títulos y descripciones amigables (por eventI18nKey(medusa_event))
  EVENTS: {
    customer_created: {
      TITLE: "Registro de cliente",
      DESC: "Cuando un cliente nuevo crea su cuenta en la tienda."
    },
    contact_submission_created: {
      TITLE: "Formulario de contacto enviado",
      DESC: "Cuando un visitante envía el formulario de contacto — se registra como lead."
    },
    company_created: {
      TITLE: "Alta de empresa",
      DESC: "Cuando se crea una empresa (B2B) — alta directa, sin aprobación."
    },
    company_member_joined: {
      TITLE: "Miembro se une a empresa",
      DESC: "Cuando un usuario se suma a una empresa existente."
    },
    corporate_created: {
      TITLE: "Registro corporativo enviado",
      DESC: "Cuando se envía el formulario de registro corporativo (queda pendiente hasta aprobación) — un lead."
    },
    corporate_member_joined: {
      TITLE: "Miembro se une a corporativo",
      DESC: "Cuando un usuario acepta la invitación y se suma al corporativo."
    },
    corporate_activated: {
      TITLE: "Cuenta corporativa activada",
      DESC: "Cuando una cuenta corporativa pasa a estado activo."
    },
    corporate_suspended: {
      TITLE: "Cuenta corporativa suspendida",
      DESC: "Cuando una cuenta corporativa se suspende."
    },
    corporate_member_invited: {
      TITLE: "Invitación a corporativo",
      DESC: "Cuando se invita a un usuario a una cuenta corporativa."
    },
    corporate_rule_updated: {
      TITLE: "Regla corporativa actualizada",
      DESC: "Cuando se modifica una regla de la cuenta corporativa."
    },
    billing_profile_created: {
      TITLE: "Perfil de facturación creado",
      DESC: "Cuando un cliente crea un perfil de facturación."
    },
    billing_profile_updated: {
      TITLE: "Perfil de facturación actualizado",
      DESC: "Cuando se modifican los datos de un perfil de facturación."
    },
    billing_profile_deleted: {
      TITLE: "Perfil de facturación eliminado",
      DESC: "Cuando se elimina un perfil de facturación."
    },
    billing_profile_default_changed: {
      TITLE: "Perfil de facturación por defecto cambiado",
      DESC: "Cuando el cliente cambia su perfil de facturación predeterminado."
    },
    order_fulfillment_created: {
      TITLE: "Pedido enviado",
      DESC: "Cuando se genera el envío (fulfillment) de un pedido."
    },
    order_fulfillment_canceled: {
      TITLE: "Envío cancelado",
      DESC: "Cuando se cancela el envío de un pedido."
    },
    product_created: {
      TITLE: "Producto creado",
      DESC: "Cuando se crea un producto en el catálogo (evento de admin, sin usuario)."
    },
    product_updated: {
      TITLE: "Producto actualizado",
      DESC: "Cuando se modifica un producto del catálogo (evento de admin)."
    },
    product_deleted: {
      TITLE: "Producto eliminado",
      DESC: "Cuando se elimina un producto del catálogo (evento de admin)."
    }
  }
};
const registerGa4EventsTranslations = (i18n) => {
  if (registered || typeof (i18n == null ? void 0 : i18n.addResourceBundle) !== "function") {
    return;
  }
  i18n.addResourceBundle("en", GA4_EVENTS_NAMESPACE, en, true, true);
  i18n.addResourceBundle("es", GA4_EVENTS_NAMESPACE, es, true, true);
  void i18n.loadNamespaces(GA4_EVENTS_NAMESPACE);
  registered = true;
};
const emptyParamRow = () => ({
  ga4_param: "",
  source_path: "",
  static_value: ""
});
const toParamRows = (params) => (params ?? []).map((p) => ({
  ga4_param: p.ga4_param ?? "",
  source_path: p.source_path ?? "",
  static_value: p.static_value ?? ""
}));
const fromParamRows = (rows) => rows.filter((r) => r.ga4_param.trim() || r.source_path.trim() || r.static_value.trim()).map((r) => ({
  ga4_param: r.ga4_param.trim(),
  source_path: r.source_path.trim() || void 0,
  static_value: r.static_value.trim() || void 0
}));
const ParamMappingsEditor = ({
  rows,
  onChange,
  suggestedParams
}) => {
  const { t } = reactI18next.useTranslation("ga4Events");
  const updateRow = (index, patch) => {
    onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  };
  const removeRow = (index) => {
    onChange(rows.filter((_, i) => i !== index));
  };
  const addRow = () => {
    onChange([...rows, emptyParamRow()]);
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-3", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { children: t("PARAMS_TITLE") }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("PARAMS_HELP") }),
      suggestedParams && suggestedParams.length > 0 && /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-muted", children: t("PARAMS_SUGGESTED", { params: suggestedParams.join(", ") }) }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-2 rounded-lg bg-ui-bg-subtle px-3 py-2", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-muted", children: t("PARAMS_EXAMPLE") }) })
    ] }),
    rows.map((row, index) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-end gap-2", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-1 flex-col gap-1", children: [
        index === 0 && /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", className: "text-ui-fg-subtle", children: t("PARAM_GA4_PARAM_LABEL") }),
        /* @__PURE__ */ jsxRuntime.jsx(
          ui.Input,
          {
            size: "small",
            placeholder: t("PARAM_GA4_PARAM_PLACEHOLDER"),
            value: row.ga4_param,
            onChange: (e) => updateRow(index, { ga4_param: e.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-1 flex-col gap-1", children: [
        index === 0 && /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", className: "text-ui-fg-subtle", children: t("PARAM_SOURCE_PATH_LABEL") }),
        /* @__PURE__ */ jsxRuntime.jsx(
          ui.Input,
          {
            size: "small",
            placeholder: t("PARAM_SOURCE_PATH_PLACEHOLDER"),
            value: row.source_path,
            onChange: (e) => updateRow(index, { source_path: e.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-1 flex-col gap-1", children: [
        index === 0 && /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "small", className: "text-ui-fg-subtle", children: t("PARAM_STATIC_VALUE_LABEL") }),
        /* @__PURE__ */ jsxRuntime.jsx(
          ui.Input,
          {
            size: "small",
            placeholder: t("PARAM_STATIC_VALUE_PLACEHOLDER"),
            value: row.static_value,
            onChange: (e) => updateRow(index, { static_value: e.target.value })
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(
        ui.IconButton,
        {
          type: "button",
          variant: "transparent",
          onClick: () => removeRow(index),
          "aria-label": t("PARAM_REMOVE"),
          children: /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "text-ui-fg-error" })
        }
      )
    ] }, index)),
    /* @__PURE__ */ jsxRuntime.jsx("div", { children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Button, { type: "button", variant: "secondary", size: "small", onClick: addRow, children: [
      /* @__PURE__ */ jsxRuntime.jsx(icons.Plus, {}),
      t("PARAM_ADD")
    ] }) })
  ] });
};
const AdvancedParams = ({ rows, onChange, suggestedParams }) => {
  const { t } = reactI18next.useTranslation("ga4Events");
  const [open, setOpen] = react.useState(false);
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-3 border-t pt-4", children: [
    /* @__PURE__ */ jsxRuntime.jsxs(
      "button",
      {
        type: "button",
        onClick: () => setOpen((v) => !v),
        className: "flex items-center gap-1 text-ui-fg-subtle",
        children: [
          open ? /* @__PURE__ */ jsxRuntime.jsx(icons.TriangleDownMini, {}) : /* @__PURE__ */ jsxRuntime.jsx(icons.TriangleRightMini, {}),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", children: t("ADVANCED_TITLE") })
        ]
      }
    ),
    open && /* @__PURE__ */ jsxRuntime.jsx(ParamMappingsEditor, { rows, onChange, suggestedParams })
  ] });
};
const GOOGLE_RECOMMENDED_EVENTS_URL = "https://support.google.com/analytics/answer/9267735";
const EventRationale = ({ whyKey }) => {
  const { t } = reactI18next.useTranslation("ga4Events");
  const why = t(`WHY.${whyKey}`, { defaultValue: "" });
  if (!why) return null;
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1 rounded-lg bg-ui-bg-subtle px-3 py-2", children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", className: "text-ui-fg-subtle", children: t("WHY_LABEL") }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: why }),
    /* @__PURE__ */ jsxRuntime.jsxs(
      "a",
      {
        href: GOOGLE_RECOMMENDED_EVENTS_URL,
        target: "_blank",
        rel: "noreferrer noopener",
        className: "txt-compact-small text-ui-fg-interactive",
        children: [
          t("WHY_SOURCE"),
          " ↗"
        ]
      }
    )
  ] });
};
const BuiltinEditDrawer = ({ builtin, open, onOpenChange }) => {
  const { t, i18n } = reactI18next.useTranslation("ga4Events");
  registerGa4EventsTranslations(i18n);
  const prompt = ui.usePrompt();
  const [ga4EventName, setGa4EventName] = react.useState(builtin.ga4_event_name);
  const [isActive, setIsActive] = react.useState(builtin.is_active);
  react.useEffect(() => {
    if (open) {
      setGa4EventName(builtin.ga4_event_name);
      setIsActive(builtin.is_active);
    }
  }, [open, builtin]);
  const { mutateAsync: updateBuiltin, isPending } = useUpdateGa4Builtin(builtin.builtin_key, {
    onSuccess: (_data, variables) => {
      ui.toast.success(variables.hidden ? t("HIDE_BUILTIN_SUCCESS") : t("UPDATE_SUCCESS"));
      onOpenChange(false);
    },
    onError: (error) => {
      ui.toast.error(t("UPDATE_ERROR", { msg: error.message }));
    }
  });
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ga4EventName.trim()) {
      ui.toast.error(t("VALIDATION_REQUIRED"));
      return;
    }
    await updateBuiltin({ is_active: isActive, ga4_event_name: ga4EventName.trim() });
  };
  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t("HIDE_BUILTIN_PROMPT_TITLE"),
      description: t("HIDE_BUILTIN_PROMPT_DESC"),
      confirmText: t("DELETE_PROMPT_CONFIRM"),
      cancelText: t("DELETE_PROMPT_CANCEL")
    });
    if (confirmed) {
      await updateBuiltin({ hidden: true });
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open, onOpenChange, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t(`BUILTIN.${builtin.builtin_key}.TITLE`, { defaultValue: builtin.builtin_key }) }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Body, { className: "overflow-y-auto p-4", children: /* @__PURE__ */ jsxRuntime.jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1 rounded-lg bg-ui-bg-subtle px-3 py-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx("code", { className: "txt-compact-small text-ui-fg-muted", children: builtin.trigger_event }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t(`BUILTIN.${builtin.builtin_key}.DESC`, { defaultValue: "" }) })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(EventRationale, { whyKey: builtin.builtin_key }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "builtin-ga4-event-name", children: t("FIELD_GA4_EVENT_LABEL") }),
        /* @__PURE__ */ jsxRuntime.jsx(
          ui.Input,
          {
            id: "builtin-ga4-event-name",
            value: ga4EventName,
            onChange: (e) => setGa4EventName(e.target.value),
            required: true
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("BUILTIN_NOTE") })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "builtin-is-active", children: t("FIELD_ACTIVE_LABEL") }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("FIELD_ACTIVE_HELP") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Switch, { id: "builtin-is-active", checked: isActive, onCheckedChange: setIsActive })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "danger", onClick: handleDelete, isLoading: isPending, children: t("ACTION_DELETE") }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", children: t("CANCEL") }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: handleSubmit, isLoading: isPending, children: t("EDIT_SUBMIT") })
      ] })
    ] })
  ] }) });
};
const EventActionsMenu = ({
  kind,
  mapping,
  builtin,
  onEdit,
  onEditBuiltin,
  onView
}) => {
  const { t, i18n } = reactI18next.useTranslation("ga4Events");
  registerGa4EventsTranslations(i18n);
  const prompt = ui.usePrompt();
  const { mutateAsync: deleteMapping } = useDeleteGa4Mapping((mapping == null ? void 0 : mapping.id) ?? "", {
    onSuccess: () => {
      ui.toast.success(t("DELETE_SUCCESS"));
    },
    onError: (error) => {
      ui.toast.error(t("DELETE_ERROR", { msg: error.message }));
    }
  });
  const { mutateAsync: updateBuiltin } = useUpdateGa4Builtin((builtin == null ? void 0 : builtin.builtin_key) ?? "", {
    onError: (error) => {
      ui.toast.error(t("UPDATE_ERROR", { msg: error.message }));
    }
  });
  const handleDelete = async () => {
    if (!mapping) return;
    const confirmed = await prompt({
      title: t("DELETE_PROMPT_TITLE"),
      description: t("DELETE_PROMPT_DESCRIPTION", { event: mapping.medusa_event }),
      confirmText: t("DELETE_PROMPT_CONFIRM"),
      cancelText: t("DELETE_PROMPT_CANCEL")
    });
    if (confirmed) {
      await deleteMapping();
    }
  };
  const handleHideBuiltin = async () => {
    if (!builtin) return;
    const confirmed = await prompt({
      title: t("HIDE_BUILTIN_PROMPT_TITLE"),
      description: t("HIDE_BUILTIN_PROMPT_DESC"),
      confirmText: t("DELETE_PROMPT_CONFIRM"),
      cancelText: t("DELETE_PROMPT_CANCEL")
    });
    if (confirmed) {
      await updateBuiltin({ hidden: true });
      ui.toast.success(t("HIDE_BUILTIN_SUCCESS"));
    }
  };
  const handleRestoreBuiltin = async () => {
    if (!builtin) return;
    await updateBuiltin({ hidden: false });
    ui.toast.success(t("RESTORE_SUCCESS"));
  };
  return /* @__PURE__ */ jsxRuntime.jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { size: "small", variant: "transparent", children: /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, {}) }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { children: [
      kind === "generic" && mapping && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2", onClick: () => onEdit(mapping), children: [
          /* @__PURE__ */ jsxRuntime.jsx(icons.PencilSquare, { className: "text-ui-fg-subtle" }),
          t("ACTION_EDIT")
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Separator, {}),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2 text-ui-fg-error", onClick: handleDelete, children: [
          /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "text-ui-fg-error" }),
          t("ACTION_DELETE")
        ] })
      ] }),
      kind === "builtin" && builtin && !builtin.hidden && /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2", onClick: () => onEditBuiltin(builtin), children: [
          /* @__PURE__ */ jsxRuntime.jsx(icons.PencilSquare, { className: "text-ui-fg-subtle" }),
          t("ACTION_EDIT")
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Separator, {}),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2 text-ui-fg-error", onClick: handleHideBuiltin, children: [
          /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "text-ui-fg-error" }),
          t("ACTION_DELETE")
        ] })
      ] }),
      kind === "builtin" && builtin && builtin.hidden && /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2", onClick: handleRestoreBuiltin, children: [
        /* @__PURE__ */ jsxRuntime.jsx(icons.ArrowPath, { className: "text-ui-fg-subtle" }),
        t("ACTION_RESTORE")
      ] }),
      kind === "readonly" && /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2", onClick: onView, children: [
        /* @__PURE__ */ jsxRuntime.jsx(icons.EyeMini, { className: "text-ui-fg-subtle" }),
        t("ACTION_VIEW")
      ] })
    ] })
  ] }) });
};
const GA4_ADMIN_URL = "https://analytics.google.com/analytics/web/";
const ChecklistItem = ({ ok, label }) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
  ok ? /* @__PURE__ */ jsxRuntime.jsx(icons.CheckCircleSolid, { className: "text-ui-tag-green-icon" }) : /* @__PURE__ */ jsxRuntime.jsx(icons.XCircleSolid, { className: "text-ui-tag-red-icon" }),
  /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: label })
] });
const Ga4ConfigPanel = () => {
  const { t } = reactI18next.useTranslation("ga4Events");
  const { data } = useGa4Config();
  const [result, setResult] = react.useState(null);
  const { mutate: runTest, isPending: isTesting } = useTestGa4Config({
    onSuccess: setResult,
    onError: (error) => setResult({ valid: false, configured: true, validation_messages: [], message: error.message })
  });
  if (!data) return null;
  const dispatchActive = Boolean(data.measurement_id && data.api_secret_set);
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-end gap-2 border-t px-6 py-4", children: [
      data.debug && /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: "orange", children: t("CONFIG_DEBUG") }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: dispatchActive ? "green" : "grey", children: dispatchActive ? t("CONFIG_DISPATCH_ACTIVE") : t("CONFIG_DISPATCH_INACTIVE") })
    ] }),
    !dispatchActive && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2 border-t px-6 py-3", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", className: "text-ui-fg-subtle", children: t("CONFIG_CHECKLIST_TITLE") }),
      /* @__PURE__ */ jsxRuntime.jsx(ChecklistItem, { ok: Boolean(data.measurement_id), label: t("CONFIG_MEASUREMENT_ID") }),
      /* @__PURE__ */ jsxRuntime.jsx(ChecklistItem, { ok: data.api_secret_set, label: t("CONFIG_CHECKLIST_API_SECRET") }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-muted", children: t("CONFIG_DISPATCH_HINT") })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between gap-3 border-t px-6 py-3", children: [
      /* @__PURE__ */ jsxRuntime.jsxs(
        "a",
        {
          href: GA4_ADMIN_URL,
          target: "_blank",
          rel: "noreferrer noopener",
          className: "txt-compact-small text-ui-fg-interactive",
          children: [
            t("CONFIG_OPEN_GA4"),
            " ↗"
          ]
        }
      ),
      dispatchActive ? /* @__PURE__ */ jsxRuntime.jsx(
        ui.Button,
        {
          variant: "secondary",
          size: "small",
          isLoading: isTesting,
          onClick: () => runTest(),
          children: t("CONFIG_TEST_BUTTON")
        }
      ) : (
        // Botón deshabilitado: envuelto en span para que el Tooltip reciba el
        // hover (un <button disabled> no dispara eventos de puntero).
        /* @__PURE__ */ jsxRuntime.jsx(ui.Tooltip, { content: t("CONFIG_TEST_DISABLED_TOOLTIP"), children: /* @__PURE__ */ jsxRuntime.jsx("span", { tabIndex: 0, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", size: "small", disabled: true, children: t("CONFIG_TEST_BUTTON") }) }) })
      )
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("div", { className: "border-t px-6 py-3", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { size: "small", className: "text-ui-fg-muted", children: [
      t("CONFIG_TEST_HELP"),
      " ",
      /* @__PURE__ */ jsxRuntime.jsx("code", { className: "txt-compact-small", children: "ga4_connection_test" })
    ] }) }),
    result && /* @__PURE__ */ jsxRuntime.jsx(TestResult, { result })
  ] });
};
const TestResult = ({ result }) => {
  const { t } = reactI18next.useTranslation("ga4Events");
  if (result.valid) {
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2 border-t bg-ui-bg-subtle px-6 py-3", children: [
      /* @__PURE__ */ jsxRuntime.jsx(icons.CheckCircleSolid, { className: "text-ui-tag-green-icon" }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("CONFIG_TEST_SUCCESS", { event: result.event_name ?? "ga4_connection_test" }) })
    ] });
  }
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2 border-t bg-ui-bg-subtle px-6 py-3", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsxRuntime.jsx(icons.XCircleSolid, { className: "text-ui-tag-red-icon" }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", className: "text-ui-fg-subtle", children: result.configured ? t("CONFIG_TEST_INVALID") : t("CONFIG_TEST_NOT_CONFIGURED") })
    ] }),
    result.message && /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-muted", children: result.message }),
    result.validation_messages.map((m, i) => /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { size: "small", className: "text-ui-fg-muted", children: [
      m.fieldPath ? `${m.fieldPath}: ` : "",
      m.description
    ] }, i))
  ] });
};
const Field = ({ label, children }) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
  /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", className: "text-ui-fg-subtle", children: label }),
  children
] });
const ManagedInfoDrawer = ({
  open,
  onOpenChange,
  title,
  ga4Event,
  description,
  source
}) => {
  const { t, i18n } = reactI18next.useTranslation("ga4Events");
  registerGa4EventsTranslations(i18n);
  return /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open, onOpenChange, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: title || t("DETAIL_TITLE") }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Body, { className: "overflow-y-auto p-4", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(Field, { label: t("COLUMN_GA4_EVENT"), children: /* @__PURE__ */ jsxRuntime.jsx("code", { className: "txt-compact-small text-ui-fg-base", children: ga4Event }) }),
      /* @__PURE__ */ jsxRuntime.jsx(Field, { label: t("COLUMN_MEDUSA_EVENT"), children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-muted", children: t("MANAGED_MEDUSA_NONE") }) }),
      description && /* @__PURE__ */ jsxRuntime.jsx(Field, { label: t("FIELD_DESCRIPTION_LABEL"), children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: description }) }),
      source && /* @__PURE__ */ jsxRuntime.jsx(Field, { label: t("DETAIL_SOURCE_LABEL"), children: /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: "grey", children: t(`SOURCE.${source}`) }) }),
      /* @__PURE__ */ jsxRuntime.jsx(Field, { label: t("DETAIL_WHY_LABEL"), children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: source ? t(`MANAGED_WHY.${source}`) : t("MANAGED_REASON", { source: "" }) }) }),
      /* @__PURE__ */ jsxRuntime.jsx(EventRationale, { whyKey: ga4Event })
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Tooltip, { content: t("DELETE_DISABLED_MANAGED"), children: /* @__PURE__ */ jsxRuntime.jsx("span", { tabIndex: 0, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "danger", disabled: true, children: t("ACTION_DELETE") }) }) }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", children: t("CANCEL") }) })
    ] })
  ] }) });
};
const EventCombobox = ({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  id
}) => {
  const [open, setOpen] = react.useState(false);
  const [query, setQuery] = react.useState("");
  const [activeIdx, setActiveIdx] = react.useState(0);
  const inputRef = react.useRef(null);
  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = react.useMemo(
    () => q ? options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q) || o.group.toLowerCase().includes(q)
    ) : options,
    [options, q]
  );
  const openDropdown = () => {
    setQuery("");
    setActiveIdx(0);
    setOpen(true);
    window.setTimeout(() => {
      var _a;
      return (_a = inputRef.current) == null ? void 0 : _a.focus();
    }, 0);
  };
  const closeDropdown = () => {
    setOpen(false);
    setQuery("");
    setActiveIdx(0);
  };
  const select = (val) => {
    onChange(val);
    closeDropdown();
  };
  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) select(opt.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
    }
  };
  const groups = [];
  for (const opt of filtered) {
    const last = groups[groups.length - 1];
    if (last && last.label === opt.group) last.options.push(opt);
    else groups.push({ label: opt.group, options: [opt] });
  }
  const globalIdx = (groupIdx, optIdx) => {
    let idx = 0;
    for (let g = 0; g < groupIdx; g++) idx += groups[g].options.length;
    return idx + optIdx;
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", onKeyDown: handleKeyDown, children: [
    /* @__PURE__ */ jsxRuntime.jsxs(
      "button",
      {
        type: "button",
        id,
        "aria-haspopup": "listbox",
        "aria-expanded": open,
        onClick: open ? closeDropdown : openDropdown,
        className: ui.clx(
          "flex h-8 w-full items-center justify-between gap-x-2 rounded-md px-2 py-1.5",
          "bg-ui-bg-field shadow-borders-base",
          "text-ui-fg-base text-sm outline-none transition-shadow",
          "focus-visible:shadow-borders-interactive-with-active",
          open && "shadow-borders-interactive-with-active"
        ),
        children: [
          open ? /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              ref: inputRef,
              value: query,
              placeholder: searchPlaceholder ?? "Buscar…",
              className: "min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ui-fg-muted",
              onChange: (e) => {
                setQuery(e.target.value);
                setActiveIdx(0);
              },
              onClick: (e) => e.stopPropagation(),
              onBlur: () => window.setTimeout(closeDropdown, 150)
            }
          ) : /* @__PURE__ */ jsxRuntime.jsx(
            "span",
            {
              className: ui.clx("min-w-0 flex-1 truncate text-left", !selected && "text-ui-fg-muted"),
              children: selected ? selected.label : placeholder ?? ""
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            icons.ChevronDownMini,
            {
              className: ui.clx("shrink-0 text-ui-fg-muted transition-transform", open && "rotate-180")
            }
          )
        ]
      }
    ),
    open && /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        role: "listbox",
        className: "absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout",
        children: [
          filtered.length === 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "px-3 py-2 text-ui-fg-muted text-sm", children: emptyLabel ?? "Sin resultados" }),
          groups.map((group, gi) => /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "bg-ui-bg-subtle px-3 py-1 font-medium text-ui-fg-muted text-xs uppercase tracking-wide", children: group.label }),
            group.options.map((opt, oi) => {
              const idx = globalIdx(gi, oi);
              const isActive = idx === activeIdx;
              const isSelected = opt.value === value;
              return /* @__PURE__ */ jsxRuntime.jsxs(
                "button",
                {
                  type: "button",
                  role: "option",
                  "aria-selected": isSelected,
                  className: ui.clx(
                    "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm",
                    isActive && "bg-ui-bg-base-hover",
                    isSelected && "text-ui-fg-interactive"
                  ),
                  onMouseDown: (e) => {
                    e.preventDefault();
                    select(opt.value);
                  },
                  onMouseEnter: () => setActiveIdx(idx),
                  children: [
                    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "truncate text-ui-fg-base", children: opt.label }),
                    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "shrink-0 font-mono text-ui-fg-muted text-xs", children: opt.value })
                  ]
                },
                opt.value
              );
            })
          ] }, group.label))
        ]
      }
    )
  ] });
};
const MappingEventFields = ({
  events,
  categories,
  medusaEvent,
  onMedusaEventChange,
  ga4EventName,
  onGa4EventNameChange
}) => {
  const { t } = reactI18next.useTranslation("ga4Events");
  const selectedEvent = react.useMemo(
    () => events.find((e) => e.medusa_event === medusaEvent),
    [events, medusaEvent]
  );
  const eventTitle = (medusa_event) => t(`EVENTS.${eventI18nKey(medusa_event)}.TITLE`, { defaultValue: medusa_event });
  const options = react.useMemo(() => {
    const opts = [];
    for (const cat of categories) {
      for (const event of events.filter((e) => e.category === cat)) {
        opts.push({
          value: event.medusa_event,
          label: eventTitle(event.medusa_event),
          group: t(`CATEGORIES.${cat}`)
        });
      }
    }
    return opts;
  }, [events, categories, t]);
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "medusa_event", children: t("FIELD_MEDUSA_EVENT_LABEL") }),
      /* @__PURE__ */ jsxRuntime.jsx(
        EventCombobox,
        {
          id: "medusa_event",
          value: medusaEvent,
          onChange: onMedusaEventChange,
          options,
          placeholder: t("FIELD_MEDUSA_EVENT_PLACEHOLDER"),
          searchPlaceholder: t("FIELD_MEDUSA_EVENT_SEARCH"),
          emptyLabel: t("SEARCH_NO_RESULTS")
        }
      )
    ] }),
    selectedEvent && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1 rounded-lg bg-ui-bg-subtle px-3 py-2", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", children: eventTitle(selectedEvent.medusa_event) }),
      /* @__PURE__ */ jsxRuntime.jsx("code", { className: "txt-compact-small text-ui-fg-muted", children: selectedEvent.medusa_event }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t(`EVENTS.${eventI18nKey(selectedEvent.medusa_event)}.DESC`, { defaultValue: "" }) })
    ] }),
    selectedEvent && /* @__PURE__ */ jsxRuntime.jsx(EventRationale, { whyKey: eventI18nKey(selectedEvent.medusa_event) }),
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "ga4_event_name", children: t("FIELD_GA4_EVENT_LABEL") }),
      /* @__PURE__ */ jsxRuntime.jsx(
        ui.Input,
        {
          id: "ga4_event_name",
          placeholder: t("FIELD_GA4_EVENT_PLACEHOLDER"),
          value: ga4EventName,
          onChange: (e) => onGa4EventNameChange(e.target.value),
          required: true
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("FIELD_GA4_EVENT_HELP") })
    ] })
  ] });
};
const MappingCreateDrawer = () => {
  const { t, i18n } = reactI18next.useTranslation("ga4Events");
  registerGa4EventsTranslations(i18n);
  const [open, setOpen] = react.useState(false);
  const [medusaEvent, setMedusaEvent] = react.useState("");
  const [ga4EventName, setGa4EventName] = react.useState("");
  const [isActive, setIsActive] = react.useState(true);
  const [paramRows, setParamRows] = react.useState([emptyParamRow()]);
  const { data: eventsData } = useSupportedEvents({ enabled: open });
  const events = (eventsData == null ? void 0 : eventsData.events) ?? [];
  const categories = (eventsData == null ? void 0 : eventsData.categories) ?? [];
  const selectedEvent = react.useMemo(
    () => events.find((e) => e.medusa_event === medusaEvent),
    [events, medusaEvent]
  );
  const { mutateAsync: createMapping, isPending } = useCreateGa4Mapping({
    onSuccess: () => {
      ui.toast.success(t("CREATE_SUCCESS"));
      setOpen(false);
      resetForm();
    },
    onError: (error) => {
      ui.toast.error(t("CREATE_ERROR", { msg: error.message }));
    }
  });
  const resetForm = () => {
    setMedusaEvent("");
    setGa4EventName("");
    setIsActive(true);
    setParamRows([emptyParamRow()]);
  };
  const handleEventChange = (value) => {
    var _a;
    setMedusaEvent(value);
    if (!ga4EventName) {
      const suggestion = (_a = events.find((e) => e.medusa_event === value)) == null ? void 0 : _a.suggested_ga4;
      if (suggestion) setGa4EventName(suggestion);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!medusaEvent || !ga4EventName) {
      ui.toast.error(t("VALIDATION_REQUIRED"));
      return;
    }
    await createMapping({
      medusa_event: medusaEvent,
      ga4_event_name: ga4EventName,
      is_active: isActive,
      param_mappings: fromParamRows(paramRows)
    });
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer, { open, onOpenChange: setOpen, children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", size: "small", children: t("CREATE_BUTTON") }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t("CREATE_TITLE") }) }),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Body, { className: "overflow-y-auto p-4", children: /* @__PURE__ */ jsxRuntime.jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          MappingEventFields,
          {
            events,
            categories,
            medusaEvent,
            onMedusaEventChange: handleEventChange,
            ga4EventName,
            onGa4EventNameChange: setGa4EventName
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "is_active", children: t("FIELD_ACTIVE_LABEL") }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("FIELD_ACTIVE_HELP") })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Switch, { id: "is_active", checked: isActive, onCheckedChange: setIsActive })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(
          AdvancedParams,
          {
            rows: paramRows,
            onChange: setParamRows,
            suggestedParams: selectedEvent == null ? void 0 : selectedEvent.params
          }
        )
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", children: t("CANCEL") }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: handleSubmit, isLoading: isPending, children: t("CREATE_SUBMIT") })
      ] })
    ] })
  ] });
};
const MappingEditDrawer = ({ mapping, open, onOpenChange }) => {
  const { t, i18n } = reactI18next.useTranslation("ga4Events");
  registerGa4EventsTranslations(i18n);
  const prompt = ui.usePrompt();
  const { data: detail } = useGa4Mapping(mapping.id, void 0, { enabled: open });
  const source = (detail == null ? void 0 : detail.ga4_mapping) ?? mapping;
  const { data: eventsData } = useSupportedEvents({ enabled: open });
  const events = (eventsData == null ? void 0 : eventsData.events) ?? [];
  const categories = (eventsData == null ? void 0 : eventsData.categories) ?? [];
  const [medusaEvent, setMedusaEvent] = react.useState(mapping.medusa_event);
  const [ga4EventName, setGa4EventName] = react.useState(mapping.ga4_event_name);
  const [isActive, setIsActive] = react.useState(mapping.is_active);
  const [paramRows, setParamRows] = react.useState(toParamRows(mapping.param_mappings));
  const selectedEvent = react.useMemo(
    () => events.find((e) => e.medusa_event === medusaEvent),
    [events, medusaEvent]
  );
  const { mutateAsync: updateMapping, isPending } = useUpdateGa4Mapping(mapping.id, {
    onSuccess: () => {
      ui.toast.success(t("UPDATE_SUCCESS"));
      onOpenChange(false);
    },
    onError: (error) => {
      ui.toast.error(t("UPDATE_ERROR", { msg: error.message }));
    }
  });
  const { mutateAsync: deleteMapping, isPending: isDeleting } = useDeleteGa4Mapping(mapping.id, {
    onSuccess: () => {
      ui.toast.success(t("DELETE_SUCCESS"));
      onOpenChange(false);
    },
    onError: (error) => {
      ui.toast.error(t("DELETE_ERROR", { msg: error.message }));
    }
  });
  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t("DELETE_PROMPT_TITLE"),
      description: t("DELETE_PROMPT_DESCRIPTION", { event: mapping.medusa_event }),
      confirmText: t("DELETE_PROMPT_CONFIRM"),
      cancelText: t("DELETE_PROMPT_CANCEL")
    });
    if (confirmed) {
      await deleteMapping();
    }
  };
  react.useEffect(() => {
    if (open) {
      setMedusaEvent(source.medusa_event ?? "");
      setGa4EventName(source.ga4_event_name ?? "");
      setIsActive(source.is_active ?? true);
      const rows = toParamRows(source.param_mappings);
      setParamRows(rows.length > 0 ? rows : [emptyParamRow()]);
    }
  }, [open, source]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!medusaEvent || !ga4EventName) {
      ui.toast.error(t("VALIDATION_REQUIRED"));
      return;
    }
    await updateMapping({
      medusa_event: medusaEvent,
      ga4_event_name: ga4EventName,
      is_active: isActive,
      param_mappings: fromParamRows(paramRows)
    });
  };
  return /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open, onOpenChange, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t("EDIT_TITLE") }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Body, { className: "overflow-y-auto p-4", children: /* @__PURE__ */ jsxRuntime.jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        MappingEventFields,
        {
          events,
          categories,
          medusaEvent,
          onMedusaEventChange: setMedusaEvent,
          ga4EventName,
          onGa4EventNameChange: setGa4EventName
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { htmlFor: "edit-is-active", children: t("FIELD_ACTIVE_LABEL") }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("FIELD_ACTIVE_HELP") })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Switch, { id: "edit-is-active", checked: isActive, onCheckedChange: setIsActive })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(
        AdvancedParams,
        {
          rows: paramRows,
          onChange: setParamRows,
          suggestedParams: selectedEvent == null ? void 0 : selectedEvent.params
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "danger", onClick: handleDelete, isLoading: isDeleting, children: t("ACTION_DELETE") }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", children: t("CANCEL") }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { onClick: handleSubmit, isLoading: isPending, children: t("EDIT_SUBMIT") })
      ] })
    ] })
  ] }) });
};
const PAGE_SIZE = 20;
const STAGE_ORDER = { funnel: 0, acquisition: 1, b2b: 2 };
const KIND_BADGE_COLOR = {
  builtin: "blue",
  // Automático: payload calculado por el código
  generic: "green",
  // Personalizable: lo editás vos (evento + params)
  readonly: "grey"
  // Storefront: lo dispara el navegador, solo lectura
};
const columnHelper = ui.createDataTableColumnHelper();
const filterHelper = ui.createDataTableFilterHelper();
const Ga4Events = () => {
  const { t, i18n } = reactI18next.useTranslation("ga4Events");
  registerGa4EventsTranslations(i18n);
  const [editingMapping, setEditingMapping] = react.useState(null);
  const [editingBuiltin, setEditingBuiltin] = react.useState(null);
  const [infoRow, setInfoRow] = react.useState(null);
  const [search, setSearch] = react.useState("");
  const [filtering, setFiltering] = react.useState({});
  const [pagination, setPagination] = react.useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE
  });
  const filters = react.useMemo(
    () => [
      filterHelper.accessor("status", {
        type: "multiselect",
        label: t("FILTER_STATUS"),
        options: [
          { label: t("FILTER_STATUS_ACTIVE"), value: "active" },
          { label: t("FILTER_STATUS_INACTIVE"), value: "inactive" },
          { label: t("FILTER_STATUS_REMOVED"), value: "removed" }
        ]
      })
    ],
    [t]
  );
  const { data, isPending } = useGa4Mappings({ limit: 200 });
  const { data: eventsData } = useSupportedEvents();
  const { data: builtinsData } = useGa4Builtins();
  const allRows = react.useMemo(() => {
    const categoryByEvent = new Map(
      ((eventsData == null ? void 0 : eventsData.events) ?? []).map((e) => [e.medusa_event, e.category])
    );
    const builtins = ((builtinsData == null ? void 0 : builtinsData.builtins) ?? []).map((b) => ({
      id: `builtin:${b.builtin_key}`,
      kind: "builtin",
      stage: "funnel",
      title: t(`BUILTIN.${b.builtin_key}.TITLE`, { defaultValue: b.builtin_key }),
      medusa_event: b.trigger_event,
      description: t(`BUILTIN.${b.builtin_key}.DESC`, { defaultValue: "" }),
      ga4_event_name: b.ga4_event_name,
      is_active: b.is_active,
      hidden: b.hidden,
      status: b.hidden ? "removed" : b.is_active ? "active" : "inactive",
      builtin: b
    }));
    const mappings = ((data == null ? void 0 : data.ga4_mappings) ?? []).map((mapping) => ({
      id: mapping.id,
      kind: "generic",
      stage: categoryByEvent.get(mapping.medusa_event) === "b2b" ? "b2b" : "acquisition",
      title: t(`EVENTS.${eventI18nKey(mapping.medusa_event)}.TITLE`, {
        defaultValue: mapping.medusa_event
      }),
      medusa_event: mapping.medusa_event,
      description: t(`EVENTS.${eventI18nKey(mapping.medusa_event)}.DESC`, { defaultValue: "" }),
      ga4_event_name: mapping.ga4_event_name,
      is_active: mapping.is_active,
      hidden: false,
      status: mapping.is_active ? "active" : "inactive",
      mapping
    }));
    const managed = ((eventsData == null ? void 0 : eventsData.managed) ?? []).map((m) => ({
      id: `managed:${m.ga4_event}`,
      kind: "readonly",
      stage: "funnel",
      title: t(`MANAGED.${m.ga4_event}.TITLE`, { defaultValue: m.ga4_event }),
      medusa_event: "",
      description: t(`MANAGED.${m.ga4_event}.DESC`, { defaultValue: "" }),
      ga4_event_name: m.ga4_event,
      is_active: true,
      hidden: false,
      status: "active",
      source: m.source
    }));
    return [...builtins, ...mappings, ...managed].sort(
      (a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]
    );
  }, [builtinsData, eventsData, data, t]);
  const filtered = react.useMemo(() => {
    const statusValues = filtering.status ?? [];
    const visible = statusValues.length ? allRows.filter((r) => statusValues.includes(r.status)) : allRows.filter((r) => r.status !== "removed");
    const q = search.trim().toLowerCase();
    if (!q) return visible;
    return visible.filter(
      (r) => [r.title, r.medusa_event, r.ga4_event_name].some((v) => v.toLowerCase().includes(q))
    );
  }, [allRows, search, filtering]);
  const offset = pagination.pageIndex * pagination.pageSize;
  const paged = filtered.slice(offset, offset + pagination.pageSize);
  const hasActiveStatusFilter = Array.isArray(filtering.status) && filtering.status.length > 0;
  const openRow = (row) => {
    if (row.kind === "generic" && row.mapping) setEditingMapping(row.mapping);
    else if (row.kind === "builtin" && row.builtin) setEditingBuiltin(row.builtin);
    else if (row.kind === "readonly") setInfoRow(row);
  };
  const columns = react.useMemo(
    () => [
      columnHelper.display({
        id: "title",
        header: t("COLUMN_TITLE"),
        // El título es el punto de entrada clickeable de la fila. NO usamos el
        // onRowClick de useDataTable porque está roto en esta versión de
        // @medusajs/ui (el render lee instance.Ln y el hook expone onRowClick).
        cell: ({ row }) => /* @__PURE__ */ jsxRuntime.jsxs(
          "button",
          {
            type: "button",
            className: "flex flex-col items-start text-left",
            onClick: () => openRow(row.original),
            children: [
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium text-ui-fg-interactive", children: row.original.title }),
              /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-muted txt-compact-small", children: t(`STAGE.${row.original.stage}`) })
            ]
          }
        )
      }),
      columnHelper.display({
        id: "type",
        header: t("COLUMN_TYPE"),
        // Tooltip con qué significa cada tipo — reemplaza la leyenda fija que
        // antes iba al pie de la tabla.
        cell: ({ row }) => /* @__PURE__ */ jsxRuntime.jsx(ui.Tooltip, { content: t(`TYPE_HINT.${row.original.kind}`), children: /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: KIND_BADGE_COLOR[row.original.kind], children: t(`TYPE.${row.original.kind}`) }) })
      }),
      columnHelper.display({
        id: "medusa_event",
        header: t("COLUMN_MEDUSA_EVENT"),
        cell: ({ row }) => row.original.medusa_event ? /* @__PURE__ */ jsxRuntime.jsx("code", { className: "text-ui-fg-subtle txt-compact-small", children: row.original.medusa_event }) : /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-muted", children: "—" })
      }),
      columnHelper.display({
        id: "ga4_event",
        header: t("COLUMN_GA4_EVENT"),
        cell: ({ row }) => /* @__PURE__ */ jsxRuntime.jsx("code", { className: "text-ui-fg-subtle txt-compact-small", children: row.original.ga4_event_name })
      }),
      columnHelper.display({
        id: "status",
        header: t("COLUMN_STATUS"),
        cell: ({ row }) => {
          if (row.original.kind === "readonly") {
            return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: "green", children: t("STATUS_TRACKED") }),
              row.original.source && /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-muted", children: t(`SOURCE.${row.original.source}`) })
            ] });
          }
          if (row.original.kind === "builtin" && row.original.hidden) {
            return /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: "red", children: t("STATUS_REMOVED") });
          }
          return /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: row.original.is_active ? "green" : "grey", children: row.original.is_active ? t("STATUS_ACTIVE") : t("STATUS_INACTIVE") });
        }
      }),
      columnHelper.display({
        id: "actions",
        header: t("COLUMN_ACTIONS"),
        // Menú ⋮ unificado para las 3 filas — solo dispara los setters de la
        // página, no monta drawers propios (evita el doble drawer).
        cell: ({ row }) => /* @__PURE__ */ jsxRuntime.jsx(
          EventActionsMenu,
          {
            kind: row.original.kind,
            mapping: row.original.mapping,
            builtin: row.original.builtin,
            onEdit: setEditingMapping,
            onEditBuiltin: setEditingBuiltin,
            onView: () => setInfoRow(row.original)
          }
        )
      })
    ],
    [t]
  );
  const table = ui.useDataTable({
    columns,
    data: paged,
    getRowId: (row) => row.id,
    rowCount: filtered.length,
    isLoading: isPending,
    filters,
    filtering: {
      state: filtering,
      onFilteringChange: (state) => {
        setFiltering(state);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      }
    },
    pagination: {
      state: pagination,
      onPaginationChange: setPagination
    },
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      }
    }
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Container, { className: "p-0", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DataTable, { instance: table, children: [
      /* @__PURE__ */ jsxRuntime.jsxs(
        ui.DataTable.Toolbar,
        {
          className: "flex items-center justify-between",
          filterBarContent: hasActiveStatusFilter ? /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "transparent", size: "small", onClick: () => setFiltering({}), children: t("FILTER_CLEAR_ALL") }) : void 0,
          children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-x-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t("TITLE") }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", children: "v1.0.0" })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Search, { placeholder: t("SEARCH_PLACEHOLDER") }),
              /* @__PURE__ */ jsxRuntime.jsx(MappingCreateDrawer, {})
            ] })
          ]
        }
      ),
      filtered.length > 0 || isPending ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Table, {}),
        /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Pagination, {})
      ] }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-center border-t p-6 text-center", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: t("EMPTY_STATE") }) })
    ] }) }),
    editingMapping && /* @__PURE__ */ jsxRuntime.jsx(
      MappingEditDrawer,
      {
        mapping: editingMapping,
        open: !!editingMapping,
        onOpenChange: (open) => {
          if (!open) setEditingMapping(null);
        }
      }
    ),
    editingBuiltin && /* @__PURE__ */ jsxRuntime.jsx(
      BuiltinEditDrawer,
      {
        builtin: editingBuiltin,
        open: !!editingBuiltin,
        onOpenChange: (open) => {
          if (!open) setEditingBuiltin(null);
        }
      }
    ),
    infoRow && /* @__PURE__ */ jsxRuntime.jsx(
      ManagedInfoDrawer,
      {
        open: !!infoRow,
        onOpenChange: (open) => {
          if (!open) setInfoRow(null);
        },
        title: infoRow.title,
        ga4Event: infoRow.ga4_event_name,
        description: infoRow.description,
        source: infoRow.source
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] });
};
const config$1 = adminSdk.defineRouteConfig({
  label: "Eventos",
  rank: 0
});
const handle$1 = {
  breadcrumb: () => "Eventos"
};
const Ga4ConfigPage = () => {
  const { t, i18n } = reactI18next.useTranslation("ga4Events");
  registerGa4EventsTranslations(i18n);
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "p-0", children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-between px-6 py-4", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t("CONFIG_TITLE") }) }),
      /* @__PURE__ */ jsxRuntime.jsx(Ga4ConfigPanel, {})
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h2", className: "mb-2", children: "Ajustes por sitio" }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Text, { className: "text-ui-fg-subtle", children: [
        "Los campos editables (Measurement ID, API secret, GTM ID, Modo debug) se administran desde la card de ajustes de ",
        /* @__PURE__ */ jsxRuntime.jsx("code", { children: "app-settings" }),
        " del host, con el namespace",
        " ",
        /* @__PURE__ */ jsxRuntime.jsx("code", { children: "extension:ga4" }),
        ". Ese editor pisa siempre a la fila legacy",
        " ",
        /* @__PURE__ */ jsxRuntime.jsx("code", { children: "ga4_settings" }),
        " y a las variables de entorno. Sin card montada en el host, el plugin usa ",
        /* @__PURE__ */ jsxRuntime.jsx("code", { children: "process.env" }),
        " directo."
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] });
};
const config = adminSdk.defineRouteConfig({
  label: "Configuración",
  rank: 1
});
const handle = {
  breadcrumb: () => "Configuración"
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: Ga4Redirect,
      path: "/ga4",
      handle: { label: config$2.label, translationNs: config$2.translationNs, ...handle$2 }
    },
    {
      Component: Ga4Events,
      path: "/ga4/events",
      handle: { label: config$1.label, translationNs: config$1.translationNs, ...handle$1 }
    },
    {
      Component: Ga4ConfigPage,
      path: "/ga4/config",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config$2.label,
      icon: config$2.icon,
      path: "/ga4",
      nested: void 0,
      rank: 90,
      translationNs: void 0
    },
    {
      label: config.label,
      icon: void 0,
      path: "/ga4/config",
      nested: void 0,
      rank: 1,
      translationNs: void 0
    },
    {
      label: config$1.label,
      icon: void 0,
      path: "/ga4/events",
      nested: void 0,
      rank: 0,
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
