import { MedusaError } from '@medusajs/framework/utils';
import { manualLinkStrategy } from './manual-link';
import { mercadoPagoAutoStrategy, mercadoPagoRecurringProvider } from './mercadopago-auto';
import type { RecurringPaymentProvider, RenewalPaymentStrategy } from './types';

export * from './types';

const STRATEGIES = new Map<string, RenewalPaymentStrategy>([
  [manualLinkStrategy.mode, manualLinkStrategy],
  [mercadoPagoAutoStrategy.mode, mercadoPagoAutoStrategy],
]);

export {
  cancelMercadoPagoSubscriptionById,
  compensateMercadoPagoSubscriptionRotation,
  mercadoPagoRecurringCapabilities,
  syncMercadoPagoSubscriptionStatus,
  retrieveMercadoPagoSubscription,
  rotateMercadoPagoSubscription,
  updateMercadoPagoSubscriptionTerms,
} from './mercadopago-auto';
export type { MercadoPagoSubscriptionRotation } from './mercadopago-auto';

const PROVIDERS = new Map<string, RecurringPaymentProvider>([
  [mercadoPagoRecurringProvider.id, mercadoPagoRecurringProvider],
]);

export function resolveRecurringPaymentProvider(id: string): RecurringPaymentProvider {
  const provider = PROVIDERS.get(id);
  if (!provider) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Proveedor recurrente no soportado: ${id}`);
  }
  return provider;
}

export function resolvePaymentStrategy(mode: string): RenewalPaymentStrategy {
  const strategy = STRATEGIES.get(mode);
  if (!strategy) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Modo de pago recurrente no soportado: ${mode}`,
    );
  }
  return strategy;
}

export function isSupportedPaymentMode(mode: string): boolean {
  return STRATEGIES.has(mode);
}
