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

export default function SkeletonAccountPage() {
  return (
    <div className="mx-auto max-w-7xl pt-8 lg:flex lg:gap-x-16 lg:px-8">
      {/* Mobile nav skeleton */}
      <div className="lg:hidden">
        <div className="px-4 pb-3 space-y-2">
          <div className="h-8 w-40 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-64 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="flex gap-3 px-4 pb-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-[80px] w-[80px] shrink-0 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      </div>

      {/* Desktop sidebar skeleton */}
      <aside className="hidden lg:block lg:w-64 lg:flex-none lg:py-8">
        <div className="pb-6 space-y-2">
          <div className="h-8 w-36 animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-56 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-9 animate-pulse rounded-md bg-gray-100"
            />
          ))}
        </div>
      </aside>

      {/* Main content skeleton — Overview card */}
      <main className="flex-1 px-4 py-5 lg:px-0 lg:py-8">
        <div className="mx-auto max-w-2xl lg:mx-0 lg:max-w-none">
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
        </div>
      </main>
    </div>
  );
}
