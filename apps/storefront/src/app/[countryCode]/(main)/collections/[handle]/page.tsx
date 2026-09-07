import { getCollectionByHandle } from "@lib/data/collections";
import { getTenant } from "@lib/site-config/resolver";
import {
  buildBreadcrumbJsonLd,
  buildCollectionPageJsonLd,
} from "@lib/util/seo/jsonld";
import { canonicalUrl } from "@lib/util/site-url";
import JsonLd from "@modules/common/components/json-ld";
import CollectionTemplate from "@modules/collections/templates";
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string; countryCode: string }>;
  searchParams: Promise<{
    page?: string;
    sortBy?: SortOptions;
  }>;
};

export const PRODUCT_LIMIT = 12;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const [collection, tenant] = await Promise.all([
    getCollectionByHandle(params.handle),
    getTenant(),
  ]);

  if (!collection) {
    notFound();
  }

  return {
    // Sin ` | ${tenant.name}`: lo agrega el `title.template` del root layout.
    title: collection.title,
    description: `Explorá la colección ${collection.title} en ${tenant.name}: productos disponibles, precios actualizados y envíos a domicilio.`,
    alternates: { canonical: await canonicalUrl(`/collections/${params.handle}`) },
  };
}

export default async function CollectionPage(props: Props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { sortBy, page } = searchParams;

  const collection = await getCollectionByHandle(params.handle);

  if (!collection) {
    notFound();
  }

  const [tenant, url, homeUrl] = await Promise.all([
    getTenant(),
    canonicalUrl(`/collections/${params.handle}`),
    canonicalUrl("/"),
  ]);

  return (
    <>
      {/* Listado sin dato estructurado hasta acá (`missing-structured-data`). */}
      <JsonLd
        data={[
          buildCollectionPageJsonLd({
            name: collection.title,
            url,
            description: collection.metadata?.description as string | undefined,
          }),
          buildBreadcrumbJsonLd([
            { name: tenant.name, url: homeUrl },
            { name: collection.title, url },
          ]),
        ]}
      />
      <CollectionTemplate
        collection={collection}
        countryCode={params.countryCode}
        page={page}
        sortBy={sortBy}
      />
    </>
  );
}
