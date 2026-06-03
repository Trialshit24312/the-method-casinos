export default function CompareSkeleton() {
  return (
    <div className="glass-glow p-6 border-glow/15 animate-pulse space-y-4" aria-busy="true" aria-label="Loading comparison">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="h-6 w-32 rounded bg-white/10" />
          <div className="h-4 w-full rounded bg-white/5" />
          <div className="h-4 w-4/5 rounded bg-white/5" />
        </div>
        <div className="space-y-3">
          <div className="h-6 w-32 rounded bg-white/10" />
          <div className="h-4 w-full rounded bg-white/5" />
          <div className="h-4 w-4/5 rounded bg-white/5" />
        </div>
      </div>
      <div className="h-px bg-surface-border" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-24 rounded-full bg-white/5" />
        ))}
      </div>
    </div>
  );
}
