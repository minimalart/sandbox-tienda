/**
 * Vocabulario del asesor guiado para el rubro PINTURERÍA.
 *
 * Es DATO, no lógica: el motor que lo aplica es genérico y vive en
 * `modules/typesense/advisor.ts`. Estas reglas se cargan al `store_setting`
 * `whatsapp_advisor_config` con `pnpm seed:advisor` y desde ahí las lee el
 * indexado. Otro rubro se habilita cargando otro vocabulario, sin tocar código.
 *
 * Los códigos de categoría son los del ERP (Zeus) y están keyados por CÓDIGO,
 * nunca por nombre: los nombres ya se renombraron una vez en producción. El
 * motor hereda por prefijo de 2 chars (`020101` → `0201` → `02`), así que sólo
 * hace falta declarar el nodo más general que aplique.
 *
 * Números medidos en el índice del canal de la pinturería (2.660 documentos) al
 * 2026-08-03, para que se pueda auditar si una regla dejó de matchear:
 *   0208 Perfilería metal - madera  498     0207 Pisos            58
 *   020C Aerosoles                  263     0204 Techos           26
 *   020B Artística                  256     0201 Ind. y náutica    7
 *   0209 Paredes interior           121     0206 Piletas            5
 *   020D Especiales                  76     020A Cielorraso         2
 *   0205 Paredes exterior            65     03   Texturados      164
 */

import type { AdvisorAssignment, AdvisorRules } from '../../../modules/typesense/advisor';

/** Superficies (§11.1). `multi` = multisuperficie, entra en toda expansión. */
export const SURFACE = {
  wall: 'wall',
  metal: 'metal',
  wood: 'wood',
  plastic: 'plastic',
  multi: 'multi',
} as const;

/** Tipos de producto (§11.2). */
export const PRODUCT_TYPE = {
  paint: 'paint',
  artPaint: 'art_paint',
  prep: 'prep',
  accessory: 'accessory',
  tool: 'tool',
} as const;

export const ENVIRONMENT = { interior: 'interior', exterior: 'exterior' } as const;
export const SPECIAL_USE = { floor: 'floor', pool: 'pool', roof: 'roof' } as const;
export const BASE = { water: 'water', solvent: 'solvent' } as const;

/**
 * Reglas por código de categoría del ERP.
 *
 * Ojo con una particularidad del árbol de Zeus: MEZCLA superficie y ambiente en
 * un mismo nodo (`Paredes interior`), así que un nodo puede aportar dos
 * dimensiones a la vez. Y los nodos que son un USO ESPECIAL (Pisos, Piletas)
 * aportan además la superficie sobre la que se aplican.
 */
