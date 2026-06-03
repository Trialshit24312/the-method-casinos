import BrandLogo from './BrandLogo';

export default function PageLoadingFallback() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 app-background relative">
      <div className="hero-orb w-[240px] h-[240px] bg-glow/10 -top-10 pointer-events-none" />
      <BrandLogo size="md" className="mb-6 opacity-90" />
      <div className="w-full max-w-md space-y-3 animate-pulse" aria-busy="true" aria-label="Loading page">
        <div className="h-8 w-2/3 mx-auto rounded-lg bg-white/10" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-5/6 mx-auto rounded bg-white/5" />
        <div className="grid grid-cols-3 gap-3 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/[0.04] border border-white/[0.06]" />
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-600 mt-6 tracking-wide">Loading…</p>
    </div>
  );
}
