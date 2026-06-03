interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

const sizes = {
  sm: { img: 'w-8 h-8', title: 'text-sm', tagline: 'text-[9px]' },
  md: { img: 'w-10 h-10', title: 'text-base', tagline: 'text-[10px]' },
  lg: { img: 'w-[4.5rem] h-[4.5rem]', title: 'text-lg', tagline: 'text-[10px]' },
};

export default function BrandLogo({ size = 'md', showText = true, className = '', orientation = 'horizontal' }: BrandLogoProps) {
  const s = sizes[size];
  const vertical = orientation === 'vertical';
  return (
    <div className={`flex ${vertical ? 'flex-col items-center text-center gap-3' : 'items-center gap-3'} ${className}`}>
      <div className="relative shrink-0">
        <div className="absolute inset-0 blur-xl bg-glow/20 rounded-full scale-125 opacity-70" aria-hidden />
        <img src="/logo.svg" alt="The Method" className={`relative object-contain drop-shadow-method-glow ${s.img}`} />
      </div>
      {showText && (
        <div>
          <span className={`font-display font-bold tracking-[0.12em] text-white block ${s.title}`}>THE METHOD</span>
          <span className={`tagline block ${s.tagline}`}>Precision · Strategy · Execution</span>
        </div>
      )}
    </div>
  );
}
