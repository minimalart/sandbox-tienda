/**
 * Transactional email send test.
 *
 * Sends one real transactional email through the custom email provider
 * (src/modules/email) to verify the wiring end-to-end: it renders one of the
 * hardcoded HTML templates and ships it via SendGrid. Use it after configuring
 * SENDGRID_API_KEY / EMAIL_FROM in a new project.
 *
 * Without SENDGRID_API_KEY the provider logs the email to the console instead of
 * sending it — the test still runs and confirms the template renders.
 *
 * Run with:
 *   pnpm email:test                       # sends to SENDGRID_TEST_TO or ADMIN_EMAIL
 *   pnpm email:test -- you@example.com    # sends to an explicit recipient
 *   or: dotenv -e .env -- medusa exec ./src/scripts/test-email.ts -- you@example.com
 *
 * Env:
 *   SENDGRID_API_KEY     — without it the email is logged, not sent.
 *   EMAIL_FROM           — sender (from) address. Default: noreply@mercatto.com.
 *   EMAIL_TEST_TEMPLATE  — registry template name to send. Default: customer-register.
 *   SENDGRID_TEST_TO     — default recipient when no arg is passed (else ADMIN_EMAIL).
 */
import type { ExecArgs, INotificationModuleService, Logger } from '@medusajs/framework/types';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';

export default async function testEmail({ container, args }: ExecArgs) {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  logger.info('================================================');
  logger.info('Transactional email test');
  logger.info('================================================');

  if (!process.env.SENDGRID_API_KEY) {
    logger.warn(
      '[Email Test] SENDGRID_API_KEY is not set — the email will be LOGGED, not sent. ' +
        'Set SENDGRID_API_KEY and EMAIL_FROM in apps/backend/.env to send for real.',
    );
  }

  // A hardcoded template name from src/modules/email/templates. Defaults to the
  // welcome/registration email, which renders with the Mercatto theme defaults.
  const template = process.env.EMAIL_TEST_TEMPLATE || 'customer-register';

  const to = args?.[0] || process.env.SENDGRID_TEST_TO || process.env.ADMIN_EMAIL;
  if (!to) {
    logger.error(
      '[Email Test] No recipient. Pass one as an argument (pnpm email:test -- you@example.com) ' +
        'or set SENDGRID_TEST_TO / ADMIN_EMAIL.',
    );
    return;
  }

  const from = process.env.EMAIL_FROM || 'noreply@mercatto.com';
  const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION);

  logger.info(`[Email Test] Sending template "${template}" from "${from}" to "${to}"...`);

  try {
    const [notification] = await notificationService.createNotifications([
      {
        to,
        channel: 'email',
        template,
        // Sample data for the default customer-register template. Other templates
        // ignore the fields they don't use; brand/color fall back to Mercatto.
        data: {
          email: to,
          first_name: 'Test',
        },
      },
    ]);

    logger.info('================================================');
    logger.info(`[Email Test] Done ✓ (notification id: ${notification?.id ?? 'unknown'})`);
    logger.info(
      process.env.SENDGRID_API_KEY
        ? '[Email Test] Sent via SendGrid.'
        : '[Email Test] Logged only (no SENDGRID_API_KEY).',
    );
    logger.info('================================================');
  } catch (error) {
    const err = error as Error & { response?: { body?: unknown } };
    // SendGrid surfaces the real cause (unverified sender, invalid key) in
    // response.body — log it so failures are diagnosable.
    logger.error(`[Email Test] Send failed: ${err.message}`);
    if (err.response?.body) {
      logger.error(`[Email Test] SendGrid response: ${JSON.stringify(err.response.body)}`);
    }
  }
}
