import 'server-only';

import { getActiveDemoSalesChannelId } from '@lib/site-config/active-tenant';
import { getActiveSalesChannelId } from './cookies';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

export type BlogImage = {
  url: string;
  file_id?: string | null;
  alt?: string | null;
};

export type BlogPostCard = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_image?: BlogImage | null;
  category_id?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
};

export type BlogPostDetail = BlogPostCard & {
  seo_title?: string | null;
  seo_description?: string | null;
  content_html: string;
  metadata?: Record<string, unknown> | null;
};

export type BlogCategoryPublic = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: BlogImage | null;
  sort_order: number;
};

export type BlogSettingsPublic = {
  section_name: string;
  show_search: boolean;
  show_categories: boolean;
  posts_per_page: number;
  default_seo_title?: string | null;
  default_seo_description?: string | null;
};

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(PUBLISHABLE_KEY ? { 'x-publishable-api-key': PUBLISHABLE_KEY } : {}),
  };
}

/**
 * El canal de venta activo con el que scopear el blog. En el store principal es
 * el canal por defecto (o el de la sucursal); en una demo es el canal de la demo
 * y activamos `strict` para NO mostrar los artículos globales del store principal
 * (ver memory demo-content-config-and-channel: "estricto en demo"). Con `strict`
 * en falso, los artículos sin canal (globales) siguen siendo visibles.
 */
async function activeChannelScope(): Promise<{
  channelId?: string;
  strict: boolean;
}> {
  const demoChannelId = await getActiveDemoSalesChannelId();
  const channelId = await getActiveSalesChannelId();
  return { channelId: channelId || undefined, strict: Boolean(demoChannelId) };
}

/** Applies the active-channel scope to a query string. */
function applyChannelScope(
  qs: URLSearchParams,
  scope: { channelId?: string; strict: boolean },
): void {
  if (!scope.channelId) return;
  qs.set('sales_channel_id', scope.channelId);
  if (scope.strict) qs.set('strict', '1');
}

export async function listBlogPosts(params?: {
  limit?: number;
  offset?: number;
  categoryId?: string;
  q?: string;
}): Promise<{ posts: BlogPostCard[]; count: number }> {
  try {
    const qs = new URLSearchParams();
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    if (params?.categoryId) qs.set('category_id', params.categoryId);
    if (params?.q) qs.set('q', params.q);
    // Scopeamos por el canal activo: en el store principal oculta los artículos
    // de otras demos; en una demo (strict) muestra solo los suyos.
    applyChannelScope(qs, await activeChannelScope());
    const res = await fetch(
      `${BACKEND_URL}/store/blog-posts${qs.toString() ? `?${qs}` : ''}`,
      { headers: headers(), next: { revalidate: 60 } },
    );
    if (!res.ok) return { posts: [], count: 0 };
    const data = (await res.json()) as {
      blog_posts?: BlogPostCard[];
      count?: number;
    };
    return { posts: data.blog_posts ?? [], count: data.count ?? 0 };
  } catch {
    return { posts: [], count: 0 };
  }
}

export async function getBlogPostBySlug(
  slug: string,
  preview = false,
): Promise<{
  post: BlogPostDetail;
  productIds: string[];
  relatedPosts: BlogPostCard[];
} | null> {
  try {
    const params = new URLSearchParams();
    if (preview) params.set('preview', '1');
    // Scopeamos el artículo y sus relacionados al canal activo (ver
    // activeChannelScope). La preview del admin no scopea.
    if (!preview) applyChannelScope(params, await activeChannelScope());
    const qs = params.toString() ? `?${params}` : '';
    const res = await fetch(
      `${BACKEND_URL}/store/blog-posts/${encodeURIComponent(slug)}${qs}`,
      { headers: headers(), next: { revalidate: preview ? 0 : 60 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      blog_post?: BlogPostDetail;
      product_ids?: string[];
      related_posts?: BlogPostCard[];
    };
    if (!data.blog_post) return null;
    return {
      post: data.blog_post,
      productIds: data.product_ids ?? [],
      relatedPosts: data.related_posts ?? [],
    };
  } catch {
    return null;
  }
}

export async function listBlogCategories(): Promise<BlogCategoryPublic[]> {
  try {
    const qs = new URLSearchParams();
    // Solo las categorías con algún artículo visible en el canal activo.
    applyChannelScope(qs, await activeChannelScope());
    const res = await fetch(
      `${BACKEND_URL}/store/blog-categories${qs.toString() ? `?${qs}` : ''}`,
      {
        headers: headers(),
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      blog_categories?: BlogCategoryPublic[];
    };
    return data.blog_categories ?? [];
  } catch {
    return [];
  }
}

export async function getBlogCategoryBySlug(
  slug: string,
): Promise<BlogCategoryPublic | null> {
  const categories = await listBlogCategories();
  return categories.find((c) => c.slug === slug) ?? null;
}

export async function getBlogSettings(): Promise<BlogSettingsPublic> {
  const fallback: BlogSettingsPublic = {
    section_name: 'Blog',
    show_search: true,
    show_categories: true,
    posts_per_page: 12,
    default_seo_title: null,
    default_seo_description: null,
  };
  try {
    const res = await fetch(`${BACKEND_URL}/store/blog-settings`, {
      headers: headers(),
      next: { revalidate: 300 },
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { blog_settings?: BlogSettingsPublic };
    return data.blog_settings ?? fallback;
  } catch {
    return fallback;
  }
}
