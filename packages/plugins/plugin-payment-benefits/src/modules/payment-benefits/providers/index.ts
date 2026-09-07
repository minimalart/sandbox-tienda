import type { PaymentProviderCode } from '../types';
import { manualAdapter } from './manual-adapter';
import { mercadoPagoAdapter } from './mercadopago-adapter';
import type { PaymentBenefitProvider } from './types';

/**
 * Registro de adapters por código de proveedor. Agregar un proveedor nuevo
 * (MODO, Payway, …) es solo sumar su adapter acá; ni el modelo ni la UI cambian.
 */
export const PROVIDERS: Record<string, PaymentBenefitProvider> = {
  mercadopago: mercadoPagoAdapter,
  manual: manualAdapter,
};

export function getProvider(code: PaymentProviderCode | string): PaymentBenefitProvider | null {
  return PROVIDERS[code] ?? null;
}

export type { PaymentBenefitProvider, ProviderContext } from './types';
