/**
 * Decisiones PURAS del audit del asesor, separadas de la ruta para poder
 * probarlas sin levantar Medusa (mismo criterio que los `_input.ts` /
 * `_status-for-error.ts` de correo-argentino).
 *
 * Las dos que viven acá son las que hacían que el reporte mintiera:
 * qué familia cuenta como huérfana y sobre qué universo se mide cada dimensión.
 */

import { foldText, type AdvisorDimension } from '../../../../modules/typesense/advisor';
import { ADVISOR_FLOW } from '../../../../lib/whatsapp/advisor/dimensions';

const productTypeStep = ADVISOR_FLOW.find((d) => d.key === 'product_type');
const shortCircuitTypes = new Set(productTypeStep?.shortCircuitValues ?? []);

/**
 * Tipos de producto que NO cortan el recorrido guiado (hoy `paint` y `prep`).
 *
 * Sale de `ADVISOR_FLOW` y no de una lista escrita a mano para que el audit siga
 * al flujo si mañana se reordenan las preguntas o cambia qué corta el recorrido.
 */
export const TECHNICAL_PRODUCT_TYPES: string[] = (productTypeStep?.options ?? [])
  .map((o) => o.value)
  .filter((value) => !shortCircuitTypes.has(value));

/**
 * Dimensiones que sólo se preguntan si el recorrido NO cortó en `product_type`
 * (§11.2): las que vienen después de esa pregunta en el flujo.
 *
 * Por qué importa: un pincel o una lija no tienen ambiente ni base
 * agua/solvente. Eso es "no aplica", no "no sé". Contarlos en el denominador es
 * el mismo error que el código ya evita en `special_use`, y hunde el porcentaje
 * de dos dimensiones hasta volverlo inaccionable — medido en desdeelsur,
 * `environment` daba 26,9 % sobre 2.700 productos de los cuales dos tercios
 * nunca iban a recibir esa pregunta.
 */
export const TECHNICAL_DIMENSIONS: Set<AdvisorDimension> = new Set(
  ADVISOR_FLOW.slice(ADVISOR_FLOW.findIndex((d) => d.key === 'product_type') + 1).map((d) => d.key),
);

/** Texto del `scope` que acompaña a esas dimensiones en la respuesta. */
export const TECHNICAL_SCOPE_LABEL = `product_type in [${TECHNICAL_PRODUCT_TYPES.join(', ')}]`;

/** ¿A este producto le llegarían las preguntas técnicas del recorrido? */
export function inTechnicalScope(productTypes: readonly string[]): boolean {
  return productTypes.some((t) => TECHNICAL_PRODUCT_TYPES.includes(t));
}

/**
 * ¿Alguna regla de familia toca esta familia?
 *
 * `foldText` y NO `toLowerCase`: el motor matchea sin tildes
 * (`assignmentForFamily`), así que comparar con tildes reporta como huérfanas
 * familias que SÍ tienen regla —"Protección personal" contra la regla
 * `PROTECCION PERSONAL`— y manda a arreglar lo que no está roto.
 *
 * No es `assignmentForFamily` (que hace match exacto y si no elige el prefijo
 * más largo): para responder "¿la toca alguna?" alcanza con el prefijo, y así
 * la respuesta no depende de cuál gana.
 */
export function familyIsMapped(family: string, byFamily: Record<string, unknown>): boolean {
  const folded = foldText(family);
  return Object.keys(byFamily).some((key) => folded.startsWith(foldText(key)));
}
