import { listBundles, type StorefrontBundleSummary } from "@lib/data/bundles";
import { getActiveTenant } from "@lib/site-config/active-tenant";
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
 * BundlesGrid — sección del home que lista bundles publicados de la Store
 * activa como grid clickeable hacia el wizard.
 *
 * Gate: se renderiza solo si `content_config.sections.bundles === true`. Sin
 * ese flag el bloque desaparece del home sin necesidad de tocar el editor
 * Puck — el operador puede tenerlo agregado como preview y activarlo/
 * desactivarlo desde la config de la tienda.
 *
 * Fuente de datos: `listBundles()` — server action tenant-aware (usa
 * getMedusaSDK internamente) que ya scopea por la publishable key del site.
 * El backend filtra por `status: 'published'` y por link Bundle↔DemoStore.
 *
 * Selección: si `handles` viene vacío, muestra los primeros `limit` bundles
 * ordenados por `updated_at DESC`. Si viene con handles, respeta ESE orden
 * (los handles inexistentes se ignoran silenciosamente para que un handle
 * borrado no rompa el home).
 */
export default async function BundlesGrid({
  title,
  subtitle,
  limit = 6,
  handles,
  viewAllLabel,
  viewAllHref,
  countryCode,
}: BundlesGridProps) {
  const tenant = await getActiveTenant();
  // El backend mapea `content_config.sections` → `assets.sectionVisibility`
  // (ver apps/backend/src/modules/demo-store/templates/index.ts). Ausente
  // significa deshabilitado, no visible-por-default: es feature opt-in.
  const bundlesEnabled = tenant.assets?.sectionVisibility?.bundles === true;
  if (!bundlesEnabled) return null;

  let bundles: StorefrontBundleSummary[] = [];
  try {
    const response = await listBundles();
    bundles = response.bundles ?? [];
  } catch {
    return null;
  }

  const requestedHandles = (handles ?? [])
    .map((h) => h?.handle?.trim())
    .filter((h): h is string => !!h);

  const selected =
    requestedHandles.length > 0
      ? requestedHandles
          .map((h) => bundles.find((b) => b.handle === h))
          .filter((b): b is StorefrontBundleSummary => !!b)
      : bundles.slice(0, limit);

  if (selected.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {(title || subtitle) && (
        <header className="mb-8 text-center">
          {title && <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>}
          {subtitle && <p className="mt-2 text-sm text-neutral-600 sm:text-base">{subtitle}</p>}
        </header>
      )}
      <ul
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
      >
        {selected.map((bundle) => (
          <li key={bundle.id}>
            <LocalizedClientLink
              href={`/bundles/${bundle.handle}`}
              className="block h-full rounded-lg border border-neutral-200 p-4 transition hover:border-neutral-400"
            >
              {bundle.thumbnail && (
                <img
                  src={bundle.thumbnail}
                  alt=""
                  className="mb-3 aspect-video w-full rounded object-cover"
                />
              )}
              <h3 className="text-lg font-medium">{bundle.title}</h3>
              {bundle.description && (
                <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{bundle.description}</p>
              )}
              <span className="mt-3 inline-block text-sm underline">Armar mi kit</span>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
      {viewAllLabel && viewAllHref && (
        <footer className="mt-8 text-center">
          <LocalizedClientLink
            href={viewAllHref}
            className="inline-block rounded-md border border-neutral-300 px-4 py-2 text-sm hover:border-neutral-500"
          >
            {viewAllLabel}
          </LocalizedClientLink>
        </footer>
      )}
    </section>
  );
}
