import { model } from '@medusajs/framework/utils';

/**
 * Modo de venta de un Product DENTRO de una tienda (PRD Bundles V2 §5-§6).
 *
 * Vive en el módulo de tiendas y no en `bundle` a propósito: es disponibilidad
 * comercial de un producto por tienda, no una propiedad de los bundles. El mismo
 * producto puede venderse suelto en una tienda y existir sólo dentro de kits en
 * otra, así que la capacidad NO puede ser un campo global del Product.
 *
 * La ausencia de fila es `standalone_and_bundle`: es el comportamiento que ya
 * tenían todos los productos, así que nada cambia hasta que alguien configura
 * explícitamente una tienda. NUNCA se infiere `bundle_only` por pertenecer a un
 * bundle (§7) — que una botella esté en un kit no significa que deje de
 * venderse sola.
 */
export const ProductSalesMode = model
  .define('product_sales_mode', {
    id: model.id({ prefix: 'psm' }).primaryKey(),
    /** Product de Medusa. Sin FK: los módulos no comparten esquema. */
    product_id: model.text(),
    /** `demo_store.id` de la tienda en la que aplica este modo. */
    site_id: model.text(),
    /** standalone | bundle_only | standalone_and_bundle */
    sales_mode: model.text().default('standalone_and_bundle'),
  })
  .indexes([
    /**
     * Un modo por producto y tienda. El índice es único y parcial (ignora las
     * filas borradas) para que un delete + re-set no choque contra sí mismo.
     */
    {
      on: ['product_id', 'site_id'],
      unique: true,
      where: 'deleted_at is null',
    },
    /** El filtro caliente: "qué productos están ocultos en esta tienda". */
    {
      on: ['site_id', 'sales_mode'],
      where: 'deleted_at is null',
    },
  ]);
