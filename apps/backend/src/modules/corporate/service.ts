import { MedusaService, MedusaError } from '@medusajs/framework/utils';
import { randomBytes } from 'node:crypto';
import {
  Corporate,
  CorporateMember,
  CorporateRule,
  CorporateInvitation,
} from './models';
import type { CorporateRole } from './types';

class CorporateModuleService extends MedusaService({
  Corporate,
  CorporateMember,
  CorporateRule,
  CorporateInvitation,
}) {
  /** Membership de un customer en una empresa puntual (cualquier estado). */
  async getMembership(corporateId: string, customerId: string) {
    const rows = await this.listCorporateMembers({
      corporate_id: corporateId,
      customer_id: customerId,
    });
    return rows[0] ?? null;
  }

  /** Única membership ACTIVA del customer (regla v1: a lo sumo una). */
  async getActiveMembershipByCustomer(customerId: string) {
    const rows = await this.listCorporateMembers({
      customer_id: customerId,
      status: 'active',
    });
    return rows[0] ?? null;
  }

  /** Reglas habilitadas de una empresa. */
  async getActiveRules(corporateId: string) {
    return this.listCorporateRules({ corporate_id: corporateId, enabled: true });
  }

  /** Token de invitación aleatorio, url-safe. */
  generateInviteToken(): string {
    return randomBytes(24).toString('base64url');
  }
}

/** Lanza si `role` no está permitido. Helper puro reutilizable en rutas. */
export function assertRole(
  role: string | null | undefined,
  allowed: CorporateRole[],
): void {
  if (!role || !allowed.includes(role as CorporateRole)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'No tenés permisos para esta acción en la empresa.',
    );
  }
}

export default CorporateModuleService;
