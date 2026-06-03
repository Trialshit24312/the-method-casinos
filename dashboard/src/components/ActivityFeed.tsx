import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radar, CheckCircle } from 'lucide-react';
import { api } from '../api';

interface FeedItem {
  type: 'approval' | 'discovery';
  at: string;
  title: string;
  detail: string;
  casinoId?: string;
  casinoSlug?: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ActivityFeed() {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    api.getPublicFeed(8).then(setItems).catch(() => setItems([]));
  }, []);

  if (!items.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-glow p-5 mb-8 border-glow/10"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display font-semibold text-sm text-white">Recent activity</h2>
        <Link to="/status" className="text-[10px] text-gray-500 hover:text-glow transition-colors">
          Status →
        </Link>
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={`${item.type}-${item.at}-${i}`} className="flex items-start gap-3 text-sm">
            {item.type === 'approval' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Radar className="w-4 h-4 text-glow shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              {item.casinoSlug ? (
                <Link to={`/casinos/${item.casinoSlug}`} className="text-white hover:text-glow font-medium">
                  {item.title}
                </Link>
              ) : (
                <p className="text-white font-medium">{item.title}</p>
              )}
              <p className="text-xs text-gray-500">{item.detail}</p>
            </div>
            <span className="text-[10px] text-gray-600 shrink-0">{timeAgo(item.at)}</span>
          </li>
        ))}
      </ul>
      <Link to="/new" className="text-xs text-glow hover:underline mt-3 inline-block">
        All new arrivals →
      </Link>
    </motion.div>
  );
}
