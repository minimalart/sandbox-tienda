"use client";

import dynamic from "next/dynamic";
import type { PdfCatalogData } from "@lib/data/pdf-catalog";

// react-pdf no renderiza en el servidor (usa APIs de browser); se carga solo en cliente.
const PdfCatalogViewer = dynamic(() => import("./pdf-catalog-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center text-gray-400">
      Cargando catálogo…
    </div>
  ),
});

export default function PdfCatalogViewerClient({
  catalog,
  countryCode,
  whatsappNumber,
}: {
  catalog: PdfCatalogData;
  countryCode: string;
  whatsappNumber?: string;
}) {
  return (
    <PdfCatalogViewer
      catalog={catalog}
      countryCode={countryCode}
      whatsappNumber={whatsappNumber}
    />
  );
}
