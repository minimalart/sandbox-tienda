import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import type { INotificationModuleService, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { CORPORATE_MODULE } from '../modules/corporate';
import type CorporateModuleService from '../modules/corporate/service';
import type { CorporateRole } from '../modules/corporate/types';
import { getEmailTemplateSettings } from '../modules/email/settings';

/**
 * Función y no `const` de módulo: el ID de plantilla viene de `app-settings`
 * (fila en base > env > default), y un `const` lo congelaría con el valor que
 * había al importar el archivo — o sea, con el env, para siempre.
 */
const inviteEmailTemplate = (): string => getEmailTemplateSettings().corporateInviteTemplateId;
const INVITE_TTL_DAYS = 7;

export type InviteCorporateMemberInput = {
  corporate_id: string;
  email: string;
  role?: CorporateRole;
  invited_by?: string | null;
  /** Base URL del storefront para armar el link de aceptación. */
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

// 1) Crea la invitación (pending, token, expira en 7d).
const createInvitationStep = createStep(
  'create-corporate-invitation',
  async (input: InviteCorporateMemberInput, { container }) => {
    const service = container.resolve<CorporateModuleService>(CORPORATE_MODULE);

    const corporate = await service.retrieveCorporate(input.corporate_id);
    if (!corporate) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Empresa no encontrada.');
    }

    const email = input.email.trim().toLowerCase();
    const expires = new Date();
    expires.setDate(expires.getDate() + INVITE_TTL_DAYS);

    const created = await service.createCorporateInvitations({
      corporate_id: input.corporate_id,
      email,
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
        corporateName: corporate.name as string,
        // La tienda de la empresa viaja en el resultado del step: el que manda el mail
        // no tiene la empresa a mano, sólo esto.
        siteId: (corporate as { site_id?: string | null }).site_id ?? null,
      },
      invitation.id,
    );
  },
  async (invitationId: string | undefined, { container }) => {
    if (!invitationId) return;
    const service = container.resolve<CorporateModuleService>(CORPORATE_MODULE);
    await service.deleteCorporateInvitations([invitationId]);
  },
);

// 2) Envía el email (degrada a warning si no hay provider de email configurado).
const sendInviteEmailStep = createStep(
  'send-corporate-invite-email',
  async (
    data: {
      email: string;
      token: string;
      role: string;
      corporateName: string;
      siteId?: string | null;
      acceptBaseUrl?: string;
    },
    { container },
  ) => {
    const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
    const notificationService = container.resolve<INotificationModuleService>(
      Modules.NOTIFICATION,
    );
    const acceptUrl = `${resolveAcceptBaseUrl(data.acceptBaseUrl)}/corporate/invite/${data.token}`;
    try {
      await notificationService.createNotifications({
        to: data.email,
        channel: 'email',
        template: inviteEmailTemplate(),
        data: {
          site_id: data.siteId ?? undefined,
          corporate_name: data.corporateName,
          role: data.role,
          accept_url: acceptUrl,
        },
      });
    } catch (error) {
      logger.warn(
        `[Corporate] Invitación a ${data.email} creada pero email no enviado ` +
          `(sin provider de email — configurar SendGrid). Link: ${acceptUrl}. ` +
          `Detalle: ${(error as Error).message}`,
      );
    }
    return new StepResponse(void 0);
  },
);

// 3) Evento corporate.member.invited.
const emitInvitedEventStep = createStep(
  'emit-corporate-member-invited',
  async (data: { corporateId: string; invitationId: string }, { container }) => {
    const eventBus = container.resolve(Modules.EVENT_BUS);
    await eventBus.emit({
      name: 'corporate.member.invited',
      data: { id: data.corporateId, invitation_id: data.invitationId },
    });
    return new StepResponse(void 0);
  },
);

export const inviteCorporateMemberWorkflow = createWorkflow(
  'invite-corporate-member',
  function (input: InviteCorporateMemberInput) {
    const created = createInvitationStep(input);
    sendInviteEmailStep({
      email: created.invitation.email,
      token: created.invitation.token,
      role: created.invitation.role,
      corporateName: created.corporateName,
      siteId: created.siteId,
      acceptBaseUrl: input.accept_base_url,
    });
    emitInvitedEventStep({
      corporateId: input.corporate_id,
      invitationId: created.invitation.id,
    });
    return new WorkflowResponse(created.invitation);
  },
);
