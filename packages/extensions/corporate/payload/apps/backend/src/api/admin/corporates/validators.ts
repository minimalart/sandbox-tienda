import { z } from 'zod';

const ruleConfig = z.record(z.string(), z.unknown());

export const PostCreateCorporate = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  legal_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  email_domain: z.string().optional().nullable(),
  status: z.enum(['pending', 'active', 'suspended', 'archived']).optional(),
  owner_customer_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const PostUpdateCorporate = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().optional(),
  legal_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  email_domain: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const PostSetStatus = z.object({
  status: z.enum(['pending', 'active', 'suspended', 'archived']),
});

export const PostCreateMember = z
  .object({
    // Alta directa creando la cuenta:
    email: z.string().email().optional(),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    phone: z.string().optional(),
    password: z.string().min(8).optional(),
    // O vincular un customer existente:
    customer_id: z.string().optional(),
    role: z.enum(['owner', 'admin', 'buyer', 'viewer']).optional(),
    status: z.enum(['invited', 'active', 'disabled']).optional(),
  })
  .refine((d) => !!d.customer_id || (!!d.email && !!d.password), {
    message: 'Indicá un customer_id, o email y contraseña para crear la cuenta.',
  });

export const PostUpdateMember = z.object({
  role: z.enum(['owner', 'admin', 'buyer', 'viewer']).optional(),
  status: z.enum(['invited', 'active', 'disabled']).optional(),
});

const ruleType = z.enum([
  'minimum_order_amount',
  'maximum_order_amount',
  'allowed_shipping_methods',
  'allowed_payment_methods',
  'require_approval',
  'custom_catalog',
  'custom_pricing',
]);

export const PostCreateRule = z.object({
  type: ruleType,
  config: ruleConfig,
  enabled: z.boolean().optional(),
});

export const PostUpdateRule = z.object({
  type: ruleType.optional(),
  config: ruleConfig.optional(),
  enabled: z.boolean().optional(),
});

export const PostCustomerGroup = z.object({
  action: z.enum(['link', 'unlink']),
  customer_group_id: z.string().optional(),
});
