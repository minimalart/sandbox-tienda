import type { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { ERP_MODULE } from '../../../../modules/erp';
import type ErpModuleService from '../../../../modules/erp/service';
import type { ErpConfigRow } from '../../../../modules/erp/service';
import {
  getErpAdapter,
  getProviderCatalogEntry,
  PROVIDER_CATALOG,
} from '../../../../modules/erp/adapters/registry';
import { COUNTRY_CATALOG, getCountryLayer } from '../../../../modules/erp/countries/registry';
import { mergeErpSettings } from '../../../../modules/erp/settings-merge';
import {
  activeDepositoMappings,
  findDepositoMapping,
  resolveSalesTrigger,
} from '../../../../modules/erp/billing-deposito';
import type { ErpConfigSettings } from '../../../../modules/erp/types';
import type { UpsertErpConfigInput } from '../validators';

/** Capabilities del provider, tolerante a configs con providers dados de baja (ej. mock). */
function safeCapabilities(provider: string) {
  try {
    return getErpAdapter(provider).getCapabilities();
  } catch {
    return null;
  }
}

/**
 * Serializa la config a la respuesta pública del admin: NUNCA devuelve el blob
 * de credenciales ni sus valores — solo `credentials_set` + nombres de claves.
 */
function toResponse(service: ErpModuleService, config: ErpConfigRow | null) {
  const credentials = config ? service.getDecryptedCredentials(config) : null;
  return {
    config: config
      ? {
          id: config.id,
          provider: config.provider,
          country_code: config.country_code,
          enabled: config.enabled,
          stock_sync_enabled: config.stock_sync_enabled,
          catalog_sync_enabled: config.catalog_sync_enabled,
          sales_notify_enabled: config.sales_notify_enabled,
          settings: config.settings ?? {},
          credentials_set: Boolean(credentials),
          credential_keys: credentials ? Object.keys(credentials) : [],
          last_validated_at: config.last_validated_at ?? null,
          last_validation_ok: config.last_validation_ok ?? null,
          last_validation_error: config.last_validation_error ?? null,
        }
      : null,
    providers: PROVIDER_CATALOG,
    countries: COUNTRY_CATALOG,
    capabilities: config ? safeCapabilities(config.provider) : null,
  };
}

/** GET /admin/erp/config — config actual + catálogos para la UI. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getConfig();
  res.status(200).json(toResponse(service, config));
}

/**
 * POST /admin/erp/config — upsert de la config única. Credenciales write-only
 * (omitidas/vacías preservan las guardadas). No se puede activar la
 * integración sin credenciales guardadas.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const body = req.validatedBody as UpsertErpConfigInput;
  const existing = await service.getConfig();

  const provider =
    body.provider ?? existing?.provider ?? PROVIDER_CATALOG.find((p) => p.available)!.id;
  const entry = getProviderCatalogEntry(provider);
  if (!entry) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `ERP provider desconocido: ${provider}`);
  }
  if (!entry.available) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${entry.label} todavía no está disponible como provider activo.`
    );
  }

  const countryCode = (body.country_code ?? existing?.country_code ?? 'AR').toUpperCase();
  getCountryLayer(countryCode); // lanza INVALID_DATA si no está soportado

  const incomingCredentials =
    body.credentials && Object.keys(body.credentials).length > 0 ? body.credentials : undefined;
  const willEnable = body.enabled ?? existing?.enabled ?? false;
  const willHaveCredentials = Boolean(incomingCredentials) || Boolean(existing?.credentials_enc);
  if (willEnable && !willHaveCredentials) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'No se puede activar la integración sin credenciales guardadas.'
    );
  }

  // Prender el espejo de categorías programa una retro-atribución: sin esto, un
  // delta de tres filas dejaría el catálogo entero sin categorizar hasta el
  // próximo barrido completo.
  const settings = body.settings;
  const wasCategoriesSyncOn = existing?.settings?.catalog_sync?.categories_sync ?? false;
  const willCategoriesSyncBeOn = settings?.catalog_sync?.categories_sync ?? wasCategoriesSyncOn;
  if (!wasCategoriesSyncOn && willCategoriesSyncBeOn && settings?.catalog_sync) {
    settings.catalog_sync.categories_backfill_pending = true;
  }

  // El trigger por fulfillment necesita un depósito facturador MAPEADO: es la
  // stock location contra la que el gate valida el fulfillment. Sin eso el gate
  // rechazaría todos los despachos, y el operador vería un 400 sin pista de por
  // qué. Se valida sobre los settings YA MERGEADOS porque la UI puede mandar
  // sólo el bloque `sales_notify` y dejar el `deposito_map` guardado intacto.
  const effectiveSettings = mergeErpSettings(
    (existing?.settings ?? null) as Record<string, unknown> | null,
    (settings ?? {}) as Record<string, unknown>
  ) as ErpConfigSettings;
  const willNotifySales = body.sales_notify_enabled ?? existing?.sales_notify_enabled ?? false;
  if (willNotifySales && resolveSalesTrigger(effectiveSettings) === 'fulfillment_created') {
    const billingDeposito = effectiveSettings.sales_notify?.billing_deposito ?? null;
    if (!billingDeposito) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Para notificar la venta al crear el fulfillment hay que elegir el depósito facturador.'
      );
    }
    if (!findDepositoMapping(effectiveSettings, billingDeposito)) {
      const known = activeDepositoMappings(effectiveSettings)
        .map((row) => row.deposito)
        .join(', ');
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `El depósito facturador "${billingDeposito}" no está en el mapeo de depósitos${
          known ? ` (mapeados: ${known})` : ' (el mapeo está vacío)'
        }. Cargalo en Depósitos del ERP → stock locations.`
      );
    }
  }

  let config: ErpConfigRow;
  try {
    config = await service.upsertConfig(
      {
        provider,
        country_code: countryCode,
        enabled: body.enabled,
        stock_sync_enabled: body.stock_sync_enabled,
        catalog_sync_enabled: body.catalog_sync_enabled,
        sales_notify_enabled: body.sales_notify_enabled,
        settings,
      },
      {
        credentials: incomingCredentials,
        removeCredentialKeys: body.credentials_remove,
        actorId: req.auth_context?.actor_id ?? null,
      }
    );
  } catch (error) {
    // Sin esto el cliente ve "An unknown error occurred" y el motivo queda sólo
    // en los logs del server — inútil para quien está configurando, y ciego para
    // quien configura por API sin acceso a los logs (pasó exactamente eso).
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[erp] config upsert falló:', error instanceof Error ? error.stack : error);
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `No se pudo guardar la configuración del ERP: ${detail}`
    );
  }

  res.status(200).json(toResponse(service, config));
}
