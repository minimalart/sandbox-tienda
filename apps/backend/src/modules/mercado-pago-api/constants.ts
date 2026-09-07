import {
  isMercadoPagoCheckoutEnabled,
  readMercadoPagoSetting,
} from '../app-settings/mercadopago-runtime';
/**
 * Full Medusa provider id for the MercadoPago **Checkout API** provider:
 * `pp_mercadopagoapi_mercadopagoapi` (pp_ prefix + registration id +
 * service `static identifier`). Kept DISTINCT from the Checkout Pro/Express
 * provider (`pp_mercadopago_mercadopago`) so a demo can offer either one — or
 * both — at the same time. The storefront keys off this value.
 *
 * Lives in its own file (not index.ts) so loaders/lib can import it without a
 * circular dependency with the module's default export.
 */
export const MERCADO_PAGO_API_PROVIDER_ID = 'pp_mercadopagoapi_mercadopagoapi';

/**
 * Single source of truth for whether the MercadoPago Checkout API provider is
 * active. Used by medusa-config.ts (to register the provider) and the region
 * sync (to link/unlink it). Explicit opt-in toggle:
 *   MERCADOPAGO_API_ENABLED=true + a valid MERCADOPAGO_ACCESS_TOKEN.
 *
 * Shares the same MP credentials/accounts as the Express provider — the same MP
 * account can collect via both Checkout Pro and Checkout API.
 */
export function isMercadoPagoApiEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env !== process.env)
    return env.MERCADOPAGO_API_ENABLED === 'true' && !!env.MERCADOPAGO_ACCESS_TOKEN;
  return (
    isMercadoPagoCheckoutEnabled(true) &&
    Boolean(
      readMercadoPagoSetting('MERCADOPAGO_ACCESS_TOKEN') ||
      readMercadoPagoSetting('MERCADOPAGO_ACCOUNTS')
    )
  );
}
