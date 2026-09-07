import 'server-only';
import { getAuthHeaders } from './cookies';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

export type CommentableType = 'product' | 'blog_post';
export type ReviewMode = 'comment' | 'rating' | 'both';

export type PublicComment = {
  id: string;
  author_name: string | null;
  rating: number | null;
  content: string | null;
  verified_buyer: boolean;
  status: string;
  created_at: string;
  edited_at: string | null;
  parent_id: string | null;
  replies?: PublicComment[];
};

export type CommentsAggregate = {
  total: number;
  rating_count: number;
  average_rating: number | null;
};

export type PublicCommentSettings = {
  enabled: boolean;
  review_mode: ReviewMode;
  rating_scale: number;
  who_can_comment: 'registered' | 'verified_buyer';
  max_length: number;
  min_length: number;
};

export type CommentsResponse = {
  comments: PublicComment[];
  aggregate: CommentsAggregate;
  settings: PublicCommentSettings;
};

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(PUBLISHABLE_KEY ? { 'x-publishable-api-key': PUBLISHABLE_KEY } : {}),
  };
}

/** Public read of approved comments + aggregate + render settings for an entity. */
export async function getComments(
  commentableType: CommentableType,
  commentableId: string,
): Promise<CommentsResponse | null> {
  const qs = new URLSearchParams({
    commentable_type: commentableType,
    commentable_id: commentableId,
  });
  try {
    const res = await fetch(`${BACKEND_URL}/store/comments?${qs.toString()}`, {
      headers: headers(),
      next: { revalidate: 60, tags: [`comments-${commentableType}-${commentableId}`] },
    });
    if (!res.ok) return null;
    return (await res.json()) as CommentsResponse;
  } catch {
    return null;
  }
}

export type ReviewEligibilityReason =
  | 'ok'
  | 'disabled'
  | 'product_only'
  | 'not_delivered'
  | 'already_reviewed';

export type ReviewEligibility = {
  logged_in: boolean;
  can_review: boolean;
  reason: ReviewEligibilityReason;
  review_mode: ReviewMode;
  rating_scale: number;
  min_length: number;
  max_length: number;
  moderation: 'auto' | 'manual';
};

/**
 * Whether the CURRENT customer may review this entity. Returns null when not
 * logged in (no auth) so the caller can show a login prompt. No caching: it's
 * per-customer and must reflect their orders.
 */
export async function getReviewEligibility(
  commentableType: CommentableType,
  commentableId: string,
): Promise<ReviewEligibility | null> {
  const auth = await getAuthHeaders();
  if (!('authorization' in auth)) return null;
  const qs = new URLSearchParams({
    commentable_type: commentableType,
    commentable_id: commentableId,
  });
  try {
    const res = await fetch(
      `${BACKEND_URL}/store/comments/eligibility?${qs.toString()}`,
      { headers: { ...headers(), ...auth }, cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as ReviewEligibility;
  } catch {
    return null;
  }
}
