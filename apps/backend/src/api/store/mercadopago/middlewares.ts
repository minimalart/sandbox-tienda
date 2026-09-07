import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from '@medusajs/framework/http';
import {
  isMercadoPagoEnabled,
  MERCADO_PAGO_PROVIDER_ID,
} from '../../../modules/mercado-pago/constants';
import {
  isMercadoPagoApiEnabled,
  MERCADO_PAGO_API_PROVIDER_ID,
} from '../../../modules/mercado-pago-api/constants';
import {
  type MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from '@medusajs/framework';
import { PostStoreMercadopagoPayment } from './payment/validators';
import { GetStoreMercadopagoPaymentMethodsParams } from './payment-methods/validators';
import { listPaymentMethodsQueryConfig } from './payment-methods/query-config';
import { GetStoreMercadopagoInstallmentsParams } from './installments/validators';

/**
 * Middlewares for the MercadoPago Checkout API store routes. Registered from
 * src/api/middlewares.ts (the backend's single defineMiddlewares entry point).
 */
export const storeMercadopagoMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/store/payment-providers',
    method: 'GET',
    middlewares: [
      (_req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
        const json = res.json.bind(res);
        res.json = (body: any) => {
          if (Array.isArray(body?.payment_providers)) {
            const providers = body.payment_providers.filter((p: { id: string }) =>
              p.id === MERCADO_PAGO_PROVIDER_ID
                ? isMercadoPagoEnabled()
                : p.id === MERCADO_PAGO_API_PROVIDER_ID
                  ? isMercadoPagoApiEnabled()
                  : true
            );
            return json({ ...body, payment_providers: providers, count: providers.length });
          }
          return json(body);
        };
        next();
      },
    ],
  },
  {
    matcher: '/store/mercadopago/payment',
    method: 'POST',
    middlewares: [validateAndTransformBody(PostStoreMercadopagoPayment)],
  },
  {
    matcher: '/store/mercadopago/payment-methods',
    method: 'GET',
    middlewares: [
      validateAndTransformQuery(
        GetStoreMercadopagoPaymentMethodsParams,
        listPaymentMethodsQueryConfig
      ),
    ],
  },
  {
    matcher: '/store/mercadopago/installments',
    method: 'GET',
    middlewares: [
      validateAndTransformQuery(GetStoreMercadopagoInstallmentsParams, {
        isList: false,
        defaults: [],
        defaultLimit: 50,
      }),
    ],
  },
];
