import 'server-only';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

export type PuckBlock = { type: string; props?: Record<string, any> };

export type LandingPagePublic = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  seo?: {
    title?: string;
    description?: string;
    image?: string;
    noindex?: boolean;
  } | null;
  puck_data?: { content: PuckBlock[]; root?: { props?: Record<string, any> } } | null;
  template?: string | null;
  locale?: string | null;
  metadata?: Record<string, unknown> | null;
  published_at?: string | null;
  updated_at?: string | null;
};

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(PUBLISHABLE_KEY ? { 'x-publishable-api-key': PUBLISHABLE_KEY } : {}),
  };
}

export async function getLandingPageBySlug(
  slug: string,
  locale?: string,
): Promise<LandingPagePublic | null> {
  try {
    const qs = locale ? `?locale=${encodeURIComponent(locale)}` : '';
    const res = await fetch(
      `${BACKEND_URL}/store/landing-pages/${encodeURIComponent(slug)}${qs}`,
      { headers: headers(), next: { revalidate: 60 } },
    );
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { landing_page?: LandingPagePublic };
    return data.landing_page ?? null;
  } catch {
    return null;
  }
}

export async function listLandingPages(
  locale?: string,
): Promise<LandingPagePublic[]> {
  try {
    const qs = locale ? `?locale=${encodeURIComponent(locale)}` : '';
    const res = await fetch(`${BACKEND_URL}/store/landing-pages${qs}`, {
      headers: headers(),
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return [];
    }
    const data = (await res.json()) as { landing_pages?: LandingPagePublic[] };
    return data.landing_pages ?? [];
  } catch {
    return [];
  }
}
