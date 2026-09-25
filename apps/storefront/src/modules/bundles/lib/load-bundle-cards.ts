import { getBundle, listBundles, type StorefrontBundleSummary } from "@lib/data/bundles";

/**
 * Lo que necesita `BundleCard` de cada kit, ya calculado.
 *
 * Es UNA función para el índice `/bundles`, la sección del home y la fila de
 * productos con kits: si cada superficie armara lo suyo, el mismo kit diría
 * "12 productos" en un lugar y "Desde $…" en otro, o cambiaría de color.
 */
export interface BundleCardData {
  id: string;
  handle: string;
  title: string;
  itemCount: number;
  configurableCount: number;
  fromAmount: number | null;
  currencyCode: string | null;
  /** Posición en la lista completa ordenada por `created_at`: define el tono. */
  index: number;
}

/**
 * Trae los kits publicados de la tienda activa con lo que la card muestra.
 *
 * El orden es por `created_at` ASC y no por el `updated_at` DESC que devuelve el
 * endpoint: el tono de cada card sale de su posición, así que un orden que se
 * reacomoda cada vez que alguien edita un bundle haría que los kits cambien de
 * color solos (PRD V2 §34). `index` se toma de la lista COMPLETA, así el mismo
 * kit tiene el mismo color esté donde esté.
 *
 * Los detalles (cantidad de productos, precio desde) van en paralelo y son
 * tolerantes a fallo: si uno falla, la card igual sale con título y CTA.
 *
 * `handles` limita y ORDENA la selección; vacío = los primeros `limit`.
 */
export const loadBundleCards = async ({
  limit,
  handles = [],
}: { limit?: number; handles?: string[] } = {}): Promise<BundleCardData[]> => {
  let bundles: StorefrontBundleSummary[] = [];
  try {
    bundles = (await listBundles()).bundles ?? [];
  } catch {
    return [];
  }

  const ordered = [...bundles].sort((a, b) =>
    (a.created_at ?? "") > (b.created_at ?? "") ? 1 : -1,
  );

  const selected =
    handles.length > 0
      ? handles
          .map((h) => ordered.find((b) => b.handle === h))
          .filter((b): b is StorefrontBundleSummary => !!b)
      : ordered.slice(0, limit ?? ordered.length);

  const details = await Promise.all(
    selected.map((bundle) => getBundle(bundle.handle).catch(() => null)),
  );

  return selected.map((bundle, i) => {
    const detail = details[i];
    return {
      id: bundle.id,
      handle: bundle.handle,
      title: bundle.title,
      itemCount: detail?.items.length ?? 0,
      configurableCount:
        detail?.items.filter((item) => !item.auto_resolved_variant_id).length ?? 0,
      fromAmount: detail?.pricing.from?.amount ?? null,
      currencyCode: detail?.pricing.from?.currency_code ?? null,
      index: ordered.findIndex((b) => b.id === bundle.id),
    };
  });
};
