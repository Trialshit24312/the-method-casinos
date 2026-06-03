import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: string;
  delay?: number;
  to?: string;
}

export default function StatCard({ label, value, icon: Icon, color, delay = 0, to }: StatCardProps) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-3xl font-display font-bold bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">{value}</p>
        </div>
        <div
          className={`p-2.5 rounded-lg ${color} group-hover:scale-110 transition-transform duration-200`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </>
  );

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`stat-card group ${to ? 'hover:border-glow/30 cursor-pointer' : ''}`}
    >
      {inner}
    </motion.div>
  );

  if (to) {
    return (
      <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-glow/40 rounded-2xl">
        {card}
      </Link>
    );
  }

  return card;
}
