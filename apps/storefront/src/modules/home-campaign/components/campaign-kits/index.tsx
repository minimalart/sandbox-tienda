import type { CampaignKitsSectionConfig } from "@lib/site-config/types";
import { searchTypesenseProducts } from "@lib/typesense";
import Image from "next/image";
import CampaignKitAddButton from "../campaign-kit-add-button";

/**
 * Grid de kits/productos. A diferencia de los verticales (tech/fashion/…) NO es
 * un rail horizontal: es un grid único que muestra el catálogo acotado del
 * ciclo lectivo. Filtra por colección/tag/limit del config; si no hay filtro
 * lista los más recientes.
 *
 * En stock primero. Si Typesense falla, se oculta en silencio en lugar de
 * tumbar la home.
 *
 * IMPORTANTE: el template Campaña NO tiene PDP — es una landing vertical de
 * conversión directa. Las cards NO linkean a `/products/{handle}` (que en este
 * template devuelve 404); imagen y título son estáticos y el CTA de la card
 * agrega el producto al carrito con un click (`CampaignKitAddButton`, client
 * component que usa `useCartQuantityForVariant`).
 */
export default async function CampaignKits({
  config,
  ctaLabel,
  countryCode,
}: {
  config: CampaignKitsSectionConfig;
  ctaLabel: string;
  countryCode: string;
}) {
  const filter = config.filter ?? {};
  let products: Awaited<
    ReturnType<typeof searchTypesenseProducts>
  >["products"] = [];
  try {
    const result = await searchTypesenseProducts({
      limit: filter.limit ?? 8,
      collectionId: filter.collectionId,
      tag: filter.tag,
      sortBy: "created_at",
    });
    products = result.products;
  } catch (err) {
    console.error("[CampaignKits] fetch failed, hiding section:", err);
    return null;
  }
  products.sort((a, b) => {
    const aIn = a.stock_available > 0;
    const bIn = b.stock_available > 0;
    if (aIn === bIn) return 0;
    return aIn ? -1 : 1;
  });
  if (!products.length) return null;

  return (
    <section id="tienda" className="campaign-home bg-white text-[color:var(--campaign-card-fg,#0f1114)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <header className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {config.title}
          </h2>
          {config.subtitle ? (
            <p className="mx-auto mt-3 max-w-2xl text-base text-neutral-600">
              {config.subtitle}
            </p>
          ) : null}
        </header>
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <li
              key={p.id}
              className="flex flex-col overflow-hidden rounded-[var(--campaign-radius,14px)] border border-neutral-200 bg-white transition hover:shadow-lg"
            >
              <div className="relative block aspect-square w-full bg-neutral-50">
                {p.thumbnail ? (
                  <Image
                    src={p.thumbnail}
                    alt={p.title}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <h3 className="text-base font-semibold leading-snug">{p.title}</h3>
                {p.subtitle ? (
                  <p className="line-clamp-2 text-sm text-neutral-600">
                    {p.subtitle}
                  </p>
                ) : null}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-lg font-semibold">
                    {p.price
                      ? `$ ${p.price.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
                      : ""}
                  </span>
                  <CampaignKitAddButton
                    product={p}
                    countryCode={countryCode}
                    label={ctaLabel}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
