interface CatalogGridSkeletonProps {
  count?: number;
}

export default function CatalogGridSkeleton({ count = 6 }: CatalogGridSkeletonProps) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-stagger"
      aria-busy="true"
      aria-label="Loading casinos"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass-glow p-5 border-glow/10 space-y-3 animate-pulse"
        >
          <div className="h-5 w-2/3 rounded bg-white/10" />
          <div className="h-4 w-full rounded bg-white/5" />
          <div className="h-4 w-5/6 rounded bg-white/5" />
          <div className="flex gap-2 pt-2">
            <div className="h-6 w-16 rounded-full bg-white/5" />
            <div className="h-6 w-20 rounded-full bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
