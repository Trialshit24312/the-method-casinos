export default function StatsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card animate-pulse">
          <div className="h-3 w-24 bg-white/5 rounded mb-3" />
          <div className="h-8 w-16 bg-white/10 rounded" />
        </div>
      ))}
    </div>
  );
}
