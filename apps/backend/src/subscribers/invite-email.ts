import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type {
  INotificationModuleService,
  IUserModuleService,
  Logger,
} from '@medusajs/framework/types';

/**
 * Sends the admin invitation email on `invite.created` / `invite.resent`.
 * Medusa core creates the invite and emits the event with `{ id }` only, so we
 * resolve the invite (email + token) from the User module and build the accept
 * link to OUR custom accept page `/invitations/accept?token=...` (NOT the core
 * `/app/invite`, which can't handle emails that already have an auth identity —
 * e.g. an invited customer). Without this subscriber no invite email is sent.
 */
function adminBaseUrl(): string {
  const raw =
    process.env.BACKEND_URL ||
    process.env.MEDUSA_BACKEND_URL ||
    'http://localhost:9000';
  return raw.replace(/\/+$/, '');
}

export default async function handleInviteEmail({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const inviteId = event.data.id;
  if (!inviteId) return;

  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const notificationService = container.resolve<INotificationModuleService>(
    Modules.NOTIFICATION,
  );
  const userService = container.resolve<IUserModuleService>(Modules.USER);

  let invite: { email?: string | null; token?: string | null };
  try {
    invite = await userService.retrieveInvite(inviteId);
  } catch (error) {
    logger.warn(
      `[Invite Email] No se pudo leer la invitación ${inviteId}: ${(error as Error).message}`,
    );
    return;
  }

  if (!invite?.email || !invite?.token) {
    logger.warn(
      `[Invite Email] Invitación ${inviteId} sin email o token — se omite el envío.`,
    );
    return;
  }

  const link = `${adminBaseUrl()}/invitations/accept?token=${encodeURIComponent(invite.token)}`;

  try {
    await notificationService.createNotifications({
      to: invite.email,
      channel: 'email',
      template: 'admin-invite',
      data: {
        link_invitacion: link,
        invited_email: invite.email,
      },
    });
    logger.info(`[Invite Email] Invitación enviada a ${invite.email}`);
  } catch (error) {
    logger.warn(
      `[Invite Email] admin-invite no enviado a ${invite.email} (invitación ${inviteId}): ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: ['invite.created', 'invite.resent'],
};
