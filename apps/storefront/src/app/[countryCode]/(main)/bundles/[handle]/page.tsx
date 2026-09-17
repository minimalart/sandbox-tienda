import { notFound } from "next/navigation";
import { getBundle } from "@lib/data/bundles";
import { retrieveCart } from "@lib/data/cart";
import { getProductsByIds } from "@lib/data/products";
import { BundleWizard } from "@modules/bundles/components/bundle-wizard";
import type { BundleEnrichment } from "@modules/bundles/lib/variant-presentation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string; countryCode: string }>;
  searchParams: Promise<{ instance?: string }>;
};

/**
 * Página del configurador de bundles. Carga el detalle del bundle + el carrito
 * activo en el server y renderiza el wizard en el cliente. La ruta sólo existe
 * cuando el backend tiene el módulo `bundle`: para proyectos que lo omiten,
 * `getBundle` devuelve null y la página 404ea.
 *
 * `GET /store/bundles/:handle` devuelve un subconjunto MÍNIMO del producto
 * (título, thumbnail, opciones, variantes con precio) — sin descripción, sin
 * galería y sin `variants.metadata`. El wizard necesita esas tres cosas para
 * mostrar una foto por variante y la ficha de detalle, así que se completan con
 * `/store/products` (misma región y canal de venta que el bundle). Si esa
 * llamada falla, el wizard cae a la thumbnail del producto y sigue funcionando.
 *
 * `?instance=<bundle_instance_id>` cambia el wizard a MODO EDIT:
 *   - Se leen los line items del cart con ese instance_id.
 *   - Se arma `initialSelections` (bundle_item_id → variant_id) leyendo
 *     `metadata.bundle_item_id` de cada line item + su `variant_id`.
 *   - El wizard hidrata el estado inicial con esas selecciones y, al confirmar,
 *     llama `reconfigureBundleWorkflow` (reemplaza los line items viejos
 *     preservando el bundle_instance_id) en vez de generar una nueva instancia.
 *
 * Si el `?instance` viene pero no matchea ningún line item del cart (bundle
 * ya eliminado, sesión distinta, etc), se ignora y el wizard arranca fresh —
 * cae al flujo de add nuevo.
 */
export default async function BundlePage({ params, searchParams }: Props) {
  const { handle, countryCode } = await params;
  const { instance } = await searchParams;
  const bundle = await getBundle(handle);
  if (!bundle) return notFound();

  const [cart, enrichment] = await Promise.all([
    retrieveCart().catch(() => null),
    buildEnrichment(bundle.items.map((item) => item.product_id), countryCode),
  ]);

  let editInstanceId: string | null = null;
  let initialSelections: Record<string, string> | undefined;
  if (instance && cart?.items?.length) {
    const matching = cart.items.filter(
      (li) =>
        li.metadata &&
        (li.metadata as Record<string, unknown>).bundle_instance_id === instance,
    );
    if (matching.length) {
      editInstanceId = instance;
      const selections: Record<string, string> = {};
      for (const li of matching) {
        const meta = (li.metadata ?? {}) as Record<string, unknown>;
        const itemId = typeof meta.bundle_item_id === "string" ? meta.bundle_item_id : null;
        const variantId = li.variant_id ?? null;
        if (itemId && variantId) selections[itemId] = variantId;
      }
      initialSelections = selections;
    }
  }

  return (
    <div>
      <BundleWizard
        bundle={bundle}
        cartId={cart?.id ?? null}
        countryCode={countryCode}
        enrichment={enrichment}
        editInstanceId={editInstanceId}
        initialSelections={initialSelections}
      />
    </div>
  );
}

const buildEnrichment = async (
  productIds: string[],
  countryCode: string,
): Promise<BundleEnrichment> => {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (!ids.length) return {};
  try {
    const products = await getProductsByIds({ productIds: ids, countryCode });
    return Object.fromEntries(
      products.map((product) => [
        product.id,
        {
          description: product.description ?? null,
          subtitle: product.subtitle ?? null,
          images: (product.images ?? [])
            .map((image) => image?.url)
            .filter((url): url is string => !!url),
          metadata: (product.metadata ?? null) as Record<string, unknown> | null,
          variants: Object.fromEntries(
            (product.variants ?? []).map((variant) => [
              variant.id,
              { metadata: (variant.metadata ?? null) as Record<string, unknown> | null },
            ]),
          ),
        },
      ]),
    );
  } catch {
    return {};
  }
};
