import { getActiveTenant } from "@lib/site-config/active-tenant";
import { BundleCard } from "@modules/bundles/components/bundle-card";
import { loadBundleCards } from "@modules/bundles/lib/load-bundle-cards";
import LocalizedClientLink from "@modules/common/components/localized-client-link";

interface BundlesGridProps {
  title?: string;
  subtitle?: string;
  limit?: number;
  handles?: Array<{ handle?: string }>;
  viewAllLabel?: string;
  viewAllHref?: string;
  countryCode: string;
}

/**
 * BundlesGrid — sección del home que lista los kits publicados de la tienda
 * activa como cards clickeables hacia el wizard.
 *
 * Usa la MISMA card que el índice `/bundles` (`BundleCard`, PRD V2 §28-§39):
 * el kit que el comprador ve en el home tiene que ser reconocible como el mismo
 * que abre desde el índice, y el tono sale del primario de la tienda, así que
 * ninguna tienda necesita producir un asset por kit.
 *
 * Gate: alcanza con que el bloque esté en el home. Antes hacía falta además
 * `content_config.sections.bundles === true`, un flag que ningún formulario del
 * admin escribe: el bloque quedaba puesto en el editor y nunca se veía. Ahora
 * `sections.bundles === false` lo esconde —para dejarlo armado sin publicarlo—
 * y cualquier otro valor lo muestra, igual que el resto de las secciones.
 *
 * Selección: si `handles` viene vacío, muestra los primeros `limit` kits. Si
 * viene con handles, respeta ESE orden (los handles inexistentes se ignoran en
 * silencio para que un handle borrado no rompa el home).
 */
export default async function BundlesGrid({
  title,
  subtitle,
  limit = 6,
  handles,
  viewAllLabel,
  viewAllHref,
}: BundlesGridProps) {
  const tenant = await getActiveTenant();
  // El backend mapea `content_config.sections` → `assets.sectionVisibility`
  // (ver apps/backend/src/modules/demo-store/templates/index.ts).
  if (tenant.assets?.sectionVisibility?.bundles === false) return null;

  const requestedHandles = (handles ?? [])
    .map((h) => h?.handle?.trim())
    .filter((h): h is string => !!h);

  const kits = await loadBundleCards({ limit, handles: requestedHandles });
  if (kits.length === 0) return null;

  const primaryColor = tenant.theme?.colors?.primary;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {(title || subtitle) && (
        <header className="mb-8 text-center">
          {title && <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>}
          {subtitle && <p className="mt-2 text-sm text-neutral-600 sm:text-base">{subtitle}</p>}
        </header>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kits.map((kit) => (
          <BundleCard
            key={kit.id}
            handle={kit.handle}
            title={kit.title}
            itemCount={kit.itemCount}
            configurableCount={kit.configurableCount}
            fromAmount={kit.fromAmount}
            currencyCode={kit.currencyCode}
            primaryColor={primaryColor}
            index={kit.index}
          />
        ))}
      </div>

      {viewAllHref && (
        <footer className="mt-8 text-center">
          <LocalizedClientLink
            href={viewAllHref}
            className="inline-block rounded-md border border-neutral-300 px-4 py-2 text-sm transition-colors hover:border-neutral-500"
          >
            {viewAllLabel || "Ver todos los kits"}
          </LocalizedClientLink>
        </footer>
      )}
    </section>
  );
}
