/**
 * Shimmer de la PDP.
 *
 * Next renderiza este loading.tsx al instante mientras el page.tsx (que hace
 * varios fetch a Typesense/Medusa) resuelve en el servidor. Así el cambio de
 * página es inmediato y no queda la sensación de que "tarda". Es neutro: sirve
 * para todos los templates (incluido sports).
 */
export default function ProductLoading() {
  return (
    <main className="mx-auto max-w-7xl animate-pulse px-4 pt-6 sm:px-6 sm:pt-10 lg:px-8 lg:pt-12">
      <div className="mx-auto max-w-2xl lg:max-w-none">
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-12">
          {/* Galería */}
          <div className="space-y-4">
            <div className="aspect-square w-full bg-gray-200" />
            <div className="flex gap-3">
              <div className="size-16 bg-gray-200" />
              <div className="size-16 bg-gray-200" />
              <div className="size-16 bg-gray-200" />
            </div>
          </div>

          {/* Info */}
          <div className="mt-6 space-y-5 lg:mt-0">
            <div className="h-4 w-24 bg-gray-200" />
            <div className="h-8 w-3/4 bg-gray-200" />
            <div className="h-7 w-32 bg-gray-200" />
            <div className="space-y-2 pt-2">
              <div className="h-3 w-full bg-gray-200" />
              <div className="h-3 w-11/12 bg-gray-200" />
              <div className="h-3 w-9/12 bg-gray-200" />
            </div>
            <div className="h-12 w-full bg-gray-200" />
            <div className="h-12 w-full bg-gray-100" />
          </div>
        </div>
      </div>
    </main>
  );
}
