import { MedusaError } from '@medusajs/framework/utils';
import { argentinaLayer } from './ar';
import { chileLayer } from './cl';
import type { CountryLayer } from './types';

export type ErpCountryCatalogEntry = {
  id: string;
  label: string;
};

export const COUNTRY_CATALOG: ErpCountryCatalogEntry[] = [
  { id: 'AR', label: 'Argentina' },
  { id: 'CL', label: 'Chile' },
];

const LAYERS: Record<string, CountryLayer> = {
  AR: argentinaLayer,
  CL: chileLayer,
};

export function getCountryLayer(code: string): CountryLayer {
  const layer = LAYERS[code?.toUpperCase()];
  if (!layer) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `País no soportado por la extensión ERP: ${code}`);
  }
  return layer;
}
