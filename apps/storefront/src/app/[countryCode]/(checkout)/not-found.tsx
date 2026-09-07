import InteractiveLink from "@modules/common/components/interactive-link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404",
  description: "Algo salió mal",
};

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center gap-4">
      <h1 className="text-2xl-semi text-ui-fg-base">Página no encontrada</h1>
      <p className="text-small-regular text-ui-fg-base">
        La página a la que intentaste acceder no existe.
      </p>
      <InteractiveLink href="/">Ir al inicio</InteractiveLink>
    </div>
  );
}
