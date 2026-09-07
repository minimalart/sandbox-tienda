import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton del listado de pedidos (aparece al instante al navegar). */
export default function PedidosLoading() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 last:border-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        ))}
      </Card>
    </div>
  );
}
