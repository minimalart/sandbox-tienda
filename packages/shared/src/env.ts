import { z } from 'zod';

/**
 * Validates an env object against a Zod schema.
 * Throws with a readable message listing every missing/invalid variable.
 *
 * Usage:
 *   const env = validateEnv(schema, process.env);
 */
export function validateEnv<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  source: Record<string, string | undefined> = process.env
): z.infer<z.ZodObject<T>> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
