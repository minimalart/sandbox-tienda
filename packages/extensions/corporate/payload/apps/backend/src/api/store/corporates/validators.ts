import { z } from 'zod';

export const PostRegisterCorporate = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  legal_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  email_domain: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const PutCorporateMe = z.object({
  name: z.string().min(2).optional(),
  legal_name: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
  email_domain: z.string().optional().nullable(),
});

export const PostInvite = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'buyer', 'viewer']).optional(),
});

export const PostAccept = z.object({
  token: z.string().min(1),
});

export const PutMember = z.object({
  role: z.enum(['admin', 'buyer', 'viewer']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
});
