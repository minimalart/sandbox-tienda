import descriptors from './descriptors/mercadopago';
import { resolveSettingSync } from './resolve';

export function readMercadoPagoSetting(key: string): string {
  const descriptor = descriptors.settings.find((d) => d.key === key);
  const value = descriptor ? resolveSettingSync(descriptor) : undefined;
  return value === undefined || value === null ? '' : String(value);
}
export function isMercadoPagoCheckoutEnabled(api = false): boolean {
  return readMercadoPagoSetting(api ? 'MERCADOPAGO_API_ENABLED' : 'MERCADOPAGO_ENABLED') === 'true';
}
