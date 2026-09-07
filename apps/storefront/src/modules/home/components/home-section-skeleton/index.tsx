// Fallback de Suspense para las filas de producto de la home. Replica el
// contenedor y las dimensiones reales de FeaturedProductsGrid (sección con
// bg-[#f3f5f6], max-w-7xl, cards de 260px) para reservar el alto y evitar el
// salto de layout (CLS) cuando la sección streamea su contenido real.
const HomeProductRowSkeleton = () => (
  <section aria-hidden className="relative bg-[#f3f5f6] py-8 sm:py-8">
    <div className="mx-auto max-w-7xl overflow-x-hidden px-4 sm:px-6 lg:px-8">
      <div className="mb-8 animate-pulse">
        <div className="h-7 w-56 max-w-full rounded bg-gray-200" />
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-200/70" />
      </div>
      <div className="flex gap-4 overflow-hidden pb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="w-[260px] flex-shrink-0 animate-pulse" key={i}>
            <div className="aspect-square w-full rounded-2xl bg-gray-200" />
            <div className="mt-3 h-4 w-3/4 rounded bg-gray-200" />
            <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HomeProductRowSkeleton;

// Reserva el alto de CollectionsSection (bg-white, py-10/8, header + fila de
// cards con imagen h-48) para que la home no salte cuando la sección streamea.
export const CollectionsRowSkeleton = () => (
  <section aria-hidden className="bg-white py-10 sm:py-8">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-8 animate-pulse">
        <div className="h-7 w-64 max-w-full rounded bg-gray-200" />
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-gray-200/70" />
      </div>
      <div className="flex gap-5 overflow-hidden pb-6 md:grid md:grid-cols-2 md:gap-6 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            className="flex-none basis-[calc(100%/1.5)] animate-pulse rounded-3xl p-6 ring-1 ring-gray-100 md:basis-auto"
            key={i}
          >
            <div className="mb-6 h-48 w-full rounded-2xl bg-gray-200" />
            <div className="h-8 w-28 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  </section>
);

// Reserva el alto de LogoShowcase (título centrado + fila de logos h-[86px]).
export const BrandsRowSkeleton = () => (
  <section aria-hidden className="bg-white py-10">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto mb-8 h-7 w-52 animate-pulse rounded bg-gray-200" />
      <div className="flex justify-center gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            className="h-[86px] w-[140px] flex-none animate-pulse rounded-[24px] bg-gray-100"
            key={i}
          />
        ))}
      </div>
    </div>
  </section>
);

// Reserva el alto de ShoppableVideos (py-20, header + coverflow de 498px de alto
// con la card central 280×498 y las laterales escaladas).
export const VideosRowSkeleton = () => (
  <section aria-hidden className="py-20">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="h-7 w-56 max-w-full animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-gray-200/70" />
      </div>
      <div
        className="flex items-center justify-center gap-3 md:gap-4"
        style={{ minHeight: "498px" }}
      >
        <div className="hidden h-[427px] w-[240px] animate-pulse rounded-[28px] bg-gray-200 opacity-70 sm:block" />
        <div className="h-[498px] w-[280px] animate-pulse rounded-[28px] bg-gray-200" />
        <div className="hidden h-[427px] w-[240px] animate-pulse rounded-[28px] bg-gray-200 opacity-70 sm:block" />
      </div>
    </div>
  </section>
);
