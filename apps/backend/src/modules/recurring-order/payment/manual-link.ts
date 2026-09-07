import { buildConfirmationUrl } from '../lib';
import type {
  RenewalPaymentContext,
  RenewalPaymentResult,
  RenewalPaymentStrategy,
} from './types';

/**
 * Modo confirmación manual (MVP): no cobra nada. Devuelve el link que restaura
 * el carrito de renovación y lleva al checkout; el pago sale por el flujo
 * normal (Mercado Pago, etc.) y `order.placed` cierra el ciclo.
 */
export const manualLinkStrategy: RenewalPaymentStrategy = {
  mode: 'manual_link',
  async initiate(ctx: RenewalPaymentContext): Promise<RenewalPaymentResult> {
    return {
      kind: 'await_confirmation',
      confirmation_url: buildConfirmationUrl(
        ctx.cartId,
        ctx.cycle.id,
        ctx.recurringOrder.country_code,
      ),
    };
  },
};
