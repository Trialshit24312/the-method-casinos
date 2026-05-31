import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export default function PageHeader({ title, subtitle, action, icon }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-10 pb-6 border-b border-[#2a2a35]"
    >
      <div className="absolute bottom-0 left-0 w-24 h-0.5 bg-gradient-to-r from-[#b87333] to-[#00aeef]" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="p-3 rounded-xl bg-[#00aeef]/10 border border-[#00aeef]/25 shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">{title}</h1>
            {subtitle && <p className="text-gray-400 mt-2 max-w-2xl leading-relaxed">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
    </motion.div>
  );
}
