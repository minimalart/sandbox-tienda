import { model } from '@medusajs/framework/utils';

/**
 * ErpTintingFormula — el índice que hace posibles los DOS flujos con una sola
 * tabla:
 *
 * - base → color: `WHERE product_line = ? AND base_letter = ?` da los swatches
 *   que ofrece el PDP de esa base.
 * - color → base: `WHERE collection = ? AND color_code = ?` da las líneas/letras
 *   donde existe ese color, y de ahí los artículos por tamaño.
 *
 * Se keyea por `(color, carta, línea, letra)` y NO por artículo: el tamaño se
 * expresa en la cotización con `codBase` + `cantidad`, así que keyear por
 * artículo multiplicaría la tabla por los 4 tamaños sin agregar información.
 * `base_article_code` queda como override para la excepción inevitable (una
 * fórmula distinta para un tamaño puntual).
 *
 * `zeus_formula_code` se guarda TAL COMO LO MUESTRA Gestión (con espacio:
 * "00NN 16/000") porque es lo que se le muestra al operador; la normalización a
 * "00NN16/000", que es lo que la API acepta, la hace `tinting/formula-code.ts`
 * en el momento de llamar.
 */
export const ErpTintingFormula = model
  .define('erp_tinting_formula', {
    id: model.id({ prefix: 'erptfor' }).primaryKey(),
    color_code: model.text(),
    /** Carta del color. Parte de la clave: la fórmula es por carta/fabricante. */
    collection: model.text(),
    product_line: model.text(),
    /** Nulo = la línea tiene base única (ver ErpTintingBase). */
    base_letter: model.text().nullable(),
    /** `codFormula` de `GET /articulos/formulaTintometrico`. */
    zeus_formula_code: model.text(),
    /** Override: fija la fórmula para UN artículo puntual. */
    base_article_code: model.text().nullable(),
    active: model.boolean().default(true),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      on: ['color_code', 'collection', 'product_line', 'base_letter'],
      unique: true,
      where: 'deleted_at IS NULL',
    },
    { on: ['product_line', 'base_letter'] },
    { on: ['base_article_code'] },
  ]);
