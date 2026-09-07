const SkeletonProductPreview = () => {
  return (
    <div className="animate-pulse rounded-3xl border border-transparent bg-white/70 p-3">
      {/* Image skeleton */}
      <div className="aspect-[3/4] w-full rounded-2xl bg-gray-200" />

      {/* Title and price skeleton */}
      <div className="mt-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="h-5 w-3/4 rounded bg-gray-200" />
        </div>
        <div className="ml-2">
          <div className="h-5 w-16 rounded bg-gray-200" />
        </div>
      </div>

      {/* Quick view text skeleton */}
      <div className="mt-2">
        <div className="h-4 w-40 rounded bg-gray-200" />
      </div>

      {/* Link skeleton */}
      <div className="mt-3">
        <div className="h-4 w-36 rounded bg-gray-200" />
      </div>
    </div>
  );
};

export default SkeletonProductPreview;
