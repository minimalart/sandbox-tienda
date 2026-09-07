import { z } from 'zod';

const condition = z.object({
  field: z.string().min(1),
  operator: z.enum(['gte', 'lte', 'eq', 'neq', 'in', 'contains']),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number()])),
  ]),
  days: z.number().int().positive().optional(),
});

export const PostCreateDynamicGroup = z.object({
  name: z.string().min(2),
  handle: z.string().optional(),
  description: z.string().optional().nullable(),
  match: z.enum(['all', 'any']).optional(),
  conditions: z.array(condition).default([]),
  update_mode: z.enum(['realtime', 'manual']).optional(),
  is_active: z.boolean().optional(),
});

export const PostUpdateDynamicGroup = z.object({
  name: z.string().min(2).optional(),
  handle: z.string().optional(),
  description: z.string().optional().nullable(),
  match: z.enum(['all', 'any']).optional(),
  conditions: z.array(condition).optional(),
  update_mode: z.enum(['realtime', 'manual']).optional(),
  is_active: z.boolean().optional(),
});

export type PostCreateDynamicGroupInput = z.infer<typeof PostCreateDynamicGroup>;
export type PostUpdateDynamicGroupInput = z.infer<typeof PostUpdateDynamicGroup>;
