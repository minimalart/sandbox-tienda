import { createHash } from 'node:crypto';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

export const reportKey = (...parts: unknown[]) =>
  createHash('sha256').update(JSON.stringify(parts)).digest('hex');
/** Shared Postgres cache + transaction lock avoid spending the vendor quota per worker. */
export async function cachedReport<T>(
  container: MedusaContainer,
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>
): Promise<T> {
  const pg = container.resolve<any>(ContainerRegistrationKeys.PG_CONNECTION);
  return pg.transaction(async (tx: any) => {
    await tx.raw('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [key]);
    const found = await tx.raw(
      'SELECT value FROM marketing_report_cache WHERE key = ? AND expires_at > NOW()',
      [key]
    );
    if (found.rows[0]) return found.rows[0].value as T;
    const value = await load();
    await tx.raw(
      `INSERT INTO marketing_report_cache(key,value,expires_at) VALUES (?,?::jsonb,NOW() + (? * INTERVAL '1 second'))
      ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
      [key, JSON.stringify(value), ttlSeconds]
    );
    await tx.raw("DELETE FROM marketing_report_cache WHERE expires_at < NOW() - INTERVAL '7 days'");
    return value;
  });
}
