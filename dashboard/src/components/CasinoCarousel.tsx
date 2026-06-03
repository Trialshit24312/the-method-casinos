import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Casino } from '../types';
import CasinoCard from './CasinoCard';

interface Props {
  title: string;
  subtitle?: string;
  casinos: Casino[];
  icon?: React.ReactNode;
  action?: React.ReactNode;
  isFavorited?: (casinoId: string) => boolean;
  onToggleFavorite?: (casino: Casino) => void;
}

export default function CasinoCarousel({
  title, subtitle, casinos, icon, action, isFavorited, onToggleFavorite,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    trackRef.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });
  };

  if (!casinos.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-10"
    >
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="section-heading">
          <h2 className="font-display font-semibold text-lg text-white flex items-center gap-2">
            {icon}
            {title}
          </h2>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          <button
            type="button"
            onClick={() => scroll(-1)}
            className="p-2 rounded-xl border border-surface-border bg-surface-muted/80 hover:border-glow/30 hover:bg-glow/5 text-gray-400 hover:text-glow transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            className="p-2 rounded-xl border border-surface-border bg-surface-muted/80 hover:border-glow/30 hover:bg-glow/5 text-gray-400 hover:text-glow transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="carousel-fade -mx-1 px-1">
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin scroll-smooth"
        style={{ scrollbarWidth: 'thin' }}
      >
        {casinos.map((casino, i) => (
          <div key={casino.id} className="snap-start shrink-0 w-[min(100%,320px)]">
            <CasinoCard
              casino={casino}
              index={i}
              favorited={isFavorited?.(casino.id)}
              onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(casino) : undefined}
            />
          </div>
        ))}
      </div>
      </div>
    </motion.section>
  );
}
