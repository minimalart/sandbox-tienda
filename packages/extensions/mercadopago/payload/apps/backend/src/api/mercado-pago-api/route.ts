import { readMercadoPagoSetting } from '../../modules/app-settings/mercadopago-runtime';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import type { IPaymentModuleService, Logger } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import { capturePaymentWorkflow, completeCartWorkflow } from '@medusajs/medusa/core-flows';
import { cancelOrderWorkflow } from '@medusajs/core-flows';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { MERCADO_PAGO_API_PROVIDER_ID } from '../../modules/mercado-pago-api/constants';
import {
  mapMpPaymentToAction,
  type MpPaymentLike,
} from '../../modules/mercado-pago/utils/status-mapper';
import { verifyMpWebhookSignature } from '../../modules/mercado-pago/utils/webhook-verifier';
import { parseMpAccounts, resolveMpAccount } from '../../modules/mercado-pago/utils/accounts';

/**
 * MercadoPago **Checkout API** webhook.
 *
 * Payments are created with notification_url = `${BACKEND_URL}/mercado-pago-api?sc=...`,
 * external_reference = payment session id, and metadata.cart_id = cart id. MP
 * only sends `data.id`, so we resolve the collecting account from the `sc` query
 * param, fetch the full payment, then complete the cart and authorize/capture
 * the Medusa payment session — all idempotently (mirrors the Express webhook).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse): Promise<void> => {
  const logger = req.scope.resolve<Logger>('logger');
  const query = req.scope.resolve('query');
  const paymentModule = req.scope.resolve<IPaymentModuleService>(Modules.PAYMENT);

  const body = (req.body ?? {}) as {
    type?: string;
    action?: string;
    data?: { id?: string | number };
  };
  const mpPaymentId = body?.data?.id ? String(body.data.id) : undefined;
  const topic = (body?.type as string | undefined) ?? (req.query?.topic as string | undefined);

  logger.info(`MercadoPago API webhook | topic=${topic} | mp_payment_id=${mpPaymentId}`);

  if (topic !== 'payment' || !mpPaymentId) {
    res.sendStatus(200);
    return;
  }

  // Resolve the collecting account from the sales channel stamped on the URL.
  const salesChannelId = (req.query?.sc as string | undefined) ?? null;
  const account = resolveMpAccount(
    parseMpAccounts(readMercadoPagoSetting('MERCADOPAGO_ACCOUNTS')),
    {
      accessToken: readMercadoPagoSetting('MERCADOPAGO_ACCESS_TOKEN') ?? '',
      webhookSecret: readMercadoPagoSetting('MERCADOPAGO_WEBHOOK_SECRET'),
      publicKey: readMercadoPagoSetting('MERCADOPAGO_PUBLIC_KEY'),
    },
    { salesChannelId }
  );
  if (!account.accessToken) {
    logger.warn('MercadoPago API webhook: no access token resolved; dropping.');
    res.sendStatus(200);
    return;
  }

  // Verify HMAC with the resolved account's secret (allow-with-warning if unset).
  const signatureCheck = verifyMpWebhookSignature({
    secret: account.webhookSecret,
    xSignature: req.headers['x-signature'] as string | undefined,
    xRequestId: req.headers['x-request-id'] as string | undefined,
    dataId: mpPaymentId,
  });
  if (!signatureCheck.valid) {
    if (signatureCheck.reason === 'no_secret_configured') {
      logger.warn('MERCADOPAGO_WEBHOOK_SECRET not set — skipping HMAC verification.');
    } else {
      logger.warn(
        `MercadoPago API webhook signature invalid (${signatureCheck.reason}); dropping.`
      );
      res.sendStatus(401);
      return;
    }
  }

  // Fetch the real MP payment.
  let mpPayment: MpPaymentLike & { metadata?: Record<string, unknown> };
  try {
    const client = new MercadoPagoConfig({ accessToken: account.accessToken });
    const payment = new Payment(client);
    const result = await payment.get({ id: mpPaymentId });
    mpPayment = result as unknown as MpPaymentLike & { metadata?: Record<string, unknown> };
  } catch (err) {
    logger.error(
      `MercadoPago API webhook could not fetch payment ${mpPaymentId}: ${err instanceof Error ? err.message : String(err)}`
    );
    res.sendStatus(200);
    return;
  }

  const sessionId = mpPayment.external_reference as string | undefined;
  const cartId = (mpPayment.metadata?.cart_id as string | undefined) ?? undefined;
  logger.info(
    `MercadoPago API payment | id=${mpPayment.id} | status=${mpPayment.status} | session=${sessionId} | cart=${cartId}`
  );
  if (!cartId) {
    logger.warn(
      `MercadoPago API payment ${mpPaymentId} has no metadata.cart_id; cannot link to a cart.`
    );
    res.sendStatus(200);
    return;
  }

  const resolveCartState = async () => {
    const { data: carts } = await query.graph({
      entity: 'cart',
      fields: [
        'id',
        'order.id',
        'payment_collection.payment_sessions.id',
        'payment_collection.payment_sessions.provider_id',
        'payment_collection.payment_sessions.status',
        'payment_collection.payments.id',
        'payment_collection.payments.provider_id',
        'payment_collection.payments.captured_at',
      ],
      filters: { id: cartId },
    });
    const cart = carts?.[0] as
      | {
          order?: { id?: string };
          payment_collection?: {
            payment_sessions?: Array<{ id: string; provider_id: string; status: string }>;
            payments?: Array<{ id: string; provider_id: string; captured_at?: string | null }>;
          };
        }
      | undefined;
    return {
      sessions: cart?.payment_collection?.payment_sessions ?? [],
      payments: cart?.payment_collection?.payments ?? [],
      linkedOrderId: cart?.order?.id,
    };
  };

  let { sessions, payments, linkedOrderId } = await resolveCartState();
  const mpSession =
    sessions.find((s) => s.id === sessionId && s.provider_id === MERCADO_PAGO_API_PROVIDER_ID) ??
    sessions.find((s) => s.provider_id === MERCADO_PAGO_API_PROVIDER_ID);

  if (!mpSession) {
    logger.warn(
      `No MercadoPago API payment_session on cart ${cartId} for webhook ${mpPaymentId}; nothing to update.`
    );
    res.sendStatus(200);
    return;
  }

  // La acción se mapea ANTES de completar el carrito — mismo motivo que en
  // `/mercado-pago` (ver el comentario largo allá): un pago que MercadoPago dio
  // por muerto no puede convertir el carrito en orden, porque el comprador se
  // queda sin carrito y sin poder reintentar. Los medios offline llegan como
  // `authorized`, no como `failed`, así que siguen creando su orden.
  const action = mapMpPaymentToAction(mpPayment);
  logger.info(
    `MercadoPago API webhook mapped | cart=${cartId} | session=${mpSession.id} | mp_status=${mpPayment.status} | action=${action}`
  );

  if (!linkedOrderId && (action === 'failed' || action === 'canceled')) {
    logger.info(
      `MercadoPago API webhook: pago ${mpPaymentId} terminó en ${mpPayment.status} (action=${action}) y el carrito ${cartId} todavía no es orden; se deja el carrito intacto para que el comprador pueda reintentar.`
    );
    res.sendStatus(200);
    return;
  }

  // Webhook is the primary trigger for cart completion. Idempotent by cart_id.
  if (!linkedOrderId) {
    try {
      await completeCartWorkflow(req.scope).run({ input: { id: cartId } });
      logger.info(`MercadoPago API webhook completed cart | cart=${cartId}`);
    } catch (err) {
      const status =
        (err as { status?: number } | null)?.status ??
        (err instanceof Error && /already being completed/i.test(err.message) ? 409 : undefined);
      if (status === 409) {
        logger.info(
          `MercadoPago API webhook: cart ${cartId} is being completed elsewhere; continuing.`
        );
      } else {
        // El dinero YA está cobrado en MercadoPago y la orden no existe: hay
        // que intervenir a mano (ver el mismo comentario en /mercado-pago).
        logger.error(
          `PAGO COBRADO SIN ORDEN | MercadoPago Checkout API | cart=${cartId} | mp_payment=${mpPaymentId} | mp_status=${mpPayment.status} | motivo=${err instanceof Error ? err.message : String(err)} | REQUIERE INTERVENCION MANUAL`
        );
        res.sendStatus(200);
        return;
      }
    }
    ({ sessions, payments, linkedOrderId } = await resolveCartState());
  }

  const existingMpPayment = payments.find((p) => p.provider_id === MERCADO_PAGO_API_PROVIDER_ID);

  try {
    if (action === 'authorized') {
      if (existingMpPayment) {
        logger.info(
          `Authorize requested but MP payment already exists (${existingMpPayment.id}); no-op.`
        );
      } else {
        const payment = await paymentModule.authorizePaymentSession(mpSession.id, {});
        logger.info(
          `authorizePaymentSession OK | session=${mpSession.id} | payment=${payment?.id}`
        );
      }
    } else if (action === 'captured') {
      let paymentId = existingMpPayment?.id;
      if (!paymentId) {
        const payment = await paymentModule.authorizePaymentSession(mpSession.id, {});
        paymentId = payment?.id;
        logger.info(
          `Implicit authorize before capture | session=${mpSession.id} | payment=${paymentId}`
        );
      }
      if (!paymentId) {
        throw new Error(`Could not resolve a payment to capture for session ${mpSession.id}`);
      }
      if (existingMpPayment?.captured_at) {
        logger.info(
          `Payment ${paymentId} already captured at ${existingMpPayment.captured_at}; no-op.`
        );
      } else {
        // Capture via workflow so `payment.captured` fires (ERP subscriber) and
        // the order capture transaction is recorded.
        await capturePaymentWorkflow(req.scope).run({ input: { payment_id: paymentId } });
        logger.info(`capturePayment OK | payment=${paymentId}`);
      }
    } else if (action === 'canceled') {
      if (linkedOrderId) {
        try {
          await cancelOrderWorkflow(req.scope).run({ input: { order_id: linkedOrderId } });
          logger.info(
            `MercadoPago API webhook cancelled order | order=${linkedOrderId} | cart=${cartId}`
          );
        } catch (cancelErr) {
          logger.warn(
            `MercadoPago API webhook could not cancel order ${linkedOrderId}: ${cancelErr instanceof Error ? cancelErr.message : String(cancelErr)}`
          );
        }
      }
    } else {
      logger.info(`MercadoPago API webhook action=${action} is a no-op; returning 200.`);
    }
  } catch (err) {
    logger.error(
      `MercadoPago API webhook action dispatch failed for cart ${cartId}: ${err instanceof Error ? err.message : String(err)}`
    );
    res.sendStatus(200);
    return;
  }

  res.sendStatus(200);
};
