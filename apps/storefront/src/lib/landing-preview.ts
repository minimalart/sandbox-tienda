/** Public shape of an authenticated, short-lived preview snapshot. No admin credentials. */
export type LandingPreview = {
  landing_id: string; site_id: string; site_slug: string; country_code: string;
  parent_origin: string; mode: 'block' | 'page'; language: 'es' | 'en'; expires_at: number;
  puck_data: { content: Array<{ type: string; props: Record<string, any> }> };
};

export async function fetchLandingPreview(token: string, kind: 'landing' | 'home' = 'landing'): Promise<LandingPreview | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  try {
    const base = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';
    const response = await fetch(`${base}/store/${kind}-previews/${token}`, {
      cache: 'no-store',
      headers: { 'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '' },
    });
    if (!response.ok) return null;
    const { preview } = await response.json();
    if (!preview || preview.expires_at <= Date.now() || !/^[a-z]{2}$/.test(preview.country_code)) return null;
    return preview;
  } catch { return null; }
}
