import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules, MedusaError, ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import { COMPANY_MODULE } from '../modules/company';
import type CompanyModuleService from '../modules/company/service';
import type { CompanyRole } from '../modules/company/types';
import { getEmailTemplateSettings } from '../modules/email/settings';

/**
 * Función y no `const` de módulo: el ID de plantilla viene de `app-settings`
 * (fila en base > env > default), y un `const` lo congelaría con el valor que
 * había al importar el archivo — o sea, con el env, para siempre.
 */
const inviteEmailTemplate = (): string => getEmailTemplateSettings().companyInviteTemplateId;
const INVITE_TTL_DAYS = 7;

export type InviteCompanyMemberInput = {
  company_id: string;
  email: string;
  role?: CompanyRole;
  invited_by?: string | null;
  accept_base_url?: string;
};

const resolveAcceptBaseUrl = (explicit?: string): string => {
  if (explicit) return explicit.replace(/\/+$/, '');
  const fromEnv =
    process.env.STOREFRONT_URL ||
    (process.env.STORE_CORS || '').split(',')[0] ||
    'http://localhost:3000';
  return fromEnv.replace(/\/+$/, '');
};

const createInvitationStep = createStep(
  'create-company-invitation',
  async (input: InviteCompanyMemberInput, { container }) => {
    const service = container.resolve<CompanyModuleService>(COMPANY_MODULE);
    const company = await service.retrieveCompany(input.company_id);
    if (!company) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Empresa no encontrada.');
    }
    const expires = new Date();
    expires.setDate(expires.getDate() + INVITE_TTL_DAYS);
    const created = await service.createCompanyInvitations({
      company_id: input.company_id,
      email: input.email.trim().toLowerCase(),
      role: input.role ?? 'buyer',
      token: service.generateInviteToken(),
      invited_by: input.invited_by ?? null,
      status: 'pending',
      expires_at: expires,
    });
    const invitation = Array.isArray(created) ? created[0] : created;
    if (!invitation) throw new Error('No se pudo crear la invitación.');
    return new StepResponse(
      {
        invitation,
        companyName: company.name as string,
        // La empresa lleva canal, no site_id. Viaja en el resultado del step.
        salesChannelId:
          (company as { sales_channel_id?: string | null }).sales_channel_id ?? null,
      },
      invitation.id,
    );
  },
  async (invitationId: string | undefined, { container }) => {
    if (!invitationId) return;
    const service = container.resolve<CompanyModuleService>(COMPANY_MODULE);
    await service.deleteCompanyInvitations([invitationId]);
  },
);

const sendInviteEmailStep = createStep(
  'send-company-invite-email',
  async (
    data: {
      email: string;
      token: string;
      role: string;
      companyName: string;
      salesChannelId?: string | null;
      acceptBaseUrl?: string;
    },
    { container },
  ) => {
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
    const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);
    const acceptUrl = `${resolveAcceptBaseUrl(data.acceptBaseUrl)}/mayorista/invitacion/${data.token}`;
    try {
      await notificationService.createNotifications({
        to: data.email,
        channel: 'email',
        template: inviteEmailTemplate(),
        data: {
          sales_channel_id: data.salesChannelId ?? undefined,
          company_name: data.companyName,
          role: data.role,
          accept_url: acceptUrl,
        },
      });
    } catch (error) {
      logger.warn(
        `[Company] Invitación a ${data.email} creada pero email no enviado. Link: ${acceptUrl}. ${(error as Error).message}`,
      );
    }
    return new StepResponse(void 0);
  },
);

export const inviteCompanyMemberWorkflow = createWorkflow(
  'invite-company-member',
  function (input: InviteCompanyMemberInput) {
    const created = createInvitationStep(input);
    sendInviteEmailStep({
      email: created.invitation.email,
      token: created.invitation.token,
      role: created.invitation.role,
      companyName: created.companyName,
      salesChannelId: created.salesChannelId,
      acceptBaseUrl: input.accept_base_url,
    });
    return new WorkflowResponse(created.invitation);
  },
);
