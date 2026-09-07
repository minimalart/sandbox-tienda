import type { AdvisorDimension } from '../../../modules/typesense/advisor';
import { ADVISOR_FLOW, dimensionByKey, type AdvisorDimensionDef, type AdvisorOption } from './dimensions';
import type { AdvisorAnswers } from './filters';

/**
 * Motor del filtrado guiado (PRD §13). PURO: recibe las respuestas del cliente y
 * el resultado de UNA búsqueda a Typesense (cuántos productos quedan + qué valores
 * tiene cada faceta pendiente) y decide si preguntar o mostrar.
 *
 * El objetivo del §32 —"preguntar únicamente lo necesario"— se cumple con tres
 * reglas que sólo se pueden aplicar mirando facetas reales:
 *
 *  1. Si quedan `showThreshold` productos o menos, se muestran. No tiene sentido
 *     preguntar el ambiente cuando quedan tres opciones.
 *  2. Si una faceta tiene un único valor posible, la pregunta se OMITE y la
 *     respuesta se asume: preguntar "¿interior o exterior?" cuando todo lo que
 *     queda es interior sólo agrega un turno.
 *  3. Con `maxQuestions` preguntas hechas se muestra lo que haya, aunque sean
 *     muchos: el cliente vino a comprar, no a llenar un formulario.
 */

/** Conteos por valor de una faceta, tal como los devuelve Typesense. */
export type FacetCounts = Record<string, Record<string, number>>;

export type AdvisorStep =
  | {
      kind: 'ask';
      dimension: AdvisorDimensionDef;
      /** Sólo las opciones que TIENEN productos detrás (más "me da igual"). */
      options: AdvisorOption[];
    }
  | { kind: 'show'; reason: 'threshold' | 'max_questions' | 'exhausted' | 'short_circuit' }
  | { kind: 'empty' };

export type EngineConfig = {
  showThreshold: number;
  maxQuestions: number;
};

/** Cuántas preguntas se le hicieron ya (respuestas registradas). */
export const answeredCount = (answers: AdvisorAnswers): number =>
  ADVISOR_FLOW.filter((d) => Boolean(answers[d.key])).length;

/**
 * Valores de una faceta que tienen al menos un producto. Un valor con count 0 no
 * viene en `facet_counts`, así que basta con leer las claves.
 */
function availableValues(facets: FacetCounts, dimension: AdvisorDimension): Set<string> {
  return new Set(Object.keys(facets[`advisor_${dimension}`] ?? {}));
}

/**
 * Opciones ofrecibles de una dimensión: las que tienen productos detrás. Una
 * opción se ofrece si CUALQUIERA de sus valores expandidos existe en la faceta
 * (elegir "Madera" también trae multisuperficie, así que alcanza con que haya
 * multisuperficie). Las que no filtran ("me da igual", "No") se ofrecen siempre.
 */
export function offerableOptions(
  dimension: AdvisorDimensionDef,
  facets: FacetCounts,
): AdvisorOption[] {
  const available = availableValues(facets, dimension.key);
  // Sin datos de faceta (Typesense no devolvió nada para el campo) se ofrecen
  // todas: mejor preguntar de más que cortar el recorrido por falta de datos.
  if (available.size === 0) return dimension.options;
  return dimension.options.filter(
    (option) => option.expand.length === 0 || option.expand.some((v) => available.has(v)),
  );
}

/**
 * Próximo paso del recorrido.
 *
 * `found` es el total de productos que matchean las respuestas actuales; `facets`
 * son los `facet_counts` de las dimensiones pendientes. Los dos salen de la MISMA
 * búsqueda: un turno del asesor cuesta una sola consulta a Typesense y cero
 * llamadas al modelo.
 */
export function nextStep(
  answers: AdvisorAnswers,
  found: number,
  facets: FacetCounts,
  config: EngineConfig,
): AdvisorStep {
  if (found <= 0) return { kind: 'empty' };

  // §11.2 — pintura artística, accesorio o herramienta cortan el recorrido técnico.
  for (const dimension of ADVISOR_FLOW) {
    const value = answers[dimension.key];
    if (value && dimension.shortCircuitValues?.includes(value)) {
      return { kind: 'show', reason: 'short_circuit' };
    }
  }

  // Regla 1 — pocos resultados: mostrar.
  if (found <= config.showThreshold) return { kind: 'show', reason: 'threshold' };

  // Regla 3 — tope de preguntas.
  if (answeredCount(answers) >= config.maxQuestions) {
    return { kind: 'show', reason: 'max_questions' };
  }

  // Regla 2 — la próxima pregunta que aporte algo, en el orden configurado.
  for (const dimension of ADVISOR_FLOW) {
    if (answers[dimension.key]) continue;
    const options = offerableOptions(dimension, facets);
    // Con una sola opción real la pregunta no discrimina: se omite.
    const discriminating = options.filter((o) => o.expand.length > 0);
    if (discriminating.length <= 1) continue;
    return { kind: 'ask', dimension, options };
  }

  // No queda ninguna pregunta útil: mostrar lo que haya.
  return { kind: 'show', reason: 'exhausted' };
}

/**
 * Dimensiones que el motor decidió OMITIR por tener una sola opción posible. Se
 * registran como respuestas implícitas para no volver a evaluarlas y para que el
 * embudo muestre por qué el recorrido fue corto.
 */
export function impliedAnswers(answers: AdvisorAnswers, facets: FacetCounts): AdvisorAnswers {
  const implied: AdvisorAnswers = {};
  for (const dimension of ADVISOR_FLOW) {
    if (answers[dimension.key]) continue;
    const discriminating = offerableOptions(dimension, facets).filter((o) => o.expand.length > 0);
    if (discriminating.length === 1) implied[dimension.key] = discriminating[0]!.value;
  }
  return implied;
}

/** Resumen de lo elegido, para encabezar los resultados. */
export function describeAnswers(answers: AdvisorAnswers): string {
  const parts: string[] = [];
  for (const dimension of ADVISOR_FLOW) {
    const value = answers[dimension.key];
    if (!value) continue;
    const option = dimensionByKey(dimension.key)?.options.find((o) => o.value === value);
    if (option && option.expand.length > 0) parts.push(option.label.toLowerCase());
  }
  return parts.join(', ');
}
