/**
 * Corporate Accounts (B2B). El `Corporate` es la fuente de verdad de la
 * organización; el customer_group nativo es opcional (solo para pricing/promos).
 */

export type CorporateStatus = 'pending' | 'active' | 'suspended' | 'archived';

export type CorporateRole = 'owner' | 'admin' | 'buyer' | 'viewer';

export type MemberStatus = 'invited' | 'active' | 'disabled';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/** Tipos de regla corporativa. */
export type CorporateRuleType =
  | 'minimum_order_amount'
  | 'maximum_order_amount'
  | 'allowed_shipping_methods'
  | 'allowed_payment_methods'
  | 'require_approval' // Fase 2
  | 'custom_catalog' // Fase 4
  | 'custom_pricing'; // Fase 4

/** Config por tipo de regla (JSON en `CorporateRule.config`). */
export type CorporateRuleConfig =
  | { amount: number } // minimum/maximum_order_amount
  | { ids: string[] } // allowed_shipping_methods / allowed_payment_methods (shipping_option_id / provider_id)
  | Record<string, unknown>;

export type CorporateRuleInput = {
  type: CorporateRuleType;
  config: CorporateRuleConfig;
  enabled?: boolean;
};

/** Resultado de validar un carrito contra las reglas activas. */
export type CartRuleViolation = {
  type: CorporateRuleType;
  message: string;
};

/** Roles que pueden GESTIONAR (editar empresa, miembros, reglas, invitar). */
export const MANAGER_ROLES: CorporateRole[] = ['owner', 'admin'];

/** Roles que pueden COMPRAR. */
export const BUYER_ROLES: CorporateRole[] = ['owner', 'admin', 'buyer'];

export const CORPORATE_ACTIVATION_SETTING = 'corporate_activation_mode';

export type CorporateActivationMode = 'manual' | 'automatic';

export const CORPORATE_MODULE = 'corporate';
