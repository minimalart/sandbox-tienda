type ListingRow = {
  slug: string; name: string; status: string; is_main: boolean; sales_channel_id?: string | null;
  canonical_form?: 'host' | 'path' | null; theme?: Record<string, unknown> | null; template_code: string;
};
export function publicStoreListing(row: ListingRow) {
  if (row.status !== 'ready' || row.is_main || !row.sales_channel_id) return null;
  return { slug: row.slug, name: row.name, canonical_form: row.canonical_form ?? 'host',
    logo: typeof row.theme?.logo === 'string' ? row.theme.logo : null, template_code: row.template_code };
}
