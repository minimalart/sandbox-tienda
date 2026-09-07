/**
 * Builds the public storefront URL for a checkout link from the backend's
 * configured storefront origin. Falls back to a relative path when no origin is
 * configured (the admin can still prepend its own host if needed).
 */
export declare function buildPublicUrl(link: {
    token: string;
    country_code: string;
}): string;
export declare function withPublicUrl<T extends {
    token: string;
    country_code: string;
}>(link: T): T & {
    public_url: string;
};
