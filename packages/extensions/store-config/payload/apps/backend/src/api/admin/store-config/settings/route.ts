import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import StoreConfigModuleService, {
  STORE_SETTING_KEYS,
} from '../../../../modules/store-config/service';

/**
 * La tienda cuyos toggles se están viendo o editando.
 *
 * `null` = la fila GLOBAL, que es el fallback de toda tienda que no defina el suyo.
 */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

/**
 * GET /admin/store-config/settings — current store toggles.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const siteId = await siteOf(req);
    const [
      multiBranch,
      requireCoverage,
      branchGatePrompt,
      barcodeScanner,
      shopByLook,
      pdfCatalog,
      cookieBanner,
    ] = await Promise.all([
      service.getBooleanSetting(STORE_SETTING_KEYS.MULTI_BRANCH_ENABLED, false, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.REQUIRE_BRANCH_COVERAGE, false, siteId),
      // OJO: fallback `true`, único de esta pantalla. Ver el comentario de la clave
      // en `store-config/service.ts` — una tienda sin fila propia SÍ ve la barra.
      service.getBooleanSetting(STORE_SETTING_KEYS.BRANCH_GATE_PROMPT_ENABLED, true, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.BARCODE_SCANNER_ENABLED, false, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.SHOP_BY_LOOK_ENABLED, false, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.PDF_CATALOG_ENABLED, false, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.COOKIE_BANNER_ENABLED, false, siteId),
    ]);
    return res.status(200).json({
      settings: {
        multi_branch_enabled: multiBranch,
        require_branch_coverage: requireCoverage,
        branch_gate_prompt_enabled: branchGatePrompt,
        barcode_scanner_enabled: barcodeScanner,
        shop_by_look_enabled: shopByLook,
        pdf_catalog_enabled: pdfCatalog,
        cookie_banner_enabled: cookieBanner,
      },
    });
  } catch (error) {
    console.error('[Admin StoreConfig] Error reading settings:', error);
    return res.status(500).json({ message: 'Error reading settings' });
  }
}

const UpdateSettingsSchema = z.object({
  multi_branch_enabled: z.boolean().optional(),
  require_branch_coverage: z.boolean().optional(),
  branch_gate_prompt_enabled: z.boolean().optional(),
  barcode_scanner_enabled: z.boolean().optional(),
  shop_by_look_enabled: z.boolean().optional(),
  pdf_catalog_enabled: z.boolean().optional(),
  cookie_banner_enabled: z.boolean().optional(),
});

/**
 * POST /admin/store-config/settings — upsert store toggles.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = UpdateSettingsSchema.parse(req.body);
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const siteId = await siteOf(req);

    if (body.multi_branch_enabled !== undefined) {
      await service.upsertSetting(
        STORE_SETTING_KEYS.MULTI_BRANCH_ENABLED,
        body.multi_branch_enabled,
        siteId,
      );
    }
    if (body.require_branch_coverage !== undefined) {
      await service.upsertSetting(
        STORE_SETTING_KEYS.REQUIRE_BRANCH_COVERAGE,
        body.require_branch_coverage,
        siteId,
      );
    }
    if (body.branch_gate_prompt_enabled !== undefined) {
      await service.upsertSetting(
        STORE_SETTING_KEYS.BRANCH_GATE_PROMPT_ENABLED,
        body.branch_gate_prompt_enabled,
        siteId,
      );
    }
    if (body.barcode_scanner_enabled !== undefined) {
      await service.upsertSetting(
        STORE_SETTING_KEYS.BARCODE_SCANNER_ENABLED,
        body.barcode_scanner_enabled,
        siteId,
      );
    }
    if (body.shop_by_look_enabled !== undefined) {
      await service.upsertSetting(
        STORE_SETTING_KEYS.SHOP_BY_LOOK_ENABLED,
        body.shop_by_look_enabled,
        siteId,
      );
    }
    if (body.pdf_catalog_enabled !== undefined) {
      await service.upsertSetting(
        STORE_SETTING_KEYS.PDF_CATALOG_ENABLED,
        body.pdf_catalog_enabled,
        siteId,
      );
    }
    if (body.cookie_banner_enabled !== undefined) {
      await service.upsertSetting(
        STORE_SETTING_KEYS.COOKIE_BANNER_ENABLED,
        body.cookie_banner_enabled,
        siteId,
      );
    }

    const [
      multiBranch,
      requireCoverage,
      branchGatePrompt,
      barcodeScanner,
      shopByLook,
      pdfCatalog,
      cookieBanner,
    ] = await Promise.all([
      service.getBooleanSetting(STORE_SETTING_KEYS.MULTI_BRANCH_ENABLED, false, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.REQUIRE_BRANCH_COVERAGE, false, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.BRANCH_GATE_PROMPT_ENABLED, true, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.BARCODE_SCANNER_ENABLED, false, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.SHOP_BY_LOOK_ENABLED, false, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.PDF_CATALOG_ENABLED, false, siteId),
      service.getBooleanSetting(STORE_SETTING_KEYS.COOKIE_BANNER_ENABLED, false, siteId),
    ]);

    return res.status(200).json({
      settings: {
        multi_branch_enabled: multiBranch,
        require_branch_coverage: requireCoverage,
        branch_gate_prompt_enabled: branchGatePrompt,
        barcode_scanner_enabled: barcodeScanner,
        shop_by_look_enabled: shopByLook,
        pdf_catalog_enabled: pdfCatalog,
        cookie_banner_enabled: cookieBanner,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error updating settings';
    console.error('[Admin StoreConfig] Error updating settings:', message);
    return res.status(400).json({ message });
  }
}
