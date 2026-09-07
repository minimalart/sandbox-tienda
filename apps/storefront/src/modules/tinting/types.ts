/**
 * Shapes del flujo inverso (color → bases), tal como los devuelve
 * `/api/store/tinting/bases`.
 */

export type TintBaseSize = {
  article_code: string
  /** Ya normalizado por el backend (`4 lt`), listo para pintar. */
  size_label: string | null
  size_liters: number | null
  base_letter: string | null
  variant_id: string
  /** Precio de catálogo de la base SIN entonar. El precio con color lo cotiza el ERP. */
  base_price: number | null
  currency_code: string | null
}

/**
 * Una card del paso 2: UN producto de Medusa. `sizes` casi siempre trae un solo
 * envase —cada tamaño es su propio producto— y trae varios sólo cuando el
 * producto tiene varias variantes de presentación.
 */
export type TintBaseLine = {
  /** Clave estable de la card: el producto, o el artículo si no tuviera. */
  key: string
  /** Línea de pintura ("ALBACRYL LATEX INTERIOR"), como subtítulo. */
  product_line: string
  product: {
    id: string | null
    handle: string | null
    title: string | null
    thumbnail: string | null
  } | null
  sizes: TintBaseSize[]
}

/**
 * Foto de ambiente del color, tal como la publica el CDN del fabricante. `room`
 * viene en inglés ("Livingroom") y puede ser nulo si la foto no está etiquetada.
 */
export type TintColorImage = {
  room: string | null
  url: string
}

export type TintBasesResponse = {
  color: {
    code: string
    name: string
    collection: string
    hex: string | null
    family: string | null
    /** Opcional: un backend anterior a erp 2.14.0 no manda el campo. */
    images?: TintColorImage[]
  } | null
  lines: TintBaseLine[]
}
