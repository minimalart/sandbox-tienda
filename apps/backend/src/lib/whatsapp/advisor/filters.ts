import type { AdvisorDimension } from '../../../modules/typesense/advisor';
import { ADVISOR_FLOW, dimensionByKey, optionByValue } from './dimensions';

/**
 * Traducción de las respuestas del cliente a `filter_by` de Typesense, con la
 * expansión de compatibilidad del §12 y la relajación del §14.
 *
 * Todo acá es PURO: no toca Typesense ni la base, así que se testea sin red.
 */

export type AdvisorAnswers = Partial<Record<AdvisorDimension, string>>;

/** Filtros base que aplican SIEMPRE (canal y productos ocultos). */
export function baseFilters(salesChannelIds: string[]): string[] {
  // Lista: el bot puede atender varios canales (Admin → WhatsApp → Ajustes).
  return [`sales_channels.id:=[${salesChannelIds.join(',')}]`, 'metadata.hidden_from_store:!=true'];
}

/**
 * Cláusula de una dimensión. Devuelve `null` cuando la respuesta no filtra:
 * "me da igual" y el "No" de uso especial.
 *
 * OJO con `special_use`: el "No" NO se traduce a "que no tenga uso especial". Una
 * pintura de piso sirve perfectamente para una pared, así que filtrar por ausencia
 * escondería productos válidos. Sólo restringe cuando el cliente PIDE piso o
 * pileta.
 */
export function clauseFor(dimensionKey: AdvisorDimension, value: string): string | null {
  const dimension = dimensionByKey(dimensionKey);
  if (!dimension) return null;
  const option = optionByValue(dimension, value);
  if (!option || option.expand.length === 0) return null;
  return `advisor_${dimensionKey}:=[${option.expand.join(',')}]`;
}

/**
 * `filter_by` completo para un conjunto de respuestas.
 *
 * `dropped` permite construir el paso de relajación sin duplicar la lógica: se
 * pasan las dimensiones a ignorar y sale el filtro sin ellas.
 */
export function buildAdvisorFilterBy(
  answers: AdvisorAnswers,
  salesChannelIds: string[],
  dropped: AdvisorDimension[] = [],
): string {
  const clauses = baseFilters(salesChannelIds);
  for (const dimension of ADVISOR_FLOW) {
    if (dropped.includes(dimension.key)) continue;
    const value = answers[dimension.key];
    if (!value) continue;
    const clause = clauseFor(dimension.key, value);
    if (clause) clauses.push(clause);
  }
  return clauses.join(' && ');
}

/**
 * Dimensiones que se pueden relajar, en orden, cuando no hay resultados (§14).
 *
 * Sólo las NO restrictivas y que además estén respondidas con algo que filtre. La
 * superficie, el tipo de producto y los usos piso/pileta nunca entran: el PRD es
 * explícito en que no se relajan automáticamente, porque mostrar un producto
 * incompatible es peor que no mostrar nada.
 */
export function relaxableDimensions(answers: AdvisorAnswers): AdvisorDimension[] {
  return ADVISOR_FLOW.filter((dimension) => {
    if (dimension.restrictive) return false;
    const value = answers[dimension.key];
    return Boolean(value && clauseFor(dimension.key, value));
  }).map((d) => d.key);
}

/** Facetas a pedir: las dimensiones que todavía no se respondieron. */
export function pendingFacetFields(answers: AdvisorAnswers): string[] {
  return ADVISOR_FLOW.filter((d) => !answers[d.key]).map((d) => `advisor_${d.key}`);
}