export const PAINT_CATEGORY_RULES: Record<string, AdvisorAssignment> = {
  // ── Raíces ────────────────────────────────────────────────────────────────
  '01': { product_type: [PRODUCT_TYPE.accessory] }, // Accesorios
  '02': { product_type: [PRODUCT_TYPE.paint] }, // Pintura (los hijos afinan)
  '03': {
    // Texturados: revestimiento de pared, sirve adentro y afuera, al agua.
    product_type: [PRODUCT_TYPE.paint],
    surface: [SURFACE.wall],
    environment: [ENVIRONMENT.interior, ENVIRONMENT.exterior],
    base: [BASE.water],
  },
  '04': { product_type: [PRODUCT_TYPE.prep], base: [BASE.solvent] }, // Diluyentes
  '05': { product_type: [PRODUCT_TYPE.prep], special_use: [SPECIAL_USE.floor] }, // Pisos PVC y cementicio
  '06': { product_type: [PRODUCT_TYPE.prep] }, // Masilla - enduido y yeso
  '07': { product_type: [PRODUCT_TYPE.tool] }, // Herramientas eléctricas y manuales
  '08': { product_type: [PRODUCT_TYPE.prep] }, // Primers - fondos
  '09': { product_type: [PRODUCT_TYPE.prep] }, // Adhesivos y selladores
  '0A': { product_type: [PRODUCT_TYPE.prep] }, // Complementos

  // ── Pintura (02xx) ────────────────────────────────────────────────────────
  '0201': {
    // Industria y náutica (incluye Epoxi 020101 y Poliuretano 020102 por prefijo)
    product_type: [PRODUCT_TYPE.paint],
    surface: [SURFACE.metal],
    base: [BASE.solvent],
  },
  '0203': {
    // Lacas y barnices: acabado para madera.
    product_type: [PRODUCT_TYPE.paint],
    surface: [SURFACE.wood],
  },
  '0204': {
    // Techos: membrana / pintura para cubierta, siempre exterior.
    product_type: [PRODUCT_TYPE.paint],
    surface: [SURFACE.wall],
    environment: [ENVIRONMENT.exterior],
  },
  '0205': {
    product_type: [PRODUCT_TYPE.paint],
    surface: [SURFACE.wall],
    environment: [ENVIRONMENT.exterior],
  },
  '0206': {
    // Piletas: filtro RESTRICTIVO del §14, nunca se relaja.
    product_type: [PRODUCT_TYPE.paint],
    surface: [SURFACE.wall],
    environment: [ENVIRONMENT.exterior],
    special_use: [SPECIAL_USE.pool],
  },
  '0207': {
    // Pisos: también restrictivo. Cemento y madera son los dos sustratos.
    product_type: [PRODUCT_TYPE.paint],
    surface: [SURFACE.wall, SURFACE.wood],
    special_use: [SPECIAL_USE.floor],
  },
  '0208': {
    // Perfilería metal - madera: la rama más grande (498). Esmaltes y barnices
    // que van sobre las dos superficies.
    product_type: [PRODUCT_TYPE.paint],
    surface: [SURFACE.metal, SURFACE.wood],
  },
  '0209': {
    product_type: [PRODUCT_TYPE.paint],
    surface: [SURFACE.wall],
    environment: [ENVIRONMENT.interior],
  },
  '020A': {
    // Cielorraso: interior por definición.
    product_type: [PRODUCT_TYPE.paint],
    surface: [SURFACE.wall],
    environment: [ENVIRONMENT.interior],
  },
  '020B': {
    // Artística: corta el recorrido técnico (§11.2).
    product_type: [PRODUCT_TYPE.artPaint],
    environment: [ENVIRONMENT.interior],
  },
  '020C': {
    // Aerosoles: multisuperficie, base solvente salvo que el título diga otra cosa.
    product_type: [PRODUCT_TYPE.paint],
    surface: [SURFACE.multi],
    base: [BASE.solvent],
  },
  '020D': {
    // Especiales: multisuperficie sin más precisión.
    product_type: [PRODUCT_TYPE.paint],
    surface: [SURFACE.multi],
  },
};

/**
 * Reglas por familia del ERP. La familia es texto libre y ORTOGONAL a la
 * categoría, así que aporta sobre todo la BASE (agua/solvente), que es la
 * dimensión que el árbol no permite deducir. El motor matchea exacto y, si no,
 * por prefijo del nombre — de ahí que `TEXTURADO` cubra las cuatro familias
 * `TEXTURADO MARBLE/REVEX/STONE/REVOQUE PLASTICO`.
 */
