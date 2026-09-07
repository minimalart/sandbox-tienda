'use server';

import { revalidateTag } from 'next/cache';
import { getAuthHeaders } from './cookies';
import type { CommentableType } from './comments';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 'http://localhost:9000';
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || '';

export type CreateReviewInput = {
  commentable_type: CommentableType;
  commentable_id: string;
  rating?: number | null;
  content?: string | null;
};

export type CreateReviewResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Submit a review for the authenticated customer. Eligibility (logged in +
 * delivered order when required) is enforced by the backend; we surface its
 * message. Revalidates the entity's comments so the new (or pending) review and
 * updated average refresh.
 */
export async function createReview(
  input: CreateReviewInput,
): Promise<CreateReviewResult> {
  const auth = await getAuthHeaders();
  if (!('authorization' in auth)) {
    return { ok: false, error: 'Iniciá sesión para opinar.' };
  }

  try {
    const res = await fetch(`${BACKEND_URL}/store/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PUBLISHABLE_KEY ? { 'x-publishable-api-key': PUBLISHABLE_KEY } : {}),
        ...auth,
      },
      body: JSON.stringify({
        commentable_type: input.commentable_type,
        commentable_id: input.commentable_id,
        ...(input.rating != null ? { rating: input.rating } : {}),
        ...(input.content ? { content: input.content } : {}),
      }),
      cache: 'no-store',
    });

    const data = (await res.json().catch(() => null)) as
      | { message?: string }
      | null;

    if (!res.ok) {
      return {
        ok: false,
        error: data?.message ?? 'No se pudo enviar tu opinión.',
      };
    }

    revalidateTag(
      `comments-${input.commentable_type}-${input.commentable_id}`,
      'max',
    );
    return {
      ok: true,
      message: data?.message ?? 'Opinión enviada.',
    };
  } catch {
    return { ok: false, error: 'No se pudo enviar tu opinión.' };
  }
}
