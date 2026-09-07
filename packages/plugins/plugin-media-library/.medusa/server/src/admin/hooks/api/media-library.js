"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEDIA_PAGE_SIZE = exports.MEDIA_QK = void 0;
exports.useMediaAssets = useMediaAssets;
exports.useRegisterAsset = useRegisterAsset;
exports.useUpdateAsset = useUpdateAsset;
exports.useDeleteAsset = useDeleteAsset;
exports.useBackfill = useBackfill;
exports.useAttachToProduct = useAttachToProduct;
const react_query_1 = require("@tanstack/react-query");
const BASE_URL = '/admin/media-library';
exports.MEDIA_QK = ['media-library'];
async function fetchJson(url, init) {
    const res = await fetch(url, {
        credentials: 'include',
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? res.statusText);
    }
    return res.json();
}
exports.MEDIA_PAGE_SIZE = 24;
function useMediaAssets(params) {
    const q = params?.q;
    const limit = params?.limit ?? exports.MEDIA_PAGE_SIZE;
    const page = params?.page ?? 1;
    const offset = (page - 1) * limit;
    const qs = new URLSearchParams();
    if (q)
        qs.set('q', q);
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    return (0, react_query_1.useQuery)({
        queryKey: [...exports.MEDIA_QK, q ?? '', page, limit],
        queryFn: () => fetchJson(`${BASE_URL}?${qs}`),
    });
}
function useRegisterAsset() {
    const qc = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: (body) => fetchJson(BASE_URL, { method: 'POST', body: JSON.stringify(body) }),
        onSuccess: () => qc.invalidateQueries({ queryKey: exports.MEDIA_QK }),
    });
}
function useUpdateAsset() {
    const qc = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: (args) => fetchJson(`${BASE_URL}/${args.id}`, {
            method: 'POST',
            body: JSON.stringify({ filename: args.filename, alt: args.alt, title: args.title }),
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: exports.MEDIA_QK }),
    });
}
function useDeleteAsset() {
    const qc = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: (id) => fetchJson(`${BASE_URL}/${id}`, { method: 'DELETE' }),
        onSuccess: () => qc.invalidateQueries({ queryKey: exports.MEDIA_QK }),
    });
}
function useBackfill() {
    const qc = (0, react_query_1.useQueryClient)();
    return (0, react_query_1.useMutation)({
        mutationFn: () => fetchJson(`${BASE_URL}/backfill`, {
            method: 'POST',
            body: '{}',
        }),
        onSuccess: () => qc.invalidateQueries({ queryKey: exports.MEDIA_QK }),
    });
}
function useAttachToProduct() {
    return (0, react_query_1.useMutation)({
        mutationFn: (args) => fetchJson(`${BASE_URL}/attach`, {
            method: 'POST',
            body: JSON.stringify(args),
        }),
    });
}
