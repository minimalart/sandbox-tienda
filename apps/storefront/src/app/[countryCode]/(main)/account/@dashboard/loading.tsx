function SkeletonOrderRow() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3.5">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-gray-100" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3.5 w-16 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="h-6 w-20 animate-pulse rounded-full bg-gray-100" />
      <div className="hidden h-4 w-16 animate-pulse rounded bg-gray-100 sm:block" />
      <div className="hidden h-4 w-4 animate-pulse rounded bg-gray-100 sm:block" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-[0px_5px_20px_0px_#0000000D]">
      <div className="border-gray-100 px-6 py-5">
        <div className="h-5 w-28 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="space-y-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonOrderRow key={i} />
        ))}
      </div>
    </div>
  );
}
