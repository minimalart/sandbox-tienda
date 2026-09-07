"use strict";
const jsxRuntime = require("react/jsx-runtime");
const adminSdk = require("@medusajs/admin-sdk");
const icons = require("@medusajs/icons");
const ui = require("@medusajs/ui");
const react = require("react");
const reactI18next = require("react-i18next");
const reactRouterDom = require("react-router-dom");
const reactQuery = require("@tanstack/react-query");
const Medusa = require("@medusajs/js-sdk");
const admin = require("@minimalart/mercatto-plugin-runtime/admin");
const core = require("@dnd-kit/core");
const sortable = require("@dnd-kit/sortable");
const utilities = require("@dnd-kit/utilities");
require("@medusajs/admin-shared");
const _interopDefault = (e) => e && e.__esModule ? e : { default: e };
const Medusa__default = /* @__PURE__ */ _interopDefault(Medusa);
const BASE_URL = "/admin/banners";
const BANNERS_QUERY_KEY = ["banners"];
const bannerQueryKey = (id) => ["banners", id];
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
function useBanners(params) {
  const qs = new URLSearchParams();
  if ((params == null ? void 0 : params.limit) != null) qs.set("limit", String(params.limit));
  if ((params == null ? void 0 : params.offset) != null) qs.set("offset", String(params.offset));
  const url = qs.toString() ? `${BASE_URL}?${qs.toString()}` : BASE_URL;
  return reactQuery.useQuery({
    queryKey: [...BANNERS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson(url)
  });
}
function useCreateBanner() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (data) => fetchJson(BASE_URL, {
      method: "POST",
      body: JSON.stringify(data)
    }).then((d) => d.banner),
    onSuccess: () => qc.invalidateQueries({ queryKey: BANNERS_QUERY_KEY })
  });
}
function useUpdateBanner(id) {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (data) => fetchJson(`${BASE_URL}/${id}`, {
      method: "POST",
      body: JSON.stringify(data)
    }).then((d) => d.banner),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BANNERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: bannerQueryKey(id) });
    }
  });
}
function useDeleteBanner() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson(`${BASE_URL}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BANNERS_QUERY_KEY })
  });
}
function usePublishBanner() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson(`${BASE_URL}/${id}/publish`, { method: "POST" }).then(
      (d) => d.banner
    ),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: BANNERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: bannerQueryKey(id) });
    }
  });
}
function useUnpublishBanner() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson(`${BASE_URL}/${id}/unpublish`, { method: "POST" }).then(
      (d) => d.banner
    ),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: BANNERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: bannerQueryKey(id) });
    }
  });
}
function useArchiveBanner() {
  const qc = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (id) => fetchJson(`${BASE_URL}/${id}/archive`, { method: "POST" }).then(
      (d) => d.banner
    ),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: BANNERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: bannerQueryKey(id) });
    }
  });
}
function useComposeBannerAI() {
  return reactQuery.useMutation({
    mutationFn: (input) => fetchJson(`${BASE_URL}/ai-compose`, {
      method: "POST",
      body: JSON.stringify(input)
    })
  });
}
const BANNERS_NAMESPACE = "banners";
let registered$1 = false;
const en$1 = {
  // Page
  TITLE: "Banners",
  SUBTITLE: "Manage the storefront banners by placement and status.",
  NEW_BANNER: "New banner",
  CREATE_BUTTON: "Create",
  EMPTY_STATE: "No banners yet. Create the first one.",
  // Table headers
  COL_INTERNAL_NAME: "Internal name",
  COL_PLACEMENT: "Placement",
  COL_STATUS: "Status",
  COL_PRIORITY: "Priority",
  COL_DEVICE: "Device",
  // Row actions
  ACTION_EDIT: "Edit",
  ACTION_PUBLISH: "Publish",
  ACTION_UNPUBLISH: "Unpublish",
  ACTION_ARCHIVE: "Archive",
  ACTION_DELETE: "Delete",
  // Confirm
  CONFIRM_DELETE: "Delete this banner?",
  // Toasts
  TOAST_DELETED: "Banner deleted",
  TOAST_DELETE_FAILED: "Failed to delete the banner",
  TOAST_PUBLISHED: "Banner published",
  TOAST_PUBLISH_FAILED: "Failed to publish the banner",
  TOAST_UNPUBLISHED: "Banner unpublished",
  TOAST_UNPUBLISH_FAILED: "Failed to unpublish the banner",
  TOAST_ARCHIVED: "Banner archived",
  TOAST_ARCHIVE_FAILED: "Failed to archive the banner",
  // Form drawer
  FORM_EDIT_TITLE: "Edit Banner",
  FORM_CREATE_TITLE: "New Banner",
  FIELD_INTERNAL_NAME: "Internal name",
  PLACEHOLDER_INTERNAL_NAME: "E.g.: Top bar January 2025",
  FIELD_PLACEMENT: "Placement *",
  PLACEHOLDER_PLACEMENT: "Select placement",
  FIELD_STATUS: "Status",
  FIELD_DEVICE: "Device",
  PLACEHOLDER_DEVICE: "All devices",
  FIELD_TYPE: "Type",
  PLACEHOLDER_TYPE: "E.g.: image, video, card",
  FIELD_PRIORITY: "Priority",
  FIELD_COUNTDOWN_SECONDS: "Auto-close countdown (seconds)",
  HELP_COUNTDOWN_SECONDS: "Seconds before the splash closes by itself. 0 = no auto-close (only the X).",
  FIELD_SPLASH_BG: "Splash background",
  HELP_SPLASH_BG: "Choose a plain color or a full-screen background image. Title, subtitle and logo are always optional.",
  SPLASH_BG_COLOR: "Background color",
  SPLASH_BG_COLOR_HELP: "Plain color + centered image.",
  SPLASH_BG_IMAGE: "Background image",
  SPLASH_BG_IMAGE_HELP: "The image fills the whole screen.",
  FIELD_SHOW_LOGO: "Show logo above the title",
  HELP_SHOW_LOGO: "Displays the store logo above the title in the splash.",
  SECTION_LINKS: "Links",
  FIELD_STICKY_LINKS: "Links (logo + URL)",
  HELP_STICKY_LINKS: "Add up to 4 items (image + link). You can leave it empty, but then set a button (label + URL) below.",
  FIELD_STICKY_LINK_IMAGE: "Image (URL)",
  FIELD_STICKY_LINK_URL: "Link",
  ADD_STICKY_LINK: "Add link",
  SECTION_CONTENT: "Content",
  FIELD_CONTENT_TITLE: "Title",
  FIELD_CONTENT_SUBTITLE: "Subtitle",
  FIELD_CONTENT_BODY: "Body",
  SECTION_MEDIA: "Media",
  FIELD_MEDIA_URL: "Image/video URL",
  MEDIA_UPLOAD_BUTTON: "Upload image",
  MEDIA_UPLOADING: "Uploading...",
  MEDIA_UPLOAD_HINT: "or paste a URL above",
  MEDIA_UPLOAD_SUCCESS: "Image uploaded",
  MEDIA_UPLOAD_FAILED: "Failed to upload image: {{msg}}",
  SECTION_TARGETING: "Audience",
  FIELD_CUSTOMER_GROUPS: "Customer groups",
  TARGETING_ALL_HINT: "Shown to everyone. Select groups to restrict it.",
  TARGETING_SELECTED_HINT: "Only shown to customers in the selected groups.",
  TARGETING_NO_GROUPS: "No customer groups yet.",
  SECTION_CTA: "CTA",
  FIELD_CTA_URL: "URL",
  FIELD_CTA_LABEL: "Button label",
  PLACEHOLDER_CTA_LABEL: "E.g.: See more",
  FIELD_CTA_TARGET: "Target",
  FIELD_CARD_COLOR: "Card color (card_color)",
  FIELD_BACKGROUND_COLOR: "Background color",
  FIELD_ICON_COLOR: "Icon color",
  FIELD_TEXT_COLOR: "Text color",
  FIELD_ICON: "Icon",
  PLACEHOLDER_ICON: "Select an icon",
  PLACEHOLDER_CARD_COLOR: "#ffffff or CSS name",
  PLACEHOLDER_ICON_COLOR: "#2e7d32",
  PLACEHOLDER_TEXT_COLOR: "#2e7d32",
  ICON_CREDIT_CARD: "Credit card",
  ICON_TRUCK: "Truck",
  ICON_GIFT: "Gift",
  ICON_SHIELD: "Shield",
  ICON_STAR: "Star",
  ICON_TAG: "Tag",
  COLOR_THEME_PRIMARY: "Theme primary",
  COLOR_THEME_PRIMARY_DARK: "Theme primary dark",
  COLOR_THEME_PRIMARY_SOFT: "Theme primary soft",
  COLOR_THEME_SURFACE: "Surface",
  COLOR_THEME_TEXT: "Text",
  COLOR_THEME_MUTED: "Muted",
  FIELD_START_AT: "Start",
  FIELD_END_AT: "End",
  BTN_CANCEL: "Cancel",
  BTN_SAVE: "Save changes",
  BTN_CREATE: "Create banner",
  TOAST_CREATED: "Banner created",
  TOAST_UPDATED: "Banner updated",
  TOAST_SAVE_FAILED: "Failed to save the banner",
  // Placement-centric admin
  LOADING: "Loading...",
  PLACEMENT_TOP_BAR: "Top bar",
  PLACEMENT_BANNER_0: "Banner",
  PLACEMENT_BANNER_1: "Main banner",
  PLACEMENT_BANNER_2: "Banner 2",
  PLACEMENT_BANNER_3: "Banner 3",
  PLACEMENT_BANNER_4: "Banner 4",
  PLACEMENT_BANNER_5: "Banner 5",
  PLACEMENT_BANNER_6: "Banner 6",
  PLACEMENT_STICKY_FOOTER: "Sticky footer",
  PLACEMENT_WELCOME_SPLASH: "Welcome splash (mobile)",
  ITEM_MESSAGE: "Message",
  ITEM_MESSAGE_PLURAL: "Messages",
  ITEM_SLIDE: "Slide",
  ITEM_SLIDE_PLURAL: "Slides",
  ITEM_CARD: "Card",
  ITEM_CARD_PLURAL: "Cards",
  ITEM_HIGHLIGHT: "Highlight",
  ITEM_HIGHLIGHT_PLURAL: "Highlights",
  ITEM_SPLASH: "Splash",
  ITEM_SPLASH_PLURAL: "Splashes",
  PLACEMENT_EMPTY: "No items yet",
  PLACEMENT_UNKNOWN: "Unknown placement.",
  BACK_TO_PLACEMENTS: "Back to Banners",
  BADGE_ACTIVE: "{{count}} active",
  BADGE_DRAFTS: "{{count}} draft(s)",
  BADGE_NEXT: "Next: {{date}}",
  DEVICE_FILTER_ALL: "All devices",
  ADD_ITEM: "Add {{item}}",
  PREVIEW_TITLE: "Preview",
  PREVIEW_EMPTY: "Nothing published right now for this placement.",
  PREVIEW_HINT: "Live preview — updates as you type.",
  GROUP_PUBLISHED: "Published",
  GROUP_SCHEDULED: "Scheduled",
  GROUP_DRAFTS: "Drafts",
  GROUP_ARCHIVED: "Archived",
  SECTION_BASIC: "Basics",
  SECTION_STYLE: "Style",
  SECTION_SCHEDULE: "Schedule",
  SECTION_ADVANCED: "Advanced (not used by this placement)",
  FIELD_PLACEMENT_FIXED: "Placement:",
  FORM_CREATE_ITEM_TITLE: "New {{item}}",
  FORM_EDIT_ITEM_TITLE: "Edit {{item}}",
  ERROR_INTERNAL_NAME: "Internal name must have at least 2 characters",
  ERROR_STICKY_REQUIRES_CTA: "Add at least one image + link, or set a button (label + URL).",
  ACTION_DUPLICATE: "Duplicate",
  TOAST_DUPLICATED: "Item duplicated as draft",
  DUPLICATE_SUFFIX: "(copy)",
  TOAST_PRIORITY_UPDATED: "Priority updated",
  TAB_MEDIA_CTA: "Media & CTA",
  TAB_ADVANCED: "Advanced",
  BTN_CONTINUE: "Continue",
  COL_ITEMS: "Items",
  COL_ACTIVE: "Active",
  COL_DRAFTS: "Drafts",
  COL_NEXT_SCHEDULED: "Next scheduled",
  STATUS_LIVE: "Active",
  STATUS_INACTIVE: "Inactive",
  // Display labels for technical values
  DEVICE_ALL: "All",
  DEVICE_DESKTOP: "Desktop",
  DEVICE_MOBILE: "Mobile",
  DEVICE_TABLET: "Tablet",
  STATUS_DRAFT: "Draft",
  STATUS_PUBLISHED: "Published",
  STATUS_ARCHIVED: "Archived",
  TARGET_SELF: "Same tab",
  TARGET_BLANK: "New tab",
  // AI generation
  AI_TITLE: "Generate with AI",
  AI_BRIEF_PLACEHOLDER: "Describe the banner: product, promo, occasion…",
  AI_GOAL: "Goal (e.g. sales)",
  AI_TONE: "Tone (e.g. bold)",
  AI_AUDIENCE: "Audience",
  AI_GENERATE_COPY: "Generate copy",
  AI_GENERATE_IMAGE: "Generate image",
  AI_HELP: "Fills title/subtitle/CTA and can create the banner image. Review before saving.",
  AI_COPY_DONE: "Copy generated",
  AI_IMAGE_DONE: "Image generated",
  AI_ERROR: "AI generation failed",
  // AI compose drawer (copy + product-aware image in one flow)
  AI_COMPOSE_BUTTON: "Generate with AI",
  AI_COMPOSE_TITLE: "Generate banner with AI",
  AI_COMPOSE_SUBTITLE: "Pick products and give context — AI writes the copy and composes an image featuring those products.",
  AI_COMPOSE_PLACEMENT: "Placement",
  AI_BRIEF_LABEL: "Brief",
  AI_COMPOSE_PRODUCTS_LABEL: "Products (context & reference photos)",
  AI_COMPOSE_PRODUCTS_HELP: "Their photos are sent as references so the products appear in the banner without being altered.",
  AI_COMPOSE_GENERATE: "Generate",
  AI_COMPOSE_DONE: "Slide generated — review and save.",
  AI_COMPOSE_WARN: "Generated with warnings: {{msg}}",
  AI_COMPOSE_PREVIEW: "Preview",
  AI_COMPOSE_PREVIEW_HELP: "This is how the slide will look. Regenerate for another variant or use it.",
  AI_COMPOSE_REGENERATE: "Regenerate",
  AI_COMPOSE_USE: "Use this slide"
};
const es$1 = {
  // Page
  TITLE: "Banners",
  SUBTITLE: "Gestioná los banners del storefront por placement y estado.",
  NEW_BANNER: "Nuevo banner",
  CREATE_BUTTON: "Crear",
  EMPTY_STATE: "No hay banners aún. Crea el primero.",
  // Table headers
  COL_INTERNAL_NAME: "Nombre interno",
  COL_PLACEMENT: "Placement",
  COL_STATUS: "Estado",
  COL_PRIORITY: "Prioridad",
  COL_DEVICE: "Dispositivo",
  // Row actions
  ACTION_EDIT: "Editar",
  ACTION_PUBLISH: "Publicar",
  ACTION_UNPUBLISH: "Despublicar",
  ACTION_ARCHIVE: "Archivar",
  ACTION_DELETE: "Eliminar",
  // Confirm
  CONFIRM_DELETE: "¿Eliminar este banner?",
  // Toasts
  TOAST_DELETED: "Banner eliminado",
  TOAST_DELETE_FAILED: "Error al eliminar el banner",
  TOAST_PUBLISHED: "Banner publicado",
  TOAST_PUBLISH_FAILED: "Error al publicar el banner",
  TOAST_UNPUBLISHED: "Banner despublicado",
  TOAST_UNPUBLISH_FAILED: "Error al despublicar el banner",
  TOAST_ARCHIVED: "Banner archivado",
  TOAST_ARCHIVE_FAILED: "Error al archivar el banner",
  // Form drawer
  FORM_EDIT_TITLE: "Editar Banner",
  FORM_CREATE_TITLE: "Nuevo Banner",
  FIELD_INTERNAL_NAME: "Nombre interno",
  PLACEHOLDER_INTERNAL_NAME: "Ej: Top bar enero 2025",
  FIELD_PLACEMENT: "Placement *",
  PLACEHOLDER_PLACEMENT: "Seleccionar placement",
  FIELD_STATUS: "Estado",
  FIELD_DEVICE: "Dispositivo",
  PLACEHOLDER_DEVICE: "Todos los dispositivos",
  FIELD_TYPE: "Tipo",
  PLACEHOLDER_TYPE: "Ej: image, video, card",
  FIELD_PRIORITY: "Prioridad",
  FIELD_COUNTDOWN_SECONDS: "Cuenta regresiva de autocierre (segundos)",
  HELP_COUNTDOWN_SECONDS: "Segundos antes de que el splash se cierre solo. 0 = sin autocierre (solo la X).",
  FIELD_SPLASH_BG: "Fondo del splash",
  HELP_SPLASH_BG: "Elegí un color pleno o una imagen de fondo a pantalla completa. El título, subtítulo y logo son siempre opcionales.",
  SPLASH_BG_COLOR: "Color de fondo",
  SPLASH_BG_COLOR_HELP: "Color pleno + imagen centrada.",
  SPLASH_BG_IMAGE: "Imagen de fondo",
  SPLASH_BG_IMAGE_HELP: "La imagen ocupa toda la pantalla.",
  FIELD_SHOW_LOGO: "Mostrar logo arriba del título",
  HELP_SHOW_LOGO: "Muestra el logo de la tienda arriba del título en el splash.",
  SECTION_LINKS: "Enlaces",
  FIELD_STICKY_LINKS: "Enlaces (logo + URL)",
  HELP_STICKY_LINKS: "Agregá hasta 4 items (imagen + link). Podés dejarlo vacío, pero en ese caso completá un botón (etiqueta + URL) abajo.",
  FIELD_STICKY_LINK_IMAGE: "Imagen (URL)",
  FIELD_STICKY_LINK_URL: "Enlace",
  ADD_STICKY_LINK: "Agregar enlace",
  SECTION_CONTENT: "Contenido",
  FIELD_CONTENT_TITLE: "Título",
  FIELD_CONTENT_SUBTITLE: "Subtítulo",
  FIELD_CONTENT_BODY: "Cuerpo",
  SECTION_MEDIA: "Media",
  FIELD_MEDIA_URL: "URL de imagen/video",
  MEDIA_UPLOAD_BUTTON: "Subir imagen",
  MEDIA_UPLOADING: "Subiendo...",
  MEDIA_UPLOAD_HINT: "o pegá una URL arriba",
  MEDIA_UPLOAD_SUCCESS: "Imagen subida",
  MEDIA_UPLOAD_FAILED: "Error al subir la imagen: {{msg}}",
  SECTION_TARGETING: "Audiencia",
  FIELD_CUSTOMER_GROUPS: "Grupos de clientes",
  TARGETING_ALL_HINT: "Se muestra a todos. Seleccioná grupos para restringirlo.",
  TARGETING_SELECTED_HINT: "Solo se muestra a clientes de los grupos seleccionados.",
  TARGETING_NO_GROUPS: "Todavía no hay grupos de clientes.",
  SECTION_CTA: "CTA",
  FIELD_CTA_URL: "URL",
  FIELD_CTA_LABEL: "Etiqueta del botón",
  PLACEHOLDER_CTA_LABEL: "Ej: Ver más",
  FIELD_CTA_TARGET: "Target",
  FIELD_CARD_COLOR: "Color de tarjeta (card_color)",
  FIELD_BACKGROUND_COLOR: "Color de fondo",
  FIELD_ICON_COLOR: "Color del icono",
  FIELD_TEXT_COLOR: "Color del texto",
  FIELD_ICON: "Icono",
  PLACEHOLDER_ICON: "Seleccionar icono",
  PLACEHOLDER_CARD_COLOR: "#ffffff o nombre CSS",
  PLACEHOLDER_ICON_COLOR: "#2e7d32",
  PLACEHOLDER_TEXT_COLOR: "#2e7d32",
  ICON_CREDIT_CARD: "Tarjeta",
  ICON_TRUCK: "Envio",
  ICON_GIFT: "Regalo",
  ICON_SHIELD: "Escudo",
  ICON_STAR: "Estrella",
  ICON_TAG: "Etiqueta",
  COLOR_THEME_PRIMARY: "Primario del tema",
  COLOR_THEME_PRIMARY_DARK: "Primario oscuro",
  COLOR_THEME_PRIMARY_SOFT: "Primario suave",
  COLOR_THEME_SURFACE: "Superficie",
  COLOR_THEME_TEXT: "Texto",
  COLOR_THEME_MUTED: "Muted",
  FIELD_START_AT: "Inicio",
  FIELD_END_AT: "Fin",
  BTN_CANCEL: "Cancelar",
  BTN_SAVE: "Guardar cambios",
  BTN_CREATE: "Crear banner",
  TOAST_CREATED: "Banner creado",
  TOAST_UPDATED: "Banner actualizado",
  TOAST_SAVE_FAILED: "Error al guardar el banner",
  // Placement-centric admin
  LOADING: "Cargando...",
  PLACEMENT_TOP_BAR: "Top bar",
  PLACEMENT_BANNER_0: "Banner",
  PLACEMENT_BANNER_1: "Banner principal",
  PLACEMENT_BANNER_2: "Banner 2",
  PLACEMENT_BANNER_3: "Banner 3",
  PLACEMENT_BANNER_4: "Banner 4",
  PLACEMENT_BANNER_5: "Banner 5",
  PLACEMENT_BANNER_6: "Banner 6",
  PLACEMENT_STICKY_FOOTER: "Footer sticky",
  PLACEMENT_WELCOME_SPLASH: "Splash de bienvenida (mobile)",
  ITEM_MESSAGE: "Mensaje",
  ITEM_MESSAGE_PLURAL: "Mensajes",
  ITEM_SLIDE: "Slide",
  ITEM_SLIDE_PLURAL: "Slides",
  ITEM_CARD: "Card",
  ITEM_CARD_PLURAL: "Cards",
  ITEM_HIGHLIGHT: "Destacado",
  ITEM_HIGHLIGHT_PLURAL: "Destacados",
  ITEM_SPLASH: "Splash",
  ITEM_SPLASH_PLURAL: "Splashes",
  PLACEMENT_EMPTY: "Sin items todavía",
  PLACEMENT_UNKNOWN: "Placement desconocido.",
  BACK_TO_PLACEMENTS: "Volver a Banners",
  BADGE_ACTIVE: "{{count}} activos",
  BADGE_DRAFTS: "{{count}} draft(s)",
  BADGE_NEXT: "Próximo: {{date}}",
  DEVICE_FILTER_ALL: "Todos los dispositivos",
  ADD_ITEM: "Agregar {{item}}",
  PREVIEW_TITLE: "Vista previa",
  PREVIEW_EMPTY: "No hay nada publicado ahora para este placement.",
  PREVIEW_HINT: "Vista previa en vivo — se actualiza mientras escribís.",
  GROUP_PUBLISHED: "Publicados",
  GROUP_SCHEDULED: "Programados",
  GROUP_DRAFTS: "Drafts",
  GROUP_ARCHIVED: "Archivados",
  SECTION_BASIC: "Básico",
  SECTION_STYLE: "Estilo",
  SECTION_SCHEDULE: "Programación",
  SECTION_ADVANCED: "Avanzado (no usado por este placement)",
  FIELD_PLACEMENT_FIXED: "Placement:",
  FORM_CREATE_ITEM_TITLE: "Nuevo {{item}}",
  FORM_EDIT_ITEM_TITLE: "Editar {{item}}",
  ERROR_INTERNAL_NAME: "El nombre interno debe tener al menos 2 caracteres",
  ERROR_STICKY_REQUIRES_CTA: "Agregá al menos una imagen + link, o completá un botón (etiqueta + URL).",
  ACTION_DUPLICATE: "Duplicar",
  TOAST_DUPLICATED: "Item duplicado como draft",
  DUPLICATE_SUFFIX: "(copia)",
  TOAST_PRIORITY_UPDATED: "Prioridad actualizada",
  TAB_MEDIA_CTA: "Media y CTA",
  TAB_ADVANCED: "Avanzado",
  BTN_CONTINUE: "Continuar",
  COL_ITEMS: "Items",
  COL_ACTIVE: "Activos",
  COL_DRAFTS: "Drafts",
  COL_NEXT_SCHEDULED: "Próximo programado",
  STATUS_LIVE: "Activo",
  STATUS_INACTIVE: "Inactivo",
  // Display labels for technical values
  DEVICE_ALL: "Todos",
  DEVICE_DESKTOP: "Escritorio",
  DEVICE_MOBILE: "Móvil",
  DEVICE_TABLET: "Tablet",
  STATUS_DRAFT: "Borrador",
  STATUS_PUBLISHED: "Publicado",
  STATUS_ARCHIVED: "Archivado",
  TARGET_SELF: "Misma pestaña",
  TARGET_BLANK: "Nueva pestaña",
  // Generación con IA
  AI_TITLE: "Generar con IA",
  AI_BRIEF_PLACEHOLDER: "Describí el banner: producto, promo, ocasión…",
  AI_GOAL: "Objetivo (ej: ventas)",
  AI_TONE: "Tono (ej: audaz)",
  AI_AUDIENCE: "Audiencia",
  AI_GENERATE_COPY: "Generar textos",
  AI_GENERATE_IMAGE: "Generar imagen",
  AI_HELP: "Completa título/subtítulo/CTA y puede crear la imagen del banner. Revisá antes de guardar.",
  AI_COPY_DONE: "Textos generados",
  AI_IMAGE_DONE: "Imagen generada",
  AI_ERROR: "Falló la generación con IA",
  // Drawer de generación con IA (copy + imagen con productos, en un solo flujo)
  AI_COMPOSE_BUTTON: "Generar con IA",
  AI_COMPOSE_TITLE: "Generar banner con IA",
  AI_COMPOSE_SUBTITLE: "Elegí productos y dales contexto: la IA escribe el copy y compone una imagen con esos productos.",
  AI_COMPOSE_PLACEMENT: "Ubicación",
  AI_BRIEF_LABEL: "Brief",
  AI_COMPOSE_PRODUCTS_LABEL: "Productos (contexto y fotos de referencia)",
  AI_COMPOSE_PRODUCTS_HELP: "Sus fotos se mandan como referencia para que los productos aparezcan en el banner sin deformarse.",
  AI_COMPOSE_GENERATE: "Generar",
  AI_COMPOSE_DONE: "Slide generado: revisá y guardá.",
  AI_COMPOSE_WARN: "Generado con avisos: {{msg}}",
  AI_COMPOSE_PREVIEW: "Vista previa",
  AI_COMPOSE_PREVIEW_HELP: "Así va a quedar el slide. Regenerá para otra variante o usalo.",
  AI_COMPOSE_REGENERATE: "Regenerar",
  AI_COMPOSE_USE: "Usar este slide"
};
const registerBannersTranslations = (i18n) => {
  if (registered$1 || typeof (i18n == null ? void 0 : i18n.addResourceBundle) !== "function") {
    return;
  }
  i18n.addResourceBundle("en", BANNERS_NAMESPACE, en$1, true, true);
  i18n.addResourceBundle("es", BANNERS_NAMESPACE, es$1, true, true);
  void i18n.loadNamespaces(BANNERS_NAMESPACE);
  registered$1 = true;
};
const pad = (n) => String(n).padStart(2, "0");
function localInputToDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function dateToLocalInput(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function bannerToPreviewData(banner) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
  return {
    title: ((_a = banner.content) == null ? void 0 : _a.title) ?? void 0,
    subtitle: ((_b = banner.content) == null ? void 0 : _b.subtitle) ?? void 0,
    body: ((_c = banner.content) == null ? void 0 : _c.body) ?? void 0,
    mediaUrl: ((_d = banner.media) == null ? void 0 : _d.url) ?? void 0,
    ctaUrl: ((_e = banner.cta) == null ? void 0 : _e.url) ?? void 0,
    ctaLabel: ((_f = banner.cta) == null ? void 0 : _f.label) ?? void 0,
    icon: ((_g = banner.metadata) == null ? void 0 : _g.icon) ?? void 0,
    cardColor: ((_h = banner.metadata) == null ? void 0 : _h.card_color) ?? void 0,
    iconColor: ((_i = banner.metadata) == null ? void 0 : _i.icon_color) ?? void 0,
    textColor: ((_j = banner.metadata) == null ? void 0 : _j.color_font) ?? void 0,
    showLogo: ((_k = banner.metadata) == null ? void 0 : _k.show_logo) === true || ((_l = banner.metadata) == null ? void 0 : _l.show_logo) === "true",
    splashBg: ((_m = banner.metadata) == null ? void 0 : _m.splash_bg) === "image" ? "image" : "color",
    links: Array.isArray((_n = banner.metadata) == null ? void 0 : _n.links) ? banner.metadata.links : void 0
  };
}
const CtaChip = ({ label }) => label ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "inline-flex shrink-0 items-center rounded-md bg-white px-2.5 py-1 text-xs font-medium text-zinc-900", children: label }) : null;
const TopBarPreview = ({ data }) => /* @__PURE__ */ jsxRuntime.jsxs(
  "div",
  {
    className: "flex h-10 w-full items-center justify-center gap-2 overflow-hidden rounded-md border border-ui-border-base px-4",
    style: {
      backgroundColor: data.cardColor || "#ffffff",
      color: data.textColor || "#2e7d32"
    },
    children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        "span",
        {
          className: "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-[10px] font-semibold",
          style: { color: data.iconColor || data.textColor || "#2e7d32" },
          "aria-hidden": "true",
          children: (data.icon || "credit-card").slice(0, 1).toUpperCase()
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "truncate text-inherit", children: data.title || data.body || "—" })
    ]
  }
);
const HeroPreview = ({ data }) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative aspect-[21/9] w-full overflow-hidden rounded-lg bg-zinc-800", children: [
  data.mediaUrl ? /* @__PURE__ */ jsxRuntime.jsx("img", { src: data.mediaUrl, className: "absolute inset-0 h-full w-full object-cover" }) : null,
  /* @__PURE__ */ jsxRuntime.jsx("div", { className: "absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" }),
  /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "absolute inset-0 flex flex-col justify-center gap-1.5 p-6", children: [
    data.title ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "max-w-[70%] text-xl font-bold leading-tight text-white", children: data.title }) : null,
    data.subtitle ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "max-w-[70%] text-sm font-medium text-white/90", children: data.subtitle }) : null,
    data.body ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "line-clamp-2 max-w-[60%] text-xs text-white/75", children: data.body }) : null,
    data.ctaUrl ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-2", children: /* @__PURE__ */ jsxRuntime.jsx(CtaChip, { label: data.ctaLabel || data.ctaUrl }) }) : null
  ] })
] });
const CardPreview = ({ data }) => /* @__PURE__ */ jsxRuntime.jsxs(
  "div",
  {
    className: "flex w-full flex-col overflow-hidden rounded-lg border border-ui-border-base",
    style: { backgroundColor: data.cardColor || void 0 },
    children: [
      data.mediaUrl ? /* @__PURE__ */ jsxRuntime.jsx("img", { src: data.mediaUrl, className: "aspect-[16/7] w-full object-cover" }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "aspect-[16/7] w-full bg-ui-bg-subtle" }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1 p-4", children: [
        data.title ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-sm font-semibold text-ui-fg-base", children: data.title }) : null,
        data.subtitle ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-xs font-medium text-ui-fg-subtle", children: data.subtitle }) : null,
        data.body ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "line-clamp-2 text-xs text-ui-fg-muted", children: data.body }) : null,
        data.ctaUrl ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mt-1.5", children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: "inline-flex items-center rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white", children: data.ctaLabel || data.ctaUrl }) }) : null
      ] })
    ]
  }
);
const SplashPreview = ({ data }) => {
  const bg = data.cardColor || "#0b1437";
  const fg = data.textColor || "#ffffff";
  const isImageBg = data.splashBg === "image";
  if (isImageBg) {
    return /* @__PURE__ */ jsxRuntime.jsxs(
      "div",
      {
        className: "relative mx-auto flex aspect-[9/16] w-[200px] max-w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl px-4 py-6 text-center",
        style: { backgroundColor: bg, color: fg },
        children: [
          data.mediaUrl ? /* @__PURE__ */ jsxRuntime.jsx(
            "img",
            {
              src: data.mediaUrl,
              className: "absolute inset-0 h-full w-full object-cover"
            }
          ) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-white/10 text-xs text-white/70", children: "imagen de fondo" }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative z-10 flex flex-col items-center gap-2", children: [
            data.showLogo ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "flex h-7 items-center rounded-lg bg-white px-2 font-semibold text-[10px] text-zinc-700 shadow", children: "logo" }) : null,
            data.title ? /* @__PURE__ */ jsxRuntime.jsx(
              "span",
              {
                className: "text-center font-bold text-base leading-tight drop-shadow",
                style: { color: fg },
                children: data.title
              }
            ) : null,
            data.subtitle ? /* @__PURE__ */ jsxRuntime.jsx(
              "span",
              {
                className: "text-center text-xs opacity-90 drop-shadow",
                style: { color: fg },
                children: data.subtitle
              }
            ) : null
          ] })
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: "mx-auto flex aspect-[9/16] w-[200px] max-w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl px-4 py-6",
      style: { backgroundColor: bg, color: fg },
      children: [
        data.showLogo ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "flex h-7 items-center rounded-lg bg-white px-2 font-semibold text-[10px] text-zinc-700 shadow", children: "logo" }) : null,
        data.title ? /* @__PURE__ */ jsxRuntime.jsx(
          "span",
          {
            className: "text-center font-bold text-base leading-tight",
            style: { color: fg },
            children: data.title
          }
        ) : null,
        data.mediaUrl ? /* @__PURE__ */ jsxRuntime.jsx(
          "img",
          {
            src: data.mediaUrl,
            className: "h-[40%] w-auto max-w-full object-contain"
          }
        ) : /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: "flex h-[40%] w-3/4 items-center justify-center rounded-lg bg-white/10 text-xs",
            style: { color: fg },
            children: "imagen"
          }
        ),
        data.subtitle ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-center text-xs opacity-80", style: { color: fg }, children: data.subtitle }) : null
      ]
    }
  );
};
const StickyPreview = ({ data }) => {
  const fg = data.textColor || "#ffffff";
  const useGradient = !data.cardColor;
  const links = (data.links ?? []).filter((l) => (l == null ? void 0 : l.image) || (l == null ? void 0 : l.url)).slice(0, 4);
  const hasLinks = links.length > 0;
  const ctaLabel = data.ctaLabel || (data.ctaUrl ? "Ver todas →" : void 0);
  const cells = hasLinks ? links : ctaLabel ? [] : [{}, {}, {}, {}];
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "div",
    {
      className: `mx-auto flex w-full max-w-3xl items-center gap-3 overflow-hidden rounded-2xl px-4 py-2.5 shadow-lg ${useGradient ? "bg-gradient-to-r from-[#1a1a4e] via-[#2d2d7b] to-[#1a1a4e]" : ""}`,
      style: useGradient ? { color: fg } : { backgroundColor: data.cardColor, color: fg },
      children: [
        (data.title || data.subtitle) && /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "hidden shrink-0 flex-col sm:flex", style: { color: fg }, children: [
          data.title ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-semibold text-sm", children: data.title }) : null,
          data.subtitle ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-xs opacity-80", children: data.subtitle }) : null
        ] }),
        cells.length > 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-1 items-center gap-2 overflow-hidden", children: cells.map((l, i) => /* @__PURE__ */ jsxRuntime.jsx(
          "div",
          {
            className: "flex h-[34px] min-w-[60px] items-center justify-center rounded-md bg-white px-2",
            children: l.image ? /* @__PURE__ */ jsxRuntime.jsx("img", { src: l.image, className: "h-full w-full object-contain py-1" }) : /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-[10px] text-zinc-400", children: "logo" })
          },
          i
        )) }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex-1" }),
        ctaLabel ? /* @__PURE__ */ jsxRuntime.jsx(
          "span",
          {
            className: "shrink-0 rounded-full bg-white px-3 py-1 font-semibold text-xs",
            style: { color: data.cardColor || "#1a1a4e" },
            children: ctaLabel
          }
        ) : null
      ]
    }
  );
};
const BannerPreview = ({
  kind,
  data
}) => {
  switch (kind) {
    case "topbar":
      return /* @__PURE__ */ jsxRuntime.jsx(TopBarPreview, { data });
    case "hero":
      return /* @__PURE__ */ jsxRuntime.jsx(HeroPreview, { data });
    case "splash":
      return /* @__PURE__ */ jsxRuntime.jsx(SplashPreview, { data });
    case "sticky":
      return /* @__PURE__ */ jsxRuntime.jsx(StickyPreview, { data });
    default:
      return /* @__PURE__ */ jsxRuntime.jsx(CardPreview, { data });
  }
};
const ALL_FIELDS = [
  "internal_name",
  "status",
  "device_type",
  "type",
  "priority",
  "content_title",
  "content_subtitle",
  "content_body",
  "media_url",
  "cta_url",
  "cta_label",
  "cta_target",
  "card_color",
  "start_at",
  "end_at"
];
const TOP_BAR_FIELDS = [
  "internal_name",
  "status",
  "device_type",
  "type",
  "priority",
  "content_title",
  "content_body",
  "icon",
  "card_color",
  "icon_color",
  "text_color",
  "start_at",
  "end_at"
];
const cardPlacement = (n) => ({
  id: `banner_${n}`,
  labelKey: `PLACEMENT_BANNER_${n}`,
  itemLabelKey: "ITEM_CARD",
  itemLabelPluralKey: "ITEM_CARD_PLURAL",
  preview: "card",
  visibleFields: ALL_FIELDS
});
const STICKY_FOOTER_FIELDS = [
  "internal_name",
  "status",
  "priority",
  "content_title",
  "content_subtitle",
  "card_color",
  "text_color",
  "sticky_links",
  // CTA opcional: si no hay enlaces, es obligatorio (botón + link).
  "cta_label",
  "cta_url",
  "cta_target",
  "start_at",
  "end_at"
];
const WELCOME_SPLASH_FIELDS = [
  "internal_name",
  "status",
  "priority",
  "content_title",
  "content_subtitle",
  "splash_bg",
  "media_url",
  "card_color",
  "text_color",
  "show_logo",
  "countdown_seconds",
  "start_at",
  "end_at"
];
const PLACEMENT_CONFIG = {
  top_bar: {
    id: "top_bar",
    labelKey: "PLACEMENT_TOP_BAR",
    itemLabelKey: "ITEM_MESSAGE",
    itemLabelPluralKey: "ITEM_MESSAGE_PLURAL",
    preview: "topbar",
    visibleFields: TOP_BAR_FIELDS
  },
  banner_1: {
    id: "banner_1",
    labelKey: "PLACEMENT_BANNER_1",
    itemLabelKey: "ITEM_SLIDE",
    itemLabelPluralKey: "ITEM_SLIDE_PLURAL",
    preview: "hero",
    visibleFields: ALL_FIELDS
  },
  banner_2: cardPlacement(2),
  banner_3: cardPlacement(3),
  banner_4: cardPlacement(4),
  banner_5: cardPlacement(5),
  banner_6: cardPlacement(6),
  sticky_footer: {
    id: "sticky_footer",
    labelKey: "PLACEMENT_STICKY_FOOTER",
    itemLabelKey: "ITEM_HIGHLIGHT",
    itemLabelPluralKey: "ITEM_HIGHLIGHT_PLURAL",
    preview: "sticky",
    visibleFields: STICKY_FOOTER_FIELDS
  },
  welcome_splash: {
    id: "welcome_splash",
    labelKey: "PLACEMENT_WELCOME_SPLASH",
    itemLabelKey: "ITEM_SPLASH",
    itemLabelPluralKey: "ITEM_SPLASH_PLURAL",
    preview: "splash",
    visibleFields: WELCOME_SPLASH_FIELDS
  }
};
const PLACEMENT_IDS = Object.keys(PLACEMENT_CONFIG);
function getPlacementConfig(placement) {
  return PLACEMENT_CONFIG[placement] ?? cardPlacement(0);
}
function isScheduled(banner, now = /* @__PURE__ */ new Date()) {
  return banner.status === "published" && !!banner.start_at && new Date(banner.start_at) > now;
}
function isExpired(banner, now = /* @__PURE__ */ new Date()) {
  return !!banner.end_at && new Date(banner.end_at) < now;
}
function isLive(banner, now = /* @__PURE__ */ new Date()) {
  return banner.status === "published" && !isScheduled(banner, now) && !isExpired(banner, now);
}
function sortBanners(a, b) {
  const prio = (b.priority ?? 0) - (a.priority ?? 0);
  if (prio !== 0) return prio;
  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
}
function groupByPlacement(banners) {
  var _a;
  const groups = {};
  for (const banner of banners) {
    (groups[_a = banner.placement] ?? (groups[_a] = [])).push(banner);
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort(sortBanners);
  }
  return groups;
}
function nextScheduledAt(banners, now = /* @__PURE__ */ new Date()) {
  const upcoming = banners.filter((b) => isScheduled(b, now)).map((b) => b.start_at).sort();
  return upcoming[0] ?? null;
}
const sdk = new Medusa__default.default({
  baseUrl: "/",
  auth: {
    type: "session"
  }
});
const STATUSES = ["draft", "published", "archived"];
const DEVICE_TYPES = ["all", "desktop", "mobile", "tablet"];
const TOPBAR_ICONS = [
  "credit-card",
  "truck",
  "gift",
  "shield",
  "star",
  "tag",
  "sparkles",
  "fire",
  "bolt",
  "clock",
  "phone",
  "map-pin",
  "heart",
  "check-badge",
  "banknotes",
  "shopping-bag",
  "shopping-cart",
  "receipt-percent",
  "ticket",
  "megaphone",
  "bell",
  "globe",
  "rocket",
  "building-storefront"
];
const THEME_COLORS = [
  { labelKey: "COLOR_THEME_PRIMARY", value: "#2e7d32" },
  { labelKey: "COLOR_THEME_PRIMARY_DARK", value: "#166534" },
  { labelKey: "COLOR_THEME_PRIMARY_SOFT", value: "#e8f5e9" },
  { labelKey: "COLOR_THEME_SURFACE", value: "#ffffff" },
  { labelKey: "COLOR_THEME_TEXT", value: "#111827" },
  { labelKey: "COLOR_THEME_MUTED", value: "#6b7280" }
];
const EMPTY_FORM = {
  internal_name: "",
  handle: "",
  type: "",
  device_type: "",
  status: "draft",
  priority: "0",
  content_title: "",
  content_subtitle: "",
  content_body: "",
  media_url: "",
  cta_url: "",
  cta_label: "",
  cta_target: "_self",
  icon: "credit-card",
  card_color: "",
  icon_color: "",
  text_color: "",
  countdown_seconds: "8",
  show_logo: false,
  splash_bg: "color",
  sticky_links: [],
  start_at: "",
  end_at: "",
  customer_group_ids: [],
  sales_channel_ids: []
};
function bannerToForm(banner) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r;
  return {
    internal_name: banner.internal_name ?? "",
    handle: banner.handle ?? "",
    type: banner.type ?? "",
    device_type: banner.device_type ?? "",
    status: banner.status,
    priority: String(banner.priority ?? 0),
    content_title: ((_a = banner.content) == null ? void 0 : _a.title) ?? "",
    content_subtitle: ((_b = banner.content) == null ? void 0 : _b.subtitle) ?? "",
    content_body: ((_c = banner.content) == null ? void 0 : _c.body) ?? "",
    media_url: ((_d = banner.media) == null ? void 0 : _d.url) ?? "",
    cta_url: ((_e = banner.cta) == null ? void 0 : _e.url) ?? "",
    cta_label: ((_f = banner.cta) == null ? void 0 : _f.label) ?? "",
    cta_target: ((_g = banner.cta) == null ? void 0 : _g.target) ?? "_self",
    icon: ((_h = banner.metadata) == null ? void 0 : _h.icon) ?? "credit-card",
    card_color: ((_i = banner.metadata) == null ? void 0 : _i.card_color) ?? "",
    icon_color: ((_j = banner.metadata) == null ? void 0 : _j.icon_color) ?? "",
    text_color: ((_k = banner.metadata) == null ? void 0 : _k.color_font) ?? "",
    countdown_seconds: ((_l = banner.metadata) == null ? void 0 : _l.countdown_seconds) != null ? String(banner.metadata.countdown_seconds) : "8",
    show_logo: ((_m = banner.metadata) == null ? void 0 : _m.show_logo) === true || ((_n = banner.metadata) == null ? void 0 : _n.show_logo) === "true",
    splash_bg: ((_o = banner.metadata) == null ? void 0 : _o.splash_bg) === "image" ? "image" : "color",
    sticky_links: Array.isArray((_p = banner.metadata) == null ? void 0 : _p.links) ? banner.metadata.links.map((l) => ({
      url: String((l == null ? void 0 : l.url) ?? ""),
      image: String((l == null ? void 0 : l.image) ?? "")
    })) : [],
    start_at: banner.start_at ? banner.start_at.slice(0, 16) : "",
    end_at: banner.end_at ? banner.end_at.slice(0, 16) : "",
    customer_group_ids: ((_q = banner.rules) == null ? void 0 : _q.customer_group_ids) ?? [],
    sales_channel_ids: ((_r = banner.rules) == null ? void 0 : _r.sales_channel_ids) ?? []
  };
}
function formToInput(form, placement, existingRules) {
  const isTopBar = placement === "top_bar";
  const rules = { ...existingRules ?? {} };
  if (form.customer_group_ids.length > 0) {
    rules.customer_group_ids = form.customer_group_ids;
  } else {
    delete rules.customer_group_ids;
  }
  if (form.sales_channel_ids.length > 0) {
    rules.sales_channel_ids = form.sales_channel_ids;
  } else {
    delete rules.sales_channel_ids;
  }
  const isSplash = placement === "welcome_splash";
  const isSticky = placement === "sticky_footer";
  const metadata = {};
  if (form.card_color) metadata.card_color = form.card_color;
  if (isTopBar && form.icon) metadata.icon = form.icon;
  if (isTopBar && form.icon_color) metadata.icon_color = form.icon_color;
  if ((isTopBar || isSplash || isSticky) && form.text_color) {
    metadata.color_font = form.text_color;
  }
  if (isSplash && form.countdown_seconds) {
    metadata.countdown_seconds = form.countdown_seconds;
  }
  if (isSplash) {
    metadata.show_logo = form.show_logo ? "true" : "false";
    metadata.splash_bg = form.splash_bg === "image" ? "image" : "color";
  }
  if (isSticky) {
    metadata.links = form.sticky_links.filter((l) => l.url || l.image);
  }
  return {
    internal_name: form.internal_name || void 0,
    handle: form.handle || void 0,
    type: form.type || void 0,
    // El splash es siempre mobile (sin selector de dispositivo en el form).
    device_type: isSplash ? "mobile" : form.device_type || void 0,
    placement,
    status: form.status,
    priority: Number(form.priority) || 0,
    content: form.content_title || form.content_subtitle || form.content_body ? {
      title: form.content_title || void 0,
      subtitle: form.content_subtitle || void 0,
      body: form.content_body || void 0
    } : null,
    media: !isTopBar && form.media_url ? { url: form.media_url } : null,
    cta: !isTopBar && form.cta_url ? {
      url: form.cta_url,
      label: form.cta_label || void 0,
      target: form.cta_target || "_self"
    } : null,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    rules: Object.keys(rules).length > 0 ? rules : null,
    start_at: form.start_at ? form.start_at : null,
    end_at: form.end_at ? form.end_at : null
  };
}
const FIELD_GROUPS = [
  {
    titleKey: "SECTION_BASIC",
    fields: ["internal_name", "status", "device_type", "type", "priority"]
  },
  { titleKey: "SECTION_CONTENT", fields: ["content_title", "content_subtitle", "content_body"] },
  { titleKey: "SECTION_MEDIA", fields: ["splash_bg", "media_url"] },
  { titleKey: "SECTION_CTA", fields: ["cta_url", "cta_label", "cta_target"] },
  {
    titleKey: "SECTION_STYLE",
    fields: [
      "icon",
      "card_color",
      "icon_color",
      "text_color",
      "show_logo",
      "countdown_seconds"
    ]
  },
  { titleKey: "SECTION_LINKS", fields: ["sticky_links"] },
  { titleKey: "SECTION_SCHEDULE", fields: ["start_at", "end_at"] },
  { titleKey: "SECTION_TARGETING", fields: ["customer_group_ids"] }
];
const TAB_DEFS = [
  { id: "basic", labelKey: "SECTION_BASIC", groupKeys: ["SECTION_BASIC"] },
  { id: "content", labelKey: "SECTION_CONTENT", groupKeys: ["SECTION_CONTENT"] },
  { id: "media", labelKey: "TAB_MEDIA_CTA", groupKeys: ["SECTION_MEDIA", "SECTION_LINKS", "SECTION_CTA", "SECTION_STYLE"] },
  { id: "schedule", labelKey: "SECTION_SCHEDULE", groupKeys: ["SECTION_SCHEDULE"] },
  { id: "targeting", labelKey: "SECTION_TARGETING", groupKeys: ["SECTION_TARGETING"] }
];
function isHexColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
function BannerFormDrawer({ open, onClose, placement, banner, initialForm }) {
  const { t, i18n } = reactI18next.useTranslation("banners");
  registerBannersTranslations(i18n);
  const config2 = getPlacementConfig(placement);
  const isEditing = !!banner;
  const [form, setForm] = react.useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = react.useState("basic");
  const [nameError, setNameError] = react.useState(null);
  const { mutateAsync: createBanner, isPending: isCreating } = useCreateBanner();
  const { mutateAsync: updateBanner, isPending: isUpdating } = useUpdateBanner((banner == null ? void 0 : banner.id) ?? "");
  const isPending = isCreating || isUpdating;
  react.useEffect(() => {
    if (open) {
      setForm(
        banner ? bannerToForm(banner) : { ...EMPTY_FORM, ...initialForm ?? {} }
      );
      setActiveTab("basic");
      setNameError(null);
    }
  }, [open, banner, initialForm]);
  const visible = react.useMemo(
    () => /* @__PURE__ */ new Set([...config2.visibleFields, "customer_group_ids"]),
    [config2]
  );
  const { data: customerGroupsData } = reactQuery.useQuery({
    queryKey: ["admin", "customer-groups", "all"],
    queryFn: () => sdk.admin.customerGroup.list({ limit: 200, fields: "id,name" }),
    staleTime: 6e4
  });
  const customerGroups = (customerGroupsData == null ? void 0 : customerGroupsData.customer_groups) ?? [];
  const toggleCustomerGroup = (id) => {
    setForm((prev) => ({
      ...prev,
      customer_group_ids: prev.customer_group_ids.includes(id) ? prev.customer_group_ids.filter((g) => g !== id) : [...prev.customer_group_ids, id]
    }));
  };
  const tabs = react.useMemo(() => {
    const groupByKey = new Map(FIELD_GROUPS.map((g) => [g.titleKey, g]));
    return TAB_DEFS.map((tab) => ({
      ...tab,
      groups: tab.groupKeys.map((key) => {
        const group = groupByKey.get(key);
        return { ...group, fields: group.fields.filter((f) => visible.has(f)) };
      }).filter((group) => group.fields.length > 0)
    })).filter((tab) => tab.groups.length > 0);
  }, [visible]);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeTab)
  );
  const isLastTab = activeIndex === tabs.length - 1;
  const [uploadingMedia, setUploadingMedia] = react.useState(false);
  async function handleMediaUpload(file) {
    var _a, _b;
    setUploadingMedia(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const url = (_b = (_a = res.files) == null ? void 0 : _a[0]) == null ? void 0 : _b.url;
      if (url) {
        set("media_url", url);
        ui.toast.success(t("MEDIA_UPLOAD_SUCCESS"));
      }
    } catch (error) {
      ui.toast.error(t("MEDIA_UPLOAD_FAILED", { msg: (error == null ? void 0 : error.message) ?? "" }));
    } finally {
      setUploadingMedia(false);
    }
  }
  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "internal_name" && value.trim().length >= 2) {
      setNameError(null);
    }
  }
  const setStickyLinks = (links) => setForm((prev) => ({ ...prev, sticky_links: links }));
  const renderColorField = (field, labelKey, placeholderKey) => {
    const value = form[field];
    const pickerValue = isHexColor(value) ? value : "#ffffff";
    return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t(labelKey) }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-wrap gap-2", children: THEME_COLORS.map((color) => /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          type: "button",
          className: `h-7 w-7 rounded-md border ${value.toLowerCase() === color.value.toLowerCase() ? "border-ui-fg-base shadow-borders-focus" : "border-ui-border-base"}`,
          style: { backgroundColor: color.value },
          "aria-label": t(color.labelKey),
          title: t(color.labelKey),
          onClick: () => set(field, color.value)
        },
        `${field}-${color.value}`
      )) }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          "input",
          {
            type: "color",
            value: pickerValue,
            onChange: (e) => set(field, e.target.value),
            className: "h-8 w-10 shrink-0 cursor-pointer rounded-md border border-ui-border-base bg-ui-bg-field p-0.5",
            "aria-label": t(labelKey)
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(
          ui.Input,
          {
            className: "flex-1",
            value,
            onChange: (e) => set(field, e.target.value),
            placeholder: t(placeholderKey)
          }
        )
      ] })
    ] }, field);
  };
  function validateName() {
    var _a;
    if (form.internal_name.trim().length < 2) {
      setNameError(t("ERROR_INTERNAL_NAME"));
      setActiveTab(((_a = tabs[0]) == null ? void 0 : _a.id) ?? "basic");
      return false;
    }
    return true;
  }
  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateName()) return;
    if (placement === "sticky_footer") {
      const links = form.sticky_links.filter((l) => l.url || l.image);
      if (links.length === 0 && (!form.cta_url.trim() || !form.cta_label.trim())) {
        ui.toast.error(t("ERROR_STICKY_REQUIRES_CTA"));
        setActiveTab("media");
        return;
      }
    }
    const input = formToInput(form, placement, banner == null ? void 0 : banner.rules);
    try {
      if (isEditing) {
        await updateBanner(input);
        ui.toast.success(t("TOAST_UPDATED"));
      } else {
        await createBanner(input);
        ui.toast.success(t("TOAST_CREATED"));
      }
      onClose();
    } catch (err) {
      ui.toast.error(err instanceof Error ? err.message : t("TOAST_SAVE_FAILED"));
    }
  }
  const renderField = (field) => {
    switch (field) {
      case "internal_name":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_INTERNAL_NAME") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              value: form.internal_name,
              onChange: (e) => set("internal_name", e.target.value),
              placeholder: t("PLACEHOLDER_INTERNAL_NAME"),
              "aria-invalid": !!nameError
            }
          ),
          nameError ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-error", children: nameError }) : null
        ] }, field);
      case "status":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_STATUS") }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.status, onValueChange: (v) => set("status", v), children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { children: STATUSES.map((s) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: s, children: t(`STATUS_${s.toUpperCase()}`) }, s)) })
          ] })
        ] }, field);
      case "device_type":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_DEVICE") }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.device_type, onValueChange: (v) => set("device_type", v), children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, { placeholder: t("PLACEHOLDER_DEVICE") }) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { children: DEVICE_TYPES.map((d) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: d, children: t(`DEVICE_${d.toUpperCase()}`) }, d)) })
          ] })
        ] }, field);
      case "type":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_TYPE") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              value: form.type,
              onChange: (e) => set("type", e.target.value),
              placeholder: t("PLACEHOLDER_TYPE")
            }
          )
        ] }, field);
      case "priority":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_PRIORITY") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              type: "number",
              value: form.priority,
              onChange: (e) => set("priority", e.target.value)
            }
          )
        ] }, field);
      case "splash_bg":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_SPLASH_BG") }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: t("HELP_SPLASH_BG") }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex gap-2", children: ["color", "image"].map((mode) => /* @__PURE__ */ jsxRuntime.jsxs(
            "button",
            {
              type: "button",
              onClick: () => set("splash_bg", mode),
              className: `flex-1 rounded-lg border px-3 py-2 text-left txt-compact-small transition ${(form.splash_bg || "color") === mode ? "border-ui-fg-base bg-ui-bg-base shadow-borders-focus" : "border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-base-hover"}`,
              children: [
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "block font-medium text-ui-fg-base", children: t(mode === "color" ? "SPLASH_BG_COLOR" : "SPLASH_BG_IMAGE") }),
                /* @__PURE__ */ jsxRuntime.jsx("span", { className: "block text-ui-fg-subtle txt-compact-xsmall", children: t(
                  mode === "color" ? "SPLASH_BG_COLOR_HELP" : "SPLASH_BG_IMAGE_HELP"
                ) })
              ]
            },
            mode
          )) })
        ] }, field);
      case "show_logo":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between gap-3", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_SHOW_LOGO") }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: t("HELP_SHOW_LOGO") })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Switch,
            {
              checked: form.show_logo,
              onCheckedChange: (v) => set("show_logo", v)
            }
          )
        ] }, field);
      case "sticky_links":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_STICKY_LINKS") }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: t("HELP_STICKY_LINKS") }),
          form.sticky_links.map((row, i) => /* @__PURE__ */ jsxRuntime.jsxs(
            "div",
            {
              className: "flex flex-wrap items-end gap-2 rounded-lg border border-ui-border-base p-2",
              children: [
                /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex min-w-[160px] flex-1 flex-col gap-1", children: [
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_STICKY_LINK_IMAGE") }),
                  /* @__PURE__ */ jsxRuntime.jsx(
                    ui.Input,
                    {
                      value: row.image,
                      placeholder: "https://…/logo.png",
                      onChange: (e) => setStickyLinks(
                        form.sticky_links.map(
                          (r, idx) => idx === i ? { ...r, image: e.target.value } : r
                        )
                      )
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex min-w-[160px] flex-1 flex-col gap-1", children: [
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_STICKY_LINK_URL") }),
                  /* @__PURE__ */ jsxRuntime.jsx(
                    ui.Input,
                    {
                      value: row.url,
                      placeholder: "/store?brand=…",
                      onChange: (e) => setStickyLinks(
                        form.sticky_links.map(
                          (r, idx) => idx === i ? { ...r, url: e.target.value } : r
                        )
                      )
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxRuntime.jsx(
                  ui.Button,
                  {
                    variant: "transparent",
                    size: "small",
                    type: "button",
                    onClick: () => setStickyLinks(form.sticky_links.filter((_, idx) => idx !== i)),
                    children: "Quitar"
                  }
                )
              ]
            },
            i
          )),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Button,
            {
              variant: "secondary",
              size: "small",
              type: "button",
              disabled: form.sticky_links.length >= 4,
              onClick: () => setStickyLinks([...form.sticky_links, { url: "", image: "" }]),
              children: t("ADD_STICKY_LINK")
            }
          )
        ] }, field);
      case "countdown_seconds":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_COUNTDOWN_SECONDS") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              type: "number",
              min: "0",
              max: "120",
              value: form.countdown_seconds,
              onChange: (e) => set("countdown_seconds", e.target.value),
              placeholder: "8"
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: t("HELP_COUNTDOWN_SECONDS") })
        ] }, field);
      case "content_title":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_CONTENT_TITLE") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              value: form.content_title,
              onChange: (e) => set("content_title", e.target.value)
            }
          )
        ] }, field);
      case "content_subtitle":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_CONTENT_SUBTITLE") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              value: form.content_subtitle,
              onChange: (e) => set("content_subtitle", e.target.value)
            }
          )
        ] }, field);
      case "content_body":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_CONTENT_BODY") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Textarea,
            {
              value: form.content_body,
              onChange: (e) => set("content_body", e.target.value),
              rows: 3
            }
          )
        ] }, field);
      case "media_url":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_MEDIA_URL") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              value: form.media_url,
              onChange: (e) => set("media_url", e.target.value),
              placeholder: "https://..."
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mt-1 flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsxs(
              "label",
              {
                className: `inline-flex w-fit items-center gap-2 rounded-md border border-ui-border-base bg-ui-bg-base px-3 py-1.5 text-ui-fg-base shadow-borders-base txt-compact-small-plus ${uploadingMedia ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-ui-bg-base-hover"}`,
                children: [
                  uploadingMedia ? t("MEDIA_UPLOADING") : t("MEDIA_UPLOAD_BUTTON"),
                  /* @__PURE__ */ jsxRuntime.jsx(
                    "input",
                    {
                      type: "file",
                      accept: "image/*,video/*",
                      className: "hidden",
                      disabled: uploadingMedia,
                      onChange: (e) => {
                        var _a;
                        const file = (_a = e.target.files) == null ? void 0 : _a[0];
                        if (file) {
                          void handleMediaUpload(file);
                        }
                        e.target.value = "";
                      }
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: t("MEDIA_UPLOAD_HINT") })
          ] })
        ] }, field);
      case "cta_url":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_CTA_URL") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              value: form.cta_url,
              onChange: (e) => set("cta_url", e.target.value),
              placeholder: "https://..."
            }
          )
        ] }, field);
      case "cta_label":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_CTA_LABEL") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              value: form.cta_label,
              onChange: (e) => set("cta_label", e.target.value),
              placeholder: t("PLACEHOLDER_CTA_LABEL")
            }
          )
        ] }, field);
      case "cta_target":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_CTA_TARGET") }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.cta_target, onValueChange: (v) => set("cta_target", v), children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
            /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "_self", children: t("TARGET_SELF") }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: "_blank", children: t("TARGET_BLANK") })
            ] })
          ] })
        ] }, field);
      case "icon":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_ICON") }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: form.icon, onValueChange: (v) => set("icon", v), children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, { placeholder: t("PLACEHOLDER_ICON") }) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { children: TOPBAR_ICONS.map((icon) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: icon, children: t(`ICON_${icon.replace(/-/g, "_").toUpperCase()}`, {
              defaultValue: icon.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())
            }) }, icon)) })
          ] })
        ] }, field);
      case "card_color":
        return renderColorField("card_color", "FIELD_BACKGROUND_COLOR", "PLACEHOLDER_CARD_COLOR");
      case "icon_color":
        return renderColorField("icon_color", "FIELD_ICON_COLOR", "PLACEHOLDER_ICON_COLOR");
      case "text_color":
        return renderColorField("text_color", "FIELD_TEXT_COLOR", "PLACEHOLDER_TEXT_COLOR");
      case "start_at":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_START_AT") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.DatePicker,
            {
              granularity: "minute",
              value: localInputToDate(form.start_at),
              onChange: (d) => set("start_at", dateToLocalInput(d))
            }
          )
        ] }, field);
      case "end_at":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_END_AT") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.DatePicker,
            {
              granularity: "minute",
              value: localInputToDate(form.end_at),
              onChange: (d) => set("end_at", dateToLocalInput(d))
            }
          )
        ] }, field);
      case "customer_group_ids":
        return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_CUSTOMER_GROUPS") }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: form.customer_group_ids.length === 0 ? t("TARGETING_ALL_HINT") : t("TARGETING_SELECTED_HINT") }),
          customerGroups.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-muted", children: t("TARGETING_NO_GROUPS") }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-col gap-2 rounded-lg border border-ui-border-base p-3", children: customerGroups.map((group) => /* @__PURE__ */ jsxRuntime.jsxs(
            "label",
            {
              className: "flex cursor-pointer items-center gap-2",
              children: [
                /* @__PURE__ */ jsxRuntime.jsx(
                  ui.Checkbox,
                  {
                    checked: form.customer_group_ids.includes(group.id),
                    onCheckedChange: () => toggleCustomerGroup(group.id)
                  }
                ),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", children: group.name ?? group.id })
              ]
            },
            group.id
          )) })
        ] }, field);
      default:
        return null;
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal, { open, onOpenChange: (v) => !v && onClose(), children: /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Content, { children: /* @__PURE__ */ jsxRuntime.jsxs(
    ui.ProgressTabs,
    {
      value: activeTab,
      onValueChange: setActiveTab,
      className: "flex h-full flex-col overflow-hidden",
      children: [
        /* @__PURE__ */ jsxRuntime.jsxs(ui.FocusModal.Header, { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Title, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: "sr-only", children: isEditing ? t("FORM_EDIT_ITEM_TITLE", { item: t(config2.itemLabelKey) }) : t("FORM_CREATE_ITEM_TITLE", { item: t(config2.itemLabelKey) }) }) }),
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "-my-2 w-full border-l", children: /* @__PURE__ */ jsxRuntime.jsx(ui.ProgressTabs.List, { children: tabs.map((tab, index) => /* @__PURE__ */ jsxRuntime.jsx(
            ui.ProgressTabs.Trigger,
            {
              value: tab.id,
              status: index < activeIndex ? "completed" : index === activeIndex ? "in-progress" : "not-started",
              children: t(tab.labelKey)
            },
            tab.id
          )) }) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Body, { className: "flex flex-1 overflow-hidden", children: /* @__PURE__ */ jsxRuntime.jsxs("form", { id: "banner-form", onSubmit: handleSubmit, className: "flex w-full", children: [
          /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex-1 overflow-y-auto px-8 py-12", children: /* @__PURE__ */ jsxRuntime.jsx("div", { className: "mx-auto flex w-full max-w-[640px] flex-col", children: tabs.map((tab) => /* @__PURE__ */ jsxRuntime.jsxs(
            ui.ProgressTabs.Content,
            {
              value: tab.id,
              className: "flex flex-col gap-8",
              children: [
                /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t(tab.labelKey) }),
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", children: t(config2.labelKey) })
                ] }),
                tab.groups.map((group) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-4", children: [
                  tab.groups.length > 1 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", className: "text-ui-fg-base", children: t(group.titleKey) }) : null,
                  group.fields.map(renderField)
                ] }, group.titleKey)),
                tab.id === "targeting" ? /* @__PURE__ */ jsxRuntime.jsx(
                  admin.SalesChannelMultiSelect,
                  {
                    value: form.sales_channel_ids,
                    onChange: (ids) => setForm((prev) => ({ ...prev, sales_channel_ids: ids })),
                    label: t("FIELD_SALES_CHANNELS", {
                      defaultValue: "Canales de venta"
                    }),
                    help: t("SALES_CHANNELS_HELP", {
                      defaultValue: "Vacío = visible en todos los canales."
                    })
                  }
                ) : null
              ]
            },
            tab.id
          )) }) }),
          /* @__PURE__ */ jsxRuntime.jsx("aside", { className: "hidden w-[400px] shrink-0 overflow-y-auto border-l border-ui-border-base bg-ui-bg-subtle px-6 py-6 lg:block", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { className: "font-semibold text-ui-fg-base", children: t("PREVIEW_TITLE") }),
            /* @__PURE__ */ jsxRuntime.jsx(
              BannerPreview,
              {
                kind: config2.preview,
                data: {
                  title: form.content_title || void 0,
                  subtitle: form.content_subtitle || void 0,
                  body: form.content_body || void 0,
                  mediaUrl: form.media_url || void 0,
                  ctaUrl: form.cta_url || void 0,
                  ctaLabel: form.cta_label || void 0,
                  icon: form.icon || void 0,
                  cardColor: form.card_color || void 0,
                  iconColor: form.icon_color || void 0,
                  textColor: form.text_color || void 0,
                  showLogo: form.show_logo,
                  splashBg: form.splash_bg === "image" ? "image" : "color",
                  links: form.sticky_links.filter((l) => l.url || l.image)
                }
              }
            ),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-muted", children: t("PREVIEW_HINT") })
          ] }) })
        ] }) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Footer, { children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-end gap-x-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", size: "small", onClick: onClose, disabled: isPending, children: t("BTN_CANCEL") }),
          isEditing || isLastTab ? /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { type: "submit", size: "small", form: "banner-form", isLoading: isPending, children: isEditing ? t("BTN_SAVE") : t("CREATE_BUTTON") }) : /* @__PURE__ */ jsxRuntime.jsx(
            ui.Button,
            {
              type: "button",
              size: "small",
              onClick: () => {
                if (activeIndex === 0 && !validateName()) return;
                const next = tabs[activeIndex + 1];
                if (next) setActiveTab(next.id);
              },
              children: t("BTN_CONTINUE")
            }
          )
        ] }) })
      ]
    }
  ) }) });
}
const ProductSelector = ({ value, onChange }) => {
  const { t } = reactI18next.useTranslation("blog");
  const [search, setSearch] = react.useState("");
  const [debounced, setDebounced] = react.useState("");
  react.useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  const { data: searchData } = reactQuery.useQuery({
    queryKey: ["blog-product-search", debounced],
    queryFn: () => sdk.admin.product.list({
      q: debounced,
      limit: 8,
      fields: "id,title,thumbnail"
    }),
    enabled: debounced.length > 0
  });
  const { data: selectedData } = reactQuery.useQuery({
    queryKey: ["blog-product-selected", value],
    queryFn: () => sdk.admin.product.list({
      id: value,
      limit: value.length,
      fields: "id,title,thumbnail"
    }),
    enabled: value.length > 0
  });
  const selectedProducts = react.useMemo(() => {
    const byId = new Map(
      ((selectedData == null ? void 0 : selectedData.products) ?? []).map((p) => [
        p.id,
        { id: p.id, title: p.title, thumbnail: p.thumbnail }
      ])
    );
    return value.map(
      (id) => byId.get(id) ?? { id, title: id, thumbnail: null }
    );
  }, [value, selectedData]);
  const sensors = core.useSensors(core.useSensor(core.PointerSensor));
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = value.indexOf(active.id);
      const newIndex = value.indexOf(over.id);
      onChange(sortable.arrayMove(value, oldIndex, newIndex));
    }
  };
  const add = (id) => {
    if (!value.includes(id)) {
      onChange([...value, id]);
    }
    setSearch("");
    setDebounced("");
  };
  const remove = (id) => onChange(value.filter((v) => v !== id));
  const results = ((searchData == null ? void 0 : searchData.products) ?? []).filter(
    (p) => !value.includes(p.id)
  );
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-3", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsxRuntime.jsx(
        ui.Input,
        {
          placeholder: t("PRODUCTS_SEARCH"),
          value: search,
          onChange: (e) => setSearch(e.target.value)
        }
      ),
      debounced && results.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout", children: results.map((p) => /* @__PURE__ */ jsxRuntime.jsxs(
        "button",
        {
          type: "button",
          onClick: () => add(p.id),
          className: "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ui-bg-base-hover",
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(Thumb, { src: p.thumbnail }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", children: p.title })
          ]
        },
        p.id
      )) })
    ] }),
    value.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-muted", children: t("PRODUCTS_EMPTY") }) : /* @__PURE__ */ jsxRuntime.jsx(
      core.DndContext,
      {
        sensors,
        collisionDetection: core.closestCenter,
        onDragEnd: handleDragEnd,
        children: /* @__PURE__ */ jsxRuntime.jsx(sortable.SortableContext, { items: value, strategy: sortable.verticalListSortingStrategy, children: /* @__PURE__ */ jsxRuntime.jsx("ul", { className: "flex flex-col gap-2", children: selectedProducts.map((p) => /* @__PURE__ */ jsxRuntime.jsx(
          SortableRow,
          {
            product: p,
            onRemove: () => remove(p.id),
            removeLabel: t("PRODUCTS_REMOVE")
          },
          p.id
        )) }) })
      }
    )
  ] });
};
function SortableRow({
  product,
  onRemove,
  removeLabel
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable.useSortable({ id: product.id });
  return /* @__PURE__ */ jsxRuntime.jsxs(
    "li",
    {
      ref: setNodeRef,
      style: { transform: utilities.CSS.Transform.toString(transform), transition },
      className: ui.clx(
        "flex items-center gap-2 rounded-lg border border-ui-border-base bg-ui-bg-base px-2 py-1.5",
        { "opacity-60": isDragging }
      ),
      children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          "button",
          {
            type: "button",
            className: "cursor-grab text-ui-fg-muted",
            ...attributes,
            ...listeners,
            children: /* @__PURE__ */ jsxRuntime.jsx(icons.DotsSix, {})
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(Thumb, { src: product.thumbnail }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "flex-1 truncate", children: product.title }),
        /* @__PURE__ */ jsxRuntime.jsx(
          ui.Button,
          {
            type: "button",
            variant: "transparent",
            size: "small",
            onClick: onRemove,
            title: removeLabel,
            children: /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "text-ui-fg-muted" })
          }
        )
      ]
    }
  );
}
function Thumb({ src }) {
  return /* @__PURE__ */ jsxRuntime.jsx("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-ui-bg-component", children: src ? /* @__PURE__ */ jsxRuntime.jsx("img", { src, alt: "", className: "h-full w-full object-cover" }) : null });
}
const BLOG_NAMESPACE = "blog";
let registered = false;
const en = {
  // Menu / shared
  MENU_BLOG: "Blog",
  MENU_ARTICLES: "Articles",
  MENU_CATEGORIES: "Categories",
  MENU_SETTINGS: "Settings",
  // Articles list
  ARTICLES_TITLE: "Articles",
  ARTICLES_EMPTY: "No articles yet. Create your first one.",
  CREATE_ARTICLE: "Create",
  COLUMN_TITLE: "Title",
  COLUMN_CATEGORY: "Category",
  COLUMN_STATUS: "Status",
  COLUMN_DATE: "Date",
  COLUMN_ACTIONS: "Actions",
  STATUS_DRAFT: "Draft",
  STATUS_PUBLISHED: "Published",
  ACTION_EDIT: "Edit",
  ACTION_DUPLICATE: "Duplicate",
  ACTION_DELETE: "Delete",
  ACTION_PUBLISH: "Publish",
  ACTION_UNPUBLISH: "Unpublish",
  CONFIRM_DELETE_TITLE: "Delete article",
  CONFIRM_DELETE_DESC: "This action cannot be undone.",
  NONE: "None",
  // Editor
  EDITOR_NEW_TITLE: "New article",
  EDITOR_BACK: "Back",
  EDITOR_SAVE: "Save",
  EDITOR_PREVIEW: "Preview",
  SAVE_SUCCESS: "Article saved",
  SAVE_ERROR: "Could not save: {{msg}}",
  FIELD_TITLE: "Title",
  FIELD_TITLE_PLACEHOLDER: "Article title",
  FIELD_SLUG: "Slug",
  FIELD_SLUG_HELP: "URL: /blog/{slug}. Generated from the title when empty.",
  FIELD_EXCERPT: "Excerpt",
  FIELD_EXCERPT_PLACEHOLDER: "Short summary shown in cards and listings",
  FIELD_COVER: "Cover image",
  FIELD_CONTENT: "Content",
  FIELD_CATEGORY: "Category",
  FIELD_STATUS: "Status",
  SECTION_SEO: "SEO",
  FIELD_SEO_TITLE: "SEO title",
  FIELD_SEO_DESCRIPTION: "SEO description",
  SECTION_PRODUCTS: "Related products",
  PRODUCTS_HELP: "These products appear in the article and can be added to cart.",
  PRODUCTS_ADD: "Add products",
  PRODUCTS_SEARCH: "Search products…",
  PRODUCTS_EMPTY: "No products linked yet.",
  PRODUCTS_REMOVE: "Remove",
  UPLOAD: "Upload",
  UPLOADING: "Uploading…",
  REMOVE_IMAGE: "Remove image",
  VALIDATION_TITLE_REQUIRED: "Title is required",
  // Toolbar
  TB_BOLD: "Bold",
  TB_ITALIC: "Italic",
  TB_UNDERLINE: "Underline",
  TB_STRIKE: "Strikethrough",
  TB_H1: "Heading 1",
  TB_H2: "Heading 2",
  TB_H3: "Heading 3",
  TB_PARAGRAPH: "Paragraph",
  TB_BULLET: "Bullet list",
  TB_ORDERED: "Numbered list",
  TB_TASK: "Checklist",
  TB_QUOTE: "Quote",
  TB_DIVIDER: "Divider",
  TB_LINK: "Link",
  TB_IMAGE: "Image",
  TB_VIDEO: "Embed video (YouTube/Vimeo)",
  TB_TABLE: "Table",
  TB_HIGHLIGHT: "Highlight",
  TB_COLOR: "Text color",
  PROMPT_LINK: "Enter URL",
  PROMPT_VIDEO: "Enter YouTube or Vimeo URL",
  LINK_MODAL_TITLE: "Add link",
  LINK_MODAL_SUBMIT: "Apply link",
  VIDEO_MODAL_TITLE: "Add video",
  VIDEO_MODAL_SUBMIT: "Insert video",
  // Categories
  CATEGORIES_TITLE: "Categories",
  CATEGORIES_EMPTY: "No categories yet.",
  CREATE_CATEGORY: "Create category",
  EDIT_CATEGORY: "Edit category",
  FIELD_NAME: "Name",
  FIELD_DESCRIPTION: "Description",
  FIELD_IMAGE: "Image",
  FIELD_ORDER: "Order",
  CATEGORY_SAVED: "Category saved",
  CATEGORY_DELETED: "Category deleted",
  // Settings
  SETTINGS_TITLE: "Blog settings",
  SETTINGS_GENERAL: "General",
  SETTINGS_SEO: "SEO defaults",
  FIELD_SECTION_NAME: "Section name",
  FIELD_SHOW_SEARCH: "Show search",
  FIELD_SHOW_CATEGORIES: "Show categories",
  FIELD_POSTS_PER_PAGE: "Posts per page",
  FIELD_DEFAULT_SEO_TITLE: "Default meta title",
  FIELD_DEFAULT_SEO_DESCRIPTION: "Default meta description",
  SETTINGS_SAVED: "Settings saved",
  SAVE: "Save",
  CANCEL: "Cancel"
};
const es = {
  MENU_BLOG: "Blog",
  MENU_ARTICLES: "Artículos",
  MENU_CATEGORIES: "Categorías",
  MENU_SETTINGS: "Configuración",
  ARTICLES_TITLE: "Artículos",
  ARTICLES_EMPTY: "Todavía no hay artículos. Creá el primero.",
  CREATE_ARTICLE: "Crear",
  COLUMN_TITLE: "Título",
  COLUMN_CATEGORY: "Categoría",
  COLUMN_STATUS: "Estado",
  COLUMN_DATE: "Fecha",
  COLUMN_ACTIONS: "Acciones",
  STATUS_DRAFT: "Borrador",
  STATUS_PUBLISHED: "Publicado",
  ACTION_EDIT: "Editar",
  ACTION_DUPLICATE: "Duplicar",
  ACTION_DELETE: "Eliminar",
  ACTION_PUBLISH: "Publicar",
  ACTION_UNPUBLISH: "Despublicar",
  CONFIRM_DELETE_TITLE: "Eliminar artículo",
  CONFIRM_DELETE_DESC: "Esta acción no se puede deshacer.",
  NONE: "Ninguna",
  EDITOR_NEW_TITLE: "Nuevo artículo",
  EDITOR_BACK: "Volver",
  EDITOR_SAVE: "Guardar",
  EDITOR_PREVIEW: "Vista previa",
  SAVE_SUCCESS: "Artículo guardado",
  SAVE_ERROR: "No se pudo guardar: {{msg}}",
  FIELD_TITLE: "Título",
  FIELD_TITLE_PLACEHOLDER: "Título del artículo",
  FIELD_SLUG: "Slug",
  FIELD_SLUG_HELP: "URL: /blog/{slug}. Se genera del título si se deja vacío.",
  FIELD_EXCERPT: "Extracto",
  FIELD_EXCERPT_PLACEHOLDER: "Resumen breve que se muestra en las tarjetas",
  FIELD_COVER: "Imagen de portada",
  FIELD_CONTENT: "Contenido",
  FIELD_CATEGORY: "Categoría",
  FIELD_STATUS: "Estado",
  SECTION_SEO: "SEO",
  FIELD_SEO_TITLE: "Título SEO",
  FIELD_SEO_DESCRIPTION: "Descripción SEO",
  SECTION_PRODUCTS: "Productos relacionados",
  PRODUCTS_HELP: "Estos productos aparecen en el artículo y se pueden agregar al carrito.",
  PRODUCTS_ADD: "Agregar productos",
  PRODUCTS_SEARCH: "Buscar productos…",
  PRODUCTS_EMPTY: "Todavía no hay productos vinculados.",
  PRODUCTS_REMOVE: "Quitar",
  UPLOAD: "Subir",
  UPLOADING: "Subiendo…",
  REMOVE_IMAGE: "Quitar imagen",
  VALIDATION_TITLE_REQUIRED: "El título es obligatorio",
  TB_BOLD: "Negrita",
  TB_ITALIC: "Cursiva",
  TB_UNDERLINE: "Subrayado",
  TB_STRIKE: "Tachado",
  TB_H1: "Título 1",
  TB_H2: "Título 2",
  TB_H3: "Título 3",
  TB_PARAGRAPH: "Párrafo",
  TB_BULLET: "Lista con viñetas",
  TB_ORDERED: "Lista numerada",
  TB_TASK: "Checklist",
  TB_QUOTE: "Cita",
  TB_DIVIDER: "Separador",
  TB_LINK: "Enlace",
  TB_IMAGE: "Imagen",
  TB_VIDEO: "Insertar video (YouTube/Vimeo)",
  TB_TABLE: "Tabla",
  TB_HIGHLIGHT: "Resaltar",
  TB_COLOR: "Color de texto",
  LINK_MODAL_TITLE: "Agregar enlace",
  LINK_MODAL_SUBMIT: "Aplicar enlace",
  VIDEO_MODAL_TITLE: "Agregar video",
  VIDEO_MODAL_SUBMIT: "Insertar video",
  PROMPT_LINK: "Ingresá la URL",
  PROMPT_VIDEO: "Ingresá la URL de YouTube o Vimeo",
  CATEGORIES_TITLE: "Categorías",
  CATEGORIES_EMPTY: "Todavía no hay categorías.",
  CREATE_CATEGORY: "Crear categoría",
  EDIT_CATEGORY: "Editar categoría",
  FIELD_NAME: "Nombre",
  FIELD_DESCRIPTION: "Descripción",
  FIELD_IMAGE: "Imagen",
  FIELD_ORDER: "Orden",
  CATEGORY_SAVED: "Categoría guardada",
  CATEGORY_DELETED: "Categoría eliminada",
  SETTINGS_TITLE: "Configuración del blog",
  SETTINGS_GENERAL: "Generales",
  SETTINGS_SEO: "SEO por defecto",
  FIELD_SECTION_NAME: "Nombre de sección",
  FIELD_SHOW_SEARCH: "Mostrar buscador",
  FIELD_SHOW_CATEGORIES: "Mostrar categorías",
  FIELD_POSTS_PER_PAGE: "Posts por página",
  FIELD_DEFAULT_SEO_TITLE: "Meta title por defecto",
  FIELD_DEFAULT_SEO_DESCRIPTION: "Meta description por defecto",
  SETTINGS_SAVED: "Configuración guardada",
  SAVE: "Guardar",
  CANCEL: "Cancelar"
};
const registerBlogTranslations = (i18n) => {
  if (registered) return;
  registered = true;
  i18n.addResourceBundle("en", BLOG_NAMESPACE, en);
  i18n.addResourceBundle("es", BLOG_NAMESPACE, es);
};
const DEFAULT_PLACEMENT = PLACEMENT_IDS.includes("banner_1") ? "banner_1" : PLACEMENT_IDS[0] ?? "banner_1";
function aspectForPlacement(placement) {
  if (placement === "welcome_splash") return "9:16";
  if (placement === "banner_1") return "21:9";
  return "16:9";
}
function AiComposeDrawer({ open, onClose, onComposed }) {
  const { t, i18n } = reactI18next.useTranslation("banners");
  registerBannersTranslations(i18n);
  registerBlogTranslations(i18n);
  const [placement, setPlacement] = react.useState(DEFAULT_PLACEMENT);
  const [brief, setBrief] = react.useState("");
  const [goal, setGoal] = react.useState("");
  const [tone, setTone] = react.useState("");
  const [audience, setAudience] = react.useState("");
  const [productIds, setProductIds] = react.useState([]);
  const compose = useComposeBannerAI();
  const [result, setResult] = react.useState(null);
  const reset = () => {
    setPlacement(DEFAULT_PLACEMENT);
    setBrief("");
    setGoal("");
    setTone("");
    setAudience("");
    setProductIds([]);
    setResult(null);
  };
  const close = () => {
    if (compose.isPending) return;
    reset();
    onClose();
  };
  const handleGenerate = async () => {
    var _a;
    if (!brief.trim()) return;
    try {
      const r = await compose.mutateAsync({
        brief: brief.trim(),
        goal: goal.trim() || void 0,
        tone: tone.trim() || void 0,
        audience: audience.trim() || void 0,
        placement,
        aspectRatio: aspectForPlacement(placement),
        productIds: productIds.length ? productIds : void 0
      });
      if ((_a = r.warnings) == null ? void 0 : _a.length) {
        ui.toast.warning(t("AI_COMPOSE_WARN", { msg: r.warnings.join(" · ") }));
      } else {
        ui.toast.success(t("AI_COMPOSE_DONE"));
      }
      setResult(r);
    } catch (err) {
      ui.toast.error(err instanceof Error ? err.message : t("AI_ERROR"));
    }
  };
  const handleUse = () => {
    if (!result) return;
    onComposed(result, placement);
    reset();
  };
  return /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer, { open, onOpenChange: (v) => !v && close(), children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Content, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Drawer.Header, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t("AI_COMPOSE_TITLE") }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Body, { className: "flex flex-col gap-4 overflow-y-auto p-4", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("AI_COMPOSE_SUBTITLE") }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("AI_COMPOSE_PLACEMENT") }),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: placement, onValueChange: setPlacement, children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { className: "z-[60]", children: PLACEMENT_IDS.map((id) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: id, children: t(PLACEMENT_CONFIG[id].labelKey) }, id)) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("AI_BRIEF_LABEL") }),
        /* @__PURE__ */ jsxRuntime.jsx(
          ui.Textarea,
          {
            rows: 3,
            placeholder: t("AI_BRIEF_PLACEHOLDER"),
            value: brief,
            onChange: (e) => setBrief(e.target.value)
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "grid grid-cols-1 gap-2 sm:grid-cols-3", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { placeholder: t("AI_GOAL"), value: goal, onChange: (e) => setGoal(e.target.value) }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Input, { placeholder: t("AI_TONE"), value: tone, onChange: (e) => setTone(e.target.value) }),
        /* @__PURE__ */ jsxRuntime.jsx(
          ui.Input,
          {
            placeholder: t("AI_AUDIENCE"),
            value: audience,
            onChange: (e) => setAudience(e.target.value)
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("AI_COMPOSE_PRODUCTS_LABEL") }),
        /* @__PURE__ */ jsxRuntime.jsx(ProductSelector, { value: productIds, onChange: setProductIds }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-muted", children: t("AI_COMPOSE_PRODUCTS_HELP") })
      ] }),
      result ? /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2 border-t border-ui-border-base pt-4", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("AI_COMPOSE_PREVIEW") }),
        /* @__PURE__ */ jsxRuntime.jsx(
          BannerPreview,
          {
            kind: getPlacementConfig(placement).preview,
            data: {
              title: result.content.title || void 0,
              subtitle: result.content.subtitle || void 0,
              body: result.content.body || void 0,
              mediaUrl: result.image_url || void 0,
              ctaLabel: result.cta.label || void 0,
              ctaUrl: result.cta.url || void 0
            }
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-muted", children: t("AI_COMPOSE_PREVIEW_HELP") })
      ] }) : null
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Drawer.Footer, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", size: "small", onClick: close, disabled: compose.isPending, children: t("BTN_CANCEL") }),
      result ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(
          ui.Button,
          {
            variant: "secondary",
            size: "small",
            onClick: handleGenerate,
            isLoading: compose.isPending,
            disabled: !brief.trim(),
            children: t("AI_COMPOSE_REGENERATE")
          }
        ),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", onClick: handleUse, disabled: compose.isPending, children: t("AI_COMPOSE_USE") })
      ] }) : /* @__PURE__ */ jsxRuntime.jsx(
        ui.Button,
        {
          size: "small",
          onClick: handleGenerate,
          isLoading: compose.isPending,
          disabled: !brief.trim(),
          children: t("AI_COMPOSE_GENERATE")
        }
      )
    ] })
  ] }) });
}
const VIEWBOX = "0 0 320 180";
const TopBarShapes = () => /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 16, y: 56, width: 288, height: 108, rx: 10, fill: "currentColor", fillOpacity: 0.05 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 16, y: 16, width: 288, height: 28, rx: 8, fill: "currentColor", fillOpacity: 0.16 }),
  /* @__PURE__ */ jsxRuntime.jsx("circle", { cx: 126, cy: 30, r: 5, fill: "currentColor", fillOpacity: 0.7 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 140, y: 27, width: 54, height: 6, rx: 3, fill: "currentColor", fillOpacity: 0.45 })
] });
const HeroShapes = () => /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 16, y: 16, width: 288, height: 148, rx: 12, fill: "currentColor", fillOpacity: 0.09 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 40, y: 58, width: 54, height: 6, rx: 3, fill: "currentColor", fillOpacity: 0.35 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 40, y: 74, width: 150, height: 13, rx: 4, fill: "currentColor", fillOpacity: 0.8 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 40, y: 93, width: 112, height: 13, rx: 4, fill: "currentColor", fillOpacity: 0.8 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 40, y: 114, width: 132, height: 6, rx: 3, fill: "currentColor", fillOpacity: 0.28 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 40, y: 130, width: 66, height: 18, rx: 9, fill: "currentColor", fillOpacity: 0.85 })
] });
const CardShapes = () => /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 76, y: 18, width: 168, height: 144, rx: 12, fill: "currentColor", fillOpacity: 0.09 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 90, y: 30, width: 140, height: 52, rx: 7, fill: "currentColor", fillOpacity: 0.16 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 90, y: 94, width: 104, height: 9, rx: 4, fill: "currentColor", fillOpacity: 0.8 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 90, y: 109, width: 140, height: 5, rx: 2.5, fill: "currentColor", fillOpacity: 0.28 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 90, y: 120, width: 116, height: 5, rx: 2.5, fill: "currentColor", fillOpacity: 0.28 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 90, y: 134, width: 56, height: 14, rx: 7, fill: "currentColor", fillOpacity: 0.85 })
] });
const SplashShapes = () => /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
  /* @__PURE__ */ jsxRuntime.jsx(
    "rect",
    {
      x: 118,
      y: 12,
      width: 84,
      height: 156,
      rx: 14,
      fill: "currentColor",
      fillOpacity: 0.05,
      stroke: "currentColor",
      strokeOpacity: 0.22,
      strokeWidth: 2.5
    }
  ),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 150, y: 26, width: 20, height: 8, rx: 4, fill: "currentColor", fillOpacity: 0.55 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 134, y: 42, width: 52, height: 8, rx: 4, fill: "currentColor", fillOpacity: 0.8 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 142, y: 54, width: 36, height: 8, rx: 4, fill: "currentColor", fillOpacity: 0.8 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 134, y: 72, width: 52, height: 48, rx: 8, fill: "currentColor", fillOpacity: 0.16 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 138, y: 132, width: 44, height: 5, rx: 2.5, fill: "currentColor", fillOpacity: 0.28 })
] });
const StickyShapes = () => /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 16, y: 14, width: 288, height: 98, rx: 10, fill: "currentColor", fillOpacity: 0.05 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 24, y: 122, width: 272, height: 42, rx: 14, fill: "currentColor", fillOpacity: 0.15 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 40, y: 134, width: 40, height: 18, rx: 4, fill: "currentColor", fillOpacity: 0.6 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 88, y: 134, width: 40, height: 18, rx: 4, fill: "currentColor", fillOpacity: 0.6 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 136, y: 134, width: 40, height: 18, rx: 4, fill: "currentColor", fillOpacity: 0.6 }),
  /* @__PURE__ */ jsxRuntime.jsx("rect", { x: 226, y: 136, width: 54, height: 14, rx: 7, fill: "currentColor", fillOpacity: 0.85 })
] });
const SHAPES = {
  topbar: TopBarShapes,
  hero: HeroShapes,
  card: CardShapes,
  splash: SplashShapes,
  sticky: StickyShapes
};
const PlacementThumbnail = ({ kind }) => {
  const Shapes = SHAPES[kind] ?? CardShapes;
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle text-ui-fg-base", children: /* @__PURE__ */ jsxRuntime.jsx("svg", { viewBox: VIEWBOX, className: "h-full w-full", role: "img", "aria-hidden": "true", children: /* @__PURE__ */ jsxRuntime.jsx(Shapes, {}) }) });
};
const BannersPage = () => {
  const { t, i18n } = reactI18next.useTranslation("banners");
  registerBannersTranslations(i18n);
  const navigate = reactRouterDom.useNavigate();
  const [drawerOpen, setDrawerOpen] = react.useState(false);
  const [newPlacement, setNewPlacement] = react.useState(PLACEMENT_IDS[0] ?? "top_bar");
  const [aiOpen, setAiOpen] = react.useState(false);
  const [aiDraft, setAiDraft] = react.useState(null);
  const openManualCreate = () => {
    setAiDraft(null);
    setDrawerOpen(true);
  };
  const { data, isLoading } = useBanners({ limit: 200, offset: 0 });
  const formatDate = (iso) => new Date(iso).toLocaleString(i18n.language === "es" ? "es-AR" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  const rows = react.useMemo(() => {
    const grouped = groupByPlacement((data == null ? void 0 : data.banners) ?? []);
    return PLACEMENT_IDS.map((placementId) => {
      const config2 = PLACEMENT_CONFIG[placementId];
      const items = grouped[placementId] ?? [];
      const itemWord = t(
        items.length === 1 ? config2.itemLabelKey : config2.itemLabelPluralKey
      ).toLowerCase();
      return {
        id: placementId,
        label: t(config2.labelKey),
        itemsLabel: items.length > 0 ? `${items.length} ${itemWord}` : t("PLACEMENT_EMPTY"),
        preview: config2.preview,
        total: items.length,
        live: items.filter((b) => isLive(b)).length,
        drafts: items.filter((b) => b.status === "draft").length,
        next: nextScheduledAt(items)
      };
    });
  }, [data == null ? void 0 : data.banners, t]);
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(admin.SiteScopeBar, { screen: "banners" }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "divide-y p-0", children: [
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 px-6 py-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-x-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t("TITLE") }),
          /* @__PURE__ */ jsxRuntime.jsx(admin.ExtensionVersion, { extension: "banners" })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: newPlacement, onValueChange: setNewPlacement, size: "small", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { className: "w-48", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { children: PLACEMENT_IDS.map((placementId) => {
              const config2 = PLACEMENT_CONFIG[placementId];
              return /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: placementId, children: t(config2.labelKey) }, placementId);
            }) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", variant: "secondary", onClick: openManualCreate, children: t("CREATE_BUTTON") }),
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Button, { size: "small", onClick: () => setAiOpen(true), children: [
            "✨ ",
            t("AI_COMPOSE_BUTTON")
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "grid grid-cols-1 gap-4 px-6 py-6 sm:grid-cols-2 xl:grid-cols-3", children: rows.map((row) => /* @__PURE__ */ jsxRuntime.jsxs(
        "button",
        {
          type: "button",
          onClick: () => navigate(`/banners/${row.id}`),
          className: "group flex flex-col gap-3 rounded-xl border border-ui-border-base bg-ui-bg-base p-3 text-left shadow-elevation-card-rest outline-none transition-shadow hover:shadow-elevation-card-hover focus-visible:shadow-borders-focus",
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(PlacementThumbnail, { kind: row.preview }),
            /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-start justify-between gap-2 px-1", children: [
              /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", className: "truncate text-ui-fg-base", children: row.label }),
                /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "truncate text-ui-fg-subtle", children: row.itemsLabel })
              ] }),
              isLoading ? null : /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: row.live > 0 ? "green" : "grey", className: "shrink-0", children: row.live > 0 ? t("STATUS_LIVE") : t("STATUS_INACTIVE") })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex min-h-[24px] flex-wrap items-center gap-1.5 px-1", children: isLoading ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "h-5 w-28 animate-pulse rounded-full bg-ui-bg-component" }) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
              row.live > 0 ? /* @__PURE__ */ jsxRuntime.jsxs(ui.Badge, { size: "2xsmall", color: "green", children: [
                t("COL_ACTIVE"),
                ": ",
                row.live
              ] }) : null,
              row.drafts > 0 ? /* @__PURE__ */ jsxRuntime.jsxs(ui.Badge, { size: "2xsmall", color: "orange", children: [
                t("COL_DRAFTS"),
                ": ",
                row.drafts
              ] }) : null,
              row.next ? /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: "blue", children: t("BADGE_NEXT", { date: formatDate(row.next) }) }) : null,
              row.live === 0 && row.drafts === 0 && !row.next ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-muted", children: "—" }) : null
            ] }) })
          ]
        },
        row.id
      )) })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(
      BannerFormDrawer,
      {
        open: drawerOpen,
        onClose: () => setDrawerOpen(false),
        placement: newPlacement,
        banner: null,
        initialForm: aiDraft
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(
      AiComposeDrawer,
      {
        open: aiOpen,
        onClose: () => setAiOpen(false),
        onComposed: (result, placement) => {
          setAiDraft({
            content_title: result.content.title,
            content_subtitle: result.content.subtitle,
            content_body: result.content.body,
            cta_label: result.cta.label,
            cta_url: result.cta.url,
            media_url: result.image_url,
            status: "draft"
          });
          setNewPlacement(placement);
          setAiOpen(false);
          setDrawerOpen(true);
        }
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] });
};
const BannersIcon = () => /* @__PURE__ */ jsxRuntime.jsx(icons.Newspaper, { style: { color: "#4B8EEF" } });
const config$1 = adminSdk.defineRouteConfig({
  label: "Banners",
  icon: BannersIcon,
  rank: 30
});
const handle$1 = {
  breadcrumb: () => "Banners"
};
const CredentialsPage = () => /* @__PURE__ */ jsxRuntime.jsx(reactRouterDom.Navigate, { to: "/settings/site-credentials#banners", replace: true });
const config = adminSdk.defineRouteConfig({ label: "Credenciales", rank: 99 });
const handle = { breadcrumb: () => "Credenciales" };
function statusColor(status) {
  switch (status) {
    case "published":
      return "green";
    case "draft":
      return "orange";
    case "archived":
      return "grey";
    default:
      return "grey";
  }
}
const PriorityCell = ({ banner }) => {
  const { t } = reactI18next.useTranslation("banners");
  const [priority, setPriority] = react.useState(String(banner.priority ?? 0));
  const { mutateAsync: updateBanner } = useUpdateBanner(banner.id);
  async function savePriority() {
    const next = Number(priority) || 0;
    if (next === (banner.priority ?? 0)) return;
    try {
      await updateBanner({ priority: next });
      ui.toast.success(t("TOAST_PRIORITY_UPDATED"));
    } catch {
      setPriority(String(banner.priority ?? 0));
      ui.toast.error(t("TOAST_SAVE_FAILED"));
    }
  }
  return /* @__PURE__ */ jsxRuntime.jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntime.jsx(
    ui.Input,
    {
      type: "number",
      className: "w-20",
      size: "small",
      value: priority,
      onChange: (e) => setPriority(e.target.value),
      onBlur: savePriority,
      onKeyDown: (e) => {
        if (e.key === "Enter") e.target.blur();
      }
    }
  ) });
};
const ActionsCell = ({ banner, onEdit }) => {
  const { t } = reactI18next.useTranslation("banners");
  const { mutateAsync: createBanner } = useCreateBanner();
  const { mutateAsync: deleteBanner } = useDeleteBanner();
  const { mutateAsync: publishBanner } = usePublishBanner();
  const { mutateAsync: unpublishBanner } = useUnpublishBanner();
  const { mutateAsync: archiveBanner } = useArchiveBanner();
  async function run(action, okKey, failKey) {
    try {
      await action();
      ui.toast.success(t(okKey));
    } catch {
      ui.toast.error(t(failKey));
    }
  }
  async function handleDuplicate() {
    try {
      await createBanner({
        internal_name: `${banner.internal_name ?? banner.id} ${t("DUPLICATE_SUFFIX")}`,
        type: banner.type,
        device_type: banner.device_type,
        placement: banner.placement,
        status: "draft",
        priority: banner.priority ?? 0,
        content: banner.content,
        media: banner.media,
        cta: banner.cta,
        metadata: banner.metadata,
        start_at: banner.start_at ?? null,
        end_at: banner.end_at ?? null
      });
      ui.toast.success(t("TOAST_DUPLICATED"));
    } catch {
      ui.toast.error(t("TOAST_SAVE_FAILED"));
    }
  }
  async function handleDelete() {
    if (!confirm(t("CONFIRM_DELETE"))) return;
    await run(() => deleteBanner(banner.id), "TOAST_DELETED", "TOAST_DELETE_FAILED");
  }
  return /* @__PURE__ */ jsxRuntime.jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { size: "small", variant: "transparent", children: /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, {}) }) }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { align: "end", children: [
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2", onClick: () => onEdit(banner), children: [
        /* @__PURE__ */ jsxRuntime.jsx(icons.PencilSquare, { className: "text-ui-fg-subtle" }),
        t("ACTION_EDIT")
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2", onClick: handleDuplicate, children: [
        /* @__PURE__ */ jsxRuntime.jsx(icons.SquareTwoStack, { className: "text-ui-fg-subtle" }),
        t("ACTION_DUPLICATE")
      ] }),
      banner.status !== "published" && /* @__PURE__ */ jsxRuntime.jsxs(
        ui.DropdownMenu.Item,
        {
          className: "gap-x-2",
          onClick: () => run(() => publishBanner(banner.id), "TOAST_PUBLISHED", "TOAST_PUBLISH_FAILED"),
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(icons.Photo, { className: "text-ui-fg-subtle" }),
            t("ACTION_PUBLISH")
          ]
        }
      ),
      banner.status === "published" && /* @__PURE__ */ jsxRuntime.jsxs(
        ui.DropdownMenu.Item,
        {
          className: "gap-x-2",
          onClick: () => run(() => unpublishBanner(banner.id), "TOAST_UNPUBLISHED", "TOAST_UNPUBLISH_FAILED"),
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, { className: "text-ui-fg-subtle" }),
            t("ACTION_UNPUBLISH")
          ]
        }
      ),
      banner.status !== "archived" && /* @__PURE__ */ jsxRuntime.jsxs(
        ui.DropdownMenu.Item,
        {
          className: "gap-x-2",
          onClick: () => run(() => archiveBanner(banner.id), "TOAST_ARCHIVED", "TOAST_ARCHIVE_FAILED"),
          children: [
            /* @__PURE__ */ jsxRuntime.jsx(icons.ArchiveBox, { className: "text-ui-fg-subtle" }),
            t("ACTION_ARCHIVE")
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Separator, {}),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2", onClick: handleDelete, children: [
        /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "text-ui-fg-subtle" }),
        t("ACTION_DELETE")
      ] })
    ] })
  ] }) });
};
const columnHelper = ui.createDataTableColumnHelper();
function PlacementItemsTable({ titleKey, items, onEdit }) {
  const { t } = reactI18next.useTranslation("banners");
  const columns = react.useMemo(
    () => [
      columnHelper.accessor("internal_name", {
        header: t("COL_INTERNAL_NAME"),
        cell: ({ row }) => {
          var _a, _b, _c;
          const banner = row.original;
          const snippet = ((_a = banner.content) == null ? void 0 : _a.title) || ((_b = banner.content) == null ? void 0 : _b.body) || ((_c = banner.content) == null ? void 0 : _c.subtitle);
          return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex min-w-0 flex-col gap-0.5", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", weight: "plus", className: "truncate", children: banner.internal_name || "—" }),
            snippet ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "truncate text-ui-fg-subtle", children: snippet }) : null
          ] });
        }
      }),
      columnHelper.accessor("device_type", {
        header: t("COL_DEVICE"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", children: t(`DEVICE_${(getValue() || "all").toUpperCase()}`) })
      }),
      columnHelper.accessor("priority", {
        header: t("COL_PRIORITY"),
        cell: ({ row }) => /* @__PURE__ */ jsxRuntime.jsx(PriorityCell, { banner: row.original })
      }),
      columnHelper.accessor("status", {
        header: t("COL_STATUS"),
        cell: ({ row }) => /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: statusColor(row.original.status), children: t(`STATUS_${row.original.status.toUpperCase()}`) }),
          isScheduled(row.original) ? /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: "blue", children: t("GROUP_SCHEDULED") }) : null
        ] })
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => /* @__PURE__ */ jsxRuntime.jsx(ActionsCell, { banner: row.original, onEdit })
      })
    ],
    [t, onEdit]
  );
  const table = ui.useDataTable({
    columns,
    data: items,
    getRowId: (row) => row.id,
    rowCount: items.length,
    // Medusa's DataTable passes the TanStack row wrapper at runtime (aunque el
    // tipo diga que es la fila de datos). El form de edición lee los campos del
    // banner directamente, así que hay que desenvolver `.original`; si no, abre
    // vacío como si fuera "crear".
    onRowClick: (_event, row) => onEdit(row.original ?? row)
  });
  if (items.length === 0) return null;
  return /* @__PURE__ */ jsxRuntime.jsx(ui.Container, { className: "p-0", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DataTable, { instance: table, children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Toolbar, { className: "flex items-center justify-between px-6 py-4", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.Heading, { level: "h2", children: [
      t(titleKey),
      " (",
      items.length,
      ")"
    ] }) }),
    /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Table, {})
  ] }) });
}
const DEVICE_FILTERS = ["all", "desktop", "mobile", "tablet"];
const PlacementEditorPage = () => {
  const { t, i18n } = reactI18next.useTranslation("banners");
  registerBannersTranslations(i18n);
  const navigate = reactRouterDom.useNavigate();
  const { placement = "" } = reactRouterDom.useParams();
  const [deviceFilter, setDeviceFilter] = react.useState("all");
  const [drawerOpen, setDrawerOpen] = react.useState(false);
  const [editingBanner, setEditingBanner] = react.useState(null);
  const { data, isLoading } = useBanners({ limit: 200, offset: 0 });
  const isKnown = !!PLACEMENT_CONFIG[placement];
  const config2 = getPlacementConfig(placement);
  const items = react.useMemo(() => {
    const all = ((data == null ? void 0 : data.banners) ?? []).filter((b) => b.placement === placement);
    const filtered = deviceFilter === "all" ? all : all.filter((b) => !b.device_type || b.device_type === "all" || b.device_type === deviceFilter);
    return filtered.sort(sortBanners);
  }, [data == null ? void 0 : data.banners, placement, deviceFilter]);
  const live = items.filter((b) => isLive(b));
  const scheduled = items.filter((b) => isScheduled(b));
  const drafts = items.filter((b) => b.status === "draft");
  const archived = items.filter((b) => b.status === "archived");
  function openCreate() {
    setEditingBanner(null);
    setDrawerOpen(true);
  }
  function openEdit(banner) {
    setEditingBanner(banner);
    setDrawerOpen(true);
  }
  if (!isKnown) {
    return /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "flex flex-col gap-4 p-6", children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: t("PLACEMENT_UNKNOWN") }),
      /* @__PURE__ */ jsxRuntime.jsx("div", { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", size: "small", onClick: () => navigate("/banners"), children: t("BACK_TO_PLACEMENTS") }) })
    ] });
  }
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-y-4", children: [
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "flex items-center justify-between p-6", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { size: "small", variant: "transparent", onClick: () => navigate("/banners"), children: /* @__PURE__ */ jsxRuntime.jsx(icons.ArrowLeft, {}) }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t(config2.labelKey) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntime.jsxs(ui.Select, { value: deviceFilter, onValueChange: setDeviceFilter, size: "small", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { className: "w-56 whitespace-nowrap", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { children: DEVICE_FILTERS.map((d) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: d, children: d === "all" ? t("DEVICE_FILTER_ALL") : t(`DEVICE_${d.toUpperCase()}`) }, d)) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", size: "small", onClick: openCreate, children: t("ADD_ITEM", { item: t(config2.itemLabelKey).toLowerCase() }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.Container, { className: "flex flex-col gap-3 p-6", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", weight: "plus", className: "uppercase text-ui-fg-muted", children: t("PREVIEW_TITLE") }),
        live.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-center rounded-lg border border-dashed border-ui-border-base py-10", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("PREVIEW_EMPTY") }) }) : config2.preview === "card" ? /* @__PURE__ */ jsxRuntime.jsx("div", { className: "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3", children: live.map((banner) => /* @__PURE__ */ jsxRuntime.jsx(BannerPreview, { kind: "card", data: bannerToPreviewData(banner) }, banner.id)) }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-col gap-2", children: live.map((banner) => /* @__PURE__ */ jsxRuntime.jsx(
          BannerPreview,
          {
            kind: config2.preview,
            data: bannerToPreviewData(banner)
          },
          banner.id
        )) })
      ] }),
      isLoading ? /* @__PURE__ */ jsxRuntime.jsx(ui.Container, { className: "p-6", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("LOADING") }) }) : items.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Container, { className: "p-6", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col items-center gap-3 py-8", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: t("PLACEMENT_EMPTY") }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", size: "small", onClick: openCreate, children: t("ADD_ITEM", { item: t(config2.itemLabelKey).toLowerCase() }) })
      ] }) }) : /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(PlacementItemsTable, { titleKey: "GROUP_PUBLISHED", items: live, onEdit: openEdit }),
        /* @__PURE__ */ jsxRuntime.jsx(PlacementItemsTable, { titleKey: "GROUP_SCHEDULED", items: scheduled, onEdit: openEdit }),
        /* @__PURE__ */ jsxRuntime.jsx(PlacementItemsTable, { titleKey: "GROUP_DRAFTS", items: drafts, onEdit: openEdit }),
        /* @__PURE__ */ jsxRuntime.jsx(PlacementItemsTable, { titleKey: "GROUP_ARCHIVED", items: archived, onEdit: openEdit })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(
      BannerFormDrawer,
      {
        open: drawerOpen,
        onClose: () => setDrawerOpen(false),
        placement,
        banner: editingBanner
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] });
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: BannersPage,
      path: "/banners",
      handle: { label: config$1.label, translationNs: config$1.translationNs, ...handle$1 }
    },
    {
      Component: CredentialsPage,
      path: "/banners/credenciales",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    },
    {
      Component: PlacementEditorPage,
      path: "/banners/:placement"
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config$1.label,
      icon: config$1.icon,
      path: "/banners",
      nested: void 0,
      rank: 30,
      translationNs: void 0
    },
    {
      label: config.label,
      icon: void 0,
      path: "/banners/credenciales",
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
