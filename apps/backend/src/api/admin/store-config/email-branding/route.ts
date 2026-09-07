import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { z } from 'zod';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { STORE_CONFIG_MODULE } from '../../../../modules/store-config';
import type StoreConfigModuleService from '../../../../modules/store-config/service';

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const emptyStringToNull = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? null : v;

/**
 * La tienda cuya configuración se está viendo o editando.
 *
 * `null` = la fila GLOBAL de la instancia, que es el fallback de toda tienda que no
 * defina el suyo. Es lo que pasa en una instalación mono-tienda y en cualquier
 * pantalla que todavía no mande la tienda activa: el comportamiento por defecto es
 * exactamente el de antes.
 */
const siteOf = async (req: MedusaRequest): Promise<string | null> => {
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' ? resolution.site.id : null;
};

/**
 * POST /admin/store-config/email-branding body validator.
 *
 * `primary_color_bg` is intentionally absent — it is derived at send time.
 */
const UpdateEmailBrandingSchema = z.object({
  primary_color: z
    .string()
    .regex(HEX_COLOR, 'primary_color must be a hex color (e.g. #2e7d32)'),
  text_color: z
    .string()
    .regex(HEX_COLOR, 'text_color must be a hex color (e.g. #111111)'),
  logo_url: z.preprocess(
    emptyStringToNull,
    z.string().url('logo_url must be a valid URL').nullable().optional(),
  ),
  cde_display_name: z.preprocess(
    emptyStringToNull,
    z.string().nullable().optional(),
  ),
  admin_notification_email: z.preprocess(
    emptyStringToNull,
    z.string().email('admin_notification_email must be a valid email').nullable().optional(),
  ),
});

/**
 * GET /admin/store-config/email-branding — current email branding settings,
 * always returned complete (merged over defaults).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const email_branding = await service.getEmailBranding(await siteOf(req));
    return res.status(200).json({ email_branding });
  } catch (error) {
    console.error('[Admin StoreConfig] Error reading email branding:', error);
    return res.status(500).json({ message: 'Error reading email branding' });
  }
}

/**
 * POST /admin/store-config/email-branding — upsert email branding settings.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const body = UpdateEmailBrandingSchema.parse(req.body);
    const service: StoreConfigModuleService = req.scope.resolve(STORE_CONFIG_MODULE);
    const email_branding = await service.upsertEmailBranding(body, await siteOf(req));
    return res.status(200).json({ email_branding });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Error updating email branding';
    console.error('[Admin StoreConfig] Error updating email branding:', message);
    return res.status(400).json({ message });
  }
}
