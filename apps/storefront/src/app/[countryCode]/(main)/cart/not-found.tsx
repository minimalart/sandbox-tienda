import InteractiveLink from "@modules/common/components/interactive-link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404",
  description: "Algo salió mal",
};

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center">
      <h1 className="text-2xl-semi text-ui-fg-base">Página no encontrada</h1>
      <p className="text-small-regular text-ui-fg-base">
        El carrito al que intentaste acceder no existe. Borrá tus cookies y
        probá de nuevo.
      </p>
      <InteractiveLink href="/">Ir al inicio</InteractiveLink>
    </div>
  );
}
