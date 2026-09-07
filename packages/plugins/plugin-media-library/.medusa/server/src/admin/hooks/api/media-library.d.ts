export type MediaAsset = {
    id: string;
    file_id?: string | null;
    url: string;
    filename: string;
    mime_type?: string | null;
    size?: number | null;
    alt?: string | null;
    title?: string | null;
    source?: string | null;
    created_at?: string;
};
export declare const MEDIA_QK: readonly ["media-library"];
export declare const MEDIA_PAGE_SIZE = 24;
export declare function useMediaAssets(params?: {
    q?: string;
    page?: number;
    limit?: number;
}): import("@tanstack/react-query").UseQueryResult<{
    media_assets: MediaAsset[];
    count: number;
    limit: number;
    offset: number;
}, Error>;
export declare function useRegisterAsset(): import("@tanstack/react-query").UseMutationResult<{
    media_asset: MediaAsset;
}, Error, {
    url: string;
    file_id?: string;
    filename: string;
    mime_type?: string;
    size?: number;
}, unknown>;
export declare function useUpdateAsset(): import("@tanstack/react-query").UseMutationResult<unknown, Error, {
    id: string;
    filename?: string;
    alt?: string;
    title?: string;
}, unknown>;
export declare function useDeleteAsset(): import("@tanstack/react-query").UseMutationResult<unknown, Error, string, unknown>;
export declare function useBackfill(): import("@tanstack/react-query").UseMutationResult<{
    imported: number;
    skipped: number;
    total: number;
}, Error, void, unknown>;
export declare function useAttachToProduct(): import("@tanstack/react-query").UseMutationResult<{
    added: number;
    total: number;
}, Error, {
    product_id: string;
    asset_ids: string[];
}, unknown>;
