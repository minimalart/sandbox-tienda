/** Public projection of a landing page (no internal/audit fields). */
export function toPublicLandingPage(page: Record<string, any>) {
  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    description: page.description ?? null,
    seo: page.seo ?? null,
    puck_data: page.puck_data ?? { content: [], root: { props: {} } },
    template: page.template ?? null,
    locale: page.locale ?? null,
    metadata: page.metadata ?? null,
    published_at: page.published_at ?? null,
    updated_at: page.updated_at ?? null,
  };
}
