import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 mb-6">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3 h-3 text-gray-600" />}
          {item.to ? (
            <Link to={item.to} className="hover:text-glow transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-400 truncate max-w-[12rem] sm:max-w-none">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
