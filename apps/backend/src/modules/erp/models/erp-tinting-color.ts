import { model } from '@medusajs/framework/utils';

/**
 * ErpTintingColor — un color de una carta tintométrica.
 *
 * Los colores NO son productos ni variantes de Medusa a propósito: el índice de
 * Typesense es un documento por producto con las variantes anidadas, así que
 * modelarlos como catálogo haría explotar el índice y el PLP con ~1000 colores
 * que no se venden solos. Un color existe únicamente como opción de entonado.
 *
 * La API de Zeus NO expone colores (los 51 endpoints no tienen ninguna entidad
 * color/fórmula, y `/validations/entities?entities=color=1` responde
 * `existe: null` = entidad desconocida), así que esta tabla se llena por import
 * desde la planilla del fabricante.
 *
 * La clave natural es `(collection, code)` y no `code` solo: la fórmula es POR
 * CARTA — el campo que devuelve Zeus se llama `codigoformulaho` ("Hogar y Obra")
 * y la pantalla de Gestión muestra `Código de Fabricante: ALBAHYO`. El mismo
 * color visual en otra carta puede tener otro código de fórmula, así que
 * unificarlos rompería la cotización. `group_key` los linkea sin fusionarlos.
 */
export const ErpTintingColor = model
  .define('erp_tinting_color', {
    id: model.id({ prefix: 'erptcol' }).primaryKey(),
    /** Código del color en la carta (ej. "COSMOS" o "1010-Y20R"). */
    code: model.text(),
    name: model.text(),
    /** Carta / fabricante (ej. "ALBAHYO"). Parte de la clave natural. */
    collection: model.text(),
    /** Color de muestra en hex (`#RRGGBB`). Nulo = swatch neutro: NO se inventa. */
    hex: model.text().nullable(),
    /** Familia para agrupar la grilla ("Verdes", "Neutros"). */
    family: model.text().nullable(),
    /** Linkea el mismo color visual entre cartas distintas. */
    group_key: model.text().nullable(),
    /** Orden dentro de la familia/carta. */
    rank: model.number().default(0),
    active: model.boolean().default(true),
    metadata: model.json().nullable(),
  })
  .indexes([
    {
      on: ['collection', 'code'],
      unique: true,
      where: 'deleted_at IS NULL',
    },
    { on: ['collection', 'family'] },
    { on: ['group_key'] },
  ]);
