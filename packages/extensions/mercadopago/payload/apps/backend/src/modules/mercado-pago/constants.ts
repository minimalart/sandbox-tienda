import {
  isMercadoPagoCheckoutEnabled,
  readMercadoPagoSetting,
} from '../app-settings/mercadopago-runtime';
/**
 * Full Medusa provider id: `pp_mercadopago_mercadopago`
 * (pp_ prefix + module identifier + service identifier). The storefront keys
 * off this value.
 *
 * Lives in its own file (not index.ts) so the loader/lib can import it without
 * creating a circular dependency with the module's default export.
 */
export const MERCADO_PAGO_PROVIDER_ID = 'pp_mercadopago_mercadopago';

/**
 * Single source of truth for whether MercadoPago is active. Used by
 * medusa-config.ts (to register the provider) and the setup script (to know
 * whether to link or unlink it). Explicit opt-in toggle:
 *   MERCADOPAGO_ENABLED=true  + a valid MERCADOPAGO_ACCESS_TOKEN.
 */
export function isMercadoPagoEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env !== process.env)
    return env.MERCADOPAGO_ENABLED === 'true' && !!env.MERCADOPAGO_ACCESS_TOKEN;
  return (
    isMercadoPagoCheckoutEnabled(false) &&
    Boolean(
      readMercadoPagoSetting('MERCADOPAGO_ACCESS_TOKEN') ||
      readMercadoPagoSetting('MERCADOPAGO_ACCOUNTS')
    )
  );
}
