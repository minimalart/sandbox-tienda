import type { TintingBaseRow, TintingFormulaRow } from '../service';

/**
 * El cruce del flujo inverso (color → bases), separado de las queries.
 *
 * Tiene que devolver EXACTAMENTE las bases que `resolveTintingSelection` sabe
 * resolver para ese color: si devuelve de menos, la página de colores no ofrece
 * un artículo que el PDP sí entona; si devuelve de más, se ofrece una
 * combinación que después no cotiza. Por eso replica su precedencia — override
 * por artículo primero, `(línea, letra)` después — y por eso vive acá, donde se
 * puede probar sin base de datos.
 */

export type BaseForColor = {
  base: TintingBaseRow;
  /** La fórmula llegó por override de artículo (`base_article_code`). */
  via_override: boolean;
};

export type SelectBasesInput = {
  /** Fórmulas activas del color, YA filtradas por su carta. */
  formulas: TintingFormulaRow[];
  /** Bases activas y confirmadas de las líneas que menciona alguna fórmula. */
  basesByLine: TintingBaseRow[];
  /** Bases activas y confirmadas apuntadas por un `base_article_code`. */
  basesByOverride?: TintingBaseRow[];
};

/** Los `base_article_code` que las fórmulas fijan como override. */
export const overrideCodesOf = (formulas: TintingFormulaRow[]): string[] => [
  ...new Set(
    formulas
      .map((formula) => formula.base_article_code?.trim())
      .filter((code): code is string => Boolean(code))
  ),
];

/** Las líneas de producto que menciona alguna fórmula del color. */
export const productLinesOf = (formulas: TintingFormulaRow[]): string[] => [
  ...new Set(formulas.map((formula) => formula.product_line)),
];

const pairKey = (productLine: string, baseLetter: string | null): string =>
  `${productLine}::${baseLetter ?? ''}`;

export function selectBasesForColor(input: SelectBasesInput): BaseForColor[] {
  if (!input.formulas.length) return [];

  const pairs = new Set(
    input.formulas.map((formula) => pairKey(formula.product_line, formula.base_letter))
  );

  const result = new Map<string, BaseForColor>();
  for (const base of input.basesByLine) {
    // El cruce de la tupla se hace acá y no en el filtro de la query: filtrar por
    // dos listas sueltas (líneas y letras) admite combinaciones que ninguna
    // fórmula cubre — la misma razón por la que el flujo directo cruza en memoria.
    if (!pairs.has(pairKey(base.product_line, base.base_letter))) continue;
    result.set(base.article_code, { base, via_override: false });
  }

  // El override gana: si la fórmula está fijada para ese artículo, la base entra
  // aunque su `(línea, letra)` no tenga fórmula propia.
  for (const base of input.basesByOverride ?? []) {
    result.set(base.article_code, { base, via_override: true });
  }

  return [...result.values()].sort((a, b) => {
    const line = a.base.product_line.localeCompare(b.base.product_line);
    if (line !== 0) return line;
    // Los envases sin litros conocidos van al final: no se pueden ordenar contra
    // los que sí, y arriba desordenarían la lista.
    const al = a.base.size_liters ?? Number.POSITIVE_INFINITY;
    const bl = b.base.size_liters ?? Number.POSITIVE_INFINITY;
    if (al !== bl) return al - bl;
    return a.base.article_code.localeCompare(b.base.article_code);
  });
}
