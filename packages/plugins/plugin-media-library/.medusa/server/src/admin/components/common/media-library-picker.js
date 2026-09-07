"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaLibraryPickerModal = MediaLibraryPickerModal;
const jsx_runtime_1 = require("react/jsx-runtime");
const ui_1 = require("@medusajs/ui");
const react_1 = require("react");
const media_library_1 = require("../../hooks/api/media-library");
/**
 * Reusable picker backed by the Biblioteca (media-library) module. Lets the user
 * reuse an already-uploaded S3 asset (its public `url`) instead of re-uploading.
 * Used by the email branding card and the Puck Logo/Image blocks.
 */
function MediaLibraryPickerModal({ open, onOpenChange, onPick, title = 'Elegir de la biblioteca', }) {
    const [query, setQuery] = (0, react_1.useState)('');
    // Only hit the endpoint while the modal is open. The list searches by filename.
    const { data, isPending } = (0, media_library_1.useMediaAssets)(open ? { q: query || undefined, limit: 60 } : { limit: 0 });
    const assets = open ? (data?.media_assets ?? []) : [];
    return ((0, jsx_runtime_1.jsx)(ui_1.FocusModal, { open: open, onOpenChange: onOpenChange, children: (0, jsx_runtime_1.jsxs)(ui_1.FocusModal.Content, { children: [(0, jsx_runtime_1.jsx)(ui_1.FocusModal.Header, { children: (0, jsx_runtime_1.jsx)(ui_1.FocusModal.Title, { children: title }) }), (0, jsx_runtime_1.jsxs)(ui_1.FocusModal.Body, { className: "flex flex-col gap-4 overflow-y-auto p-6", children: [(0, jsx_runtime_1.jsx)(ui_1.Input, { value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Buscar por nombre de archivo\u2026", autoComplete: "off" }), isPending ? ((0, jsx_runtime_1.jsx)(ui_1.Text, { size: "small", className: "text-ui-fg-subtle", children: "Cargando\u2026" })) : assets.length === 0 ? ((0, jsx_runtime_1.jsx)(ui_1.Text, { size: "small", className: "text-ui-fg-subtle", children: "No hay im\u00E1genes en la biblioteca que coincidan." })) : ((0, jsx_runtime_1.jsx)("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5", children: assets.map((a) => ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => {
                                    onPick(a.url);
                                    onOpenChange(false);
                                }, title: a.filename, className: "flex flex-col gap-1 rounded-lg border border-ui-border-base p-2 text-left transition-colors hover:border-ui-border-interactive hover:bg-ui-bg-base-hover", children: [(0, jsx_runtime_1.jsx)("div", { className: "grid aspect-square place-items-center overflow-hidden rounded bg-ui-bg-subtle", children: (0, jsx_runtime_1.jsx)("img", { src: a.url, alt: a.alt ?? a.filename, className: "size-full object-contain", loading: "lazy" }) }), (0, jsx_runtime_1.jsx)(ui_1.Text, { size: "xsmall", className: "truncate text-ui-fg-muted", children: a.filename })] }, a.id))) }))] })] }) }));
}
exports.default = MediaLibraryPickerModal;
