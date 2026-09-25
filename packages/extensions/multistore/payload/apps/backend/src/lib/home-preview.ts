import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';


export const PREVIEW_TTL = 600;
export const PreviewInput = z.object({
  site_id: z.string().min(1).max(120),
  country_code: z.string().regex(/^[a-z]{2}$/),
  parent_origin: z.string().url(),
  language: z.enum(['es', 'en']).default('es'),
  mode: z.enum(['block', 'page']).default('page'),
  puck_data: z.object({ content: z.array(z.object({
    type: z.string().max(80), props: z.record(z.string(), z.unknown()),
  })).max(100), root: z.unknown().optional() }),
});

export type PreviewSession = {
  home_id: string;
  site_id: string;
  site_slug: string;
  country_code: string;
  parent_origin: string;
  language: 'es' | 'en';
  mode: 'block' | 'page';
  expires_at: number;
  puck_data: z.infer<typeof PreviewInput>['puck_data'];
};

export interface PreviewCache {
  set(key: string, value: unknown, ttl: number): Promise<void>;
  get<T>(key: string): Promise<T | null | undefined>;
}

const key = (token: string) => `home-preview:${createHash('sha256').update(token).digest('hex')}`;

/** Immutable snapshots: overlapping requests can never overwrite a newer revision. */
export async function createPreview(cache: PreviewCache, session: Omit<PreviewSession, 'expires_at'>) {
  const token = randomBytes(32).toString('hex');
  const expires_at = Date.now() + PREVIEW_TTL * 1000;
  await cache.set(key(token), { ...session, expires_at }, PREVIEW_TTL);
  return { token, expires_at };
}

export async function readPreview(cache: PreviewCache, token: string): Promise<PreviewSession | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await cache.get<PreviewSession>(key(token));
  return session && session.expires_at > Date.now() ? session : null;
}

export function previewOrigin(raw: string, allowed: string[]): string | null {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return allowed.some(value => {
      try { return new URL(value.trim()).origin === url.origin; } catch { return false; }
    }) ? url.origin : null;
  } catch { return null; }
}
