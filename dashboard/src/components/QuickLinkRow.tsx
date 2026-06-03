import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

export interface QuickLinkItem {
  to: string;
  label: string;
  icon?: LucideIcon;
  external?: boolean;
}

interface QuickLinkRowProps {
  links: QuickLinkItem[];
  className?: string;
}

export default function QuickLinkRow({ links, className = '' }: QuickLinkRowProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {links.map(({ to, label, icon: Icon, external }) =>
        external ? (
          <a
            key={to}
            href={to}
            target="_blank"
            rel="noopener noreferrer"
            className="chip hover:border-glow/30 hover:text-glow inline-flex items-center gap-1.5 text-sm"
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
          </a>
        ) : (
          <Link
            key={to}
            to={to}
            className="chip hover:border-glow/30 hover:text-glow inline-flex items-center gap-1.5 text-sm"
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
          </Link>
        ),
      )}
    </div>
  );
}
