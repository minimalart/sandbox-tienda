import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { ERP_MODULE } from '../../../../../modules/erp';
import type ErpModuleService from '../../../../../modules/erp/service';
import { getErpAdapter } from '../../../../../modules/erp/adapters/registry';
import { ERP_CONFIG_LOOKUP_TARGETS } from '../../../../../modules/erp/adapters/config-lookups';

/**
 * GET /admin/erp/config/lookups — opciones válidas de los campos de
 * configuración cuyo valor es un código de la cuenta del ERP.
 *
 * Existe porque la pantalla de configuración pide trece códigos en inputs de
 * TEXTO LIBRE, seis de los cuales el ERP sabe listar, y hasta ahora nadie los
 * consultaba: el operador tenía que pedirle al cliente códigos que estaban a una
 * llamada de distancia. Alimenta los selectores de esa pantalla.
 *
 * ─── Por qué NUNCA responde con error ────────────────────────────────────────
 *
 * Devuelve 200 en todos los casos previsibles —provider sin listados, sin
 * credenciales, listado caído— con la razón adentro del cuerpo. Un 4xx/5xx acá
 * dejaría la pantalla de configuración inutilizable, y esa pantalla es
 * justamente desde donde se arregla la credencial que falta. El campo degrada a
 * texto libre, que es exactamente el estado actual: la peor respuesta posible es
 * la de hoy, no un error.
 *
 * `supported: false` y `options` vacío no son lo mismo, y la UI los distingue:
 * el primero significa "este ERP no tiene listados" (mostrar input, sin aviso);
 * el segundo, "los tiene y no se pudieron leer" (mostrar input y el motivo).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);

  const config = await service.getConfig();
  const base = { targets: ERP_CONFIG_LOOKUP_TARGETS, options: {}, errors: {} };

  if (!config?.provider) {
    res.status(200).json({
      ...base,
      supported: false,
      reason: 'Todavía no hay un ERP configurado.',
    });
    return;
  }

  const adapter = getErpAdapter(config.provider);
  if (!adapter.getCapabilities().config_lookups || !adapter.fetchConfigLookups) {
    res.status(200).json({
      ...base,
      supported: false,
      provider: config.provider,
      reason: `${config.provider} no expone listados de sus códigos de configuración.`,
    });
    return;
  }

  const credentials = service.getDecryptedCredentials(config);
  if (!credentials || Object.keys(credentials).length === 0) {
    res.status(200).json({
      ...base,
      supported: true,
      provider: config.provider,
      // El caso frecuente después de rotar el JWT_SECRET: la fila existe y el
      // blob ya no se puede descifrar. Ver `modules/erp/crypto.ts`.
      reason: 'No hay credenciales guardadas para consultar los listados.',
    });
    return;
  }

  const { options, errors } = await adapter.fetchConfigLookups({
    credentials,
    settings: (config.settings ?? {}) as Record<string, unknown>,
    countryCode: config.country_code ?? 'AR',
    logger,
  });

  res.status(200).json({
    ...base,
    supported: true,
    provider: config.provider,
    options,
    errors,
    fetched_at: new Date().toISOString(),
  });
}
