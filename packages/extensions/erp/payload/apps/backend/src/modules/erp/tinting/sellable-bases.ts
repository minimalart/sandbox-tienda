/**
 * Cuántas bases confirmadas se pueden VENDER hoy, que es lo único que decide si
 * el tintométrico funciona.
 *
 * Existe porque `getTintingReadiness` contaba colores, bases y fórmulas y decía
 * `ready: true` con las tres cosas cargadas — sin mirar nunca si esas bases
 * existen como producto. En desdeelsur eso dio `bases_confirmed: 117` con CERO
 * artículos en Medusa: los dos flujos (el PDP y "Buscá tu color") devolvían
 * vacío en todos los colores y ningún check lo dijo. El operador se enteró por
 * un cliente.
 *
 * La cuenta es de instancia y NO por canal a propósito: la pregunta que
 * responde es "¿esta instalación tiene con qué entonar?", no "¿esta tienda
 * puede vender esta base?". Meter el canal la volvería dependiente del pedido y
 * el catálogo de colores —que se cachea público 5 minutos— dejaría de ser
 * cacheable para responder algo que igual no es lo que se pregunta acá.
 *
 * Toma la función `graph` en vez del contenedor para poder probarse sin Medusa
 * levantado, igual que el resto de `tinting/`.
 */

/** Fila mínima que hace falta de una variante para decidir si se vende. */
export type SellableVariantRow = {
  sku?: string | null;
  product?: { status?: string | null } | null;
};

/** La forma de `query.graph` que usa este módulo, sin arrastrar el framework. */
export type SellableBasesGraph = (config: {
  entity: string;
  fields: string[];
  filters?: Record<string, unknown>;
}) => Promise<{ data: SellableVariantRow[] }>;

/**
 * Tope por consulta. Las bases son ~150 filas en la cuenta real, así que casi
 * siempre entra en una sola; el corte está para que una tabla que crezca no
 * arme un `IN` de miles de elementos.
 */
const CHUNK = 500;

/**
 * Cuántos `article_code` distintos tienen una variante de un producto PUBLICADO.
 *
 * El criterio de "vendible" es el mismo que aplica `loadVariantsBySku` cuando
 * arma la respuesta del storefront: producto publicado, o sin estado conocido.
 * Si los dos no coincidieran, el readiness diría que hay bases vendibles y la
 * página seguiría vacía — que es exactamente el fallo que esto viene a cerrar.
 */
export async function countSellableBases(
  graph: SellableBasesGraph,
  articleCodes: string[]
): Promise<number> {
  const wanted = [
    ...new Set(articleCodes.map((code) => code?.trim()).filter(Boolean)),
  ] as string[];
  if (!wanted.length) return 0;

  const sellable = new Set<string>();
  for (let index = 0; index < wanted.length; index += CHUNK) {
    const { data } = await graph({
      entity: 'product_variant',
      fields: ['sku', 'product.status'],
      filters: { sku: wanted.slice(index, index + CHUNK) },
    });

    for (const variant of data ?? []) {
      const sku = variant.sku?.trim();
      if (!sku) continue;
      if (variant.product?.status && variant.product.status !== 'published') continue;
      sellable.add(sku);
    }
  }

  return sellable.size;
}
