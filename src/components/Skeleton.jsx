export function Skeleton({ className = "", ...props }) {
  return (
    <div
      className={`skeleton-shimmer rounded-xl bg-white/10 ${className}`}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <Skeleton className="mb-4 h-6 w-1/3" />
      <Skeleton className="mb-2 h-4 w-full" />
      <Skeleton className="mb-2 h-4 w-[80%]" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function SkeletonList({ rows = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function SkeletonMeter() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <Skeleton className="mx-auto mb-4 h-24 w-24 rounded-full" />
      <Skeleton className="mx-auto h-6 w-20" />
      <Skeleton className="mt-4 h-2 w-full rounded-full" />
    </div>
  );
}
