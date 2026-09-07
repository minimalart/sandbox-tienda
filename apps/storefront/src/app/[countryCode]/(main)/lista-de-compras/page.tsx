import ShoppingListTemplate from "@modules/shopping-list/templates/shopping-list-template";
import ShoppingListTemplateV2 from "@modules/shopping-list/templates/shopping-list-template-v2";
import { parseShoppingList } from "@lib/util/shopping-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lista de compras",
  /**
   * `noindex`: página de sesión/utilidad, no un resultado de búsqueda.
   *
   * El `robots.txt` ya la bloquea, pero una URL bloqueada que Google descubre por un
   * link se puede indexar SIN contenido ("indexada aunque bloqueada"). El meta es lo
   * que lo evita. La auditoría del 19/08 no encontró NINGUNA página noindex en todo
   * el storefront: /account y /lista-de-compras se crawlearon y midieron.
   */
  robots: { index: false, follow: false },
  description:
    "Ingresá tu lista de compras y recibí productos sugeridos por cada ítem.",
};

type Props = {
  params: Promise<{ countryCode: string }>;
  searchParams?: Promise<{ items?: string | string[]; v?: string }>;
};

export default async function ShoppingListPage({ params, searchParams }: Props) {
  const { countryCode } = await params;
  const resolvedSearchParams = await searchParams;
  const rawItems = Array.isArray(resolvedSearchParams?.items)
    ? resolvedSearchParams?.items.join(",")
    : resolvedSearchParams?.items || "";
  const initialTerms = parseShoppingList(rawItems);

  // v2 (pestañas estilo Mercado Libre) es la versión por defecto.
  // La v1 (carrusel por término) queda oculta, accesible con `?v=1` para
  // poder compararlas mientras probamos la nueva.
  if (resolvedSearchParams?.v === "1") {
    return (
      <ShoppingListTemplate
        countryCode={countryCode}
        initialTerms={initialTerms}
      />
    );
  }

  return (
    <ShoppingListTemplateV2
      countryCode={countryCode}
      initialTerms={initialTerms}
    />
  );
}
