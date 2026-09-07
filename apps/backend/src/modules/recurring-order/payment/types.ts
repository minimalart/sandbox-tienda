/**
 * Capa de cobro de renovaciones, desacoplada del motor. NO es un payment
 * provider de Medusa (eso es checkout interactivo): es la estrategia que decide
 * cómo se resuelve el pago de un ciclo ya validado, con el carrito armado.
 *
 * MVP: `manual_link` (el cliente confirma y paga con el checkout existente).
 * Fase 2: `mercadopago_auto` (débito vía Preapproval API) — se agrega otra
 * estrategia sin tocar el motor ni el modelo.
 */

import type { MedusaContainer } from '@medusajs/framework/types';

export type RenewalPaymentMode = 'manual_link' | 'mercadopago_auto';

export type RenewalPaymentContext = {
  recurringOrder: {
    id: string;
    email: string | null;
    sales_channel_id: string | null;
    payment_mode: string;
    payment_context: Record<string, unknown> | null;
    external_subscription_id: string | null;
    provider_state: Record<string, unknown> | null;
    frequency_interval: string;
    frequency_count: number;
    plan_name: string | null;
    country_code: string | null;
  };
  cycle: { id: string; scheduled_at: Date | string };
  /** Carrito de renovación ya armado (items + dirección + envío del canal). */
  cartId: string;
};

export type RenewalPaymentResult =
  /** El cliente debe confirmar: mandar `confirmation_url` y esperar `order.placed`. */
  | { kind: 'await_confirmation'; confirmation_url: string }
  | {
      kind: 'await_authorization';
      authorization_url: string;
      external_subscription_id: string;
      provider_status: string;
    }
  | {
      kind: 'awaiting_charge';
      external_subscription_id: string;
      provider_status: string;
    }
  /** Cobro automático exitoso (Fase 2): completar el carrito y registrar la referencia. */
  | { kind: 'charged'; payment_reference: string }
  | { kind: 'failed'; error: string };

export interface RenewalPaymentStrategy {
  readonly mode: RenewalPaymentMode;
  initiate(
    ctx: RenewalPaymentContext,
    container: MedusaContainer,
  ): Promise<RenewalPaymentResult>;
}

export type ExternalSubscriptionStatus = 'authorized' | 'paused' | 'cancelled';

export type RecurringPaymentCapabilities = {
  authorize: boolean;
  updateAmount: boolean;
  pause: boolean;
  resume: boolean;
  cancel: boolean;
  changePaymentMethod: boolean;
  getStatus: boolean;
  reconcileWebhooks: boolean;
  updateSchedule: 'supported' | 'reauthorization_required' | 'unsupported';
};

/**
 * Contrato portable del proveedor financiero recurrente. El dominio consulta
 * estas capacidades en lugar de asumir que todos los proveedores permiten
 * modificar una agenda ya autorizada.
 */
export interface RecurringPaymentProvider {
  readonly id: string;
  readonly capabilities: RecurringPaymentCapabilities;
  readonly strategy: RenewalPaymentStrategy;
}
