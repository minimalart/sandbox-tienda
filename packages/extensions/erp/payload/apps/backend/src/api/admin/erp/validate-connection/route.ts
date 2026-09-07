import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';
import { ERP_MODULE } from '../../../../modules/erp';
import type ErpModuleService from '../../../../modules/erp/service';
import { getErpAdapter } from '../../../../modules/erp/adapters/registry';
import type { ValidateConnectionInput } from '../validators';

/**
 * POST /admin/erp/validate-connection — prueba las credenciales contra el
 * adapter. Si vienen credenciales en el body se validan SIN persistir
 * (dry-run pre-guardado); si no, se usan las guardadas y el resultado queda
 * registrado en la config (`last_validated_at/_ok/_error`).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const body = (req.validatedBody ?? {}) as ValidateConnectionInput;

  const config = await service.getConfig();
  const provider = body.provider ?? config?.provider;
  if (!provider) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'No hay provider para validar: guardá la configuración primero o indicá uno.'
    );
  }
  const adapter = getErpAdapter(provider);

  const usingStored = !(body.credentials && Object.keys(body.credentials).length > 0);
  const credentials = usingStored
    ? config
      ? service.getDecryptedCredentials(config)
      : null
    : body.credentials!;

  let ok = false;
  let message: string | null = null;
  if (!credentials || Object.keys(credentials).length === 0) {
    message = 'No hay credenciales para validar.';
  } else {
    try {
      const result = await adapter.validateCredentials({
        credentials,
        settings: (config?.settings ?? {}) as Record<string, unknown>,
        countryCode: config?.country_code ?? 'AR',
        logger,
      });
      ok = result.ok;
      message = result.message ?? null;
    } catch (error) {
      ok = false;
      message = error instanceof Error ? error.message : String(error);
    }
  }

  // Solo persiste cuando validó las credenciales GUARDADAS del provider configurado.
  const persisted = usingStored && Boolean(config) && provider === config!.provider;
  if (persisted) {
    await service.updateErpConfigs({
      id: config!.id,
      last_validated_at: new Date(),
      last_validation_ok: ok,
      last_validation_error: ok ? null : message,
    });
  }

  res.status(200).json({ ok, message, persisted, validated_at: new Date().toISOString() });
}
