"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ImageEditorModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const ui_1 = require("@medusajs/ui");
const react_query_1 = require("@tanstack/react-query");
const react_1 = require("react");
// react-easy-crop's default export type is not a valid JSX signature under
// strict tsc (works fine at runtime with esbuild). Cast to a component type.
const react_easy_crop_1 = __importDefault(require("react-easy-crop"));
const Cropper = react_easy_crop_1.default;
const client_1 = require("../../../../lib/client");
const media_library_1 = require("../../../../hooks/api/media-library");
const presets_1 = require("./presets");
const image_utils_1 = require("./image-utils");
function ImageEditorModal({ open, onClose, images, productId, onSaved }) {
    const queryClient = (0, react_query_1.useQueryClient)();
    const [imgs, setImgs] = (0, react_1.useState)(images);
    const [idx, setIdx] = (0, react_1.useState)(0);
    const [crop, setCrop] = (0, react_1.useState)({ x: 0, y: 0 });
    const [zoom, setZoom] = (0, react_1.useState)(1);
    const [presetKey, setPresetKey] = (0, react_1.useState)(presets_1.DEFAULT_PRESET.key);
    const [format, setFormat] = (0, react_1.useState)('webp');
    const [quality, setQuality] = (0, react_1.useState)(0.9);
    const [smoothing, setSmoothing] = (0, react_1.useState)('high');
    const [saving, setSaving] = (0, react_1.useState)(false);
    const [savedIds, setSavedIds] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        setImgs(images);
        setIdx(0);
    }, [images]);
    const preset = (0, react_1.useMemo)(() => presets_1.PRESETS.find((p) => p.key === presetKey) ?? presets_1.DEFAULT_PRESET, [presetKey]);
    const current = imgs[idx];
    const onCropComplete = (0, react_1.useCallback)((_area, areaPixels) => {
        setImgs((prev) => prev.map((im, i) => i === idx
            ? { ...im, manualPixels: areaPixels, useSmart: false }
            : im));
    }, [idx]);
    const applySmartCrop = async () => {
        if (!current)
            return;
        try {
            const img = await (0, image_utils_1.loadDisplayImage)(current.sourceUrl);
            const rect = await (0, image_utils_1.smartCrop)(img, preset.aspect);
            setImgs((prev) => prev.map((im, i) => (i === idx ? { ...im, smartPixels: rect, useSmart: true } : im)));
            ui_1.toast.success('Smart crop aplicado a esta imagen');
        }
        catch (e) {
            ui_1.toast.error(e.message);
        }
    };
    const save = async () => {
        setSaving(true);
        const ids = [];
        try {
            for (const im of imgs) {
                const exportImg = await (0, image_utils_1.loadExportImage)(im.sourceUrl);
                const rect = im.useSmart && im.smartPixels
                    ? im.smartPixels
                    : im.manualPixels ?? (0, image_utils_1.centerCrop)(exportImg, preset.aspect);
                const result = await (0, image_utils_1.exportImage)({
                    exportImg,
                    rect,
                    preset,
                    format,
                    quality,
                    smoothing,
                    baseName: im.filename,
                });
                const up = await client_1.sdk.admin.upload.create({ files: [result.file] });
                const f = up.files?.[0];
                if (!f?.url)
                    continue;
                const { media_asset } = await client_1.sdk.client.fetch('/admin/media-library', {
                    method: 'POST',
                    body: {
                        url: f.url,
                        file_id: f.id,
                        filename: result.file.name,
                        mime_type: result.file.type,
                        size: result.bytes,
                        source: 'edited',
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
                                preset: preset.key,
                            },
                        },
                    },
                });
                if (media_asset?.id)
                    ids.push(media_asset.id);
            }
            await queryClient.invalidateQueries({ queryKey: media_library_1.MEDIA_QK });
            onSaved?.(ids);
            setSavedIds(ids);
            ui_1.toast.success(`Guardadas ${ids.length} imágenes editadas en la galería`);
            if (!productId) {
                onClose();
            }
        }
        catch (e) {
            ui_1.toast.error(e.message);
        }
        finally {
            setSaving(false);
        }
    };
    const associate = async () => {
        if (!productId || !savedIds?.length)
            return;
        try {
            await client_1.sdk.client.fetch('/admin/media-library/attach', {
                method: 'POST',
                body: { product_id: productId, asset_ids: savedIds },
            });
            ui_1.toast.success('Imágenes asociadas al producto');
        }
        catch (e) {
            ui_1.toast.error(e.message);
        }
        finally {
            setSavedIds(null);
            onClose();
        }
    };
    return ((0, jsx_runtime_1.jsxs)(ui_1.FocusModal, { open: open, onOpenChange: (v) => !v && onClose(), children: [(0, jsx_runtime_1.jsxs)(ui_1.FocusModal.Content, { children: [(0, jsx_runtime_1.jsx)(ui_1.FocusModal.Header, { children: (0, jsx_runtime_1.jsxs)("div", { className: "flex w-full items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)(ui_1.Text, { weight: "plus", children: ["Editor de im\u00E1genes (", imgs.length, ")"] }), (0, jsx_runtime_1.jsxs)(ui_1.Button, { onClick: save, isLoading: saving, children: ["Editar y guardar copia", imgs.length > 1 ? 's' : ''] })] }) }), (0, jsx_runtime_1.jsxs)(ui_1.FocusModal.Body, { className: "flex flex-col gap-4 overflow-y-auto p-6 lg:flex-row", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsx)("div", { className: "relative h-[360px] w-full overflow-hidden rounded-lg bg-ui-bg-subtle", children: current ? ((0, jsx_runtime_1.jsx)(Cropper, { image: current.sourceUrl, crop: crop, zoom: zoom, aspect: preset.aspect ?? undefined, onCropChange: setCrop, onZoomChange: setZoom, onCropComplete: onCropComplete })) : null }), current?.useSmart ? ((0, jsx_runtime_1.jsx)(ui_1.Text, { size: "xsmall", className: "mt-1 text-ui-fg-interactive", children: "Smart crop aplicado a esta imagen (mov\u00E9s el recuadro para volver a manual)." })) : null, imgs.length > 1 ? ((0, jsx_runtime_1.jsx)("div", { className: "mt-3 flex gap-2 overflow-x-auto", children: imgs.map((im, i) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setIdx(i), className: `h-14 w-14 shrink-0 overflow-hidden rounded border-2 ${i === idx ? 'border-ui-fg-interactive' : 'border-ui-border-base'}`, children: (0, jsx_runtime_1.jsx)("img", { src: im.sourceUrl, className: "h-full w-full object-cover" }) }, `${im.sourceUrl}-${i}`))) })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex w-full shrink-0 flex-col gap-3 lg:w-[280px]", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)(ui_1.Label, { size: "xsmall", children: "Preset" }), (0, jsx_runtime_1.jsxs)(ui_1.Select, { value: presetKey, onValueChange: setPresetKey, children: [(0, jsx_runtime_1.jsx)(ui_1.Select.Trigger, { children: (0, jsx_runtime_1.jsx)(ui_1.Select.Value, {}) }), (0, jsx_runtime_1.jsx)(ui_1.Select.Content, { children: presets_1.PRESETS.map((p) => ((0, jsx_runtime_1.jsx)(ui_1.Select.Item, { value: p.key, children: p.label }, p.key))) })] })] }), (0, jsx_runtime_1.jsx)(ui_1.Button, { size: "small", variant: "secondary", onClick: applySmartCrop, children: "Smart crop (esta imagen)" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)(ui_1.Label, { size: "xsmall", children: "Formato" }), (0, jsx_runtime_1.jsxs)(ui_1.Select, { value: format, onValueChange: (v) => setFormat(v), children: [(0, jsx_runtime_1.jsx)(ui_1.Select.Trigger, { children: (0, jsx_runtime_1.jsx)(ui_1.Select.Value, {}) }), (0, jsx_runtime_1.jsxs)(ui_1.Select.Content, { children: [(0, jsx_runtime_1.jsx)(ui_1.Select.Item, { value: "webp", children: "WebP (recomendado)" }), (0, jsx_runtime_1.jsx)(ui_1.Select.Item, { value: "jpeg", children: "JPG" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsxs)(ui_1.Label, { size: "xsmall", children: ["Calidad (", Math.round(quality * 100), "%)"] }), (0, jsx_runtime_1.jsx)("input", { type: "range", min: 0.4, max: 1, step: 0.05, value: quality, onChange: (e) => setQuality(Number(e.target.value)) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)(ui_1.Label, { size: "xsmall", children: "Suavizado" }), (0, jsx_runtime_1.jsxs)(ui_1.Select, { value: smoothing, onValueChange: (v) => setSmoothing(v), children: [(0, jsx_runtime_1.jsx)(ui_1.Select.Trigger, { children: (0, jsx_runtime_1.jsx)(ui_1.Select.Value, {}) }), (0, jsx_runtime_1.jsxs)(ui_1.Select.Content, { children: [(0, jsx_runtime_1.jsx)(ui_1.Select.Item, { value: "low", children: "Bajo" }), (0, jsx_runtime_1.jsx)(ui_1.Select.Item, { value: "medium", children: "Medio" }), (0, jsx_runtime_1.jsx)(ui_1.Select.Item, { value: "high", children: "Alto" })] })] })] }), current ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-1", children: [(0, jsx_runtime_1.jsx)(ui_1.Label, { size: "xsmall", children: "Zoom" }), (0, jsx_runtime_1.jsx)("input", { type: "range", min: 1, max: 3, step: 0.05, value: zoom, onChange: (e) => setZoom(Number(e.target.value)) })] })) : null, (0, jsx_runtime_1.jsx)(ui_1.Text, { size: "xsmall", className: "text-ui-fg-subtle", children: "Se guarda como copia nueva (no pisa el original)." })] })] })] }), (0, jsx_runtime_1.jsx)(ui_1.Prompt, { open: !!productId && !!savedIds, onOpenChange: (v) => !v && setSavedIds(null), children: (0, jsx_runtime_1.jsxs)(ui_1.Prompt.Content, { children: [(0, jsx_runtime_1.jsxs)(ui_1.Prompt.Header, { children: [(0, jsx_runtime_1.jsx)(ui_1.Prompt.Title, { children: "Imagen editada guardada" }), (0, jsx_runtime_1.jsxs)(ui_1.Prompt.Description, { children: ["\u00BFQuer\u00E9s asociar ", savedIds?.length ?? 0, " imagen(es) a este producto?"] })] }), (0, jsx_runtime_1.jsxs)(ui_1.Prompt.Footer, { children: [(0, jsx_runtime_1.jsx)(ui_1.Button, { variant: "secondary", onClick: () => {
                                        setSavedIds(null);
                                        onClose();
                                    }, children: "Solo guardar" }), (0, jsx_runtime_1.jsx)(ui_1.Button, { onClick: associate, children: "Asociar" })] })] }) })] }));
}
