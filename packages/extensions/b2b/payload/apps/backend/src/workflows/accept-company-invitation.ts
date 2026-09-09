import type { ICustomerModuleService, IEventBusModuleService } from '@medusajs/framework/types';
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import { COMPANY_MODULE } from '../modules/company';
import type CompanyModuleService from '../modules/company/service';

export type AcceptCompanyInvitationInput = { token: string; customer_id: string };

const acceptStep = createStep(
  'accept-company-invitation',
  async (input: AcceptCompanyInvitationInput, { container }) => {
    const service = container.resolve<CompanyModuleService>(COMPANY_MODULE);
    const matches = await service.listCompanyInvitations({ token: input.token });
    const invitation = matches[0];
    if (!invitation) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Invitación inválida.');
    }
    if (invitation.status !== 'pending') {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'La invitación ya fue usada o revocada.');
    }
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await service.updateCompanyInvitations({ id: invitation.id, status: 'expired' });
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'La invitación expiró.');
    }
    const existing = await service.getMembershipByCustomer(input.customer_id);
    if (existing) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Ya pertenecés a una empresa.');
    }
    const created = await service.createCompanyMembers({
      company_id: invitation.company_id,
      customer_id: input.customer_id,
      role: invitation.role,
      status: 'active',
      invited_by: invitation.invited_by ?? null,
      joined_at: new Date(),
    });
    const member = Array.isArray(created) ? created[0] : created;
    if (!member) throw new Error('No se pudo crear la membresía.');
    await service.updateCompanyInvitations({
      id: invitation.id,
      status: 'accepted',
      accepted_at: new Date(),
    });

    // Si la empresa tiene customer group vinculado, sumamos al nuevo miembro.
    const company = await service.retrieveCompany(invitation.company_id);
    if (company?.customer_group_id) {
      const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER);
      await customerService.addCustomerToGroup({
        customer_id: input.customer_id,
        customer_group_id: company.customer_group_id as string,
      });
    }

    return new StepResponse(
      { member, companyId: invitation.company_id },
      { memberId: member.id, invitationId: invitation.id },
    );
  },
  async (undo: { memberId: string; invitationId: string } | undefined, { container }) => {
    if (!undo) return;
    const service = container.resolve<CompanyModuleService>(COMPANY_MODULE);
    await service.deleteCompanyMembers([undo.memberId]);
    await service.updateCompanyInvitations({
      id: undo.invitationId,
      status: 'pending',
      accepted_at: null,
    });
  },
);

const emitJoinedStep = createStep(
  'emit-company-member-joined',
  async (data: { companyId: string }, { container }) => {
    const eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS);
    await eventBus.emit({ name: 'company.member.joined', data: { id: data.companyId } });
    return new StepResponse(void 0);
  },
);

export const acceptCompanyInvitationWorkflow = createWorkflow(
  'accept-company-invitation',
  function (input: AcceptCompanyInvitationInput) {
    const result = acceptStep(input);
    emitJoinedStep({ companyId: result.companyId });
    return new WorkflowResponse(result.member);
  },
);
