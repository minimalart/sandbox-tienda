import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { defineWidgetConfig, defineRouteConfig } from "@medusajs/admin-sdk";
import { FocusModal, Text, Button, Label, Select, Prompt, toast, Container, Heading, Input, usePrompt, Badge, Drawer, Toaster } from "@medusajs/ui";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import CropperImport from "react-easy-crop";
import Medusa from "@medusajs/js-sdk";
import smartcrop from "smartcrop";
import { FolderOpen } from "@medusajs/icons";
import { SiteScopeBar } from "@minimalart/mercatto-plugin-runtime/admin";
import "@medusajs/admin-shared";
const BASE_URL = "/admin/media-library";
const MEDIA_QK = ["media-library"];
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
const MEDIA_PAGE_SIZE = 24;
function useMediaAssets(params) {
  const q = params == null ? void 0 : params.q;
  const limit = (params == null ? void 0 : params.limit) ?? MEDIA_PAGE_SIZE;
  const page = (params == null ? void 0 : params.page) ?? 1;
  const offset = (page - 1) * limit;
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  return useQuery({
    queryKey: [...MEDIA_QK, q ?? "", page, limit],
    queryFn: () => fetchJson(
      `${BASE_URL}?${qs}`
    )
  });
}
function useRegisterAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => fetchJson(BASE_URL, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MEDIA_QK })
  });
}
function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args) => fetchJson(`${BASE_URL}/${args.id}`, {
      method: "POST",
      body: JSON.stringify({ filename: args.filename, alt: args.alt, title: args.title })
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MEDIA_QK })
  });
}
function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => fetchJson(`${BASE_URL}/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MEDIA_QK })
  });
}
function useBackfill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => fetchJson(`${BASE_URL}/backfill`, {
      method: "POST",
      body: "{}"
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MEDIA_QK })
  });
}
function useAttachToProduct() {
  return useMutation({
    mutationFn: (args) => fetchJson(`${BASE_URL}/attach`, {
      method: "POST",
      body: JSON.stringify(args)
    })
  });
}
const sdk = new Medusa({
  baseUrl: "/",
  auth: {
    type: "session"
  }
});
const PRESETS = [
  { key: "product_square", label: "Producto principal (1200×1200)", aspect: 1, width: 1200, height: 1200 },
  { key: "thumbnail", label: "Thumbnail (600×600)", aspect: 1, width: 600, height: 600 },
  { key: "banner", label: "Banner / lifestyle (1600×900)", aspect: 16 / 9, width: 1600, height: 900 },
  { key: "original_optimizado", label: "Original optimizado (máx 2000px)", aspect: null, maxDim: 2e3 },
  { key: "free", label: "Libre", aspect: null }
];
const DEFAULT_PRESET = PRESETS[0];
function loadDisplayImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = url;
  });
}
function loadExportImage(url) {
  const proxied = `/admin/media-library/proxy?url=${encodeURIComponent(url)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen (proxy)"));
    img.src = proxied;
  });
}
async function smartCrop(img, aspect) {
  const a = aspect ?? 1;
  const w = a >= 1 ? 100 : Math.round(100 * a);
  const h = a >= 1 ? Math.round(100 / a) : 100;
  const result = await smartcrop.crop(img, { width: w, height: h });
  const c = result.topCrop;
  return { x: c.x, y: c.y, width: c.width, height: c.height };
}
function centerCrop(img, aspect) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!aspect) return { x: 0, y: 0, width: iw, height: ih };
  let w = iw;
  let h = Math.round(iw / aspect);
  if (h > ih) {
    h = ih;
    w = Math.round(ih * aspect);
  }
  return { x: Math.round((iw - w) / 2), y: Math.round((ih - h) / 2), width: w, height: h };
}
function targetSize(preset, rect, customW, customH) {
  if (customW && customH) return { w: customW, h: customH };
  if (preset.width && preset.height) return { w: preset.width, h: preset.height };
  if (preset.maxDim) {
    const max = Math.max(rect.width, rect.height);
    const scale = max > preset.maxDim ? preset.maxDim / max : 1;
    return { w: Math.round(rect.width * scale), h: Math.round(rect.height * scale) };
  }
  return { w: Math.round(rect.width), h: Math.round(rect.height) };
}
function drawHighQuality(ctx, img, rect, w, h) {
  let curW = rect.width;
  let curH = rect.height;
  let canvas = document.createElement("canvas");
  canvas.width = curW;
  canvas.height = curH;
  let c = canvas.getContext("2d");
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, curW, curH);
  while (curW > w * 2 || curH > h * 2) {
    const nextW = Math.max(w, Math.floor(curW / 2));
    const nextH = Math.max(h, Math.floor(curH / 2));
    const tmp = document.createElement("canvas");
    tmp.width = nextW;
    tmp.height = nextH;
    const tc = tmp.getContext("2d");
    tc.imageSmoothingEnabled = true;
    tc.imageSmoothingQuality = "high";
    tc.drawImage(canvas, 0, 0, curW, curH, 0, 0, nextW, nextH);
    canvas = tmp;
    c = tc;
    curW = nextW;
    curH = nextH;
  }
  ctx.drawImage(canvas, 0, 0, curW, curH, 0, 0, w, h);
}
async function exportImage(opts) {
  const { exportImg, rect, preset, format, quality, smoothing, baseName, customW, customH } = opts;
  const { w, h } = targetSize(preset, rect, customW, customH);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear el canvas");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = smoothing;
  const downscaleRatio = Math.min(w / rect.width, h / rect.height);
  if (smoothing === "high" && downscaleRatio < 0.5) {
    drawHighQuality(ctx, exportImg, rect, w, h);
  } else {
    ctx.drawImage(exportImg, rect.x, rect.y, rect.width, rect.height, 0, 0, w, h);
  }
  const mime = format === "webp" ? "image/webp" : "image/jpeg";
  const blob = await new Promise(
    (resolve) => canvas.toBlob((b) => resolve(b), mime, quality)
  );
  if (!blob) throw new Error("No se pudo exportar la imagen");
  const ext = format === "webp" ? "webp" : "jpg";
  const base = baseName.replace(/\.[^.]+$/, "");
  const file = new File([blob], `${base}__edited_${w}x${h}.${ext}`, { type: mime });
  return { file, width: w, height: h, bytes: blob.size };
}
const Cropper = CropperImport;
function ImageEditorModal({ open, onClose, images, productId, onSaved }) {
  const queryClient = useQueryClient();
  const [imgs, setImgs] = useState(images);
  const [idx, setIdx] = useState(0);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [presetKey, setPresetKey] = useState(DEFAULT_PRESET.key);
  const [format, setFormat] = useState("webp");
  const [quality, setQuality] = useState(0.9);
  const [smoothing, setSmoothing] = useState("high");
  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState(null);
  useEffect(() => {
    setImgs(images);
    setIdx(0);
  }, [images]);
  const preset = useMemo(
    () => PRESETS.find((p) => p.key === presetKey) ?? DEFAULT_PRESET,
    [presetKey]
  );
  const current = imgs[idx];
  const onCropComplete = useCallback(
    (_area, areaPixels) => {
      setImgs(
        (prev) => prev.map(
          (im, i) => i === idx ? { ...im, manualPixels: areaPixels, useSmart: false } : im
        )
      );
    },
    [idx]
  );
  const applySmartCrop = async () => {
    if (!current) return;
    try {
      const img = await loadDisplayImage(current.sourceUrl);
      const rect = await smartCrop(img, preset.aspect);
      setImgs(
        (prev) => prev.map((im, i) => i === idx ? { ...im, smartPixels: rect, useSmart: true } : im)
      );
      toast.success("Smart crop aplicado a esta imagen");
    } catch (e) {
      toast.error(e.message);
    }
  };
  const save = async () => {
    var _a;
    setSaving(true);
    const ids = [];
    try {
      for (const im of imgs) {
        const exportImg = await loadExportImage(im.sourceUrl);
        const rect = im.useSmart && im.smartPixels ? im.smartPixels : im.manualPixels ?? centerCrop(exportImg, preset.aspect);
        const result = await exportImage({
          exportImg,
          rect,
          preset,
          format,
          quality,
          smoothing,
          baseName: im.filename
        });
        const up = await sdk.admin.upload.create({ files: [result.file] });
        const f = (_a = up.files) == null ? void 0 : _a[0];
        if (!(f == null ? void 0 : f.url)) continue;
        const { media_asset } = await sdk.client.fetch(
          "/admin/media-library",
          {
            method: "POST",
            body: {
              url: f.url,
              file_id: f.id,
              filename: result.file.name,
              mime_type: result.file.type,
              size: result.bytes,
              source: "edited",
              metadata: {
                source_file_id: im.sourceFileId ?? null,
                source_url: im.sourceUrl,
                edited: true,
                transformations: {
                  crop: rect,
                  resize: { width: result.width, height: result.height },
                  format,
                  quality,
                  smoothing_quality: smoothing,
                  preset: preset.key
                }
              }
            }
          }
        );
        if (media_asset == null ? void 0 : media_asset.id) ids.push(media_asset.id);
      }
      await queryClient.invalidateQueries({ queryKey: MEDIA_QK });
      onSaved == null ? void 0 : onSaved(ids);
      setSavedIds(ids);
      toast.success(`Guardadas ${ids.length} imágenes editadas en la galería`);
      if (!productId) {
        onClose();
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  const associate = async () => {
    if (!productId || !(savedIds == null ? void 0 : savedIds.length)) return;
    try {
      await sdk.client.fetch("/admin/media-library/attach", {
        method: "POST",
        body: { product_id: productId, asset_ids: savedIds }
      });
      toast.success("Imágenes asociadas al producto");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavedIds(null);
      onClose();
    }
  };
  return /* @__PURE__ */ jsxs(FocusModal, { open, onOpenChange: (v) => !v && onClose(), children: [
    /* @__PURE__ */ jsxs(FocusModal.Content, { children: [
      /* @__PURE__ */ jsx(FocusModal.Header, { children: /* @__PURE__ */ jsxs("div", { className: "flex w-full items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxs(Text, { weight: "plus", children: [
          "Editor de imágenes (",
          imgs.length,
          ")"
        ] }),
        /* @__PURE__ */ jsxs(Button, { onClick: save, isLoading: saving, children: [
          "Editar y guardar copia",
          imgs.length > 1 ? "s" : ""
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs(FocusModal.Body, { className: "flex flex-col gap-4 overflow-y-auto p-6 lg:flex-row", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
          /* @__PURE__ */ jsx("div", { className: "relative h-[360px] w-full overflow-hidden rounded-lg bg-ui-bg-subtle", children: current ? /* @__PURE__ */ jsx(
            Cropper,
            {
              image: current.sourceUrl,
              crop,
              zoom,
              aspect: preset.aspect ?? void 0,
              onCropChange: setCrop,
              onZoomChange: setZoom,
              onCropComplete
            }
          ) : null }),
          (current == null ? void 0 : current.useSmart) ? /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "mt-1 text-ui-fg-interactive", children: "Smart crop aplicado a esta imagen (movés el recuadro para volver a manual)." }) : null,
          imgs.length > 1 ? /* @__PURE__ */ jsx("div", { className: "mt-3 flex gap-2 overflow-x-auto", children: imgs.map((im, i) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setIdx(i),
              className: `h-14 w-14 shrink-0 overflow-hidden rounded border-2 ${i === idx ? "border-ui-fg-interactive" : "border-ui-border-base"}`,
              children: /* @__PURE__ */ jsx("img", { src: im.sourceUrl, className: "h-full w-full object-cover" })
            },
            `${im.sourceUrl}-${i}`
          )) }) : null
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex w-full shrink-0 flex-col gap-3 lg:w-[280px]", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Preset" }),
            /* @__PURE__ */ jsxs(Select, { value: presetKey, onValueChange: setPresetKey, children: [
              /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, {}) }),
              /* @__PURE__ */ jsx(Select.Content, { children: PRESETS.map((p) => /* @__PURE__ */ jsx(Select.Item, { value: p.key, children: p.label }, p.key)) })
            ] })
          ] }),
          /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", onClick: applySmartCrop, children: "Smart crop (esta imagen)" }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Formato" }),
            /* @__PURE__ */ jsxs(Select, { value: format, onValueChange: (v) => setFormat(v), children: [
              /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, {}) }),
              /* @__PURE__ */ jsxs(Select.Content, { children: [
                /* @__PURE__ */ jsx(Select.Item, { value: "webp", children: "WebP (recomendado)" }),
                /* @__PURE__ */ jsx(Select.Item, { value: "jpeg", children: "JPG" })
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsxs(Label, { size: "xsmall", children: [
              "Calidad (",
              Math.round(quality * 100),
              "%)"
            ] }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "range",
                min: 0.4,
                max: 1,
                step: 0.05,
                value: quality,
                onChange: (e) => setQuality(Number(e.target.value))
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Suavizado" }),
            /* @__PURE__ */ jsxs(Select, { value: smoothing, onValueChange: (v) => setSmoothing(v), children: [
              /* @__PURE__ */ jsx(Select.Trigger, { children: /* @__PURE__ */ jsx(Select.Value, {}) }),
              /* @__PURE__ */ jsxs(Select.Content, { children: [
                /* @__PURE__ */ jsx(Select.Item, { value: "low", children: "Bajo" }),
                /* @__PURE__ */ jsx(Select.Item, { value: "medium", children: "Medio" }),
                /* @__PURE__ */ jsx(Select.Item, { value: "high", children: "Alto" })
              ] })
            ] })
          ] }),
          current ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsx(Label, { size: "xsmall", children: "Zoom" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "range",
                min: 1,
                max: 3,
                step: 0.05,
                value: zoom,
                onChange: (e) => setZoom(Number(e.target.value))
              }
            )
          ] }) : null,
          /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "text-ui-fg-subtle", children: "Se guarda como copia nueva (no pisa el original)." })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Prompt, { open: !!productId && !!savedIds, onOpenChange: (v) => !v && setSavedIds(null), children: /* @__PURE__ */ jsxs(Prompt.Content, { children: [
      /* @__PURE__ */ jsxs(Prompt.Header, { children: [
        /* @__PURE__ */ jsx(Prompt.Title, { children: "Imagen editada guardada" }),
        /* @__PURE__ */ jsxs(Prompt.Description, { children: [
          "¿Querés asociar ",
          (savedIds == null ? void 0 : savedIds.length) ?? 0,
          " imagen(es) a este producto?"
        ] })
      ] }),
      /* @__PURE__ */ jsxs(Prompt.Footer, { children: [
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "secondary",
            onClick: () => {
              setSavedIds(null);
              onClose();
            },
            children: "Solo guardar"
          }
        ),
        /* @__PURE__ */ jsx(Button, { onClick: associate, children: "Asociar" })
      ] })
    ] }) })
  ] });
}
const ProductMediaLibraryWidget = ({ data }) => {
  const productId = data.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(/* @__PURE__ */ new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const { data: assetsData, isLoading } = useMediaAssets({ q: q || void 0, page });
  const attach = useAttachToProduct();
  const assets = (assetsData == null ? void 0 : assetsData.media_assets) ?? [];
  const count = (assetsData == null ? void 0 : assetsData.count) ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / MEDIA_PAGE_SIZE));
  const editorImages = assets.filter((a) => selected.has(a.id)).map((a) => ({
    sourceAssetId: a.id,
    sourceFileId: a.file_id ?? null,
    sourceUrl: a.url,
    filename: a.filename
  }));
  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const onAttach = async () => {
    if (selected.size === 0) return;
    try {
      const r = await attach.mutateAsync({
        product_id: productId,
        asset_ids: [...selected]
      });
      toast.success(`Agregadas ${r.added} imágenes (${r.total} en total).`);
      setSelected(/* @__PURE__ */ new Set());
      setOpen(false);
      await queryClient.invalidateQueries();
    } catch (e) {
      toast.error(e.message);
    }
  };
  return /* @__PURE__ */ jsxs(Container, { className: "divide-y p-0", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-6 py-4", children: [
      /* @__PURE__ */ jsx(Heading, { level: "h2", children: "Biblioteca de imágenes" }),
      /* @__PURE__ */ jsxs(FocusModal, { open, onOpenChange: setOpen, children: [
        /* @__PURE__ */ jsx(FocusModal.Trigger, { asChild: true, children: /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", children: "Agregar desde Biblioteca" }) }),
        /* @__PURE__ */ jsxs(FocusModal.Content, { children: [
          /* @__PURE__ */ jsx(FocusModal.Header, { children: /* @__PURE__ */ jsxs("div", { className: "flex w-full items-center justify-between gap-4", children: [
            /* @__PURE__ */ jsx(
              Input,
              {
                placeholder: "Buscar por nombre…",
                value: q,
                onChange: (e) => {
                  setQ(e.target.value);
                  setPage(1);
                },
                className: "w-[260px]"
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
              /* @__PURE__ */ jsxs(
                Button,
                {
                  variant: "secondary",
                  disabled: selected.size === 0,
                  onClick: () => {
                    setOpen(false);
                    setEditorOpen(true);
                  },
                  children: [
                    "Editar ",
                    selected.size > 0 ? `(${selected.size})` : ""
                  ]
                }
              ),
              /* @__PURE__ */ jsxs(
                Button,
                {
                  onClick: onAttach,
                  isLoading: attach.isPending,
                  disabled: selected.size === 0,
                  children: [
                    "Agregar ",
                    selected.size > 0 ? `(${selected.size})` : ""
                  ]
                }
              )
            ] })
          ] }) }),
          /* @__PURE__ */ jsxs(FocusModal.Body, { className: "overflow-y-auto p-6", children: [
            isLoading ? /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Cargando…" }) : assets.length === 0 ? /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "No hay imágenes en la Biblioteca. Subí o importá desde la sección Biblioteca." }) : /* @__PURE__ */ jsx("div", { className: "grid grid-cols-3 gap-3 md:grid-cols-5 lg:grid-cols-6", children: assets.map((a) => {
              const isSel = selected.has(a.id);
              return /* @__PURE__ */ jsxs(
                "button",
                {
                  type: "button",
                  onClick: () => toggle(a.id),
                  className: `relative flex flex-col overflow-hidden rounded-lg border-2 text-left ${isSel ? "border-ui-fg-interactive" : "border-ui-border-base"}`,
                  children: [
                    /* @__PURE__ */ jsx("div", { className: "aspect-square w-full bg-ui-bg-subtle", children: /* @__PURE__ */ jsx("img", { src: a.url, className: "h-full w-full object-cover", loading: "lazy" }) }),
                    isSel ? /* @__PURE__ */ jsx("span", { className: "absolute right-1 top-1 rounded-full bg-ui-fg-interactive px-1.5 text-white text-xs", children: "✓" }) : null,
                    /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "truncate p-1", title: a.filename, children: a.filename })
                  ]
                },
                a.id
              );
            }) }),
            count > MEDIA_PAGE_SIZE ? /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center justify-center gap-3", children: [
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  variant: "secondary",
                  disabled: page <= 1 || isLoading,
                  onClick: () => setPage((p) => Math.max(1, p - 1)),
                  children: "Anterior"
                }
              ),
              /* @__PURE__ */ jsxs(Text, { size: "small", className: "text-ui-fg-subtle", children: [
                page,
                " / ",
                totalPages
              ] }),
              /* @__PURE__ */ jsx(
                Button,
                {
                  size: "small",
                  variant: "secondary",
                  disabled: page >= totalPages || isLoading,
                  onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
                  children: "Siguiente"
                }
              )
            ] }) : null
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "px-6 py-4", children: /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: "Reutilizá imágenes ya subidas: se agregan a las actuales sin duplicar." }) }),
    editorOpen ? /* @__PURE__ */ jsx(
      ImageEditorModal,
      {
        open: editorOpen,
        images: editorImages,
        productId,
        onClose: () => {
          setEditorOpen(false);
          setSelected(/* @__PURE__ */ new Set());
        }
      }
    ) : null
  ] });
};
defineWidgetConfig({
  zone: "product.details.after"
});
const MediaLibraryPage = () => {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMediaAssets({ q: q || void 0, page });
  const register = useRegisterAsset();
  const del = useDeleteAsset();
  const update = useUpdateAsset();
  const backfill = useBackfill();
  const prompt = usePrompt();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailAsset, setDetailAsset] = useState(null);
  const [selected, setSelected] = useState(/* @__PURE__ */ new Set());
  const [editorOpen, setEditorOpen] = useState(false);
  const assets = (data == null ? void 0 : data.media_assets) ?? [];
  const count = (data == null ? void 0 : data.count) ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / MEDIA_PAGE_SIZE));
  const rangeStart = count === 0 ? 0 : (page - 1) * MEDIA_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * MEDIA_PAGE_SIZE, count);
  const toggleSelect = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const editorImages = assets.filter((a) => selected.has(a.id)).map((a) => ({
    sourceAssetId: a.id,
    sourceFileId: a.file_id ?? null,
    sourceUrl: a.url,
    filename: a.filename
  }));
  const onUpload = async (files) => {
    if (!(files == null ? void 0 : files.length)) return;
    setUploading(true);
    try {
      const res = await sdk.admin.upload.create({ files: Array.from(files) });
      for (const f of res.files ?? []) {
        const url = f.url;
        const id = f.id;
        if (!url) continue;
        const filename = decodeURIComponent(url.split("/").pop() || url);
        await register.mutateAsync({ url, file_id: id, filename });
      }
      toast.success("Imágenes subidas a la Biblioteca");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const onBackfill = async () => {
    try {
      const r = await backfill.mutateAsync();
      toast.success(`Importadas ${r.imported} imágenes de productos (${r.skipped} ya estaban).`);
    } catch (e) {
      toast.error(e.message);
    }
  };
  const onDelete = async (a) => {
    const ok = await prompt({
      title: "Eliminar de la Biblioteca",
      description: `¿Eliminar "${a.filename}" del catálogo? El archivo NO se borra de S3.`,
      variant: "danger",
      confirmText: "Eliminar",
      cancelText: "Cancelar"
    });
    if (!ok) return;
    try {
      await del.mutateAsync(a.id);
      toast.success("Eliminado del catálogo");
    } catch (e) {
      toast.error(e.message);
    }
  };
  const saveRename = async () => {
    if (!editing) return;
    try {
      await update.mutateAsync({ id: editing.id, filename: editing.name });
      setEditing(null);
      toast.success("Renombrado");
    } catch (e) {
      toast.error(e.message);
    }
  };
  const copyPublicUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copiada");
    } catch (e) {
      toast.error(e.message || "No se pudo copiar la URL");
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(Container, { className: "p-0", children: [
      /* @__PURE__ */ jsx(SiteScopeBar, { screen: "media-library" }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 px-6 py-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-x-2", children: [
          /* @__PURE__ */ jsx(Heading, { children: "Biblioteca" }),
          /* @__PURE__ */ jsx(Badge, { size: "2xsmall", children: "v1.1.3" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(
            Input,
            {
              placeholder: "Buscar por nombre…",
              value: q,
              onChange: (e) => {
                setQ(e.target.value);
                setPage(1);
              },
              className: "w-[200px]"
            }
          ),
          /* @__PURE__ */ jsx(Button, { size: "small", variant: "secondary", onClick: onBackfill, isLoading: backfill.isPending, children: "Importar de productos" }),
          /* @__PURE__ */ jsxs(
            Button,
            {
              size: "small",
              variant: "secondary",
              disabled: selected.size === 0,
              onClick: () => setEditorOpen(true),
              children: [
                "Editar",
                selected.size > 0 ? ` (${selected.size})` : ""
              ]
            }
          ),
          /* @__PURE__ */ jsx(Button, { size: "small", onClick: () => {
            var _a;
            return (_a = fileRef.current) == null ? void 0 : _a.click();
          }, isLoading: uploading, children: "Subir" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              ref: fileRef,
              type: "file",
              accept: "image/*",
              multiple: true,
              className: "hidden",
              onChange: (e) => onUpload(e.target.files)
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "px-6 py-4", children: [
        isLoading ? /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "Cargando…" }) : assets.length === 0 ? /* @__PURE__ */ jsx(Text, { className: "text-ui-fg-subtle", children: "No hay assets. Subí imágenes o importá las de productos." }) : /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6", children: assets.map((a) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "flex flex-col overflow-hidden rounded-lg border border-ui-border-base",
            children: [
              /* @__PURE__ */ jsxs("div", { className: "relative aspect-square w-full bg-ui-bg-subtle", children: [
                /* @__PURE__ */ jsx("img", { src: a.url, className: "h-full w-full object-cover", loading: "lazy" }),
                /* @__PURE__ */ jsx("label", { className: "absolute left-1.5 top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded bg-white/90 shadow", children: /* @__PURE__ */ jsx(
                  "input",
                  {
                    type: "checkbox",
                    checked: selected.has(a.id),
                    onChange: () => toggleSelect(a.id),
                    className: "h-3.5 w-3.5"
                  }
                ) })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-1 p-2", children: (editing == null ? void 0 : editing.id) === a.id ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                /* @__PURE__ */ jsx(
                  Input,
                  {
                    size: "small",
                    value: editing.name,
                    onChange: (e) => setEditing({ id: a.id, name: e.target.value })
                  }
                ),
                /* @__PURE__ */ jsxs("div", { className: "flex gap-1", children: [
                  /* @__PURE__ */ jsx(Button, { size: "small", onClick: saveRename, children: "Guardar" }),
                  /* @__PURE__ */ jsx(Button, { size: "small", variant: "transparent", onClick: () => setEditing(null), children: "Cancelar" })
                ] })
              ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx(Text, { size: "xsmall", className: "truncate", title: a.filename, children: a.filename }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap justify-between gap-1", children: [
                  /* @__PURE__ */ jsx(
                    Button,
                    {
                      size: "small",
                      variant: "transparent",
                      onClick: () => setDetailAsset(a),
                      children: "Ver detalle"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Button,
                    {
                      size: "small",
                      variant: "transparent",
                      onClick: () => setEditing({ id: a.id, name: a.filename }),
                      children: "Renombrar"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Button,
                    {
                      size: "small",
                      variant: "transparent",
                      className: "text-red-600",
                      onClick: () => onDelete(a),
                      children: "Eliminar"
                    }
                  )
                ] })
              ] }) })
            ]
          },
          a.id
        )) }),
        count > 0 ? /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center justify-between border-ui-border-base border-t pt-3", children: [
          /* @__PURE__ */ jsxs(Text, { size: "small", className: "text-ui-fg-subtle", children: [
            rangeStart,
            "–",
            rangeEnd,
            " de ",
            count
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(
              Button,
              {
                size: "small",
                variant: "secondary",
                disabled: page <= 1 || isLoading,
                onClick: () => setPage((p) => Math.max(1, p - 1)),
                children: "Anterior"
              }
            ),
            /* @__PURE__ */ jsxs(Text, { size: "small", className: "text-ui-fg-subtle", children: [
              page,
              " / ",
              totalPages
            ] }),
            /* @__PURE__ */ jsx(
              Button,
              {
                size: "small",
                variant: "secondary",
                disabled: page >= totalPages || isLoading,
                onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
                children: "Siguiente"
              }
            )
          ] })
        ] }) : null
      ] })
    ] }),
    /* @__PURE__ */ jsx(Container, { className: "mt-4 p-0", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2 px-6 py-4", children: [
      /* @__PURE__ */ jsx(Heading, { level: "h2", children: "Almacenamiento (S3)" }),
      /* @__PURE__ */ jsxs(Text, { size: "small", className: "text-ui-fg-subtle", children: [
        "Los archivos los sube y los sirve el módulo File del core. Su configuración se evalúa al arrancar el backend, así que se administra por variables de entorno: ",
        /* @__PURE__ */ jsx("code", { children: "S3_BUCKET" }),
        ", ",
        /* @__PURE__ */ jsx("code", { children: "S3_REGION" }),
        ",",
        /* @__PURE__ */ jsx("code", { children: "S3_ACCESS_KEY_ID" }),
        ", ",
        /* @__PURE__ */ jsx("code", { children: "S3_SECRET_ACCESS_KEY" }),
        ",",
        /* @__PURE__ */ jsx("code", { children: "S3_ENDPOINT" }),
        " (alias ",
        /* @__PURE__ */ jsx("code", { children: "S3_URL" }),
        "),",
        /* @__PURE__ */ jsx("code", { children: "S3_FILE_URL" }),
        " (alias ",
        /* @__PURE__ */ jsx("code", { children: "S3_PUBLIC_URL" }),
        "),",
        /* @__PURE__ */ jsx("code", { children: "S3_PREFIX" }),
        ", ",
        /* @__PURE__ */ jsx("code", { children: "S3_FORCE_PATH_STYLE" }),
        "."
      ] }),
      /* @__PURE__ */ jsxs(Text, { size: "small", className: "text-ui-fg-subtle", children: [
        "Si ",
        /* @__PURE__ */ jsx("code", { children: "S3_BUCKET" }),
        " está vacío se registra el provider LOCAL (efímero en contenedores). Cambiar ",
        /* @__PURE__ */ jsx("code", { children: "S3_PREFIX" }),
        " con assets ya subidos los deja huérfanos: las filas del catálogo guardan la URL completa y no se reescriben."
      ] })
    ] }) }),
    editorOpen ? /* @__PURE__ */ jsx(
      ImageEditorModal,
      {
        open: editorOpen,
        images: editorImages,
        onClose: () => setEditorOpen(false),
        onSaved: () => setSelected(/* @__PURE__ */ new Set())
      }
    ) : null,
    /* @__PURE__ */ jsx(Drawer, { open: !!detailAsset, onOpenChange: (open) => !open && setDetailAsset(null), children: /* @__PURE__ */ jsxs(Drawer.Content, { children: [
      /* @__PURE__ */ jsx(Drawer.Header, { children: /* @__PURE__ */ jsx(Drawer.Title, { children: "Detalle de imagen" }) }),
      detailAsset ? /* @__PURE__ */ jsxs(Drawer.Body, { className: "flex flex-col gap-4 overflow-y-auto", children: [
        /* @__PURE__ */ jsx("div", { className: "overflow-hidden rounded-lg border border-ui-border-base bg-ui-bg-subtle", children: /* @__PURE__ */ jsx("img", { src: detailAsset.url, className: "max-h-[360px] w-full object-contain" }) }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", children: "Archivo" }),
          /* @__PURE__ */ jsx(Text, { size: "small", className: "break-all text-ui-fg-subtle", children: detailAsset.filename })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", children: "URL pública" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx(Input, { readOnly: true, value: detailAsset.url, className: "min-w-0 flex-1" }),
            /* @__PURE__ */ jsx(
              Button,
              {
                size: "small",
                variant: "secondary",
                onClick: () => copyPublicUrl(detailAsset.url),
                children: "Copiar"
              }
            )
          ] })
        ] }),
        detailAsset.mime_type || detailAsset.size || detailAsset.created_at ? /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 gap-3 sm:grid-cols-3", children: [
          detailAsset.mime_type ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", children: "Tipo" }),
            /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: detailAsset.mime_type })
          ] }) : null,
          detailAsset.size ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", children: "Tamaño" }),
            /* @__PURE__ */ jsxs(Text, { size: "small", className: "text-ui-fg-subtle", children: [
              Math.round(detailAsset.size / 1024).toLocaleString("es-AR"),
              " KB"
            ] })
          ] }) : null,
          detailAsset.created_at ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsx(Text, { size: "small", weight: "plus", children: "Creada" }),
            /* @__PURE__ */ jsx(Text, { size: "small", className: "text-ui-fg-subtle", children: new Date(detailAsset.created_at).toLocaleString("es-AR") })
          ] }) : null
        ] }) : null
      ] }) : null,
      /* @__PURE__ */ jsx(Drawer.Footer, { children: /* @__PURE__ */ jsx(Drawer.Close, { asChild: true, children: /* @__PURE__ */ jsx(Button, { variant: "secondary", children: "Cerrar" }) }) })
    ] }) }),
    /* @__PURE__ */ jsx(Toaster, {})
  ] });
};
const MediaLibraryIcon = () => /* @__PURE__ */ jsx(FolderOpen, { style: { color: "#9333EA" } });
const config = defineRouteConfig({
  label: "Biblioteca",
  icon: MediaLibraryIcon,
  rank: 35
});
const handle = {
  breadcrumb: () => "Biblioteca"
};
const widgetModule = { widgets: [
  {
    Component: ProductMediaLibraryWidget,
    zone: ["product.details.after"],
    widgetId: "Widget-b678"
  }
] };
const routeModule = {
  routes: [
    {
      Component: MediaLibraryPage,
      path: "/media-library",
      handle: { label: config.label, translationNs: config.translationNs, ...handle }
    }
  ]
};
const menuItemModule = {
  menuItems: [
    {
      label: config.label,
      icon: config.icon,
      path: "/media-library",
      nested: void 0,
      rank: 35,
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
