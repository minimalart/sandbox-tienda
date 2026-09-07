import { MedusaError } from '@medusajs/framework/utils';
import { BsaleErpAdapter } from './bsale';
import { ContabiliumErpAdapter } from './contabilium';
import { OdooErpAdapter } from './odoo';
import { ZeusErpAdapter } from './zeus';
import type { ErpAdapter } from './types';

/**
 * Registry de adapters ERP. `available: false` = listado en el catálogo
 * (UI lo muestra como "próximamente") pero no seleccionable como provider
 * activo. Para sumar un ERP: implementar `ErpAdapter`, registrarlo acá y
 * marcarlo disponible.
 */

export type ErpProviderCatalogEntry = {
  id: string;
  label: string;
  available: boolean;
};

export const PROVIDER_CATALOG: ErpProviderCatalogEntry[] = [
  { id: 'contabilium', label: 'Contabilium (Argentina)', available: true },
  { id: 'bsale', label: 'Bsale (Chile)', available: true },
  { id: 'zeus', label: 'Zeus ERP (Argentina)', available: true },
  { id: 'odoo', label: 'Odoo (self-hosted / cloud)', available: true },
];

// Los adapters son stateless por llamada (Contabilium cachea tokens en la
// instancia, keyed por credencial): singletons.
const ADAPTERS: Record<string, ErpAdapter> = {
  contabilium: new ContabiliumErpAdapter(),
  bsale: new BsaleErpAdapter(),
  zeus: new ZeusErpAdapter(),
  odoo: new OdooErpAdapter(),
};

export function getErpAdapter(provider: string): ErpAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `ERP provider desconocido: ${provider}`);
  }
  return adapter;
}

export function getProviderCatalogEntry(provider: string): ErpProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((entry) => entry.id === provider);
}
