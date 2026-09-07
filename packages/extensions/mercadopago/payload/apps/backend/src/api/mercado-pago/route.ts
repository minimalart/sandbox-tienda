import { readMercadoPagoSetting } from '../../modules/app-settings/mercadopago-runtime';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import type { IPaymentModuleService, Logger } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';
import { capturePaymentWorkflow, completeCartWorkflow } from '@medusajs/medusa/core-flows';
import { cancelOrderWorkflow } from '@medusajs/core-flows';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { MERCADO_PAGO_PROVIDER_ID } from '../../modules/mercado-pago';
import {
  mapMpPaymentToAction,
  type MpPaymentLike,
} from '../../modules/mercado-pago/utils/status-mapper';
import { verifyMpWebhookSignature } from '../../modules/mercado-pago/utils/webhook-verifier';
import { parseMpAccounts, resolveMpAccount } from '../../modules/mercado-pago/utils/accounts';

/**
 * MercadoPago Checkout Pro IPN / webhook entry point.
 *
 * Preferences are created with notification_url = `${MEDUSA_BACKEND_URL}/mercado-pago`.
 * MP only sends `data.id` in the body, so we fetch the full payment via the
 * access token (single-tenant: credentials come from env).
 *
 * Webhook-as-truth: the storefront /checkout/success and /pending pages poll
 * for the order but never place it; this webhook is the authoritative trigger
 * for cart completion + authorize/capture.
 *
 * Flow:
 *   1. Verify HMAC (strict if MERCADOPAGO_WEBHOOK_SECRET is set, log-and-allow otherwise).
 *   2. Fetch the full MP payment via the access token.
 *   3. Resolve the cart's MP payment_session (cart_id = MP external_reference).
 *   4. Map MP status -> Medusa action. Si el pago murió (failed/canceled) y el
 *      carrito todavía no es orden, se corta acá y el carrito queda intacto
 *      para que el comprador pueda reintentar.
 *   5. Complete the cart if it isn't an order yet (idempotent).
 *   6. Authorize/capture/cancel según la acción mapeada en el paso 4.
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

  logger.info(`MercadoPago webhook received | topic=${topic} | mp_payment_id=${mpPaymentId}`);

  // 1. Only handle the `payment` topic — merchant_order etc. are ignored.
  if (topic !== 'payment' || !mpPaymentId) {
    res.sendStatus(200);
    return;
  }

  // Resolve the collecting account from the branch/sales-channel stamped on the
  // notification_url at preference creation. Falls back to the global account.
  const branchCode = (req.query?.branch as string | undefined) ?? null;
  const salesChannelId = (req.query?.sc as string | undefined) ?? null;
  const account = resolveMpAccount(
    parseMpAccounts(readMercadoPagoSetting('MERCADOPAGO_ACCOUNTS')),
    {
      accessToken: readMercadoPagoSetting('MERCADOPAGO_ACCESS_TOKEN') ?? '',
      webhookSecret: readMercadoPagoSetting('MERCADOPAGO_WEBHOOK_SECRET'),
      publicKey: readMercadoPagoSetting('MERCADOPAGO_PUBLIC_KEY'),
    },
    { branchCode, salesChannelId }
  );
  const accessToken = account.accessToken;
  if (!accessToken) {
    logger.warn('MercadoPago webhook received but no access token resolved; dropping.');
    res.sendStatus(200);
    return;
  }
  logger.info(`MercadoPago webhook account | branch=${branchCode ?? '(global)'}`);

  // 2. Verify HMAC with the resolved account's secret. Allow-with-warning when
  // no secret is configured so the rollout can proceed before it's provisioned.
  const signatureCheck = verifyMpWebhookSignature({
    secret: account.webhookSecret,
    xSignature: req.headers['x-signature'] as string | undefined,
    xRequestId: req.headers['x-request-id'] as string | undefined,
    dataId: mpPaymentId,
  });
  if (!signatureCheck.valid) {
    if (signatureCheck.reason === 'no_secret_configured') {
      logger.warn(
        'MERCADOPAGO_WEBHOOK_SECRET not set — skipping HMAC verification. DO NOT leave this state in production.'
      );
    } else {
      logger.warn(`MercadoPago webhook signature invalid (${signatureCheck.reason}); dropping.`);
      res.sendStatus(401);
      return;
    }
  }

  // 3. Fetch the real MP payment.
  let mpPayment: MpPaymentLike;
  try {
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);
    const result = await payment.get({ id: mpPaymentId });
    mpPayment = result as unknown as MpPaymentLike;
  } catch (err) {
    logger.error(
      `MercadoPago webhook could not fetch payment ${mpPaymentId}: ${err instanceof Error ? err.message : String(err)}`
    );
    // 200 so MP stops retrying — this payment can't be resolved in our system.
    res.sendStatus(200);
    return;
  }

  logger.info(
    `MercadoPago payment fetched | id=${mpPayment.id} | status=${mpPayment.status} | status_detail=${mpPayment.status_detail} | external_reference=${mpPayment.external_reference}`
  );

  const cartId = mpPayment.external_reference as string | undefined;
  if (!cartId) {
    logger.warn(
      `MercadoPago payment ${mpPaymentId} has no external_reference; cannot link to a cart.`
    );
    res.sendStatus(200);
    return;
  }

  // 4. Resolve the cart's MP payment_session.
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
  const mpSession = sessions.find((s) => s.provider_id === MERCADO_PAGO_PROVIDER_ID);

  if (!mpSession) {
    logger.warn(
      `No MercadoPago payment_session on cart ${cartId} for webhook ${mpPaymentId}; nothing to update.`
    );
    res.sendStatus(200);
    return;
  }

  // 4b. La acción se mapea ACÁ, ANTES de completar el carrito, y no después.
  //
  // Antes el orden era el inverso: se completaba el carrito incondicionalmente y
  // recién entonces se miraba el status del pago. Con una tarjeta RECHAZADA eso
  // convertía el carrito en orden igual, y como `rejected` mapea a `failed` —que
  // en el dispatch de abajo es un no-op— quedaba una orden fantasma sin pago. El
  // comprador volvía del checkout de MercadoPago, apretaba "Intentar nuevamente"
  // y se encontraba con "No se encontró el carrito": su carrito ya no era un
  // carrito. Rebotar una tarjeta le costaba el pedido entero.
  //
  // Ojo con la tentación de leer esto como "no completar hasta que esté
  // aprobado": los medios OFFLINE (ticket, Rapipago, transferencia) llegan con
  // status `pending` y MP los mapea a `authorized` a propósito (ver
  // status-mapper.ts) porque MP ya aceptó la compra y espera que el comprador
  // vaya a pagarla. Esos SÍ tienen que crear la orden. Lo que no puede crear
  // orden es un pago que MP dio por muerto.
  const action = mapMpPaymentToAction(mpPayment);
  const paymentIsDead = action === 'failed' || action === 'canceled';

  logger.info(
    `MercadoPago webhook mapped | cart=${cartId} | session=${mpSession.id} | mp_status=${mpPayment.status} | action=${action}`
  );

  if (!linkedOrderId && paymentIsDead) {
    // El carrito se deja INTACTO a propósito: es lo que le permite al comprador
    // reintentar con otra tarjeta desde /checkout/failure, que ya preserva el
    // carrito del lado del storefront (ver failure-client.tsx).
    logger.info(
      `MercadoPago webhook: pago ${mpPaymentId} terminó en ${mpPayment.status} (action=${action}) y el carrito ${cartId} todavía no es orden; se deja el carrito intacto para que el comprador pueda reintentar.`
    );
    res.sendStatus(200);
    return;
  }

  // 4c. Webhook is the primary trigger for cart completion. Idempotent by cart_id.
  if (!linkedOrderId) {
    try {
      await completeCartWorkflow(req.scope).run({ input: { id: cartId } });
      logger.info(`MercadoPago webhook completed cart | cart=${cartId}`);
    } catch (err) {
      const status =
        (err as { status?: number } | null)?.status ??
        (err instanceof Error && /already being completed/i.test(err.message) ? 409 : undefined);
      if (status === 409) {
        logger.info(
          `MercadoPago webhook: cart ${cartId} is being completed by another request; continuing.`
        );
      } else {
        // Acá el dinero YA está cobrado en MercadoPago y la orden no existe. Es
        // el peor estado posible del sistema y hasta ahora se iba en una línea
        // de log indistinguible de cualquier otra. Precedente real: un carrito
        // de tienda demo cuyos productos colgaban de un shipping profile sin
        // opciones de envío — `validate-shipping` revertía el workflow, esto
        // logueaba y devolvía 200, y el comprador se quedaba sin orden.
        // Medusa 2.x envuelve las fallas de step de workflow en `{ errors: [{ error, action }] }`
        // — `String(err)` sobre el wrapper rendariza `[object Object]` y perdemos la causa real.
        const serializeWorkflowError = (value: unknown): string => {
          const wrapper = value as
            | { errors?: Array<{ error?: { message?: unknown }; message?: unknown }> }
            | null
            | undefined;
          const nested = wrapper?.errors?.[0]?.error?.message;
          if (typeof nested === 'string' && nested.length > 0) return nested;
          const shallow = wrapper?.errors?.[0]?.message;
          if (typeof shallow === 'string' && shallow.length > 0) return shallow;
          if (value instanceof Error && value.message) return value.message;
          try {
            return JSON.stringify(value);
          } catch {
            return String(value);
          }
        };
        logger.error(
          `PAGO COBRADO SIN ORDEN | MercadoPago Checkout Pro | cart=${cartId} | mp_payment=${mpPaymentId} | mp_status=${mpPayment.status} | motivo=${serializeWorkflowError(err)} | REQUIERE INTERVENCION MANUAL`
        );
        res.sendStatus(200);
        return;
      }
    }
    // Re-query so subsequent steps see post-completion state.
    ({ sessions, payments, linkedOrderId } = await resolveCartState());
  }

  const existingMpPayment = payments.find((p) => p.provider_id === MERCADO_PAGO_PROVIDER_ID);

  // 5. Apply the action via the Payment Module service directly.
  // (`action` ya se mapeó en el paso 4b: se necesita ANTES de completar el carrito.)
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
      // Ensure there's a payment to capture — authorize first if needed.
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
        // Capturamos vía workflow (no paymentModule.capturePayment directo):
        // es el único camino que emite `payment.captured` (lo escucha la
        // extensión ERP) y además registra la order transaction de la captura,
        // que el service del módulo se saltea.
        await capturePaymentWorkflow(req.scope).run({ input: { payment_id: paymentId } });
        logger.info(`capturePayment OK | payment=${paymentId}`);
      }
    } else if (action === 'canceled') {
      if (linkedOrderId) {
        try {
          await cancelOrderWorkflow(req.scope).run({ input: { order_id: linkedOrderId } });
          logger.info(
            `MercadoPago webhook cancelled order | order=${linkedOrderId} | cart=${cartId}`
          );
        } catch (cancelErr) {
          logger.warn(
            `MercadoPago webhook could not cancel order ${linkedOrderId}: ${cancelErr instanceof Error ? cancelErr.message : String(cancelErr)}`
          );
        }
      } else {
        logger.info(
          `MercadoPago webhook action=${action} for cart ${cartId} but no linked order to cancel.`
        );
      }
    } else if (action === 'failed' && linkedOrderId) {
      // Llegar acá significa que la orden YA existía cuando entró un pago
      // rechazado — típicamente un reintento fallido sobre un pedido que otro
      // pago ya dejó en pie. NO se cancela: sería destruir una orden legítima
      // por un intento posterior. Pero tampoco se esconde detrás del no-op
      // genérico, porque también puede ser el rastro de una orden creada sin
      // pago válido.
      logger.warn(
        `MercadoPago webhook: pago ${mpPaymentId} rechazado sobre un carrito que YA es orden | cart=${cartId} | order=${linkedOrderId} | mp_status=${mpPayment.status} | no se cancela nada; revisar si la orden tiene un pago válido.`
      );
    } else {
      logger.info(`MercadoPago webhook action=${action} is a no-op; returning 200.`);
    }
  } catch (err) {
    logger.error(
      `MercadoPago webhook action dispatch failed for cart ${cartId}: ${err instanceof Error ? err.message : String(err)}`
    );
    // Still 200: MP will keep retrying otherwise and we'll compound the error.
    res.sendStatus(200);
    return;
  }

  res.sendStatus(200);
};
