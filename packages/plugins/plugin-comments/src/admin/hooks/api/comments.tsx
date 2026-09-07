import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BASE_URL = '/admin/comments';

export type CommentStatus = 'pending' | 'approved' | 'hidden' | 'deleted';
export type CommentableType = 'product' | 'blog_post';
export type ReviewMode = 'comment' | 'rating' | 'both';

/**
 * Resumen del producto/artículo comentado, que arma el backend
 * (`api/admin/comments/resources.ts`). `null` cuando el recurso ya no existe o
 * su módulo no está instalado.
 */
export type CommentResource = {
  type: CommentableType;
  id: string;
  title: string | null;
  /** `handle` del producto / `slug` del artículo. */
  handle: string | null;
  thumbnail: string | null;
  status: string | null;
  /** Path dentro del admin, ej. `/products/prod_123`. */
  admin_path: string | null;
  /** URL pública absoluta de la publicación. */
  storefront_url: string | null;
};

export type AdminComment = {
  id: string;
  commentable_type: CommentableType;
  commentable_id: string;
  resource?: CommentResource | null;
  parent_id: string | null;
  customer_id: string;
  author_name: string | null;
  rating: number | null;
  content: string | null;
  status: CommentStatus;
  verified_buyer: boolean;
  created_at?: string;
  edited_at?: string | null;
  reply_count?: number;
  replies?: AdminComment[];
};

export type CommentSettings = {
  id: string;
  enabled: boolean;
  review_mode: ReviewMode;
  rating_scale: number;
  who_can_comment: 'registered' | 'verified_buyer';
  moderation: 'auto' | 'manual';
  edit_window_minutes: number;
  min_length: number;
  max_length: number;
  rate_limit_per_minute: number;
};

export const COMMENTS_QUERY_KEY = ['comments'] as const;
export const COMMENT_SETTINGS_QUERY_KEY = ['comment-settings'] as const;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export type CommentListParams = {
  limit?: number;
  offset?: number;
  status?: CommentStatus;
  commentable_type?: CommentableType;
  customer_id?: string;
};

export type CommentListResponse = {
  comments: AdminComment[];
  count: number;
  limit: number;
  offset: number;
};

export function useComments(params?: CommentListParams) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.status) qs.set('status', params.status);
  if (params?.commentable_type)
    qs.set('commentable_type', params.commentable_type);
  if (params?.customer_id) qs.set('customer_id', params.customer_id);
  const url = qs.toString() ? `${BASE_URL}?${qs.toString()}` : BASE_URL;

  return useQuery({
    queryKey: [...COMMENTS_QUERY_KEY, params ?? {}],
    queryFn: () => fetchJson<CommentListResponse>(url),
  });
}

export function useComment(id: string | null) {
  return useQuery({
    queryKey: [...COMMENTS_QUERY_KEY, 'detail', id],
    queryFn: () => fetchJson<{ comment: AdminComment }>(`${BASE_URL}/${id}`),
    enabled: !!id,
  });
}

function useModerationMutation(action: (id: string) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => qc.invalidateQueries({ queryKey: COMMENTS_QUERY_KEY }),
  });
}

export const useApproveComment = () =>
  useModerationMutation((id) =>
    fetchJson(`${BASE_URL}/${id}/approve`, { method: 'POST' }),
  );

export const useHideComment = () =>
  useModerationMutation((id) =>
    fetchJson(`${BASE_URL}/${id}/hide`, { method: 'POST' }),
  );

export const useDeleteComment = () =>
  useModerationMutation((id) =>
    fetchJson(`${BASE_URL}/${id}`, { method: 'DELETE' }),
  );

export function useCommentSettings() {
  return useQuery({
    queryKey: COMMENT_SETTINGS_QUERY_KEY,
    queryFn: () => fetchJson<{ settings: CommentSettings }>(`${BASE_URL}/settings`),
  });
}

export function useUpdateCommentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CommentSettings>) =>
      fetchJson<{ settings: CommentSettings }>(`${BASE_URL}/settings`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: COMMENT_SETTINGS_QUERY_KEY }),
  });
}
