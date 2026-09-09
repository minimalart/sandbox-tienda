import type { ICustomerModuleService, IEventBusModuleService } from '@medusajs/framework/types';
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import { CORPORATE_MODULE } from '../modules/corporate';
import type CorporateModuleService from '../modules/corporate/service';

export type AcceptCorporateInvitationInput = {
  token: string;
  /** Customer autenticado que acepta. */
  customer_id: string;
};

// 1) Valida token + crea la membership activa. Compensación: borra la membership.
const acceptStep = createStep(
  'accept-corporate-invitation',
  async (input: AcceptCorporateInvitationInput, { container }) => {
    const service = container.resolve<CorporateModuleService>(CORPORATE_MODULE);

    const matches = await service.listCorporateInvitations({ token: input.token });
    const invitation = matches[0];
    if (!invitation) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Invitación inválida.');
    }
    if (invitation.status !== 'pending') {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'La invitación ya fue usada o revocada.',
      );
    }
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await service.updateCorporateInvitations({
        id: invitation.id,
        status: 'expired',
      });
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'La invitación expiró.');
    }

    const existing = await service.getActiveMembershipByCustomer(input.customer_id);
    if (existing) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Ya pertenecés a una empresa.',
      );
    }

    const created = await service.createCorporateMembers({
      corporate_id: invitation.corporate_id,
      customer_id: input.customer_id,
      role: invitation.role,
      status: 'active',
      invited_by: invitation.invited_by ?? null,
      joined_at: new Date(),
    });
    const member = Array.isArray(created) ? created[0] : created;
    if (!member) throw new Error('No se pudo crear la membresía.');

    await service.updateCorporateInvitations({
      id: invitation.id,
      status: 'accepted',
      accepted_at: new Date(),
    });

    // Si la empresa ya tiene un customer group vinculado, sumamos al nuevo miembro.
    const corporate = await service.retrieveCorporate(invitation.corporate_id);
    if (corporate?.customer_group_id) {
      const customerService = container.resolve<ICustomerModuleService>(Modules.CUSTOMER);
      await customerService.addCustomerToGroup({
        customer_id: input.customer_id,
        customer_group_id: corporate.customer_group_id as string,
      });
    }

    return new StepResponse(
      { member, corporateId: invitation.corporate_id, invitationId: invitation.id },
      { memberId: member.id, invitationId: invitation.id },
    );
  },
  async (
    undo: { memberId: string; invitationId: string } | undefined,
    { container },
  ) => {
    if (!undo) return;
    const service = container.resolve<CorporateModuleService>(CORPORATE_MODULE);
    await service.deleteCorporateMembers([undo.memberId]);
    await service.updateCorporateInvitations({
      id: undo.invitationId,
      status: 'pending',
      accepted_at: null,
    });
  },
);

// 2) Evento corporate.member.joined.
const emitJoinedEventStep = createStep(
  'emit-corporate-member-joined',
  async (data: { corporateId: string }, { container }) => {
    const eventBus = container.resolve<IEventBusModuleService>(Modules.EVENT_BUS);
    await eventBus.emit({
      name: 'corporate.member.joined',
      data: { id: data.corporateId },
    });
    return new StepResponse(void 0);
  },
);

export const acceptCorporateInvitationWorkflow = createWorkflow(
  'accept-corporate-invitation',
  function (input: AcceptCorporateInvitationInput) {
    const result = acceptStep(input);
    emitJoinedEventStep({ corporateId: result.corporateId });
    return new WorkflowResponse(result.member);
  },
);
