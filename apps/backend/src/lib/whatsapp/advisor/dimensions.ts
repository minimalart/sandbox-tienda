import type { AdvisorDimension } from '../../../modules/typesense/advisor';
import { SURFACE, PRODUCT_TYPE, ENVIRONMENT, SPECIAL_USE, BASE } from './vocabulary';

/**
 * Las 5 preguntas del filtrado guiado (PRD §11), con sus opciones y sus reglas de
 * expansión (§12).
 *
 * Es DATO y no lógica: el motor (`engine.ts`) no conoce ninguna dimensión por
 * nombre, sólo esta lista. El PRD §26 pide que el orden y los valores permitidos
 * sean administrables — con esto, cambiarlos es cambiar config, no código.
 */

export type AdvisorOption = {
  /** Valor que el cliente elige (`wood`). */
  value: string;
  /** Etiqueta del botón. WhatsApp corta a 20 chars, así que van cortas. */
  label: string;
  /**
   * Valores que se BUSCAN cuando el cliente elige esta opción (§12). Es la
   * expansión de compatibilidad: elegir madera trae también los multisuperficie.
   * Vacío = no filtra (la opción "me da igual").
   */
  expand: string[];
};

export type AdvisorDimensionDef = {
  key: AdvisorDimension;
  /** Texto de la pregunta (§11). */
  question: string;
  options: AdvisorOption[];
  /**
   * `true` = NUNCA se relaja automáticamente (§14): superficie, tipo de producto y
   * los usos piso/pileta. Mostrar un producto incompatible es peor que no mostrar
   * nada.
   */
  restrictive: boolean;
  /**
   * Dimensiones cuyo valor hace innecesario seguir preguntando lo técnico (§11.2):
   * si el cliente busca pintura artística, un accesorio o una herramienta, el
   * recorrido corta y se muestran productos.
   */
  shortCircuitValues?: string[];
};

/** "Me da igual" / "No": no agrega filtro. */
const ANY: AdvisorOption = { value: 'any', label: 'Me da igual', expand: [] };

export const ADVISOR_FLOW: AdvisorDimensionDef[] = [
  {
    key: 'surface',
    question: '¿Sobre qué superficie lo vas a aplicar?',
    restrictive: true,
    options: [
      // "Pared, cemento o placa" agrupa mampostería, hormigón y placas (§11.1).
      { value: SURFACE.wall, label: 'Pared o cemento', expand: [SURFACE.wall, SURFACE.multi] },
      { value: SURFACE.metal, label: 'Metal', expand: [SURFACE.metal, SURFACE.multi] },
      { value: SURFACE.wood, label: 'Madera', expand: [SURFACE.wood, SURFACE.multi] },
      /**
       * Plástico NO expande a multisuperficie, a diferencia de las demás. El §12 lo
       * dice distinto a propósito: "productos multisuperficie MARCADOS COMO APTOS
       * PARA PLÁSTICO". La mayoría de las pinturas no adhieren al plástico sin
       * imprimación, así que un multisuperficie genérico no sirve — tiene que
       * llevar `plastic` explícito en sus atributos.
       */
      { value: SURFACE.plastic, label: 'Plástico', expand: [SURFACE.plastic] },
      // Multisuperficie explícito: sólo lo declarado como tal.
      { value: SURFACE.multi, label: 'Multisuperficie', expand: [SURFACE.multi] },
    ],
  },
  {
    key: 'product_type',
    question: '¿Qué tipo de producto estás buscando?',
    restrictive: true,
    // Artística, accesorio y herramienta cortan el recorrido técnico (§11.2).
    shortCircuitValues: [PRODUCT_TYPE.artPaint, PRODUCT_TYPE.accessory, PRODUCT_TYPE.tool],
    options: [
      { value: PRODUCT_TYPE.paint, label: 'Pintura', expand: [PRODUCT_TYPE.paint] },
      { value: PRODUCT_TYPE.artPaint, label: 'Pintura artística', expand: [PRODUCT_TYPE.artPaint] },
      { value: PRODUCT_TYPE.prep, label: 'Preparación', expand: [PRODUCT_TYPE.prep] },
      { value: PRODUCT_TYPE.accessory, label: 'Accesorio', expand: [PRODUCT_TYPE.accessory] },
      { value: PRODUCT_TYPE.tool, label: 'Herramienta', expand: [PRODUCT_TYPE.tool] },
    ],
  },
  {
    key: 'environment',
    question: '¿Dónde lo vas a usar?',
    restrictive: false,
    options: [
      // Los aptos para los dos llevan ambos valores indexados, así que entran en
      // los dos filtros sin necesidad de expandir (§11.3).
      { value: ENVIRONMENT.interior, label: 'Interior', expand: [ENVIRONMENT.interior] },
      { value: ENVIRONMENT.exterior, label: 'Exterior', expand: [ENVIRONMENT.exterior] },
      ANY,
    ],
  },
  {
    key: 'special_use',
    // Una sola pregunta en vez de una por uso, como pide el §11.4.
    question: '¿Necesitás que sea apto para un uso especial?',
    restrictive: true,
    /**
     * Cuatro opciones, así que `askDimension` la manda como LISTA interactiva y
     * no como botones (WhatsApp permite 3 botones y 10 filas de lista).
     *
     * `roof` no está en el §11.4 —que lista sólo piso y pileta— pero el dato vino
     * en la planilla del merchant para 1.677 productos, y "¿tenés algo para el
     * techo?" es una de las consultas más comunes en una pinturería.
     */
    options: [
      { value: 'none', label: 'No', expand: [] },
      { value: SPECIAL_USE.floor, label: 'Piso', expand: [SPECIAL_USE.floor] },
      { value: SPECIAL_USE.pool, label: 'Pileta', expand: [SPECIAL_USE.pool] },
      { value: SPECIAL_USE.roof, label: 'Techo', expand: [SPECIAL_USE.roof] },
    ],
  },
  {
    key: 'base',
    question: '¿Tenés preferencia por algún tipo de producto?',
    // La ÚNICA relajable (§14): es preferencia, no requisito. Y es la dimensión
    // con menos cobertura real, así que si no se relajara dejaría al cliente sin
    // resultados a cada rato.
    restrictive: false,
    options: [
      { value: BASE.water, label: 'Al agua', expand: [BASE.water] },
      { value: BASE.solvent, label: 'Al solvente', expand: [BASE.solvent] },
      ANY,
    ],
  },
];

export const dimensionByKey = (key: string): AdvisorDimensionDef | undefined =>
  ADVISOR_FLOW.find((d) => d.key === key);

export const optionByValue = (
  dimension: AdvisorDimensionDef,
  value: string,
): AdvisorOption | undefined => dimension.options.find((o) => o.value === value);

/** Etiqueta legible de una respuesta, para el resumen y los logs. */
export function answerLabel(dimensionKey: string, value: string): string {
  const dimension = dimensionByKey(dimensionKey);
  return optionByValue(dimension!, value)?.label ?? value;
}

/**
 * Valor NEUTRO de una dimensión: la opción que no filtra ("Me da igual", "No").
 *
 * Es lo que se guarda al relajar (§14). Si en cambio se BORRARA la respuesta, el
 * motor vería la dimensión como no respondida y la volvería a preguntar: el
 * cliente contestaría "al agua" otra vez, se relajaría otra vez, y el recorrido
 * quedaría en un bucle.
 */
export function neutralValue(dimensionKey: string): string | null {
  const dimension = dimensionByKey(dimensionKey);
  return dimension?.options.find((o) => o.expand.length === 0)?.value ?? null;
}
