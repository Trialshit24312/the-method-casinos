import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
}

export default function PageHeader({ title, subtitle, action, icon, badge }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative mb-10 pb-8"
    >
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="absolute bottom-0 left-0 w-40 h-px bg-gradient-to-r from-brand via-glow to-transparent" />
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-start gap-5">
          {icon && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="p-3.5 rounded-2xl bg-gradient-to-br from-glow/20 to-brand/10 border border-glow/20 shrink-0 shadow-method-glow"
            >
              {icon}
            </motion.div>
          )}
          <div>
            {badge && <div className="mb-3">{badge}</div>}
            <h1 className="font-display text-3xl md:text-[2.75rem] font-bold tracking-tight text-white leading-tight">{title}</h1>
            {subtitle && (
              <p className="text-gray-400 mt-3 max-w-2xl leading-relaxed text-sm md:text-base">{subtitle}</p>
            )}
          </div>
        </div>
        {action}
      </div>
    </motion.div>
  );
}
