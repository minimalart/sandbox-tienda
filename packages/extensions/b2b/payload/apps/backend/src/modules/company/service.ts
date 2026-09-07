import { MedusaService, MedusaError } from '@medusajs/framework/utils';
import { randomBytes } from 'node:crypto';
import { Company, CompanyMember, CompanyInvitation } from './models';
import type { CompanyRole } from './types';

class CompanyModuleService extends MedusaService({
  Company,
  CompanyMember,
  CompanyInvitation,
}) {
  /** v1: a lo sumo UNA membership activa por customer. */
  async getMembershipByCustomer(customerId: string) {
    const rows = await this.listCompanyMembers({
      customer_id: customerId,
      status: 'active',
    });
    return rows[0] ?? null;
  }

  async getMembership(companyId: string, customerId: string) {
    const rows = await this.listCompanyMembers({
      company_id: companyId,
      customer_id: customerId,
    });
    return rows[0] ?? null;
  }

  async getActiveMembers(companyId: string) {
    return this.listCompanyMembers({ company_id: companyId, status: 'active' });
  }

  generateInviteToken(): string {
    return randomBytes(24).toString('base64url');
  }
}

/** Lanza si `role` no está permitido. */
export function assertRole(
  role: string | null | undefined,
  allowed: CompanyRole[],
): void {
  if (!role || !allowed.includes(role as CompanyRole)) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'No tenés permisos para esta acción en la empresa.',
    );
  }
}

export default CompanyModuleService;
