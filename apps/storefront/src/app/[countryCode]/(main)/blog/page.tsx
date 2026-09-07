import {
  getBlogSettings,
  listBlogCategories,
  listBlogPosts,
} from '@lib/data/blog';
import { canonicalUrl } from '@lib/util/site-url';
import { getActiveTenant } from '@lib/site-config/active-tenant';
import BlogHomeTemplate from '@modules/blog/templates/blog-home';
import type { Metadata } from 'next';

// Multi-tenant por path (/demo/{slug}): el render debe ser por request para leer
// el header x-demo-slug y resolver el tenant + sales channel de la demo. Sin
// esto la página se prerenderiza sin contexto de demo (título default "Recetas",
// posts de otros canales, productos filtrados). Igual que store/products/etc.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ countryCode: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const [settings, tenant] = await Promise.all([
    getBlogSettings(),
    getActiveTenant(),
  ]);
  // A demo can rename its blog section; that override wins over the global
  // BlogSettings.section_name for the page/SEO title.
  const sectionName = tenant.assets.blogSectionName || settings.section_name;
  const title = settings.default_seo_title || sectionName || 'Blog';
  const description = settings.default_seo_description || undefined;
  return {
    title,
    description,
    // `canonical: '/blog'` (relativo) se resolvía contra `metadataBase`, que es sólo el
    // ORIGEN: el blog de una tienda en /tienda/<slug> canonicalizaba al blog del sitio
    // principal. `canonicalUrl()` agrega el prefijo de la tienda activa.
    alternates: { canonical: await canonicalUrl('/blog') },
    openGraph: { title, description, type: 'website' },
  };
}

export default async function BlogHomePage(props: Props) {
  const { q, page: pageParam } = await props.searchParams;
  const [baseSettings, tenant] = await Promise.all([
    getBlogSettings(),
    getActiveTenant(),
  ]);
  // Override the blog section name per demo (nav + heading share the value).
  const settings = tenant.assets.blogSectionName
    ? { ...baseSettings, section_name: tenant.assets.blogSectionName }
    : baseSettings;
  const perPage = settings.posts_per_page || 12;
  const page = Math.max(1, Number(pageParam) || 1);
  const [categories, { posts, count }] = await Promise.all([
    listBlogCategories(),
    listBlogPosts({ limit: perPage, offset: (page - 1) * perPage, q }),
  ]);
  const totalPages = Math.max(1, Math.ceil(count / perPage));

  return (
    <BlogHomeTemplate
      settings={settings}
      categories={categories}
      posts={posts}
      page={page}
      totalPages={totalPages}
      query={q}
    />
  );
}