export const PAINT_FAMILY_RULES: Record<string, AdvisorAssignment> = {
  'PINTURA A LA TIZA': { base: [BASE.water] },
  TEXTURADO: { base: [BASE.water] },
  DILUYENTES: { base: [BASE.solvent], product_type: [PRODUCT_TYPE.prep] },
  'PINTURA AEROSOL': { base: [BASE.solvent] },
  'HERRAMIENTAS MANUALES': { product_type: [PRODUCT_TYPE.tool] },
  'HERRAMIENTAS ELECTRICAS': { product_type: [PRODUCT_TYPE.tool] },
  'PROTECCION PERSONAL': { product_type: [PRODUCT_TYPE.accessory] },
  'RODILLOS Y PAD': { product_type: [PRODUCT_TYPE.accessory] },
  PINCELES: { product_type: [PRODUCT_TYPE.accessory] },
  ARTISTICA: { product_type: [PRODUCT_TYPE.artPaint] },
  LIJAS: { product_type: [PRODUCT_TYPE.accessory] },
  'DISCOS ABRASIVOS': { product_type: [PRODUCT_TYPE.accessory] },
  'ABRASIVOS EN ROLLOS': { product_type: [PRODUCT_TYPE.accessory] },
  CINTAS: { product_type: [PRODUCT_TYPE.accessory] },
  ESCALERAS: { product_type: [PRODUCT_TYPE.accessory] },
  'LLANAS, ESPATULAS, FRATACHOS': { product_type: [PRODUCT_TYPE.accessory] },
  'ADHESIVOS Y SELLADORES': { product_type: [PRODUCT_TYPE.prep] },
  'MASILLAS CONSTRUCCION EN SECO': { product_type: [PRODUCT_TYPE.prep] },
  POLVOS: { product_type: [PRODUCT_TYPE.prep] },
  'PISOS MICROCEMENTO': { special_use: [SPECIAL_USE.floor] },
  'PISOS SPC Y ZOCALOS': { special_use: [SPECIAL_USE.floor] },
};

/**
 * Palabras del título. Es la última fuente y la que menos cubre: medido, las
 * palabras de base sólo alcanzan a ~1/3 de los 1.377 productos de Pintura
 * (látex 91, acrílico 132, esmalte 200, sintético 12, barniz 30, epoxi 34). Por
 * eso `base` se indexa con `unknown` cuando no se pudo deducir y es la única
 * dimensión que el flujo guiado relaja (§14).
 *
 * El matcheo es sobre el título en minúsculas SIN TILDES, así que alcanza con
 * escribir la raíz sin acento (`latex` matchea `Látex`).
 */
export const PAINT_TITLE_RULES: Array<{ match: string[]; set: AdvisorAssignment }> = [
  // ── Base al agua ─────────────────────────────────────────────────────────
  { match: ['latex', 'al agua', 'acrilic'], set: { base: [BASE.water] } },
  { match: ['a la tiza', 'chalk'], set: { base: [BASE.water] } },
  // ── Base al solvente ─────────────────────────────────────────────────────
  {
    match: ['sintetic', 'poliuretan', 'epoxi', 'aguarras', 'thinner', 'nitro', 'convertidor'],
    set: { base: [BASE.solvent] },
  },
  { match: ['laca ', 'barniz'], set: { base: [BASE.solvent] } },
  // ── Superficie / uso especial que el título delata ────────────────────────
  { match: ['pileta', 'piscina'], set: { special_use: [SPECIAL_USE.pool] } },
  { match: ['para piso', 'p/piso', 'pisos deportiv'], set: { special_use: [SPECIAL_USE.floor] } },
  { match: ['madera'], set: { surface: [SURFACE.wood] } },
  { match: ['metal', 'antioxido', 'antióxido', 'herrer'], set: { surface: [SURFACE.metal] } },
  { match: ['plastico', 'pvc'], set: { surface: [SURFACE.plastic] } },
  { match: ['multiuso', 'multisuperficie'], set: { surface: [SURFACE.multi] } },
  { match: ['exterior', 'frente', 'fachada'], set: { environment: [ENVIRONMENT.exterior] } },
  { match: ['interior'], set: { environment: [ENVIRONMENT.interior] } },
];

/**
 * Reglas completas listas para guardar en `whatsapp_advisor_config.rules`.
 * `version` sube cuando cambia el vocabulario: es la señal de que hace falta
 * re-sincronizar el índice para que los documentos se reclasifiquen.
 */
export const PAINT_ADVISOR_RULES: AdvisorRules = {
  version: 1,
  category_external_id_prefix: 'zeus:',
  by_category_code: PAINT_CATEGORY_RULES,
  by_family: PAINT_FAMILY_RULES,
  by_title_keyword: PAINT_TITLE_RULES,
  // `special_use` NO va: vacío significa "sin uso especial", no "no sé".
  fill_unknown: ['surface', 'product_type', 'environment', 'base'],
  unknown_value: 'unknown',
};
