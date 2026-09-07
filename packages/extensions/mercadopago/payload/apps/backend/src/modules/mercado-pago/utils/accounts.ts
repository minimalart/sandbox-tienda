/**
 * Per-branch MercadoPago credential resolution (env / secret-manager based).
 *
 * Each branch can collect with its own MP account. Because payment provider
 * modules are isolated (no cross-module `query`), the provider can't look a
 * branch up from the DB at runtime — instead the storefront passes the branch
 * code (and/or sales_channel_id) on the payment session data, and the account
 * is resolved from a JSON map provided via env:
 *
 *   MERCADOPAGO_ACCOUNTS='{"ESCOBAR":{"accessToken":"APP_USR-...","webhookSecret":"...","publicKey":"..."},"PILAR":{...}}'
 *
 * Keys are branch codes (case-insensitive), SITE ids/slugs, or sales_channel_ids.
 * When no entry matches, the global env credentials are used (single-tenant
 * fallback — the current behaviour, so nothing regresses until branches are wired).
 *
 * Prefer keying by SITE (`demo_norte` or its slug) over sales_channel_id: a store
 * with `b2b_enabled` owns TWO channels, so keying by channel means duplicating the
 * same credentials under two keys — and the day someone updates only one of them,
 * retail and wholesale start collecting into different accounts, silently.
 *
 * Unlike the fulfillment providers, MercadoPago does NOT read encrypted per-site
 * credentials from the DB. It can't: `getAccount` is synchronous and sits on the
 * charge path. The env map is the seam, and it is deliberate — a token that only
 * exists in the process env can't leak through a store SELECT.
 *
 * Trade-off (accepted): adding a branch's account requires a config/redeploy.
 */
export interface MpAccount {
  accessToken: string;
  webhookSecret?: string;
  publicKey?: string;
}

type RawAccount = {
  accessToken?: string;
  access_token?: string;
  webhookSecret?: string;
  webhook_secret?: string;
  publicKey?: string;
  public_key?: string;
};

/** Parses the MERCADOPAGO_ACCOUNTS JSON map. Returns an empty map on malformed input. */
export function parseMpAccounts(raw?: string): Map<string, MpAccount> {
  const map = new Map<string, MpAccount>();
  if (!raw || !raw.trim()) return map;
  try {
    const obj = JSON.parse(raw) as Record<string, RawAccount>;
    for (const [key, val] of Object.entries(obj)) {
      const accessToken = val.accessToken ?? val.access_token;
      if (!accessToken) continue;
      map.set(key.trim().toLowerCase(), {
        accessToken,
        webhookSecret: val.webhookSecret ?? val.webhook_secret,
        publicKey: val.publicKey ?? val.public_key,
      });
    }
  } catch {
    // Malformed map → behave as single-tenant (global fallback).
  }
  return map;
}

/**
 * Resolves an account by branch code, then SITE (id, then slug), then
 * sales_channel_id, then the global fallback. Lookups are case-insensitive.
 *
 * The order is the point. Branch is the narrowest (a physical store within a site),
 * site is the tenant, and channel is the legacy key kept for compatibility. Putting
 * the channel LAST is what lets a B2B site declare one entry by site id and have
 * both its retail and wholesale channels collect into the same account.
 */
export function resolveMpAccount(
  accounts: Map<string, MpAccount>,
  fallback: MpAccount,
  opts: {
    branchCode?: string | null;
    siteId?: string | null;
    siteSlug?: string | null;
    salesChannelId?: string | null;
  },
): MpAccount {
  const keys = [opts.branchCode, opts.siteId, opts.siteSlug, opts.salesChannelId]
    .filter((k): k is string => !!k)
    .map((k) => k.trim().toLowerCase());
  for (const k of keys) {
    const acc = accounts.get(k);
    if (acc) return acc;
  }
  return fallback;
}
