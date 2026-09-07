import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { STORE_CONFIG_MODULE } from '../../../modules/store-config';
import StoreConfigModuleService, {
  STORE_SETTING_KEYS,
} from '../../../modules/store-config/service';
import { siteIdFromPublishableKey } from '../../../lib/multistore/publishable-key';

/**
 * GET /store/store-config — public store-wide settings the storefront needs.
 * Shape: { multi_branch_enabled, require_branch_coverage, branch_gate_prompt_enabled,
 * barcode_scanner_enabled, cookie_banner_enabled, password_gate }.
 * Always 200 (safe defaults on error).
 *
 * `password_gate` publica SÓLO `{ enabled, length }`: la palabra nunca sale del
 * backend (`length` es cuántas casillas dibuja el formulario del gate).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    /**
     * `store_setting` tiene `site_id` con PRECEDENCIA (`readSetting(key, siteId)`), y
     * estos cinco se leían sin tienda: todo ajuste que un operador guardaba para SU
     * sitio quedaba escrito y no se aplicaba nunca. El de arriba de todo es el peor —
     * `password_gate` es un control de ACCESO: una tienda que se pone en modo privado
     * seguía abierta si la fila global lo tenía apagado.
     *
     * Una tienda sin fila propia sigue heredando la global, así que ninguna instalación
     * cambia de comportamiento por esto: sólo empieza a respetar lo que ya se guardó.
     */
    const siteId = await siteIdFromPublishableKey(req);
    const [
      multiBranch,
      requireCoverage,
      branchGatePrompt,
      barcodeScanner,
      cookieBanner,
      passwordGate,
    ] = await Promise.all([
      service.getBooleanSetting(STORE_SETTING_KEYS.MULTI_BRANCH_ENABLED, false, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.REQUIRE_BRANCH_COVERAGE, false, siteId),
      // Fallback `true` — ver el comentario de la clave en `store-config/service.ts`.
      service.getBooleanSetting(STORE_SETTING_KEYS.BRANCH_GATE_PROMPT_ENABLED, true, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.BARCODE_SCANNER_ENABLED, false, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.COOKIE_BANNER_ENABLED, false, siteId),
      service.getPasswordGate(siteId),
    ]);
    return res.status(200).json({
      multi_branch_enabled: multiBranch,
      require_branch_coverage: requireCoverage,
      branch_gate_prompt_enabled: branchGatePrompt,
      barcode_scanner_enabled: barcodeScanner,
      cookie_banner_enabled: cookieBanner,
      password_gate: {
        enabled: passwordGate.enabled,
        length: passwordGate.enabled ? passwordGate.password.length : 0,
      },
    });
  } catch (error) {
    console.error('[Store StoreConfig] Error reading settings:', error);
    return res.status(200).json({
      multi_branch_enabled: false,
      require_branch_coverage: false,
      // `true` en el path de error igual que en el happy path: el default de la
      // barra es "se muestra". En la práctica da igual (sin `multi_branch_enabled`
      // el storefront no la dibuja), pero un `false` acá haría creer que alguien la
      // apagó a propósito.
      branch_gate_prompt_enabled: true,
      barcode_scanner_enabled: false,
      cookie_banner_enabled: false,
      password_gate: { enabled: false, length: 0 },
    });
  }
}
