import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton del armador de pedido (aparece al instante al navegar). */
export default function NuevoPedidoLoading() {
  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="min-w-0 flex-1 lg:max-w-3xl">
        {/* Volver + buscador */}
        <div className="mb-3 flex items-center gap-2">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <Skeleton className="h-9 flex-1 rounded-md" />
        </div>
        {/* Chips de categorías */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
        {/* Tabla */}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="size-10 shrink-0 rounded-md" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-20 sm:block" />
              <Skeleton className="h-7 w-28 rounded-md" />
            </div>
          ))}
        </div>
      </div>

      {/* Resumen (desktop) */}
      <aside className="hidden shrink-0 lg:block lg:w-80">
        <Skeleton className="h-80 w-full rounded-xl" />
      </aside>
    </div>
  );
}
