import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { DocumentText, PlaySolid, Photo, Trash, ChevronLeft, ChevronRight, EllipsisHorizontal, PencilSquare, BookOpen } from "@medusajs/icons";
import { Drawer, Text, Button, Label, Input, Select, Textarea, FocusModal, Heading, Badge, IconButton, Switch, Checkbox, Tooltip, toast, usePrompt, DropdownMenu, createDataTableColumnHelper, StatusBadge, useDataTable, Container, DataTable, Toaster } from "@medusajs/ui";
import { SiteScopeBar } from "@minimalart/mercatto-plugin-runtime/admin";
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import Medusa from "@medusajs/js-sdk";
import { pdfjs, Document, Page } from "react-pdf";
import "@medusajs/admin-shared";
const sdk = new Medusa({
  baseUrl: "/",
  auth: {
    type: "session"
  }
});
const queryKeysFactory = (prefix) => {
  const all = [prefix];
  return {
    all,
    lists: () => [...all, "list"],
    list: (query) => query ? [...all, "list", query] : [...all, "list"],
    details: () => [...all, "detail"],
    detail: (id) => [...all, "detail", id]
  };
};
function toQueryString(query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === void 0 || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === void 0 || item === null) continue;
        params.append(key, String(item));
      }
    } else {
      params.append(key, String(value));
    }
  }
  return params.toString();
}
const pdfCatalogQueryKey = queryKeysFactory("pdf-catalog");
const usePdfCatalogs = (query, options) => {
  const filterQuery = toQueryString(query);
  return useQuery({
    queryKey: pdfCatalogQueryKey.list(query),
    queryFn: async () => sdk.client.fetch(
      `/admin/pdf-catalogs${filterQuery ? `?${filterQuery}` : ""}`,
      { method: "GET" }
    ),
    ...options
  });
};
const usePdfCatalog = (id, options) => useQuery({
  queryKey: pdfCatalogQueryKey.detail(id),
  queryFn: async () => sdk.client.fetch(`/admin/pdf-catalogs/${id}`, {
    method: "GET"
  }),
  enabled: !!id,
  ...options
});
const useCreatePdfCatalog = (options) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => sdk.client.fetch("/admin/pdf-catalogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data
    }),
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({ queryKey: pdfCatalogQueryKey.lists() });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    },
    ...options
  });
};
const useUpdatePdfCatalog = (id, options) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => sdk.client.fetch(`/admin/pdf-catalogs/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data
    }),
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({ queryKey: pdfCatalogQueryKey.lists() });
      queryClient.invalidateQueries({ queryKey: pdfCatalogQueryKey.detail(id) });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    },
    ...options
  });
};
const useDeletePdfCatalog = (id, options) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sdk.client.fetch(`/admin/pdf-catalogs/${id}`, { method: "DELETE" }),
    onSuccess: (data, variables, context) => {
      var _a;
      queryClient.invalidateQueries({ queryKey: pdfCatalogQueryKey.lists() });
      (_a = options == null ? void 0 : options.onSuccess) == null ? void 0 : _a.call(options, data, variables, context);
    },
    ...options
  });
};
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
function PdfPageCanvas({
  fileUrl,
  pageIndex,
  width = 560,
  onNumPages,
  onPageClick,
  children,
  placing,
  onPointerMove,
  onPointerUp,
  wrapRef
}) {
  const innerRef = useRef(null);
  const ref = wrapRef ?? innerRef;
  const [numPages, setNumPages] = useState(0);
  const file = useMemo(() => fileUrl, [fileUrl]);
  const onLoad = useCallback(
    ({ numPages: total }) => {
      setNumPages(total);
      onNumPages == null ? void 0 : onNumPages(total);
    },
    [onNumPages]
  );
  const handleClick = (e) => {
    if (!onPageClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = Math.min(100, Math.max(0, Math.round((e.clientX - rect.left) / rect.width * 100)));
    const y = Math.min(100, Math.max(0, Math.round((e.clientY - rect.top) / rect.height * 100)));
    onPageClick(x, y);
  };
  useEffect(() => {
    setNumPages(0);
  }, [fileUrl]);
  return /* @__PURE__ */ jsx(
    Document,
    {
      file,
      onLoadSuccess: onLoad,
      loading: /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center p-12", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-b-2 border-ui-fg-interactive" }) }),
      error: /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center p-12 text-ui-fg-error", children: "No se pudo cargar el PDF" }),
      children: /* @__PURE__ */ jsxs(
        "div",
        {
          ref,
          onClick: handleClick,
          onPointerMove,
          onPointerUp,
          onPointerLeave: onPointerUp,
          className: `relative touch-none overflow-hidden rounded-lg border border-ui-border-base shadow-sm ${placing ? "cursor-crosshair" : ""}`,
          children: [
            numPages > 0 && /* @__PURE__ */ jsx(
              Page,
              {
                pageNumber: Math.min(pageIndex + 1, numPages),
                width,
                renderAnnotationLayer: false,
                renderTextLayer: false
              }
            ),
            children
          ]
        }
      )
    }
  );
}
const VARIANT_ANY = "__any__";
const PRODUCT_FIELDS$1 = "id,title,handle,thumbnail,variants.id,variants.title";
function HotspotConfigDialog({ open, draft, onCancel, onSave }) {
  var _a, _b, _c, _d, _e, _f, _g;
  const [local, setLocal] = useState(draft);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    setLocal(draft);
    setSearch("");
    setDebounced("");
  }, [draft, open]);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  const { data: searchData } = useQuery({
    queryKey: ["pdfcat-product-search", debounced],
    queryFn: () => sdk.admin.product.list({ q: debounced, limit: 8, fields: PRODUCT_FIELDS$1 }),
    enabled: open && local.type === "product" && debounced.length >= 2
  });
  const results = (searchData == null ? void 0 : searchData.products) ?? [];
  const setData = (patch) => setLocal((p) => ({ ...p, data: { ...p.data ?? {}, ...patch } }));
  const pickProduct = (p) => {
    setLocal((prev) => ({
      ...prev,
      product_id: p.id,
      variant_id: null,
      product_title: p.title,
      product_thumbnail: p.thumbnail ?? null,
      product_variants: p.variants ?? []
    }));
    setSearch("");
    setDebounced("");
  };
  const youtubeId = extractYoutubeId(String(((_a = local.data) == null ? void 0 : _a.youtubeUrl) ?? ""));
  const canSave = local.type === "product" && !!local.product_id || local.type === "video" && !!youtubeId || local.type === "text" && !!String(((_b = local.data) == null ? void 0 : _b.title) ?? "").trim();
  return /* @__PURE__ */ jsx(Drawer, { open, onOpenChange: (o) => !o && onCancel(), children: /* @__PURE__ */ jsxs(Drawer.Content, { className: "z-[60]", children: [
    /* @__PURE__ */ jsxs(Drawer.Header, { children: [
      /* @__PURE__ */ jsx(Drawer.Title, { children: local.type === "product" ? "Producto" : local.type === "video" ? "Video" : "Texto" }),
      /* @__PURE__ */ jsx(Drawer.Description, { className: "sr-only", children: "Configurá el contenido del hotspot antes de guardarlo." })
    ] }),
    /* @__PURE__ */ jsxs(Drawer.Body, { className: "flex flex-col gap-4 overflow-y-auto", children: [
      local.type === "product" && /* @__PURE__ */ jsxs(Fragment, { children: [
        local.product_id ? /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 rounded-lg border border-ui-border-base p-3", children: [
          /* @__PURE__ */ jsx(Thumb, { src: local.product_thumbnail }),
          /* @__PURE__ */ jsx("div", { className: "flex-1", children: /* @__PURE__ */ jsx(Text, { size: "small", className: "font-medium", children: local.product_title ?? local.product_id }) }),
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "transparent",
              size: "small",
              onClick: () => setLocal((p) => ({
                ...p,
                product_id: null,
                variant_id: null,
                product_title: null,
                product_thumbnail: null,
                product_variants: []
              })),
              children: "Cambiar"
            }
          )
        ] }) : /* @__PURE__ */ jsxs("div", { className: "relative", children: [
          /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Buscar producto" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              placeholder: "Escribí para buscar…",
              value: search,
              onChange: (e) => setSearch(e.target.value)
            }
          ),
          debounced.length >= 2 && results.length > 0 && /* @__PURE__ */ jsx("div", { className: "mt-1 max-h-60 overflow-y-auto rounded-lg border border-ui-border-base", children: results.map((p) => /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              onClick: () => pickProduct(p),
              className: "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ui-bg-base-hover",
              children: [
                /* @__PURE__ */ jsx(Thumb, { src: p.thumbnail }),
                /* @__PURE__ */ jsx(Text, { size: "small", children: p.title })
              ]
            },
            p.id
          )) })
        ] }),
        local.product_id && (((_c = local.product_variants) == null ? void 0 : _c.length) ?? 0) > 1 && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Variante" }),
          /* @__PURE__ */ jsxs(
            Select,
            {
              value: local.variant_id ?? VARIANT_ANY,
              onValueChange: (v) => setLocal((p) => ({ ...p, variant_id: v === VARIANT_ANY ? null : v })),
              children: [
                /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, { placeholder: "El cliente elige" }) }),
                /* @__PURE__ */ jsxs(Select.Content, { className: "z-[70]", children: [
                  /* @__PURE__ */ jsx(Select.Item, { value: VARIANT_ANY, children: "El cliente elige" }),
                  (local.product_variants ?? []).map((v) => /* @__PURE__ */ jsx(Select.Item, { value: v.id, children: v.title || v.id }, v.id))
                ] })
              ]
            }
          )
        ] })
      ] }),
      local.type === "video" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "URL de YouTube" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              placeholder: "https://youtube.com/watch?v=…",
              value: String(((_d = local.data) == null ? void 0 : _d.youtubeUrl) ?? ""),
              onChange: (e) => setData({ youtubeUrl: e.target.value })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Título (opcional)" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              value: String(((_e = local.data) == null ? void 0 : _e.title) ?? ""),
              onChange: (e) => setData({ title: e.target.value })
            }
          )
        ] }),
        youtubeId && /* @__PURE__ */ jsx("div", { className: "aspect-video overflow-hidden rounded-lg", children: /* @__PURE__ */ jsx(
          "iframe",
          {
            className: "h-full w-full",
            src: `https://www.youtube.com/embed/${youtubeId}`,
            allowFullScreen: true
          }
        ) })
      ] }),
      local.type === "text" && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Título" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              value: String(((_f = local.data) == null ? void 0 : _f.title) ?? ""),
              onChange: (e) => setData({ title: e.target.value })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Contenido" }),
          /* @__PURE__ */ jsx(
            Textarea,
            {
              rows: 5,
              value: String(((_g = local.data) == null ? void 0 : _g.content) ?? ""),
              onChange: (e) => setData({ content: e.target.value })
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Drawer.Footer, { children: [
      /* @__PURE__ */ jsx(Button, { variant: "secondary", size: "small", onClick: onCancel, children: "Cancelar" }),
      /* @__PURE__ */ jsx(Button, { size: "small", disabled: !canSave, onClick: () => onSave(local), children: "Guardar" })
    ] })
  ] }) });
}
function Thumb({ src }) {
  return /* @__PURE__ */ jsx("span", { className: "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-ui-bg-component", children: src ? /* @__PURE__ */ jsx("img", { src, alt: "", className: "h-full w-full object-cover" }) : null });
}
function extractYoutubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}
const PRODUCT_FIELDS = "id,title,handle,thumbnail,variants.id,variants.title";
let keyCounter = 0;
const nextKey = () => `hs_${Date.now()}_${keyCounter++}`;
const TYPE_META = {
  product: { label: "Producto", Icon: Photo, color: "#2563eb" },
  video: { label: "Video", Icon: PlaySolid, color: "#dc2626" },
  text: { label: "Texto", Icon: DocumentText, color: "#7c3aed" }
};
const PdfCatalogFormDrawer = ({ catalog, open, onOpenChange }) => {
  const isEdit = !!catalog;
  const [name, setName] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfFileId, setPdfFileId] = useState(null);
  const [pages, setPages] = useState(0);
  const [published, setPublished] = useState(false);
  const [salesChannelIds, setSalesChannelIds] = useState([]);
  const [hotspots, setHotspots] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [placingType, setPlacingType] = useState(null);
  const [draggingKey, setDraggingKey] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [config2, setConfig] = useState(null);
  const fileInputRef = useRef(null);
  const wrapRef = useRef(null);
  const { data: detail } = usePdfCatalog((catalog == null ? void 0 : catalog.id) ?? "", { enabled: isEdit && open });
  const full = detail == null ? void 0 : detail.pdf_catalog;
  const { data: channelsData } = useQuery({
    queryKey: ["pdfcat-sales-channels"],
    queryFn: () => sdk.admin.salesChannel.list({ limit: 200, fields: "id,name" }),
    enabled: open
  });
  const channels = (channelsData == null ? void 0 : channelsData.sales_channels) ?? [];
  const productIds = ((full == null ? void 0 : full.hotspots) ?? []).filter((h) => h.type === "product" && h.product_id).map((h) => h.product_id);
  const { data: linkedProducts } = useQuery({
    queryKey: ["pdfcat-linked-products", productIds],
    queryFn: () => sdk.admin.product.list({ id: productIds, limit: 100, fields: PRODUCT_FIELDS }),
    enabled: open && productIds.length > 0
  });
  const reset = () => {
    setName("");
    setPdfUrl("");
    setPdfFileId(null);
    setPages(0);
    setPublished(false);
    setSalesChannelIds([]);
    setHotspots([]);
    setCurrentPage(0);
    setPlacingType(null);
    setConfig(null);
  };
  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      reset();
      return;
    }
    const src = full ?? catalog;
    if (!src) return;
    setName(src.name ?? "");
    setPdfUrl(src.pdf_url ?? "");
    setPdfFileId(src.pdf_file_id ?? null);
    setPages(src.pages ?? 0);
    setPublished(src.published ?? false);
    setSalesChannelIds(src.sales_channel_ids ?? []);
  }, [open, isEdit, full]);
  useEffect(() => {
    if (!isEdit || !(full == null ? void 0 : full.hotspots)) return;
    const byId = new Map(
      ((linkedProducts == null ? void 0 : linkedProducts.products) ?? []).map((p) => [p.id, p])
    );
    const built = [...full.hotspots].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((h) => {
      const p = h.product_id ? byId.get(h.product_id) : null;
      return {
        key: nextKey(),
        type: h.type,
        page_index: h.page_index ?? 0,
        pos_x: h.pos_x ?? 50,
        pos_y: h.pos_y ?? 50,
        product_id: h.product_id ?? null,
        variant_id: h.variant_id ?? null,
        data: h.data ?? null,
        product_title: (p == null ? void 0 : p.title) ?? h.product_id ?? null,
        product_thumbnail: (p == null ? void 0 : p.thumbnail) ?? null,
        product_variants: (p == null ? void 0 : p.variants) ?? []
      };
    });
    setHotspots(built);
  }, [full == null ? void 0 : full.id, linkedProducts]);
  const createMutation = useCreatePdfCatalog({
    onSuccess: () => {
      toast.success("Catálogo creado");
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e.message)
  });
  const updateMutation = useUpdatePdfCatalog((catalog == null ? void 0 : catalog.id) ?? "", {
    onSuccess: () => {
      toast.success("Catálogo actualizado");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message)
  });
  const isPending = createMutation.isPending || updateMutation.isPending;
  const handlePdfUpload = async (e) => {
    var _a, _b;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("El archivo debe ser un PDF");
      return;
    }
    setIsUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: [file] });
      const uploaded = (_b = res.files) == null ? void 0 : _b[0];
      if (uploaded == null ? void 0 : uploaded.url) {
        setPdfUrl(uploaded.url);
        setPdfFileId(uploaded.id ?? null);
        setCurrentPage(0);
        if (!name) setName(file.name.replace(/\.pdf$/i, ""));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
    }
  };
  const handlePageClick = (x, y) => {
    if (!placingType) return;
    setConfig({
      open: true,
      key: null,
      draft: {
        type: placingType,
        product_id: null,
        variant_id: null,
        data: placingType === "product" ? null : {}
      },
      page: currentPage,
      x,
      y
    });
  };
  const saveConfig = (draft) => {
    if (!config2) return;
    if (config2.key === null) {
      setHotspots((prev) => [
        ...prev,
        {
          key: nextKey(),
          type: draft.type,
          page_index: config2.page,
          pos_x: config2.x,
          pos_y: config2.y,
          product_id: draft.product_id,
          variant_id: draft.variant_id,
          data: draft.data,
          product_title: draft.product_title,
          product_thumbnail: draft.product_thumbnail,
          product_variants: draft.product_variants
        }
      ]);
    } else {
      const k = config2.key;
      setHotspots(
        (prev) => prev.map(
          (h) => h.key === k ? {
            ...h,
            product_id: draft.product_id,
            variant_id: draft.variant_id,
            data: draft.data,
            product_title: draft.product_title,
            product_thumbnail: draft.product_thumbnail,
            product_variants: draft.product_variants
          } : h
        )
      );
    }
    setPlacingType(null);
    setConfig(null);
  };
  const editHotspot = (h) => {
    setConfig({
      open: true,
      key: h.key,
      draft: {
        type: h.type,
        product_id: h.product_id,
        variant_id: h.variant_id,
        product_title: h.product_title,
        product_thumbnail: h.product_thumbnail,
        product_variants: h.product_variants,
        data: h.data
      },
      page: h.page_index,
      x: h.pos_x,
      y: h.pos_y
    });
  };
  const removeHotspot = (key) => setHotspots((prev) => prev.filter((h) => h.key !== key));
  const posFromEvent = (e) => {
    const el = wrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(100, Math.max(0, Math.round((e.clientX - rect.left) / rect.width * 100))),
      y: Math.min(100, Math.max(0, Math.round((e.clientY - rect.top) / rect.height * 100)))
    };
  };
  const handlePointerMove = (e) => {
    if (!draggingKey) return;
    const p = posFromEvent(e);
    if (p) setHotspots((prev) => prev.map((h) => h.key === draggingKey ? { ...h, ...{ pos_x: p.x, pos_y: p.y } } : h));
  };
  const toggleChannel = (id) => setSalesChannelIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const handleSubmit = async () => {
    if (!name || !pdfUrl) {
      toast.error("Nombre y PDF son obligatorios");
      return;
    }
    const payload = {
      name,
      pdf_url: pdfUrl,
      pdf_file_id: pdfFileId,
      pages,
      published,
      sales_channel_ids: salesChannelIds,
      hotspots: hotspots.map((h, i) => ({
        type: h.type,
        page_index: h.page_index,
        pos_x: h.pos_x,
        pos_y: h.pos_y,
        product_id: h.product_id,
        variant_id: h.variant_id,
        data: h.data,
        sort_order: i
      }))
    };
    if (isEdit) await updateMutation.mutateAsync(payload);
    else await createMutation.mutateAsync(payload);
  };
  const pageHotspots = hotspots.filter((h) => h.page_index === currentPage);
  const previewUrl = pdfFileId ? `/admin/pdf-catalogs/file?id=${encodeURIComponent(pdfFileId)}` : pdfUrl;
  return /* @__PURE__ */ jsxs(FocusModal, { open, onOpenChange, children: [
    /* @__PURE__ */ jsxs(FocusModal.Content, { children: [
      /* @__PURE__ */ jsxs(FocusModal.Header, { children: [
        /* @__PURE__ */ jsx(FocusModal.Title, { asChild: true, children: /* @__PURE__ */ jsx("span", { className: "sr-only", children: isEdit ? "Editar catálogo" : "Nuevo catálogo" }) }),
        /* @__PURE__ */ jsxs(FocusModal.Description, { className: "sr-only", children: [
          "Formulario para ",
          isEdit ? "editar" : "crear",
          " un catálogo PDF con hotspots."
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex w-full items-center justify-end gap-x-2", children: [
          /* @__PURE__ */ jsx(Button, { variant: "secondary", size: "small", onClick: () => onOpenChange(false), children: "Cancelar" }),
          /* @__PURE__ */ jsx(Button, { size: "small", onClick: handleSubmit, isLoading: isPending, children: isEdit ? "Guardar cambios" : "Crear" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs(FocusModal.Body, { className: "flex flex-1 overflow-hidden", children: [
        /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto px-8 py-10", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto flex w-full max-w-[560px] flex-col gap-8", children: [
          /* @__PURE__ */ jsx(Heading, { children: isEdit ? "Editar catálogo" : "Nuevo catálogo" }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Nombre *" }),
            /* @__PURE__ */ jsx(
              Input,
              {
                placeholder: "Catálogo primavera 2026",
                value: name,
                onChange: (e) => setName(e.target.value)
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2 border-t pt-6", children: [
            /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Archivo PDF *" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                ref: fileInputRef,
                type: "file",
                accept: "application/pdf",
                className: "hidden",
                onChange: handlePdfUpload
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsx(
                Button,
                {
                  type: "button",
                  size: "small",
                  variant: "secondary",
                  onClick: () => {
                    var _a;
                    return (_a = fileInputRef.current) == null ? void 0 : _a.click();
                  },
                  isLoading: isUploading,
                  children: pdfUrl ? "Reemplazar PDF" : "Subir PDF"
                }
              ),
              pdfUrl && /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: pages > 0 ? `${pages} páginas` : "Cargado" })
            ] })
          ] }),
          pdfUrl && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 border-t pt-6", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx(Heading, { level: "h3", children: "Hotspots" }),
              /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: "Elegí un tipo y hacé click sobre la página para colocarlo. Podés arrastrarlos para reposicionar." })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "flex gap-2", children: Object.keys(TYPE_META).map((t) => {
              const { label, Icon } = TYPE_META[t];
              const active = placingType === t;
              return /* @__PURE__ */ jsxs(
                Button,
                {
                  type: "button",
                  size: "small",
                  variant: active ? "primary" : "secondary",
                  onClick: () => setPlacingType(active ? null : t),
                  children: [
                    /* @__PURE__ */ jsx(Icon, {}),
                    " ",
                    label
                  ]
                },
                t
              );
            }) }),
            placingType && /* @__PURE__ */ jsxs(Badge, { size: "2xsmall", color: "blue", children: [
              "Click en la página para colocar: ",
              TYPE_META[placingType].label
            ] }),
            hotspots.length > 0 && /* @__PURE__ */ jsx("ul", { className: "flex flex-col gap-1", children: hotspots.map((h, i) => {
              var _a;
              const { label, Icon, color } = TYPE_META[h.type];
              const title = h.type === "product" ? h.product_title ?? h.product_id ?? label : String(((_a = h.data) == null ? void 0 : _a.title) ?? "") || label;
              return /* @__PURE__ */ jsxs(
                "li",
                {
                  className: "flex items-center gap-2 rounded-lg border border-ui-border-base px-3 py-2",
                  children: [
                    /* @__PURE__ */ jsx(
                      "span",
                      {
                        className: "flex h-5 w-5 items-center justify-center rounded-full text-white",
                        style: { backgroundColor: color },
                        children: /* @__PURE__ */ jsx(Icon, { className: "h-3 w-3" })
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "button",
                      {
                        type: "button",
                        className: "flex-1 truncate text-left",
                        onClick: () => {
                          setCurrentPage(h.page_index);
                          editHotspot(h);
                        },
                        children: /* @__PURE__ */ jsx(Text, { size: "small", className: "truncate", children: title })
                      }
                    ),
                    /* @__PURE__ */ jsxs(Text, { size: "xsmall", className: "text-ui-fg-muted", children: [
                      "pág. ",
                      h.page_index + 1
                    ] }),
                    /* @__PURE__ */ jsx(
                      IconButton,
                      {
                        size: "small",
                        variant: "transparent",
                        onClick: () => removeHotspot(h.key),
                        children: /* @__PURE__ */ jsx(Trash, { className: "text-ui-fg-muted" })
                      }
                    )
                  ]
                },
                h.key
              );
            }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 border-t pt-6", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Publicado" }),
                /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: "Un catálogo debe estar publicado y activo en un canal para verse." })
              ] }),
              /* @__PURE__ */ jsx(Switch, { checked: published, onCheckedChange: setPublished })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
              /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Activo en estos sales channels" }),
              /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: "Solo puede haber un catálogo activo por canal: activar un canal ya usado por otro catálogo se lo quita a ese." }),
              /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-2", children: channels.map((c) => /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsx(
                  Checkbox,
                  {
                    checked: salesChannelIds.includes(c.id),
                    onCheckedChange: () => toggleChannel(c.id)
                  }
                ),
                /* @__PURE__ */ jsx(Text, { size: "small", children: c.name })
              ] }, c.id)) })
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs("aside", { className: "hidden w-[620px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-ui-border-base bg-ui-bg-subtle px-6 py-6 lg:flex", children: [
          /* @__PURE__ */ jsx(Label, { className: "font-semibold text-ui-fg-base", children: "Vista previa" }),
          pdfUrl ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-center gap-3", children: [
              /* @__PURE__ */ jsx(
                IconButton,
                {
                  size: "small",
                  variant: "transparent",
                  disabled: currentPage === 0,
                  onClick: () => setCurrentPage((p) => Math.max(0, p - 1)),
                  children: /* @__PURE__ */ jsx(ChevronLeft, {})
                }
              ),
              /* @__PURE__ */ jsxs(Text, { size: "small", className: "tabular-nums", children: [
                currentPage + 1,
                " / ",
                pages || "…"
              ] }),
              /* @__PURE__ */ jsx(
                IconButton,
                {
                  size: "small",
                  variant: "transparent",
                  disabled: pages > 0 && currentPage >= pages - 1,
                  onClick: () => setCurrentPage((p) => pages ? Math.min(pages - 1, p + 1) : p + 1),
                  children: /* @__PURE__ */ jsx(ChevronRight, {})
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsx(
              PdfPageCanvas,
              {
                fileUrl: previewUrl,
                pageIndex: currentPage,
                width: 560,
                onNumPages: setPages,
                onPageClick: handlePageClick,
                placing: !!placingType,
                wrapRef,
                onPointerMove: handlePointerMove,
                onPointerUp: () => setDraggingKey(null),
                children: pageHotspots.map((h) => {
                  var _a;
                  const { Icon, color, label } = TYPE_META[h.type];
                  const title = h.type === "product" ? h.product_title ?? label : String(((_a = h.data) == null ? void 0 : _a.title) ?? "") || label;
                  return /* @__PURE__ */ jsx(Tooltip, { content: title, children: /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: (e) => {
                        e.stopPropagation();
                        editHotspot(h);
                      },
                      onPointerDown: (e) => {
                        e.stopPropagation();
                        setDraggingKey(h.key);
                      },
                      style: {
                        left: `${h.pos_x}%`,
                        top: `${h.pos_y}%`,
                        backgroundColor: color
                      },
                      className: "absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full text-white shadow-md ring-2 ring-white",
                      children: /* @__PURE__ */ jsx(Icon, { className: "h-3.5 w-3.5" })
                    }
                  ) }, h.key);
                })
              }
            ) })
          ] }) : /* @__PURE__ */ jsx("div", { className: "flex h-64 items-center justify-center rounded-xl border border-dashed border-ui-border-base", children: /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-muted", children: "Subí un PDF para previsualizarlo" }) })
        ] })
      ] })
    ] }),
    config2 && /* @__PURE__ */ jsx(
      HotspotConfigDialog,
      {
        open: config2.open,
        draft: config2.draft,
        onCancel: () => {
          setConfig(null);
          setPlacingType(null);
        },
        onSave: saveConfig
      }
    )
  ] });
};
const PdfCatalogActionsMenu = ({ catalog }) => {
  const prompt = usePrompt();
  const [editOpen, setEditOpen] = useState(false);
  const { mutateAsync: deleteCatalog } = useDeletePdfCatalog(catalog.id, {
    onSuccess: () => toast.success("Catálogo eliminado"),
    onError: (error) => toast.error(error.message)
  });
  const handleDelete = async () => {
    const confirmed = await prompt({
      title: "Eliminar catálogo",
      description: `¿Seguro que querés eliminar "${catalog.name}"? Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar"
    });
    if (confirmed) await deleteCatalog();
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(DropdownMenu, { children: [
      /* @__PURE__ */ jsx(DropdownMenu.Trigger, { asChild: true, children: /* @__PURE__ */ jsx(IconButton, { variant: "transparent", children: /* @__PURE__ */ jsx(EllipsisHorizontal, {}) }) }),
      /* @__PURE__ */ jsxs(DropdownMenu.Content, { children: [
        /* @__PURE__ */ jsxs(DropdownMenu.Item, { className: "gap-x-2", onClick: () => setEditOpen(true), children: [
          /* @__PURE__ */ jsx(PencilSquare, { className: "text-ui-fg-subtle" }),
          "Editar"
        ] }),
        /* @__PURE__ */ jsx(DropdownMenu.Separator, {}),
        /* @__PURE__ */ jsxs(DropdownMenu.Item, { className: "gap-x-2 text-ui-fg-error", onClick: handleDelete, children: [
          /* @__PURE__ */ jsx(Trash, { className: "text-ui-fg-error" }),
          "Eliminar"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(PdfCatalogFormDrawer, { catalog, open: editOpen, onOpenChange: setEditOpen })
  ] });
};
const PdfCatalogCreateButton = () => {
  const [open, setOpen] = useState(false);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(Button, { variant: "secondary", size: "small", onClick: () => setOpen(true), children: "Crear" }),
    /* @__PURE__ */ jsx(PdfCatalogFormDrawer, { catalog: null, open, onOpenChange: setOpen })
  ] });
};
const STORE_SETTINGS_KEY = ["admin-store-settings"];
const useStoreSettings = () => useQuery({
  queryKey: STORE_SETTINGS_KEY,
  queryFn: () => sdk.client.fetch("/admin/store-config/settings", {
    method: "GET"
  })
});
const useUpdateStoreSettings = (options) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => sdk.client.fetch("/admin/store-config/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STORE_SETTINGS_KEY });
    },
    onError: options == null ? void 0 : options.onError
  });
};
const GlobalToggle = () => {
  var _a;
  const { data, isPending } = useStoreSettings();
  const enabled = ((_a = data == null ? void 0 : data.settings) == null ? void 0 : _a.pdf_catalog_enabled) ?? false;
  const { mutateAsync, isPending: saving } = useUpdateStoreSettings({
    onError: (e) => toast.error(e.message)
  });
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "flex items-center gap-2",
      title: "Interruptor general. Si está apagado, no se muestra ningún catálogo en la tienda.",
      children: [
        /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: "Catálogos PDF activados" }),
        /* @__PURE__ */ jsx(
          Switch,
          {
            checked: enabled,
            onCheckedChange: (v) => mutateAsync({ pdf_catalog_enabled: v }),
            disabled: isPending || saving
          }
        )
      ]
    }
  );
};
const PAGE_SIZE = 20;
const columnHelper = createDataTableColumnHelper();
const PdfCatalogsPage = () => {
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: PAGE_SIZE
  });
  const offset = pagination.pageIndex * pagination.pageSize;
  const { data, isPending } = usePdfCatalogs({
    limit: pagination.pageSize,
    offset,
    q: search || void 0
  });
  const catalogs = (data == null ? void 0 : data.pdf_catalogs) ?? [];
  const count = (data == null ? void 0 : data.count) ?? 0;
  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Nombre",
        cell: ({ getValue }) => /* @__PURE__ */ jsx("span", { className: "font-medium", children: getValue() })
      }),
      columnHelper.accessor("pages", {
        header: "Páginas",
        cell: ({ getValue }) => /* @__PURE__ */ jsx("span", { className: "text-ui-fg-subtle", children: getValue() })
      }),
      columnHelper.display({
        id: "hotspots",
        header: "Hotspots",
        cell: ({ row }) => {
          var _a;
          return /* @__PURE__ */ jsx("span", { className: "text-ui-fg-subtle", children: ((_a = row.original.hotspots) == null ? void 0 : _a.length) ?? 0 });
        }
      }),
      columnHelper.display({
        id: "channels",
        header: "Canales activos",
        cell: ({ row }) => {
          var _a;
          return /* @__PURE__ */ jsx("span", { className: "text-ui-fg-subtle", children: ((_a = row.original.sales_channel_ids) == null ? void 0 : _a.length) ?? 0 });
        }
      }),
      columnHelper.accessor("published", {
        header: "Estado",
        cell: ({ getValue }) => /* @__PURE__ */ jsx(StatusBadge, { color: getValue() ? "green" : "grey", children: getValue() ? "Publicado" : "Borrador" })
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => /* @__PURE__ */ jsx("div", { onClick: (e) => e.stopPropagation(), children: /* @__PURE__ */ jsx(PdfCatalogActionsMenu, { catalog: row.original }) })
      })
    ],
    []
  );
  const table = useDataTable({
    columns,
    data: catalogs,
    getRowId: (row) => row.id,
    rowCount: count,
    isLoading: isPending,
    pagination: { state: pagination, onPaginationChange: setPagination },
    search: {
      state: search,
      onSearchChange: (value) => {
        setSearch(value);
        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
      }
    },
    onRowClick: (_event, row) => setEditing(row)
  });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(Container, { className: "p-0", children: [
      /* @__PURE__ */ jsx(SiteScopeBar, { screen: "pdf-catalogs" }),
      /* @__PURE__ */ jsxs(DataTable, { instance: table, children: [
        /* @__PURE__ */ jsxs(DataTable.Toolbar, { className: "flex items-center justify-between px-6 py-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-x-2", children: [
            /* @__PURE__ */ jsx(Heading, { children: "Catálogos PDF" }),
            /* @__PURE__ */ jsx(Badge, { size: "2xsmall", children: "v1.3.2" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
            /* @__PURE__ */ jsx(GlobalToggle, {}),
            /* @__PURE__ */ jsx(DataTable.Search, { placeholder: "Buscar catálogos" }),
            /* @__PURE__ */ jsx(PdfCatalogCreateButton, {})
          ] })
        ] }),
        count > 0 || isPending ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(DataTable.Table, {}),
          /* @__PURE__ */ jsx(DataTable.Pagination, {})
        ] }) : /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center border-t p-6 text-center", children: /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Todavía no hay catálogos. Creá el primero para empezar." }) })
      ] })
    ] }),
    editing && /* @__PURE__ */ jsx(
      PdfCatalogFormDrawer,
      {
        catalog: editing,
        open: !!editing,
        onOpenChange: (open) => {
          if (!open) setEditing(null);
        }
      }
    ),
    /* @__PURE__ */ jsx(Toaster, {})
  ] });
};
const PdfCatalogIcon = () => /* @__PURE__ */ jsx(BookOpen, { style: { color: "#7270F5" } });
const config = defineRouteConfig({
  label: "Catálogos PDF",
  icon: PdfCatalogIcon,
  rank: 12
});
const handle = {
  breadcrumb: () => "Catálogos PDF"
};
const widgetModule = { widgets: [] };
const routeModule = {
  routes: [
    {
      Component: PdfCatalogsPage,
      path: "/pdf-catalogs",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config.label,
      icon: config.icon,
      path: "/pdf-catalogs",
      nested: void 0,
      rank: 12,
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
