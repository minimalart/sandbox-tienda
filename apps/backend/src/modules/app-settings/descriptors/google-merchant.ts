import { defineSettings } from './types';

export type MerchantConfig = {
  enabled: boolean;
  storefrontUrl: string;
  regionId: string;
  salesChannelId: string;
  stockLocationId: string;
  brand: string;
};
export const emptyMerchant: MerchantConfig = {
  enabled: false,
  storefrontUrl: '',
  regionId: '',
  salesChannelId: '',
  stockLocationId: '',
  brand: '',
};
export function validateMerchant(value: unknown): string | null {
  const v = value as MerchantConfig;
  if (
    !v ||
    typeof v.enabled !== 'boolean' ||
    ['storefrontUrl', 'regionId', 'salesChannelId', 'stockLocationId', 'brand'].some(
      (k) => typeof (v as any)[k] !== 'string' || (v as any)[k].length > 2048
    )
  )
    return 'Invalid Merchant configuration';
  if (!v.enabled) return null;
  try {
    const u = new URL(v.storefrontUrl);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash)
      return 'Use an HTTPS storefront URL without query or credentials';
  } catch {
    return 'Invalid storefront URL';
  }
  return /^reg_[\w]+$/.test(v.regionId) &&
    /^sc_[\w]+$/.test(v.salesChannelId) &&
    /^sloc_[\w]+$/.test(v.stockLocationId)
    ? null
    : 'Region, sales channel and stock location are required';
}
export default defineSettings({
  namespace: 'extension:google-merchant',
  title: 'Google Merchant Center',
  defaultScope: 'site',
  settings: [
    {
      key: 'CONFIG',
      env: [],
      type: 'json',
      tier: 'runtime',
      group: 'Catalog',
      label: 'Product feed / Feed de productos',
      default: emptyMerchant,
      refine: validateMerchant,
    },
  ],
});
