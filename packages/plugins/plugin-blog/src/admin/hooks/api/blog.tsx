import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const POSTS_URL = '/admin/blog-posts';
const CATEGORIES_URL = '/admin/blog-categories';
const SETTINGS_URL = '/admin/blog-settings';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BlogStatus = 'draft' | 'published';

export type BlogImage = {
  url: string;
  file_id?: string | null;
  alt?: string | null;
};

export type TiptapDoc = {
  type?: string;
  content?: unknown[];
  [key: string]: unknown;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_image?: BlogImage | null;
  content?: TiptapDoc | null;
  status: BlogStatus;
  category_id?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  published_at?: string | null;
  sales_channel_ids?: string[] | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export type BlogPostInput = {
  title: string;
  slug?: string;
  excerpt?: string | null;
  cover_image?: BlogImage | null;
  content?: TiptapDoc | null;
  status?: BlogStatus;
  category_id?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  sales_channel_ids?: string[] | null;
};

export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: BlogImage | null;
  sort_order: number;
};

export type BlogCategoryInput = {
  name: string;
  slug?: string;
  description?: string | null;
  image?: BlogImage | null;
  sort_order?: number;
};

export type BlogSettings = {
  id: string;
  section_name: string;
  show_search: boolean;
  show_categories: boolean;
  posts_per_page: number;
  default_seo_title?: string | null;
  default_seo_description?: string | null;
};

// ─── Query keys ───────────────────────────────────────────────────────────────

export const BLOG_POSTS_KEY = ['blog-posts'] as const;
export const blogPostKey = (id: string) => ['blog-posts', id] as const;
export const BLOG_CATEGORIES_KEY = ['blog-categories'] as const;
export const BLOG_SETTINGS_KEY = ['blog-settings'] as const;

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ─── Posts ──────────────────────────────────────────────────────────────────

export type BlogPostsListResponse = {
  blog_posts: BlogPost[];
  count: number;
};

export function useBlogPosts(params?: {
  limit?: number;
  offset?: number;
  status?: string;
  category_id?: string;
  q?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.status) qs.set('status', params.status);
  if (params?.category_id) qs.set('category_id', params.category_id);
  if (params?.q) qs.set('q', params.q);
  const url = qs.toString() ? `${POSTS_URL}?${qs.toString()}` : POSTS_URL;

  return useQuery({
    queryKey: [...BLOG_POSTS_KEY, params ?? {}],
    queryFn: () => fetchJson<BlogPostsListResponse>(url),
  });
}

export function useBlogPost(id: string) {
  return useQuery({
    queryKey: blogPostKey(id),
    queryFn: () =>
      fetchJson<{ blog_post: BlogPost; product_ids: string[] }>(
        `${POSTS_URL}/${id}`,
      ),
    enabled: !!id,
  });
}

export function useCreateBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BlogPostInput) =>
      fetchJson<{ blog_post: BlogPost }>(POSTS_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.blog_post),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_POSTS_KEY }),
  });
}

export function useUpdateBlogPost(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BlogPostInput>) =>
      fetchJson<{ blog_post: BlogPost }>(`${POSTS_URL}/${id}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.blog_post),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BLOG_POSTS_KEY });
      qc.invalidateQueries({ queryKey: blogPostKey(id) });
    },
  });
}

export function useDeleteBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${POSTS_URL}/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_POSTS_KEY }),
  });
}

export function usePublishBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ blog_post: BlogPost }>(`${POSTS_URL}/${id}/publish`, {
        method: 'POST',
      }).then((d) => d.blog_post),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_POSTS_KEY }),
  });
}

export function useUnpublishBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ blog_post: BlogPost }>(`${POSTS_URL}/${id}/unpublish`, {
        method: 'POST',
      }).then((d) => d.blog_post),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_POSTS_KEY }),
  });
}

export function useDuplicateBlogPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ blog_post: BlogPost }>(`${POSTS_URL}/${id}/duplicate`, {
        method: 'POST',
      }).then((d) => d.blog_post),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_POSTS_KEY }),
  });
}

export function useSetBlogPostProducts(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (product_ids: string[]) =>
      fetchJson<{ product_ids: string[] }>(`${POSTS_URL}/${id}/products`, {
        method: 'POST',
        body: JSON.stringify({ product_ids }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: blogPostKey(id) }),
  });
}

// ─── Categories ───────────────────────────────────────────────────────────────

export type BlogCategoriesListResponse = {
  blog_categories: BlogCategory[];
  count: number;
};

export function useBlogCategories(params?: { limit?: number; offset?: number; q?: string }) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.q) qs.set('q', params.q);
  const url = qs.toString() ? `${CATEGORIES_URL}?${qs.toString()}` : CATEGORIES_URL;
  return useQuery({
    queryKey: [...BLOG_CATEGORIES_KEY, params ?? {}],
    queryFn: () => fetchJson<BlogCategoriesListResponse>(url),
  });
}

export function useCreateBlogCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BlogCategoryInput) =>
      fetchJson<{ blog_category: BlogCategory }>(CATEGORIES_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.blog_category),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_CATEGORIES_KEY }),
  });
}

export function useUpdateBlogCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: BlogCategoryInput & { id: string }) =>
      fetchJson<{ blog_category: BlogCategory }>(`${CATEGORIES_URL}/${id}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.blog_category),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_CATEGORIES_KEY }),
  });
}

export function useDeleteBlogCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ deleted: boolean }>(`${CATEGORIES_URL}/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_CATEGORIES_KEY }),
  });
}

// ─── Settings ───────────────────────────────────────────────────────────────

export function useBlogSettings() {
  return useQuery({
    queryKey: BLOG_SETTINGS_KEY,
    queryFn: () =>
      fetchJson<{ blog_settings: BlogSettings }>(SETTINGS_URL).then(
        (d) => d.blog_settings,
      ),
  });
}

export function useUpdateBlogSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BlogSettings>) =>
      fetchJson<{ blog_settings: BlogSettings }>(SETTINGS_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      }).then((d) => d.blog_settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: BLOG_SETTINGS_KEY }),
  });
}
