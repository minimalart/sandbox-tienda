"use strict";
const jsxRuntime = require("react/jsx-runtime");
const adminSdk = require("@medusajs/admin-sdk");
const icons = require("@medusajs/icons");
const ui = require("@medusajs/ui");
const react = require("react");
const reactI18next = require("react-i18next");
const admin = require("@minimalart/mercatto-plugin-runtime/admin");
const reactQuery = require("@tanstack/react-query");
const Medusa = require("@medusajs/js-sdk");
require("@medusajs/admin-shared");
const _interopDefault = (e) => e && e.__esModule ? e : { default: e };
const Medusa__default = /* @__PURE__ */ _interopDefault(Medusa);
const sdk = new Medusa__default.default({
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
const shopByLookQueryKey = queryKeysFactory("shop-by-look");
const useShopByLooks = (query, options) => {
  const filterQuery = toQueryString(query);
  return reactQuery.useQuery({
    queryKey: shopByLookQueryKey.list(query),
    queryFn: async () => sdk.client.fetch(
      `/admin/shop-by-looks${filterQuery ? `?${filterQuery}` : ""}`,
      { method: "GET" }
    ),
    ...options
  });
};
const useShopByLook = (lookId, options) => reactQuery.useQuery({
  queryKey: shopByLookQueryKey.detail(lookId),
  queryFn: async () => sdk.client.fetch(`/admin/shop-by-looks/${lookId}`, {
    method: "GET"
  }),
  enabled: !!lookId,
  ...options
});
const useCreateShopByLook = (options) => {
  const queryClient = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (data) => sdk.client.fetch("/admin/shop-by-looks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data
    }),
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({ queryKey: shopByLookQueryKey.lists() });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    },
    ...options
  });
};
const useUpdateShopByLook = (lookId, options) => {
  const queryClient = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: (data) => sdk.client.fetch(`/admin/shop-by-looks/${lookId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data
    }),
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({ queryKey: shopByLookQueryKey.lists() });
      queryClient.invalidateQueries({ queryKey: shopByLookQueryKey.detail(lookId) });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    },
    ...options
  });
};
const useDeleteShopByLook = (lookId, options) => {
  const queryClient = reactQuery.useQueryClient();
  return reactQuery.useMutation({
    mutationFn: () => sdk.client.fetch(`/admin/shop-by-looks/${lookId}`, { method: "DELETE" }),
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({ queryKey: shopByLookQueryKey.lists() });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    },
    ...options
  });
};
const SHOP_BY_LOOKS_NAMESPACE = "shop-by-looks";
let registered = false;
const en = {
  // List page
  TITLE: "Shop by Look",
  COLUMN_TITLE: "Title",
  COLUMN_PLACEMENT: "Placement",
  COLUMN_PRODUCTS: "Products",
  COLUMN_ORDER: "Order",
  COLUMN_STATUS: "Status",
  COLUMN_ACTIONS: "Actions",
  STATUS_ACTIVE: "Active",
  STATUS_INACTIVE: "Inactive",
  EMPTY_STATE: "No looks yet. Create your first look to get started.",
  CREATE_BUTTON: "Create",
  SEARCH_PLACEHOLDER: "Search looks",
  // Global toggle
  GLOBAL_TOGGLE_LABEL: "Shop by Look enabled",
  GLOBAL_TOGGLE_HELP: "Master switch. When off, no look is shown in the storefront.",
  // Placement options
  PLACEMENT_TOP: "Top of home",
  PLACEMENT_AFTER_COLLECTIONS: "After collections",
  PLACEMENT_AFTER_FEATURED: "After featured products",
  PLACEMENT_BEFORE_FOOTER: "Before footer",
  // Form fields
  FIELD_TITLE_LABEL: "Title *",
  FIELD_TITLE_PLACEHOLDER: "Summer look",
  FIELD_SUBTITLE_LABEL: "Subtitle",
  FIELD_SUBTITLE_PLACEHOLDER: "Optional subtitle",
  FIELD_CTA_LABEL: "CTA label",
  FIELD_CTA_PLACEHOLDER: "Shop look",
  FIELD_IMAGE_LABEL: "Main image *",
  FIELD_IMAGE_ALT_LABEL: "Image alt text",
  FIELD_IMAGE_ALT_PLACEHOLDER: "Describe the image for accessibility",
  FIELD_PLACEMENT_LABEL: "Placement",
  FIELD_ACTIVE_LABEL: "Active",
  FIELD_ACTIVE_HELP: "Inactive looks are hidden from the storefront.",
  FIELD_SORT_ORDER_LABEL: "Sort order",
  FIELD_SALES_CHANNELS_LABEL: "Sales channels",
  FIELD_SALES_CHANNELS_HELP: "Leave empty to show in all channels.",
  FIELD_REGIONS_LABEL: "Regions",
  FIELD_REGIONS_HELP: "Leave empty to show in all regions.",
  // Image upload
  UPLOAD_IMAGE: "Upload image",
  IMAGE_URL_PLACEHOLDER: "or paste an image URL",
  CLEAR_IMAGE: "Remove",
  // Products / hotspots
  PRODUCTS_TITLE: "Products & hotspots",
  PRODUCTS_HELP: "Add products and place their hotspot (X/Y %) over the image.",
  PRODUCTS_CLICK_HELP: "Search and add products, then click a product and click the image to place its hotspot.",
  PLACING_BADGE: "Placing",
  PLACE_HINT: "Click on the image to place the selected product. Drag a marker to fine-tune.",
  PLACE_HINT_SELECT: "Select a product to place its hotspot on the image.",
  ADD_PRODUCTS: "Add product",
  SEARCH_PRODUCTS_PLACEHOLDER: "Search products by name",
  NO_PRODUCTS: "No products added yet.",
  TYPE_AT_LEAST_2_CHARS: "Type at least 2 characters",
  NO_PRODUCTS_FOUND: 'No products found for "{{query}}"',
  ALREADY_ADDED: "Already added",
  HOTSPOT_X: "X (%)",
  HOTSPOT_Y: "Y (%)",
  VARIANT_LABEL: "Variant",
  VARIANT_ANY: "Choose in storefront",
  REMOVE: "Remove",
  PREVIEW_TITLE: "Preview",
  PREVIEW_EMPTY: "Add a main image to see the preview.",
  // Create / edit
  CREATE_TITLE: "Create look",
  CREATE_SUBMIT: "Create",
  CREATE_SUCCESS: "Look created",
  CREATE_ERROR: "Failed to create look: {{msg}}",
  EDIT_TITLE: "Edit look",
  SAVE_CHANGES: "Save changes",
  UPDATE_SUCCESS: "Look updated",
  UPDATE_ERROR: "Failed to update look: {{msg}}",
  VALIDATION_REQUIRED: "Title and image are required",
  // Actions
  ACTION_EDIT: "Edit",
  ACTION_DELETE: "Delete",
  DELETE_SUCCESS: "Look deleted",
  DELETE_ERROR: "Failed to delete look: {{msg}}",
  DELETE_CONFIRM: "Delete this look? This cannot be undone.",
  CANCEL: "Cancel",
  LOADING: "Loading..."
};
const es = {
  // List page
  TITLE: "Shop by Look",
  COLUMN_TITLE: "Título",
  COLUMN_PLACEMENT: "Ubicación",
  COLUMN_PRODUCTS: "Productos",
  COLUMN_ORDER: "Orden",
  COLUMN_STATUS: "Estado",
  COLUMN_ACTIONS: "Acciones",
  STATUS_ACTIVE: "Activo",
  STATUS_INACTIVE: "Inactivo",
  EMPTY_STATE: "Todavía no hay looks. Creá el primero para empezar.",
  CREATE_BUTTON: "Crear",
  SEARCH_PLACEHOLDER: "Buscar looks",
  // Global toggle
  GLOBAL_TOGGLE_LABEL: "Shop by Look activo",
  GLOBAL_TOGGLE_HELP: "Interruptor general. Si está apagado, no se muestra ningún look en el storefront.",
  // Placement options
  PLACEMENT_TOP: "Arriba del home",
  PLACEMENT_AFTER_COLLECTIONS: "Después de colecciones",
  PLACEMENT_AFTER_FEATURED: "Después de destacados",
  PLACEMENT_BEFORE_FOOTER: "Antes del footer",
  // Form fields
  FIELD_TITLE_LABEL: "Título *",
  FIELD_TITLE_PLACEHOLDER: "Look de verano",
  FIELD_SUBTITLE_LABEL: "Subtítulo",
  FIELD_SUBTITLE_PLACEHOLDER: "Subtítulo opcional",
  FIELD_CTA_LABEL: "Texto del CTA",
  FIELD_CTA_PLACEHOLDER: "Comprar look",
  FIELD_IMAGE_LABEL: "Imagen principal *",
  FIELD_IMAGE_ALT_LABEL: "Texto alternativo",
  FIELD_IMAGE_ALT_PLACEHOLDER: "Describí la imagen para accesibilidad",
  FIELD_PLACEMENT_LABEL: "Ubicación",
  FIELD_ACTIVE_LABEL: "Activo",
  FIELD_ACTIVE_HELP: "Los looks inactivos no se muestran en el storefront.",
  FIELD_SORT_ORDER_LABEL: "Orden",
  FIELD_SALES_CHANNELS_LABEL: "Canales de venta",
  FIELD_SALES_CHANNELS_HELP: "Vacío = se muestra en todos los canales.",
  FIELD_REGIONS_LABEL: "Regiones",
  FIELD_REGIONS_HELP: "Vacío = se muestra en todas las regiones.",
  // Image upload
  UPLOAD_IMAGE: "Subir imagen",
  IMAGE_URL_PLACEHOLDER: "o pegá una URL de imagen",
  CLEAR_IMAGE: "Quitar",
  // Products / hotspots
  PRODUCTS_TITLE: "Productos y hotspots",
  PRODUCTS_HELP: "Agregá productos y ubicá su hotspot (X/Y %) sobre la imagen.",
  PRODUCTS_CLICK_HELP: "Buscá y agregá productos; después seleccioná un producto y hacé click en la imagen para ubicar su hotspot.",
  PLACING_BADGE: "Ubicando",
  PLACE_HINT: "Hacé click en la imagen para ubicar el producto seleccionado. Arrastrá un marcador para ajustarlo.",
  PLACE_HINT_SELECT: "Seleccioná un producto para ubicar su hotspot en la imagen.",
  ADD_PRODUCTS: "Agregar producto",
  SEARCH_PRODUCTS_PLACEHOLDER: "Buscar productos por nombre",
  NO_PRODUCTS: "Todavía no agregaste productos.",
  TYPE_AT_LEAST_2_CHARS: "Escribí al menos 2 caracteres",
  NO_PRODUCTS_FOUND: 'No se encontraron productos para "{{query}}"',
  ALREADY_ADDED: "Ya agregado",
  HOTSPOT_X: "X (%)",
  HOTSPOT_Y: "Y (%)",
  VARIANT_LABEL: "Variante",
  VARIANT_ANY: "Elegir en storefront",
  REMOVE: "Quitar",
  PREVIEW_TITLE: "Vista previa",
  PREVIEW_EMPTY: "Agregá una imagen principal para ver la vista previa.",
  // Create / edit
  CREATE_TITLE: "Crear look",
  CREATE_SUBMIT: "Crear",
  CREATE_SUCCESS: "Look creado",
  CREATE_ERROR: "No se pudo crear el look: {{msg}}",
  EDIT_TITLE: "Editar look",
  SAVE_CHANGES: "Guardar cambios",
  UPDATE_SUCCESS: "Look actualizado",
  UPDATE_ERROR: "No se pudo actualizar el look: {{msg}}",
  VALIDATION_REQUIRED: "El título y la imagen son obligatorios",
  // Actions
  ACTION_EDIT: "Editar",
  ACTION_DELETE: "Eliminar",
  DELETE_SUCCESS: "Look eliminado",
  DELETE_ERROR: "No se pudo eliminar el look: {{msg}}",
  DELETE_CONFIRM: "¿Eliminar este look? No se puede deshacer.",
  CANCEL: "Cancelar",
  LOADING: "Cargando..."
};
const registerShopByLooksTranslations = (i18n) => {
  if (registered || typeof (i18n == null ? void 0 : i18n.addResourceBundle) !== "function") {
    return;
  }
  i18n.addResourceBundle("en", SHOP_BY_LOOKS_NAMESPACE, en, true, true);
  i18n.addResourceBundle("es", SHOP_BY_LOOKS_NAMESPACE, es, true, true);
  void i18n.loadNamespaces(SHOP_BY_LOOKS_NAMESPACE);
  registered = true;
};
const PLACEMENTS = [
  "top",
  "after_collections",
  "after_featured",
  "before_footer"
];
const PLACEMENT_LABEL_KEY$1 = {
  top: "PLACEMENT_TOP",
  after_collections: "PLACEMENT_AFTER_COLLECTIONS",
  after_featured: "PLACEMENT_AFTER_FEATURED",
  before_footer: "PLACEMENT_BEFORE_FOOTER"
};
const VARIANT_ANY = "__any__";
const PRODUCT_FIELDS = "id,title,handle,thumbnail,variants.id,variants.title";
const ShopByLookFormDrawer = ({ look, open, onOpenChange }) => {
  const { t, i18n } = reactI18next.useTranslation("shop-by-looks");
  registerShopByLooksTranslations(i18n);
  const isEdit = !!look;
  const [title, setTitle] = react.useState("");
  const [subtitle, setSubtitle] = react.useState("");
  const [ctaLabel, setCtaLabel] = react.useState("");
  const [imageUrl, setImageUrl] = react.useState("");
  const [imageAlt, setImageAlt] = react.useState("");
  const [placement, setPlacement] = react.useState("after_featured");
  const [isActive, setIsActive] = react.useState(true);
  const [sortOrder, setSortOrder] = react.useState(0);
  const [salesChannelIds, setSalesChannelIds] = react.useState([]);
  const [regionIds, setRegionIds] = react.useState([]);
  const [rows, setRows] = react.useState([]);
  const [productSearch, setProductSearch] = react.useState("");
  const [debounced, setDebounced] = react.useState("");
  const [isUploading, setIsUploading] = react.useState(false);
  const [placingId, setPlacingId] = react.useState(null);
  const [draggingId, setDraggingId] = react.useState(null);
  const fileInputRef = react.useRef(null);
  const imageWrapRef = react.useRef(null);
  react.useEffect(() => {
    const id = setTimeout(() => setDebounced(productSearch.trim()), 300);
    return () => clearTimeout(id);
  }, [productSearch]);
  const { data: lookData } = useShopByLook((look == null ? void 0 : look.id) ?? "", { enabled: isEdit && open });
  const fullLook = lookData == null ? void 0 : lookData.shop_by_look;
  const { data: channelsData } = reactQuery.useQuery({
    queryKey: ["sbl-sales-channels"],
    queryFn: () => sdk.admin.salesChannel.list({ limit: 200, fields: "id,name" }),
    enabled: open
  });
  const { data: regionsData } = reactQuery.useQuery({
    queryKey: ["sbl-regions"],
    queryFn: () => sdk.admin.region.list({ limit: 200, fields: "id,name" }),
    enabled: open
  });
  const linkedIds = ((fullLook == null ? void 0 : fullLook.products) ?? []).map((p) => p.product_id);
  const { data: linkedProductsData } = reactQuery.useQuery({
    queryKey: ["sbl-linked-products", linkedIds],
    queryFn: () => sdk.admin.product.list({ id: linkedIds, limit: 100, fields: PRODUCT_FIELDS }),
    enabled: open && linkedIds.length > 0
  });
  const { data: searchData } = reactQuery.useQuery({
    queryKey: ["sbl-product-search", debounced],
    queryFn: () => sdk.admin.product.list({ q: debounced, limit: 8, fields: PRODUCT_FIELDS }),
    enabled: open && debounced.length >= 2
  });
  const resetForm = () => {
    setTitle("");
    setSubtitle("");
    setCtaLabel("");
    setImageUrl("");
    setImageAlt("");
    setPlacement("after_featured");
    setIsActive(true);
    setSortOrder(0);
    setSalesChannelIds([]);
    setRegionIds([]);
    setRows([]);
    setProductSearch("");
    setPlacingId(null);
  };
  react.useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      resetForm();
      return;
    }
    const source = fullLook ?? look;
    if (!source) return;
    setTitle(source.title ?? "");
    setSubtitle(source.subtitle ?? "");
    setCtaLabel(source.cta_label ?? "");
    setImageUrl(source.image_url ?? "");
    setImageAlt(source.image_alt ?? "");
    setPlacement(source.placement ?? "after_featured");
    setIsActive(source.is_active ?? true);
    setSortOrder(source.sort_order ?? 0);
    setSalesChannelIds(source.sales_channel_ids ?? []);
    setRegionIds(source.region_ids ?? []);
  }, [open, isEdit, fullLook]);
  react.useEffect(() => {
    if (!isEdit || !(fullLook == null ? void 0 : fullLook.products)) return;
    const products = (linkedProductsData == null ? void 0 : linkedProductsData.products) ?? [];
    const byId = new Map(products.map((p) => [p.id, p]));
    const built = [...fullLook.products].sort((a, b) => a.sort_order - b.sort_order).map((p) => {
      const detail = byId.get(p.product_id);
      return {
        product_id: p.product_id,
        title: (detail == null ? void 0 : detail.title) ?? p.product_id,
        thumbnail: (detail == null ? void 0 : detail.thumbnail) ?? null,
        variants: (detail == null ? void 0 : detail.variants) ?? [],
        variant_id: p.variant_id,
        pos_x: p.pos_x,
        pos_y: p.pos_y
      };
    });
    setRows(built);
    setPlacingId((cur) => {
      var _a;
      return cur ?? ((_a = built[0]) == null ? void 0 : _a.product_id) ?? null;
    });
  }, [fullLook == null ? void 0 : fullLook.id, linkedProductsData]);
  const createMutation = useCreateShopByLook({
    onSuccess: () => {
      ui.toast.success(t("CREATE_SUCCESS"));
      onOpenChange(false);
      resetForm();
    },
    onError: (e) => ui.toast.error(t("CREATE_ERROR", { msg: e.message }))
  });
  const updateMutation = useUpdateShopByLook((look == null ? void 0 : look.id) ?? "", {
    onSuccess: () => {
      ui.toast.success(t("UPDATE_SUCCESS"));
      onOpenChange(false);
    },
    onError: (e) => ui.toast.error(t("UPDATE_ERROR", { msg: e.message }))
  });
  const isPending = createMutation.isPending || updateMutation.isPending;
  const handleImageFile = async (e) => {
    var _a, _b;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    e.target.value = "";
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const uploaded = (_b = res.files) == null ? void 0 : _b[0];
      if (uploaded == null ? void 0 : uploaded.url) setImageUrl(uploaded.url);
    } catch (error) {
      ui.toast.error(t("UPDATE_ERROR", { msg: error.message }));
    } finally {
      setIsUploading(false);
    }
  };
  const addProduct = (p) => {
    if (rows.some((r) => r.product_id === p.id)) return;
    setRows((prev) => [
      ...prev,
      {
        product_id: p.id,
        title: p.title,
        thumbnail: p.thumbnail ?? null,
        variants: p.variants ?? [],
        variant_id: null,
        pos_x: 50,
        pos_y: 50
      }
    ]);
    setPlacingId(p.id);
    setProductSearch("");
    setDebounced("");
  };
  const updateRow = (productId, patch) => setRows(
    (prev) => prev.map((r) => r.product_id === productId ? { ...r, ...patch } : r)
  );
  const removeRow = (productId) => {
    setRows((prev) => prev.filter((r) => r.product_id !== productId));
    setPlacingId((cur) => cur === productId ? null : cur);
  };
  const toggleId = (list, id) => list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  const posFromEvent = (e) => {
    const el = imageWrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(100, Math.max(0, Math.round((e.clientX - rect.left) / rect.width * 100))),
      y: Math.min(100, Math.max(0, Math.round((e.clientY - rect.top) / rect.height * 100)))
    };
  };
  const handleImageClick = (e) => {
    if (!placingId) return;
    const p = posFromEvent(e);
    if (p) updateRow(placingId, { pos_x: p.x, pos_y: p.y });
  };
  const handlePointerMove = (e) => {
    if (!draggingId) return;
    const p = posFromEvent(e);
    if (p) updateRow(draggingId, { pos_x: p.x, pos_y: p.y });
  };
  const handleSubmit = async () => {
    if (!title || !imageUrl) {
      ui.toast.error(t("VALIDATION_REQUIRED"));
      return;
    }
    const payload = {
      title,
      subtitle: subtitle || null,
      cta_label: ctaLabel || null,
      image_url: imageUrl,
      image_alt: imageAlt || null,
      placement,
      is_active: isActive,
      sort_order: sortOrder,
      sales_channel_ids: salesChannelIds.length ? salesChannelIds : null,
      region_ids: regionIds.length ? regionIds : null,
      products: rows.map((r, i) => ({
        product_id: r.product_id,
        variant_id: r.variant_id,
        pos_x: r.pos_x,
        pos_y: r.pos_y,
        sort_order: i
      }))
    };
    if (isEdit) {
      await updateMutation.mutateAsync(payload);
    } else {
      await createMutation.mutateAsync(payload);
    }
  };
  const channels = (channelsData == null ? void 0 : channelsData.sales_channels) ?? [];
  const regions = (regionsData == null ? void 0 : regionsData.regions) ?? [];
  const searchResults = ((searchData == null ? void 0 : searchData.products) ?? []).filter(
    (p) => !rows.some((r) => r.product_id === p.id)
  );
  return /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal, { open, onOpenChange, children: /* @__PURE__ */ jsxRuntime.jsxs(ui.FocusModal.Content, { children: [
    /* @__PURE__ */ jsxRuntime.jsxs(ui.FocusModal.Header, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.FocusModal.Title, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx("span", { className: "sr-only", children: isEdit ? t("EDIT_TITLE") : t("CREATE_TITLE") }) }),
      /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex w-full items-center justify-end gap-x-2", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", size: "small", onClick: () => onOpenChange(false), children: t("CANCEL") }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { size: "small", onClick: handleSubmit, isLoading: isPending, children: isEdit ? t("SAVE_CHANGES") : t("CREATE_SUBMIT") })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsxs(ui.FocusModal.Body, { className: "flex flex-1 overflow-hidden", children: [
      /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex-1 overflow-y-auto px-8 py-10", children: /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "mx-auto flex w-full max-w-[640px] flex-col gap-8", children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: isEdit ? t("EDIT_TITLE") : t("CREATE_TITLE") }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_TITLE_LABEL") }),
            /* @__PURE__ */ jsxRuntime.jsx(
              ui.Input,
              {
                placeholder: t("FIELD_TITLE_PLACEHOLDER"),
                value: title,
                onChange: (e) => setTitle(e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_SUBTITLE_LABEL") }),
            /* @__PURE__ */ jsxRuntime.jsx(
              ui.Input,
              {
                placeholder: t("FIELD_SUBTITLE_PLACEHOLDER"),
                value: subtitle,
                onChange: (e) => setSubtitle(e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_CTA_LABEL") }),
            /* @__PURE__ */ jsxRuntime.jsx(
              ui.Input,
              {
                placeholder: t("FIELD_CTA_PLACEHOLDER"),
                value: ctaLabel,
                onChange: (e) => setCtaLabel(e.target.value)
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2 border-t pt-6", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_IMAGE_LABEL") }),
          /* @__PURE__ */ jsxRuntime.jsx(
            "input",
            {
              ref: fileInputRef,
              type: "file",
              accept: "image/*",
              className: "hidden",
              onChange: handleImageFile
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              ui.Button,
              {
                type: "button",
                size: "small",
                variant: "secondary",
                onClick: () => {
                  var _a;
                  return (_a = fileInputRef.current) == null ? void 0 : _a.click();
                },
                isLoading: isUploading,
                children: t("UPLOAD_IMAGE")
              }
            ),
            imageUrl && /* @__PURE__ */ jsxRuntime.jsx(
              ui.Button,
              {
                type: "button",
                size: "small",
                variant: "transparent",
                onClick: () => setImageUrl(""),
                children: t("CLEAR_IMAGE")
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              placeholder: t("IMAGE_URL_PLACEHOLDER"),
              value: imageUrl,
              onChange: (e) => setImageUrl(e.target.value)
            }
          ),
          /* @__PURE__ */ jsxRuntime.jsx(
            ui.Input,
            {
              placeholder: t("FIELD_IMAGE_ALT_PLACEHOLDER"),
              value: imageAlt,
              onChange: (e) => setImageAlt(e.target.value)
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-3 border-t pt-6", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { level: "h3", children: t("PRODUCTS_TITLE") }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("PRODUCTS_CLICK_HELP") })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsxRuntime.jsx(
              ui.Input,
              {
                placeholder: t("SEARCH_PRODUCTS_PLACEHOLDER"),
                value: productSearch,
                onChange: (e) => setProductSearch(e.target.value)
              }
            ),
            debounced.length >= 2 && searchResults.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-base shadow-elevation-flyout", children: searchResults.map((p) => /* @__PURE__ */ jsxRuntime.jsxs(
              "button",
              {
                type: "button",
                onClick: () => addProduct(p),
                className: "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ui-bg-base-hover",
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(Thumb, { src: p.thumbnail }),
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", children: p.title })
                ]
              },
              p.id
            )) }),
            debounced.length >= 2 && searchResults.length === 0 && /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "mt-1 text-ui-fg-muted", children: t("NO_PRODUCTS_FOUND", { query: debounced }) })
          ] }),
          rows.length === 0 ? /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("NO_PRODUCTS") }) : /* @__PURE__ */ jsxRuntime.jsx("ul", { className: "flex flex-col gap-2", children: rows.map((row, i) => {
            const active = placingId === row.product_id;
            const showVariant = row.variants.length > 1;
            return /* @__PURE__ */ jsxRuntime.jsxs(
              "li",
              {
                onClick: () => setPlacingId(row.product_id),
                className: `flex cursor-pointer flex-col gap-2 rounded-lg border p-3 ${active ? "border-ui-fg-interactive bg-ui-bg-base-hover" : "border-ui-border-base"}`,
                children: [
                  /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-3", children: [
                    /* @__PURE__ */ jsxRuntime.jsx("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ui-bg-component text-xs font-semibold", children: i + 1 }),
                    /* @__PURE__ */ jsxRuntime.jsx(Thumb, { src: row.thumbnail }),
                    /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "flex-1 truncate", children: row.title }),
                    active && /* @__PURE__ */ jsxRuntime.jsx(ui.Badge, { size: "2xsmall", color: "blue", children: t("PLACING_BADGE") }),
                    /* @__PURE__ */ jsxRuntime.jsx(
                      ui.Button,
                      {
                        type: "button",
                        variant: "transparent",
                        size: "small",
                        onClick: (e) => {
                          e.stopPropagation();
                          removeRow(row.product_id);
                        },
                        title: t("REMOVE"),
                        children: /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "text-ui-fg-muted" })
                      }
                    )
                  ] }),
                  showVariant && /* @__PURE__ */ jsxRuntime.jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntime.jsxs(
                    ui.Select,
                    {
                      value: row.variant_id ?? VARIANT_ANY,
                      onValueChange: (v) => updateRow(row.product_id, {
                        variant_id: v === VARIANT_ANY ? null : v
                      }),
                      children: [
                        /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, { placeholder: t("VARIANT_ANY") }) }),
                        /* @__PURE__ */ jsxRuntime.jsxs(ui.Select.Content, { children: [
                          /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: VARIANT_ANY, children: t("VARIANT_ANY") }),
                          row.variants.map((v) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: v.id, children: v.title || v.id }, v.id))
                        ] })
                      ]
                    }
                  ) })
                ]
              },
              row.product_id
            );
          }) })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-4 border-t pt-6", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_PLACEMENT_LABEL") }),
            /* @__PURE__ */ jsxRuntime.jsxs(
              ui.Select,
              {
                value: placement,
                onValueChange: (v) => setPlacement(v),
                children: [
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Trigger, { children: /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Value, {}) }),
                  /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Content, { children: PLACEMENTS.map((p) => /* @__PURE__ */ jsxRuntime.jsx(ui.Select.Item, { value: p, children: t(PLACEMENT_LABEL_KEY$1[p]) }, p)) })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsxRuntime.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_ACTIVE_LABEL") }),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: t("FIELD_ACTIVE_HELP") })
            ] }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Switch, { checked: isActive, onCheckedChange: setIsActive })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_SORT_ORDER_LABEL") }),
            /* @__PURE__ */ jsxRuntime.jsx(
              ui.Input,
              {
                type: "number",
                value: sortOrder,
                onChange: (e) => setSortOrder(parseInt(e.target.value, 10) || 0)
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-4 border-t pt-6", children: [
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_SALES_CHANNELS_LABEL") }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: t("FIELD_SALES_CHANNELS_HELP") }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-col gap-2", children: channels.map((c) => /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                ui.Checkbox,
                {
                  checked: salesChannelIds.includes(c.id),
                  onCheckedChange: () => setSalesChannelIds((prev) => toggleId(prev, c.id))
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", children: c.name })
            ] }, c.id)) })
          ] }),
          /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-2", children: [
            /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { size: "xsmall", children: t("FIELD_REGIONS_LABEL") }),
            /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: t("FIELD_REGIONS_HELP") }),
            /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex flex-col gap-2", children: regions.map((r) => /* @__PURE__ */ jsxRuntime.jsxs("label", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                ui.Checkbox,
                {
                  checked: regionIds.includes(r.id),
                  onCheckedChange: () => setRegionIds((prev) => toggleId(prev, r.id))
                }
              ),
              /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", children: r.name })
            ] }, r.id)) })
          ] })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxRuntime.jsxs("aside", { className: "hidden w-[460px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-ui-border-base bg-ui-bg-subtle px-6 py-6 lg:flex", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Label, { className: "font-semibold text-ui-fg-base", children: t("PREVIEW_TITLE") }),
          /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: placingId ? t("PLACE_HINT") : t("PLACE_HINT_SELECT") })
        ] }),
        imageUrl ? /* @__PURE__ */ jsxRuntime.jsxs(
          "div",
          {
            ref: imageWrapRef,
            onClick: handleImageClick,
            onPointerMove: handlePointerMove,
            onPointerUp: () => setDraggingId(null),
            onPointerLeave: () => setDraggingId(null),
            className: "relative w-full cursor-crosshair touch-none overflow-hidden rounded-xl border border-ui-border-base bg-ui-bg-base",
            children: [
              /* @__PURE__ */ jsxRuntime.jsx(
                "img",
                {
                  src: imageUrl,
                  alt: imageAlt || title,
                  className: "block w-full select-none",
                  draggable: false
                }
              ),
              rows.map((row, i) => {
                const active = placingId === row.product_id;
                return /* @__PURE__ */ jsxRuntime.jsx(
                  "button",
                  {
                    type: "button",
                    onClick: (e) => {
                      e.stopPropagation();
                      setPlacingId(row.product_id);
                    },
                    onPointerDown: (e) => {
                      e.stopPropagation();
                      setPlacingId(row.product_id);
                      setDraggingId(row.product_id);
                    },
                    style: { left: `${row.pos_x}%`, top: `${row.pos_y}%` },
                    className: `absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full text-xs font-semibold shadow-md ring-2 transition-transform ${active ? "scale-110 bg-ui-fg-interactive text-ui-fg-on-color ring-ui-fg-on-color" : "bg-white text-gray-900 ring-gray-900/70"}`,
                    children: i + 1
                  },
                  row.product_id
                );
              })
            ]
          }
        ) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex h-64 items-center justify-center rounded-xl border border-dashed border-ui-border-base", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-muted", children: t("PREVIEW_EMPTY") }) })
      ] })
    ] })
  ] }) });
};
function Thumb({ src }) {
  return /* @__PURE__ */ jsxRuntime.jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-ui-bg-component", children: src ? /* @__PURE__ */ jsxRuntime.jsx("img", { src, alt: "", className: "h-full w-full object-cover" }) : null });
}
const ShopByLookActionsMenu = ({ look }) => {
  const { t, i18n } = reactI18next.useTranslation("shop-by-looks");
  registerShopByLooksTranslations(i18n);
  const prompt = ui.usePrompt();
  const [editOpen, setEditOpen] = react.useState(false);
  const { mutateAsync: deleteLook } = useDeleteShopByLook(look.id, {
    onSuccess: () => ui.toast.success(t("DELETE_SUCCESS")),
    onError: (error) => ui.toast.error(t("DELETE_ERROR", { msg: error.message }))
  });
  const handleDelete = async () => {
    const confirmed = await prompt({
      title: t("ACTION_DELETE"),
      description: t("DELETE_CONFIRM"),
      confirmText: t("ACTION_DELETE"),
      cancelText: t("CANCEL")
    });
    if (confirmed) {
      await deleteLook();
    }
  };
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu, { children: [
      /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsxRuntime.jsx(ui.IconButton, { variant: "transparent", children: /* @__PURE__ */ jsxRuntime.jsx(icons.EllipsisHorizontal, {}) }) }),
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Content, { children: [
        /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2", onClick: () => setEditOpen(true), children: [
          /* @__PURE__ */ jsxRuntime.jsx(icons.PencilSquare, { className: "text-ui-fg-subtle" }),
          t("ACTION_EDIT")
        ] }),
        /* @__PURE__ */ jsxRuntime.jsx(ui.DropdownMenu.Separator, {}),
        /* @__PURE__ */ jsxRuntime.jsxs(ui.DropdownMenu.Item, { className: "gap-x-2 text-ui-fg-error", onClick: handleDelete, children: [
          /* @__PURE__ */ jsxRuntime.jsx(icons.Trash, { className: "text-ui-fg-error" }),
          t("ACTION_DELETE")
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx(ShopByLookFormDrawer, { look, open: editOpen, onOpenChange: setEditOpen })
  ] });
};
const ShopByLookCreateButton = () => {
  const { t, i18n } = reactI18next.useTranslation("shop-by-looks");
  registerShopByLooksTranslations(i18n);
  const [open, setOpen] = react.useState(false);
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Button, { variant: "secondary", size: "small", onClick: () => setOpen(true), children: t("CREATE_BUTTON") }),
    /* @__PURE__ */ jsxRuntime.jsx(ShopByLookFormDrawer, { look: null, open, onOpenChange: setOpen })
  ] });
};
const STORE_SETTINGS_QUERY_KEY = ["plugin-shop-by-looks", "store-settings"];
const GlobalToggle = () => {
  var _a;
  const { t, i18n } = reactI18next.useTranslation("shop-by-looks");
  registerShopByLooksTranslations(i18n);
  const queryClient = reactQuery.useQueryClient();
  const { data, isPending } = reactQuery.useQuery({
    queryKey: STORE_SETTINGS_QUERY_KEY,
    queryFn: () => sdk.client.fetch("/admin/store-config/settings", {
      method: "GET"
    })
  });
  const enabled = ((_a = data == null ? void 0 : data.settings) == null ? void 0 : _a.shop_by_look_enabled) ?? false;
  const { mutateAsync, isPending: saving } = reactQuery.useMutation({
    mutationFn: (payload) => sdk.client.fetch("/admin/store-config/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STORE_SETTINGS_QUERY_KEY });
    },
    onError: (e) => ui.toast.error(e.message)
  });
  const onToggle = async (v) => {
    await mutateAsync({ shop_by_look_enabled: v });
  };
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-2", title: t("GLOBAL_TOGGLE_HELP"), children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { size: "small", className: "text-ui-fg-subtle", children: t("GLOBAL_TOGGLE_LABEL") }),
    /* @__PURE__ */ jsxRuntime.jsx(
      ui.Switch,
      {
        checked: enabled,
        onCheckedChange: onToggle,
        disabled: isPending || saving
      }
    )
  ] });
};
const PAGE_SIZE = 20;
const columnHelper = ui.createDataTableColumnHelper();
const PLACEMENT_LABEL_KEY = {
  top: "PLACEMENT_TOP",
  after_collections: "PLACEMENT_AFTER_COLLECTIONS",
  after_featured: "PLACEMENT_AFTER_FEATURED",
  before_footer: "PLACEMENT_BEFORE_FOOTER"
};
const ShopByLooks = () => {
  const { t, i18n } = reactI18next.useTranslation("shop-by-looks");
  registerShopByLooksTranslations(i18n);
  const [editing, setEditing] = react.useState(null);
  const [search, setSearch] = react.useState("");
  const [pagination, setPagination] = react.useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE
  });
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = useShopByLooks({
    limit: pagination.pageSize,
    offset,
    q: search || void 0
  });
  const looks = (data == null ? void 0 : data.shop_by_looks) ?? [];
  const count = (data == null ? void 0 : data.count) ?? 0;
  const columns = react.useMemo(
    () => [
      columnHelper.accessor("title", {
        header: t("COLUMN_TITLE"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx("span", { className: "font-medium", children: getValue() })
      }),
      columnHelper.accessor("placement", {
        header: t("COLUMN_PLACEMENT"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-subtle", children: t(PLACEMENT_LABEL_KEY[getValue()] ?? "PLACEMENT_AFTER_FEATURED") })
      }),
      columnHelper.display({
        id: "products",
        header: t("COLUMN_PRODUCTS"),
        cell: ({ row }) => {
          var _a;
          return /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-subtle", children: ((_a = row.original.products) == null ? void 0 : _a.length) ?? 0 });
        }
      }),
      columnHelper.accessor("sort_order", {
        header: t("COLUMN_ORDER"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx("span", { className: "text-ui-fg-subtle", children: getValue() })
      }),
      columnHelper.accessor("is_active", {
        header: t("COLUMN_STATUS"),
        cell: ({ getValue }) => /* @__PURE__ */ jsxRuntime.jsx(ui.StatusBadge, { color: getValue() ? "green" : "grey", children: getValue() ? t("STATUS_ACTIVE") : t("STATUS_INACTIVE") })
      }),
      columnHelper.display({
        id: "actions",
        header: t("COLUMN_ACTIONS"),
        cell: ({ row }) => /* @__PURE__ */ jsxRuntime.jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsxRuntime.jsx(ShopByLookActionsMenu, { look: row.original }) })
      })
    ],
    [t]
  );
  const table = ui.useDataTable({
    columns,
    data: looks,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
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
    },
    onRowClick: (_event, row) => setEditing(row)
  });
  return /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
    /* @__PURE__ */ jsxRuntime.jsx(ui.Container, { className: "p-0", children: /* @__PURE__ */ jsxRuntime.jsxs(ui.DataTable, { instance: table, children: [
      /* @__PURE__ */ jsxRuntime.jsxs(ui.DataTable.Toolbar, { className: "flex items-center justify-between px-6 py-4", children: [
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-x-2", children: [
          /* @__PURE__ */ jsxRuntime.jsx(ui.Heading, { children: t("TITLE") }),
          /* @__PURE__ */ jsxRuntime.jsx(admin.ExtensionVersion, { extension: "shop-by-looks" })
        ] }),
        /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsxRuntime.jsx(GlobalToggle, {}),
          /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Search, { placeholder: t("SEARCH_PLACEHOLDER") }),
          /* @__PURE__ */ jsxRuntime.jsx(ShopByLookCreateButton, {})
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntime.jsx(admin.SiteScopeBar, { screen: "shop-by-looks" }),
      count > 0 || isPending ? /* @__PURE__ */ jsxRuntime.jsxs(jsxRuntime.Fragment, { children: [
        /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Table, {}),
        /* @__PURE__ */ jsxRuntime.jsx(ui.DataTable.Pagination, {})
      ] }) : /* @__PURE__ */ jsxRuntime.jsx("div", { className: "flex items-center justify-center border-t p-6 text-center", children: /* @__PURE__ */ jsxRuntime.jsx(ui.Text, { className: "text-ui-fg-subtle", children: t("EMPTY_STATE") }) })
    ] }) }),
    editing && /* @__PURE__ */ jsxRuntime.jsx(
      ShopByLookFormDrawer,
      {
        look: editing,
        open: !!editing,
        onOpenChange: (open) => {
          if (!open) setEditing(null);
        }
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(ui.Toaster, {})
  ] });
};
const ShopByLookIcon = () => /* @__PURE__ */ jsxRuntime.jsx(icons.Photo, { style: { color: "#7270F5" } });
const config = adminSdk.defineRouteConfig({
  label: "Shop by Look",
  icon: ShopByLookIcon,
  rank: 11
});
const handle = {
  breadcrumb: () => "Shop by Look"
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: ShopByLooks,
      path: "/shop-by-looks",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config.label,
      icon: config.icon,
      path: "/shop-by-looks",
      nested: void 0,
      rank: 11,
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
