import { model } from '@medusajs/framework/utils';

/**
 * ErpTintingBase — qué artículo del ERP es una base entonable, y cuál.
 *
 * Zeus TIENE los campos para esto (`agrupacion_tintometrico`, `codigo_color`,
 * `acabado`, `tamanio`) pero están vacíos en los 3438 artículos de la cuenta
 * real, así que las filas se generan parseando la descripción
 * (`tinting/parse-base.ts`, 154 matches sin falsos positivos) y quedan con
 * `confirmed: false` hasta que alguien las valida: un falso positivo publicaría
 * un pincel como entonable.
 *
 * `base_letter` es NULLABLE porque existen líneas con base ÚNICA
 * ("ALBA EFECTOS ESPECIALES DESIGN MARMOL BASE X 3,24 LTS"). Nulo significa
 * "esta línea tiene una sola base", no "no se sabe".
 */
export const ErpTintingBase = model
  .define('erp_tinting_base', {
    id: model.id({ prefix: 'erptbase' }).primaryKey(),
    /** Código del artículo en el ERP (= SKU de la variante en Medusa). */
    article_code: model.text(),
    /** Letra de base (F, P, T, MF...). Nulo = la línea tiene base única. */
    base_letter: model.text().nullable(),
    /** Línea de producto ("ALBACRYL LATEX INTERIOR ACRILICO MATE"). */
    product_line: model.text(),
    /** Carta de colores que aplica a esta base. */
    collection: model.text().nullable(),
    /** Envase tal como lo escribe el ERP ("3,6 LTS"). */
    size_label: model.text().nullable(),
    size_liters: model.number().nullable(),
    /** Descripción del artículo cuando se detectó, para notar renombres. */
    title_snapshot: model.text().nullable(),
    /** De dónde salió la fila: campo del ERP, parser de descripción, o a mano. */
    source: model.enum(['erp', 'parsed', 'manual']).default('parsed'),
    /** Alguien la revisó. El storefront sólo ofrece entonado si está confirmada. */
    confirmed: model.boolean().default(false),
    /**
     * El artículo TAMBIÉN se vende sin entonar: es un producto terminado que
     * además hace de base.
     *
     * Por defecto una base no lo es —una `BASE P` no existe sola en la góndola,
     * y por eso el PDP bloquea el botón hasta que se elige color—. Pero el
     * blanco de las líneas SIN base P (Albalux Balance, Satinol Balance, los
     * Texturados) cumple las dos funciones: se compra como blanco y es la base
     * de los colores claros. Con esto en `true` el PDP ofrece la carta sin
     * bloquear la compra.
     */
    sellable_untinted: model.boolean().default(false),
    active: model.boolean().default(true),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['article_code'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['product_line', 'base_letter'] },
  ]);
