export default function RandomPickSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Picking random casino">
      <div className="h-3 w-20 rounded bg-white/5" />
      <div className="glass-glow p-5 border-glow/10 space-y-3">
        <div className="h-6 w-2/3 rounded bg-white/10" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-4/5 rounded bg-white/5" />
        <div className="flex gap-2 pt-2">
          <div className="h-6 w-16 rounded-full bg-white/5" />
          <div className="h-6 w-20 rounded-full bg-white/5" />
        </div>
        <div className="h-9 w-full rounded-xl bg-white/[0.04] mt-2" />
      </div>
    </div>
  );
}
