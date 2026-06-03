export default function SimilarMatchesSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-stagger"
      aria-busy="true"
      aria-label="Loading similar casinos"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-glow p-5 border-glow/10 space-y-3 animate-pulse">
          <div className="flex justify-between gap-3">
            <div className="h-6 w-2/3 rounded bg-white/10" />
            <div className="h-8 w-12 rounded bg-white/5" />
          </div>
          <div className="h-4 w-full rounded bg-white/5" />
          <div className="h-4 w-4/5 rounded bg-white/5" />
          <div className="flex gap-2 pt-2">
            <div className="h-6 w-16 rounded-full bg-white/5" />
            <div className="h-6 w-20 rounded-full bg-white/5" />
          </div>
          <div className="h-9 w-full rounded-xl bg-white/[0.04] mt-2" />
        </div>
      ))}
    </div>
  );
}
