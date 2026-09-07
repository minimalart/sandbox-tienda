import type {
  FieldErrors,
  FieldValues,
  Resolver,
  ResolverResult,
} from "react-hook-form";

type ZodIssue = {
  path: (string | number)[];
  message: string;
  code?: string;
};
type ZodResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: ZodIssue[] } };
type ZodLikeSchema<T> = {
  safeParseAsync?: (value: unknown) => Promise<ZodResult<T>>;
  safeParse?: (value: unknown) => ZodResult<T>;
};

/**
 * Resolver de react-hook-form compatible con Zod v4.
 *
 * `@hookform/resolvers@3` está orientado a Zod v3 y su mapeo de errores no es
 * confiable con los issues de Zod v4 (formato nuevo con `origin`): algunos
 * errores de validación (p. ej. longitud mínima) no se reflejaban en el form,
 * así que el usuario no veía por qué no se enviaba. Esta implementación lee
 * `error.issues` de Zod v4 y arma el árbol de errores que espera RHF, soportando
 * paths anidados. Misma firma que antes: no hay que tocar ningún form.
 */
export function zodResolver<TFieldValues extends FieldValues = FieldValues>(
  schema: unknown,
): Resolver<TFieldValues> {
  return async (values) => {
    const s = schema as ZodLikeSchema<TFieldValues>;
    const result = s.safeParseAsync
      ? await s.safeParseAsync(values)
      : (s.safeParse?.(values) as ZodResult<TFieldValues>);

    if (result.success) {
      return { values: result.data, errors: {} } as ResolverResult<TFieldValues>;
    }

    const errors: FieldErrors<TFieldValues> = {};
    for (const issue of result.error.issues) {
      if (!issue.path?.length) continue;
      // biome-ignore lint/suspicious/noExplicitAny: árbol dinámico de errores RHF
      let cursor = errors as Record<string | number, any>;
      issue.path.forEach((key, index) => {
        const isLast = index === issue.path.length - 1;
        if (isLast) {
          if (!cursor[key]) {
            cursor[key] = {
              type: issue.code ?? "validation",
              message: issue.message,
            };
          }
        } else {
          cursor[key] = cursor[key] ?? {};
          cursor = cursor[key];
        }
      });
    }

    return { values: {}, errors } as ResolverResult<TFieldValues>;
  };
}
