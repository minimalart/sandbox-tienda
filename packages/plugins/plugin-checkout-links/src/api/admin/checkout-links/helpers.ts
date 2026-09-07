/**
 * Builds the public storefront URL for a checkout link from the backend's
 * configured storefront origin. Falls back to a relative path when no origin is
 * configured (the admin can still prepend its own host if needed).
 */
export function buildPublicUrl(link: {
  token: string;
  country_code: string;
}): string {
  const base = (
    process.env.STOREFRONT_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    ''
  ).replace(/\/$/, '');
  const path = `/${link.country_code}/c/${link.token}`;
  return base ? `${base}${path}` : path;
}

export function withPublicUrl<T extends { token: string; country_code: string }>(
  link: T,
): T & { public_url: string } {
  return { ...link, public_url: buildPublicUrl(link) };
}
