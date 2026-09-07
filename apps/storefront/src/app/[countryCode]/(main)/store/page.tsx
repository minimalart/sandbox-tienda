import { listCategories } from "@lib/data/categories";
import { getActiveTenant } from "@lib/site-config/active-tenant";
import StoreClientPage from "@modules/store/templates/store-client-page";
import type { Metadata } from "next";
import { TenantConfig } from "@lib/site-config";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
} from "@lib/util/seo/jsonld";
import { canonicalUrl } from "@lib/util/site-url";
import JsonLd from "@modules/common/components/json-ld";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    countryCode: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Faceta activa (marca o categoría) del listado, si hay una. */
function activeFilter(
  searchParams: Record<string, string | string[] | undefined>,
): string | undefined {
  const first = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;
  return first(searchParams.brand) || first(searchParams.category);
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  /**
   * `getActiveTenant()`, no `getTenant()`.
   *
   * `getTenant()` (`site-config/resolver.ts`) es el resolver ESTÁTICO: devuelve
   * `defaultConfig` sin mirar la request, o sea `name: "Mercatto"` en toda instalación.
   * Como el título de esta página es `absolute` —se salta el `title.template` del root
   * layout, que sí resuelve la marca— era la única marca que se emitía: desdeelsur
   * sirvió `<title>Tienda | Mercatto</title>` y `description: "…catálogo completo de
   * Mercatto…"` en su PLP, la página más indexada después de la home (DESDEELSUR-49).
   *
   * `getActiveTenant()` está `cache()`ado y el layout `(main)` ya lo resolvió en esta
   * misma request, así que no agrega I/O.
   */
  const tenant: TenantConfig = await getActiveTenant();
  const searchParams = await props.searchParams;

  const filter = activeFilter(searchParams);
  const titleText = filter
    ? `${filter} | Tienda | ${tenant.name}`
    : `Tienda | ${tenant.name}`;

  // Los textos anteriores hablaban de "fragancias, aromatizadores y aromaterapia" en
  // TODAS las tiendas. Genérico por catálogo, no por vertical ajena.
  const descriptionText = filter
    ? `Comprá ${filter} en ${tenant.name}: stock disponible, precios actualizados y envíos a domicilio.`
    : `Explorá el catálogo completo de ${tenant.name}: filtrá por categoría, marca y precio, con stock y envíos a domicilio.`;

  return {
    title: { absolute: titleText },
    description: descriptionText,
    /**
     * SIEMPRE `/store`, con faceta o sin ella.
     *
     * `?brand=`, `?category=`, `?promos=`, `?sortBy=` y `?page=` no son páginas: el HTML
     * servido es el mismo (el listado se arma client-side contra Typesense), así que la
     * auditoría del 19/08 vio 25 URLs de faceta como thin-content y `/store?promos=1`
     * como contenido duplicado exacto de `/store`. Consolidan todas acá.
     */
    alternates: { canonical: await canonicalUrl("/store") },
  };
}

export default async function StorePage(props: Params) {
  const params: { countryCode: string } = await props.params;
  const countryCode: string = params.countryCode;

  // Categorías pre-cargadas server-side. Tolerante a fallos: si el fetch de
  // categorías rompe (timeout/payload), la tienda NO debe caerse — renderiza
  // con [] y el filtro cae al fallback de facets de Typesense.
  let initialCategories: Awaited<ReturnType<typeof listCategories>> = [];
  try {
    initialCategories = await listCategories();
  } catch (error) {
    console.error("[StorePage] listCategories failed, rendering without tree:", error);
  }

  // Mismo motivo que en `generateMetadata()`: el `<h1 class="sr-only">` y el
  // `CollectionPage` de JSON-LD llevan el nombre de la marca, y con `getTenant()`
  // decían "Tienda online de Mercatto" en todas las tiendas.
  const [tenant, searchParams, storeUrl] = await Promise.all([
    getActiveTenant(),
    props.searchParams,
    canonicalUrl("/store"),
  ]);
  const filter = activeFilter(searchParams);
  const heading = filter ? `${filter} en ${tenant.name}` : `Tienda online de ${tenant.name}`;

  return (
    <>
      {/* El listado no emitía H1 (el grid abre en un h2 oculto) ni dato estructurado
          alguno: 25 de las 25 páginas de faceta salieron con `missing-h1` en la
          auditoría. Oculto visualmente para no alterar el layout de la tienda. */}
      <h1 className="sr-only">{heading}</h1>
      <JsonLd
        data={[
          buildCollectionPageJsonLd({
            name: heading,
            url: storeUrl,
          }),
          buildBreadcrumbJsonLd([
            { name: tenant.name, url: await canonicalUrl("/") },
            { name: "Tienda", url: storeUrl },
          ]),
        ]}
      />
      <StoreClientPage countryCode={countryCode} initialCategories={initialCategories} />
    </>
  );
}
