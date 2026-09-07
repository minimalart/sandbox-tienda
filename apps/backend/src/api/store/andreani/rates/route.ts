/**
 * Store API — Andreani rate calculation (cotizacion).
 *
 * POST /store/andreani/rates
 * Body: { destination_postal_code, packages: [{ weight, length?, width?, height?, declared_value }], service_types? }
 *
 * Uses env credentials via the configured Andreani fulfillment provider.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { getAndreaniClient } from '../../../../modules/andreani-fulfillment/get-client';
// Configuración de la INSTANCIA resuelta por `app-settings` (fila global → env →
// default), no `loadAndreaniOptionsFromEnv()`: esta ruta informaba el CP de origen
// del `.env` mientras el resto del módulo ya usaba el de la base.
import { getAndreaniSettings } from '../../../../modules/andreani-fulfillment/settings';
import type { AndreaniServiceType } from '../../../../modules/andreani-fulfillment/types';

interface StoreRateRequest {
  destination_postal_code?: string;
  origin_postal_code?: string;
  packages?: Array<{
    weight: number;
    length?: number;
    width?: number;
    height?: number;
    declared_value: number;
  }>;
  service_types?: AndreaniServiceType[];
}

const ALL_SERVICE_TYPES: AndreaniServiceType[] = [
  'Domicilio',
  'Sucursal',
  'PuntoDeTercero',
];

const DISPLAY_NAMES: Record<AndreaniServiceType, string> = {
  Domicilio: 'Envío a domicilio',
  Sucursal: 'Retiro en sucursal Andreani',
  PuntoDeTercero: 'Retiro en punto de tercero',
};

const sendError = (
  res: MedusaResponse,
  status: number,
  payload: { code: string; message: string }
) => res.status(status).json({ error: payload, timestamp: new Date().toISOString() });

export async function POST(
  req: MedusaRequest<StoreRateRequest>,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  const {
    destination_postal_code,
    origin_postal_code,
    packages,
    service_types = ALL_SERVICE_TYPES,
  } = req.body;

  if (!destination_postal_code) {
    sendError(res, 400, {
      code: 'MISSING_DESTINATION',
      message: 'Destination postal code is required',
    });
    return;
  }

  if (!/^\d{4}$/.test(destination_postal_code)) {
    sendError(res, 400, {
      code: 'INVALID_POSTAL_CODE',
      message: 'Invalid postal code format (expected 4 digits)',
    });
    return;
  }

  if (!packages || !Array.isArray(packages) || packages.length === 0) {
    sendError(res, 400, {
      code: 'MISSING_PACKAGES',
      message: 'At least one package is required',
    });
    return;
  }

  try {
    // Build straight from env instead of resolving the provider from req.scope
    // (unreliable in custom routes — same approach as the tracking job).
    const client = getAndreaniClient(logger);

    const bultos = packages.map((pkg) => ({
      valorDeclarado: pkg.declared_value,
      volumen:
        pkg.length && pkg.width && pkg.height
          ? pkg.length * pkg.width * pkg.height
          : 1000,
      kilos: pkg.weight,
      altoCm: pkg.height,
      largoCm: pkg.length,
      anchoCm: pkg.width,
    }));

    const rateResponse = await client.getTarifas({
      cpDestino: destination_postal_code,
      bultos,
    });

    if (!rateResponse.tarifas || !Array.isArray(rateResponse.tarifas)) {
      sendError(res, 503, {
        code: 'SERVICE_ERROR',
        message: 'Invalid response from shipping service',
      });
      return;
    }

    const rates = rateResponse.tarifas
      .filter((t) => service_types.includes(t.tipoServicio as AndreaniServiceType))
      .map((t) => {
        const priceExclTax = t.precio;
        const taxAmount = priceExclTax * 0.21; // 21% IVA
        return {
          service_type: t.tipoServicio,
          service_name:
            DISPLAY_NAMES[t.tipoServicio as AndreaniServiceType] ?? t.tipoServicio,
          price_excl_tax: priceExclTax,
          price_incl_tax: priceExclTax + taxAmount,
          tax_amount: taxAmount,
          currency_code: 'ARS',
          estimated_delivery_days: t.plazoEntrega,
          supports_tracking: true,
          metadata: {
            provider: 'andreani',
            service_code: t.tipoServicio.toLowerCase(),
          },
        };
      });

    res.status(200).json({
      rates,
      origin_postal_code:
        origin_postal_code || getAndreaniSettings().options.origin.postalCode,
      destination_postal_code,
      calculation_timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Store API: Andreani rate calculation failed: ${message}`);
    sendError(res, 503, {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Andreani shipping is currently unavailable',
    });
  }
}
