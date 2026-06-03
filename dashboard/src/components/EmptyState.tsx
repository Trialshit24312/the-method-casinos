import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon className="w-7 h-7 text-glow/80" />
      </div>
      <h3 className="font-display font-semibold text-lg text-white mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-500 max-w-md mx-auto mb-5">{description}</p>}
      {action}
    </div>
  );
}
