import { z } from 'zod';

const imageUrl = z.string().min(1).max(2048).refine((value) => {
  if (/^\/(?!\/)/.test(value) && !value.includes('\\')) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}, 'La imagen debe usar una URL HTTP(S) o una ruta interna.');

const destinationUrl = z.string().min(1).max(2048).refine((value) => {
  if (/^\/(?!\/)/.test(value) && !value.includes('\\')) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}, 'El destino debe usar HTTP(S) o una ruta interna.');

export const GiftCardDesignInput = z.object({
  public_id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,119}$/),
  name: z.string().trim().min(1).max(120),
  occasion: z.enum(['general', 'birthday', 'thanks', 'congratulations', 'holidays', 'brand']),
  desktop_image_url: imageUrl,
  mobile_image_url: imageUrl.nullish(),
  text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  content_position: z.enum([
    'top_left', 'top_center', 'top_right', 'center_left', 'center', 'center_right',
    'bottom_left', 'bottom_center', 'bottom_right',
  ]),
  active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(10_000).default(0),
}).strict();

export const GiftCardDesignUpdate = GiftCardDesignInput.partial().omit({ public_id: true });
export const GiftCardDeliveryUpdate = z.object({ recipient_email: z.string().email().max(254) }).strict();
export const GiftCardSettingsUpdate = z.object({
  enabled: z.boolean().optional(),
  timezone: z.string().max(100).optional(),
  morning_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  afternoon_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  evening_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  schedule_horizon_days: z.number().int().min(1).max(365).optional(),
  default_expiry_days: z.number().int().min(1).max(3650).nullable().optional(),
  default_design_id: z.string().min(1).max(120).optional(),
  retry_delays_minutes: z.array(z.number().int().min(1).max(43_200)).length(5).optional(),
  fallback_to_buyer: z.boolean().optional(),
  balance_reminder_days: z.number().int().min(1).max(3650).nullable().optional(),
  expiring_notice_days: z.number().int().min(1).max(365).nullable().optional(),
  legal_text: z.string().max(5000).nullable().optional(),
  terms_url: destinationUrl.nullable().optional(),
  merchandising_url: destinationUrl.nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.timezone) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: value.timezone }).format(new Date()); }
    catch { context.addIssue({ code: z.ZodIssueCode.custom, path: ['timezone'], message: 'Zona horaria inválida.' }); }
  }
});
