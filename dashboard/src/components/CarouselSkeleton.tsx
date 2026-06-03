import { motion } from 'framer-motion';

interface Props {
  title?: string;
  cards?: number;
}

export default function CarouselSkeleton({ title, cards = 4 }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mb-10"
      aria-busy="true"
      aria-label={title ? `${title} loading` : 'Loading casinos'}
    >
      {title && (
        <div className="mb-4">
          <div className="h-6 w-40 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-4 w-56 rounded-lg bg-white/[0.03] animate-pulse mt-2" />
        </div>
      )}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[min(100%,320px)] h-52 rounded-2xl border border-white/[0.06] bg-white/[0.03] animate-pulse"
          />
        ))}
      </div>
    </motion.section>
  );
}
