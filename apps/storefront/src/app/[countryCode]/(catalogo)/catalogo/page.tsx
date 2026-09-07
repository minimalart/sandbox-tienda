import type { Metadata } from "next";
import { getActivePdfCatalog } from "@lib/data/pdf-catalog";
import { getTenant } from "@lib/site-config/resolver";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import PdfCatalogViewerClient from "@modules/pdf-catalog/components/pdf-catalog-viewer-client";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  return {
    title: `Catálogo | ${tenant.name}`,
    description: `Explorá el catálogo interactivo de ${tenant.name}.`,
  };
}

export default async function CatalogoPage(props: {
  params: Promise<{ countryCode: string }>;
}) {
  const { countryCode } = await props.params;
  const catalog = await getActivePdfCatalog(countryCode);

  // Estado vacío a pantalla completa (el layout de catálogo no tiene chrome,
  // así que no usamos notFound: mostramos un mensaje propio con salida).
  if (!catalog) {
    return (
      <div className="flex h-dvh w-screen flex-col items-center justify-center gap-4 bg-neutral-100 px-6 text-center">
        <p className="text-lg text-gray-500">
          No hay ningún catálogo disponible por el momento.
        </p>
        <LocalizedClientLink
          href="/"
          className="rounded-lg bg-[--primary-color] px-4 py-2 text-sm font-medium text-white"
        >
          Volver al inicio
        </LocalizedClientLink>
      </div>
    );
  }

  // Número de WhatsApp del pedido. Sin número configurado, WhatsApp deja elegir
  // el contacto (comportamiento de poc-ipaper). Se puede cablear a un ajuste de
  // tienda más adelante.
  const whatsappNumber: string | undefined = undefined;

  return (
    <PdfCatalogViewerClient
      catalog={catalog}
      countryCode={countryCode}
      whatsappNumber={whatsappNumber}
    />
  );
}
