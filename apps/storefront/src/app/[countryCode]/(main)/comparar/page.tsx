import CompareTemplate from "@modules/compare/templates/compare-template";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparación de productos",
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
    "Compará productos seleccionados y revisá sus detalles en una misma vista.",
};

type Props = {
  params: Promise<{ countryCode: string }>;
};

export default async function ComparePage({ params }: Props) {
  const { countryCode } = await params;
  return <CompareTemplate countryCode={countryCode} />;
}
