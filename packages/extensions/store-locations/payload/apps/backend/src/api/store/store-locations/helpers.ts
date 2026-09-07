/**
 * Channel visibility for the public store-location endpoints.
 * `sales_channel_ids` on a location is opt-in scoping:
 *   - empty/absent → global: visible in every channel (incl. the main store).
 *   - non-empty    → visible ONLY in the listed channels.
 *
 * `strict` (demo pages) drops the "global = visible" rule so a demo lists ONLY
 * the branches explicitly assigned to its channel, never the main store's
 * globals. Without a channel (legacy callers) everything passes.
 *
 * NOTE: this is the storefront visibility scope, NOT the operational
 * channel↔branch ownership of the `store_location_sales_channel` link.
 *
 * Duplicado a propósito del helper del blog (api/store/blog-posts/helpers.ts):
 * importar de otra extensión rompe la propiedad de archivos del extractor de
 * componentes (blog no es dependencia de store-locations).
 */
export function isLocationInSalesChannel(
  location: Record<string, any>,
  salesChannelId: string | undefined,
  strict = false,
): boolean {
  if (!salesChannelId) return true;
  const ids = location.sales_channel_ids;
  const scoped = Array.isArray(ids) && ids.length > 0;
  if (scoped) return (ids as string[]).includes(salesChannelId);
  return !strict;
}

/** Reads the `strict` query flag used by the public store-location list. */
export function readStrictFlag(query: Record<string, unknown>): boolean {
  return query.strict === '1' || query.strict === 'true';
}

/**
 * Public shape exposed to the storefront — visible locations only,
 * without internal fields (code, delivers_kits, delivery_pin, is_visible,
 * sales_channel_ids).
 */
export const toPublicStoreLocation = (location: Record<string, any>) => ({
  id: location.id,
  name: location.name,
  street: location.street,
  city: location.city,
  province: location.province,
  lat: location.lat,
  lng: location.lng,
  store_type: location.store_type,
  phone: location.phone,
  whatsapp: location.whatsapp,
  email: location.email,
  business_hours: location.business_hours,
  images: location.images,
  social: {
    instagram: location.instagram,
    facebook: location.facebook,
    website: location.website,
    tiktok: location.tiktok,
    linkedin: location.linkedin,
  },
});
