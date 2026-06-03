export default function CheckResultSkeleton() {
  return (
    <div className="mt-4 p-5 rounded-xl border border-glow/15 bg-glow/5 animate-pulse space-y-3" aria-busy="true" aria-label="Checking URL">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-white/10" />
        <div className="h-5 w-40 rounded bg-white/10" />
      </div>
      <div className="h-4 w-3/4 rounded bg-white/5" />
      <div className="h-4 w-1/2 rounded bg-white/5" />
    </div>
  );
}
