import { getCategoryByHandle } from "@lib/data/categories";
import type { SortOptions } from "@modules/store/components/refinement-list/sort-products";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ category: string[]; countryCode: string }>;
  searchParams: Promise<{
    sortBy?: SortOptions;
    page?: string;
  }>;
};

// La tienda (`/store`) es la única superficie de listado: filtra sobre Typesense
// con facetas (marca, tags, promos, precio, etc.). Esta ruta usaba la Store API
// con `RefinementList` (solo orden), así que los filtros no aplicaban acá y la
// UX quedaba partida. En vez de duplicar el motor de filtros, redirigimos a
// `/store?category=<nombre>` — el filtro de categorías de la tienda matchea por
// NOMBRE (así lo indexa Typesense en `categories.name`), no por handle.
export default async function CategoryPage(props: Props) {
  const [params, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);

  const productCategory = await getCategoryByHandle(params.category);

  if (!productCategory?.name) {
    notFound();
  }

  const query = new URLSearchParams({ category: productCategory.name });
  if (searchParams.sortBy) {
    query.set("sortBy", searchParams.sortBy);
  }

  redirect(`/${params.countryCode}/store?${query.toString()}`);
}
