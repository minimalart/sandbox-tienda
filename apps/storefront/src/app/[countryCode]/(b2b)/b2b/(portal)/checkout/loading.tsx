import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton del checkout mayorista (aparece al instante al navegar). */
export default function CheckoutLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}
