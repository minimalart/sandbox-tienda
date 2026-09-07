import { z } from 'zod';

export const PostRegisterCompany = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  legal_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const PutCompanyMe = z.object({
  name: z.string().min(2).optional(),
  legal_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  default_billing_profile_id: z.string().optional().nullable(),
  // Facturación y direcciones de la empresa se guardan en metadata (sin migraciones),
  // igual que en el backoffice.
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const PostInvite = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'buyer', 'viewer']).optional(),
});

export const PostAccept = z.object({ token: z.string().min(1) });

export const PutMember = z.object({
  role: z.enum(['admin', 'buyer', 'viewer']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});
