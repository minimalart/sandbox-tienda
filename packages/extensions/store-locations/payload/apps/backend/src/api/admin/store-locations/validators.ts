import { z } from 'zod';

const emptyStringToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const optionalText = z.preprocess(emptyStringToUndefined, z.string().optional().nullable());

const optionalEmail = z.preprocess(
  emptyStringToUndefined,
  z.string().email('Invalid email').optional().nullable(),
);

export const storeTypeSchema = z.enum(['distribution_center', 'wholesale', 'point_of_sale']);

/**
 * business_hours shape:
 * Record<day, { closed: boolean; is24Hours: boolean; slots: { open: string; close: string }[] }>
 */
const businessHoursSchema = z.record(
  z.string(),
  z.object({
    closed: z.boolean(),
    is24Hours: z.boolean(),
    slots: z.array(z.object({ open: z.string(), close: z.string() })),
    // Optional per-day delivery cap (only used by delivery schedules).
    maxPerDay: z.number().int().min(0).optional().nullable(),
  }),
);

const imagesSchema = z
  .array(z.string().url('Image must be a valid URL'))
  .max(3, 'A maximum of 3 images is allowed');

/**
 * Public visibility scope: sales channel ids the branch is shown in.
 * null/[] = visible in every channel. Not the operational channel ownership
 * (that's `sales_channels` in PostAdminBranchConfig).
 */
const salesChannelIdsSchema = z.array(z.string()).nullish();

const deliveryPinSchema = z
  .number()
  .int()
  .min(100000, 'PIN must be a 6-digit number')
  .max(999999, 'PIN must be a 6-digit number');

export const PostAdminCreateStoreLocation = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  store_type: storeTypeSchema,
  province: z.string().min(1, 'Province is required').trim(),
  city: z.string().min(1, 'City is required').trim(),
  street: z.string().min(1, 'Street is required').trim(),
  code: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: optionalEmail,
  website: optionalText,
  instagram: optionalText,
  facebook: optionalText,
  tiktok: optionalText,
  linkedin: optionalText,
  business_hours: businessHoursSchema.optional().nullable(),
  images: imagesSchema.optional().nullable(),
  is_visible: z.boolean().optional(),
  sales_channel_ids: salesChannelIdsSchema,
  active: z.boolean().optional(),
  delivers_kits: z.boolean().optional(),
  delivery_pin: deliveryPinSchema.optional().nullable(),
  lat: optionalText,
  lng: optionalText,
});

export const PostAdminUpdateStoreLocation = z.object({
  name: z.preprocess(emptyStringToUndefined, z.string().min(1).trim().optional()),
  store_type: storeTypeSchema.optional(),
  province: z.preprocess(emptyStringToUndefined, z.string().min(1).trim().optional()),
  city: z.preprocess(emptyStringToUndefined, z.string().min(1).trim().optional()),
  street: z.preprocess(emptyStringToUndefined, z.string().min(1).trim().optional()),
  code: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: optionalEmail,
  website: optionalText,
  instagram: optionalText,
  facebook: optionalText,
  tiktok: optionalText,
  linkedin: optionalText,
  business_hours: businessHoursSchema.optional().nullable(),
  images: imagesSchema.optional().nullable(),
  is_visible: z.boolean().optional(),
  sales_channel_ids: salesChannelIdsSchema,
  active: z.boolean().optional(),
  delivers_kits: z.boolean().optional(),
  delivery_pin: deliveryPinSchema.optional().nullable(),
  lat: optionalText,
  lng: optionalText,
});

export const channelTypeSchema = z.enum(['b2c', 'b2b', 'in_person']);

// ── Branch coverage (polygons) ──────────────────────────────────────────────

const coordToString = z.union([z.number(), z.string()]).transform((v) => String(v));

/** Polygon as stored: `[{ x: lng, y: lat }]` (strings). Min 3 vertices. */
const polygonSchema = z
  .array(z.object({ x: coordToString, y: coordToString }))
  .min(3, 'A polygon needs at least 3 points');

export const PostAdminCreateCoverage = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  polygon: polygonSchema,
  priority: z.number().int().optional(),
  active: z.boolean().optional(),
});

export const PostAdminUpdateCoverage = z.object({
  name: z.preprocess(emptyStringToUndefined, z.string().min(1).trim().optional()),
  polygon: polygonSchema.optional(),
  priority: z.number().int().optional(),
  active: z.boolean().optional(),
});

// ── Branch delivery settings ────────────────────────────────────────────────

/** Upsert of a branch's delivery settings. `schedules` reuses the BusinessHours shape. */
export const PostAdminBranchDelivery = z.object({
  timezone: optionalText,
  lead_time_hours: z.number().int().min(0).optional().nullable(),
  active: z.boolean().optional(),
  schedules: businessHoursSchema.optional().nullable(),
});

/**
 * Branch commercial wiring: inventory location + owned sales channels (with
 * channel_type). Consumed by POST /admin/store-locations/:id/branch-config,
 * which runs the provision-branch workflow.
 */
export const PostAdminBranchConfig = z.object({
  active: z.boolean().optional(),
  stock_location_id: z.preprocess(emptyStringToUndefined, z.string().optional().nullable()),
  sales_channels: z
    .array(
      z.object({
        id: z.string().min(1),
        channel_type: channelTypeSchema,
      }),
    )
    .optional(),
});
