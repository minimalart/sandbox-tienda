import type { Metadata } from "next";
import { getBundle, listBundles } from "@lib/data/bundles";
import { getActiveTenant } from "@lib/site-config/active-tenant";
import { BundleCard } from "@modules/bundles/components/bundle-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kits",
  description: "Armá tu kit eligiendo entre las opciones de cada producto.",
};

/**
 * Listado de kits de la tienda activa (PRD V2 §41).
 *
 * El scoping por Store lo resuelve el backend a partir de la publishable key —
 * acá no se filtra nada por tienda.
 *
 * El orden es por `created_at` ASC y no por el `updated_at` DESC que devuelve el
 * endpoint: el tono de cada card sale de su posición, así que un orden que se
 * reacomoda cada vez que alguien edita un bundle haría que los kits cambien de
 * color solos (§34).
 *
 * La cantidad de productos y el precio "desde" salen del detalle de cada bundle,
 * que es hoy el único endpoint que los calcula con el pricing de la tienda. Son
 * llamadas en paralelo y cacheadas por el tag `bundles`; si alguna falla, la
 * card igual se muestra (título + CTA), que es lo que el PRD pide como mínimo.
 */
export default async function BundlesPage() {
  const [{ bundles }, tenant] = await Promise.all([
    listBundles().catch(() => ({ bundles: [], count: 0 })),
    getActiveTenant(),
  ]);

  const ordered = [...bundles].sort((a, b) =>
    (a.created_at ?? "") > (b.created_at ?? "") ? 1 : -1,
  );

  const details = await Promise.all(
    ordered.map((bundle) => getBundle(bundle.handle).catch(() => null)),
  );

  const primaryColor = tenant.theme?.colors?.primary;

  if (!ordered.length) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-medium tracking-tight text-neutral-900">
          Todavía no hay kits publicados
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Cuando la tienda publique uno, lo vas a ver acá para armarlo a tu medida.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-[0.22em] text-neutral-400">Kits</p>
        <h1 className="text-3xl font-medium tracking-tight text-neutral-900">Elegí tu kit</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-500">
          Cada kit trae la lista completa. Vas eligiendo entre las opciones de cada producto y lo
          agregás al carrito en un solo paso.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((bundle, index) => {
          const detail = details[index];
          const configurableCount = detail?.items.filter((i) => !i.auto_resolved_variant_id).length;
          return (
            <BundleCard
              key={bundle.id}
              handle={bundle.handle}
              title={bundle.title}
              itemCount={detail?.items.length ?? 0}
              configurableCount={configurableCount}
              fromAmount={detail?.pricing.from?.amount ?? null}
              currencyCode={detail?.pricing.from?.currency_code ?? null}
              primaryColor={primaryColor}
              index={index}
            />
          );
        })}
      </div>
    </div>
  );
}
