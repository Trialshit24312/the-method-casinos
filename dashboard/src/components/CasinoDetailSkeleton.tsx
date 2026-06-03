export default function CasinoDetailSkeleton() {
  return (
    <div className="page-container-catalog" aria-busy="true" aria-label="Loading casino profile">
      <div className="h-4 w-48 bg-white/5 rounded animate-pulse mb-6" />
      <div className="glass-glow p-8 animate-pulse space-y-4 border-glow/10">
        <div className="h-8 w-2/3 bg-white/10 rounded" />
        <div className="h-4 w-full bg-white/5 rounded" />
        <div className="h-4 w-5/6 bg-white/5 rounded" />
        <div className="flex gap-2 pt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-white/5 rounded-lg" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 w-20 rounded-full bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
