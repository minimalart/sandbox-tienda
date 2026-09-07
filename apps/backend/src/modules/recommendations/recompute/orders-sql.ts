/**
 * SQL compartido sobre órdenes, para co-compra, populares y tendencia.
 *
 * La forma del join y el predicado de órdenes válidas se copian de
 * `workflows/aggregate-commerce-metrics.ts`, que es el precedente del repo para leer
 * órdenes por SQL crudo en Medusa v2:
 *
 *   order → order_item (por order_id Y version) → order_line_item (por item_id)
 *
 * El join por `version` no es opcional: una orden editada tiene varias versiones de
 * sus items y sin ese predicado se contarían todas, duplicando unidades.
 *
 * Órdenes que NO cuentan (PRD §19): canceladas, borradores y soft-deleted. Una
 * cancelada no es evidencia de que dos productos se compren juntos.
 */

/** Predicado de órdenes elegibles, con el binding de la ventana histórica. */
export const ELIGIBLE_ORDERS_CTE = `
  base_orders as (
    select o.id as order_id, o.version as order_version
    from "order" o
    where o.deleted_at is null
      and coalesce(o.is_draft_order, false) = false
      and (o.status is null or o.status::text not in ('canceled', 'cancelled', 'draft'))
      and o.created_at >= now() - (? || ' days')::interval
      and (?::text is null or o.sales_channel_id = ?)
  )
`;

/** Productos distintos por orden (una fila por par orden/producto). */
export const ORDER_PRODUCTS_CTE = `
  order_products as (
    select distinct bo.order_id, li.product_id
    from base_orders bo
    join order_item oi on oi.order_id = bo.order_id
      and oi.version = bo.order_version
      and oi.deleted_at is null
    join order_line_item li on li.id = oi.item_id and li.deleted_at is null
    where li.product_id is not null
  )
`;

/**
 * Canastas de tamaño razonable.
 *
 * ESTE ES EL GUARD DE CPU MÁS IMPORTANTE del motor. El self-join de co-compra es
 * O(Σ tamaño²): una orden B2B de 200 líneas aporta 200×199 = 39.800 pares por sí
 * sola, y con unas pocas de esas el cálculo clava el vCPU compartido con el HTTP
 * server (es exactamente el modo de falla del incidente del 2026-07-23).
 *
 * Además de proteger el CPU, tiene sentido estadístico: un pedido mayorista de 200
 * productos no dice nada sobre afinidad entre pares.
 */
export const SANE_BASKETS_CTE = `
  sane as (
    select op.*
    from order_products op
    join (
      select order_id
      from order_products
      group by order_id
      having count(*) between 2 and ?
    ) k on k.order_id = op.order_id
  )
`;

/**
 * Conteos crudos por par, acotados a los mejores por origen.
 *
 * El `row_number()` recorta ANTES de traer las filas a Node: sin él, un catálogo
 * mediano devuelve cientos de miles de pares por lote. Se piden más de
 * `max_relations_per_source` porque los gates de confianza y lift descartan algunos y
 * conviene tener margen.
 */
export const buildPairCountsSql = (): string => `
  with ${ELIGIBLE_ORDERS_CTE},
  ${ORDER_PRODUCTS_CTE},
  ${SANE_BASKETS_CTE},
  totals as (select count(distinct order_id)::int as n from sane),
  counts as (select product_id, count(*)::int as orders from sane group by product_id),
  pairs as (
    select a.product_id as source_product_id, b.product_id as target_product_id,
           count(*)::int as co_occurrences
    from sane a
    join sane b on b.order_id = a.order_id and b.product_id <> a.product_id
    group by a.product_id, b.product_id
    having count(*) >= ?
  ),
  ranked as (
    select p.*, ca.orders as source_orders, cb.orders as target_orders,
           row_number() over (
             partition by p.source_product_id
             order by p.co_occurrences desc, p.target_product_id
           ) as rn
    from pairs p
    join counts ca on ca.product_id = p.source_product_id
    join counts cb on cb.product_id = p.target_product_id
  )
  select (select n from totals) as total_orders,
         source_product_id, target_product_id, co_occurrences, source_orders, target_orders
  from ranked
  where rn <= ?
`;

/**
 * Unidades vendidas por producto en una ventana, para populares y tendencia.
 *
 * Suma `quantity` de `order_item` (no cuenta filas): dos unidades del mismo producto
 * en una orden son dos ventas.
 */
export const buildUnitsSql = (): string => `
  with ${ELIGIBLE_ORDERS_CTE},
  units as (
    select li.product_id, sum(oi.quantity)::numeric as units, count(distinct bo.order_id)::int as orders
    from base_orders bo
    join order_item oi on oi.order_id = bo.order_id
      and oi.version = bo.order_version
      and oi.deleted_at is null
    join order_line_item li on li.id = oi.item_id and li.deleted_at is null
    where li.product_id is not null
    group by li.product_id
  )
  select product_id, units, orders
  from units
  where units >= ?
  order by units desc
  limit ?
`;
