/**
 * Store API — cotización de Correo Argentino (MiCorreo `POST /rates`).
 *
 * POST /store/correo-argentino/rates
 * Body: {
 *   destination_postal_code,          // 4 dígitos o CPA
 *   origin_postal_code?,              // default: CORREO_ARGENTINO_ORIGIN_POSTAL_CODE
 *   parcel: { weight_g, height, width, length },
 *   delivered_type?                   // "D" (domicilio) | "S" (sucursal); omitir → las dos
 * }
 *
 * Este endpoint es también el **health check de la cotización**: si devuelve
 * `outcome: "account_not_activated"`, la cuenta no está habilitada
 * comercialmente y NO hay nada que arreglar en el código. Correrlo antes de
 * prender `CORREO_ARGENTINO_SEED_SHIPPING_OPTIONS`.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { getCorreoMiCorreoClient } from '../../../../modules/correo-argentino-fulfillment/get-client';
import { getCorreoSettings } from '../../../../modules/correo-argentino-fulfillment/settings';
import { extractErrorMessage } from '../../../../modules/correo-argentino-fulfillment/utils/errors';
import type { CorreoDeliveredType } from '../../../../modules/correo-argentino-fulfillment/types';
import { parseStorePostalCode, sendCorreoStoreError } from '../_shared';

interface StoreCorreoRateRequest {
  destination_postal_code?: string;
  origin_postal_code?: string;
  parcel?: {
    weight_g?: number;
    height?: number;
    width?: number;
    length?: number;
  };
  delivered_type?: string;
}

const DISPLAY_NAMES: Record<string, string> = {
  D: 'Envío a domicilio',
  S: 'Retiro en sucursal de Correo Argentino',
};

function positive(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function POST(
  req: MedusaRequest<StoreCorreoRateRequest>,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const body = req.body ?? {};

  // `parseStorePostalCode` y NO `normalizePostalCode` del módulo: ese último es
  // un normalizador y devuelve el input tal cual cuando no matchea
  // (`"abc"` → `"ABC"`), así que un `if (!...)` NUNCA rechazaría basura y el 400
  // lo terminaría tirando MiCorreo, con un mensaje que no dice nada.
  const destination = parseStorePostalCode(body.destination_postal_code);
  if (!destination) {
    sendCorreoStoreError(res, 400, {
      code: 'INVALID_DESTINATION',
      message:
        'destination_postal_code es requerido (4 dígitos o CPA, ej. "1414" o "C1414AAF")',
    });
    return;
  }

  const options = getCorreoSettings();
  const origin =
    parseStorePostalCode(body.origin_postal_code) ??
    parseStorePostalCode(options.origin.postalCode);
  if (!origin) {
    sendCorreoStoreError(res, 500, {
      code: 'ORIGIN_NOT_CONFIGURED',
      message: 'CORREO_ARGENTINO_ORIGIN_POSTAL_CODE no está configurado',
    });
    return;
  }

  const parcel = body.parcel ?? {};
  const weight = positive(parcel.weight_g);
  const height = positive(parcel.height);
  const width = positive(parcel.width);
  const length = positive(parcel.length);

  if (!weight || !height || !width || !length) {
    sendCorreoStoreError(res, 400, {
      code: 'INVALID_PARCEL',
      message:
        'parcel requiere weight_g, height, width y length, todos positivos (peso en GRAMOS, medidas en cm)',
    });
    return;
  }

  const deliveredTypeRaw = String(body.delivered_type ?? '').toUpperCase();
  const deliveredType: CorreoDeliveredType | undefined =
    deliveredTypeRaw === 'D' || deliveredTypeRaw === 'S'
      ? deliveredTypeRaw
      : undefined;

  try {
    // Cliente desde ENV, NO resuelto del `req.scope`: la resolución del provider
    // desde el request scope no es confiable en rutas custom.
    const client = getCorreoMiCorreoClient(logger);

    const result = await client.getRates({
      postalCodeOrigin: origin,
      postalCodeDestination: destination,
      ...(deliveredType ? { deliveredType } : {}),
      dimensions: { weight, height, width, length },
    });

    res.status(200).json({
      // `outcome` se expone a propósito: es la diferencia entre "no hay tarifa
      // para esta ruta" y "la cuenta no está activada", que desde una lista
      // vacía son indistinguibles.
      outcome: result.outcome,
      rates: result.rates.map((rate) => ({
        service_type: rate.productType,
        delivered_type: rate.deliveredType,
        service_name:
          rate.productName ??
          DISPLAY_NAMES[String(rate.deliveredType ?? '').toUpperCase()] ??
          'Correo Argentino',
        // MiCorreo devuelve el precio final al consumidor, IVA incluido.
        price_incl_tax: rate.price,
        currency_code: 'ARS',
        delivery_time_min: rate.deliveryTimeMin ?? null,
        delivery_time_max: rate.deliveryTimeMax ?? null,
        supports_tracking: true,
      })),
      origin_postal_code: origin,
      destination_postal_code: destination,
      valid_to: result.validTo ?? null,
      calculation_timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    logger.error(`[correo-rates] Cotización falló: ${message}`);

    // Sin credenciales de MiCorreo el cliente tira antes de salir a la red. Es
    // un 500 de configuración, no un 503 del carrier: distinguirlo evita que
    // alguien reintente contra una API que nunca se llamó.
    const misconfigured = /credentials are not configured|customerId is required/i.test(
      message
    );
    sendCorreoStoreError(res, misconfigured ? 500 : 503, {
      code: misconfigured ? 'MICORREO_NOT_CONFIGURED' : 'SERVICE_UNAVAILABLE',
      message: misconfigured
        ? 'Faltan credenciales de MiCorreo (CORREO_ARGENTINO_MICORREO_USER / _PASS / _CUSTOMER_ID)'
        : 'La cotización de Correo Argentino no está disponible',
    });
  }
}
