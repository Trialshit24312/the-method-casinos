import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { History } from 'lucide-react';
import { readRecentlyViewed, type RecentView } from '../lib/recently-viewed';

export default function RecentlyViewed() {
  const [items, setItems] = useState<RecentView[]>([]);

  useEffect(() => {
    setItems(readRecentlyViewed());
    const refresh = () => setItems(readRecentlyViewed());
    window.addEventListener('storage', refresh);
    window.addEventListener('method-recent-view', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('method-recent-view', refresh);
    };
  }, []);

  if (!items.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-glow p-5 mb-8 border-glow/10"
    >
      <h2 className="font-display font-semibold text-sm mb-3 text-white flex items-center gap-2">
        <History className="w-4 h-4 text-glow" />
        Recently viewed
      </h2>
      <div className="flex flex-wrap gap-2">
        {items.map((v) => (
          <Link
            key={v.id}
            to={`/casinos/${v.slug}`}
            className="text-sm px-3 py-1.5 rounded-full border border-surface-border bg-surface-muted/80
                       text-gray-300 hover:text-glow hover:border-glow/30 transition-colors"
          >
            {v.name}
          </Link>
        ))}
      </div>
    </motion.section>
  );
}
