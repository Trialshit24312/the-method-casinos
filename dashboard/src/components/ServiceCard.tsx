import { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import type { WebService } from '../lib/generators';

const BADGE_COLORS: Record<string, string> = {
  Free: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  Popular: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'No Signup': 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  SMS: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  Instant: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

interface ServiceCardProps {
  service: WebService;
}

export default function ServiceCard({ service }: ServiceCardProps) {
  return (
    <a
      href={service.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block p-4 rounded-xl border border-surface-border bg-gradient-to-br from-surface-raised to-surface
                 hover:border-glow/50 hover:shadow-method-glow transition-all duration-200 card-shine"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h4 className="font-semibold text-white group-hover:text-glow transition-colors">
          {service.name}
        </h4>
        <ExternalLink className="w-4 h-4 text-gray-600 group-hover:text-glow shrink-0 mt-0.5" />
      </div>
      <p className="text-sm text-gray-500 mb-3 leading-relaxed line-clamp-2">{service.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {service.badge && (
          <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${BADGE_COLORS[service.badge] || BADGE_COLORS.Free}`}>
            {service.badge}
          </span>
        )}
        {service.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-muted text-gray-500 border border-surface-border">
            {tag}
          </span>
        ))}
      </div>
    </a>
  );
}

interface ServiceGridProps {
  title: string;
  subtitle?: string;
  services: WebService[];
  searchable?: boolean;
}

export function ServiceGrid({ title, subtitle, services, searchable = false }: ServiceGridProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [services, query]);

  return (
    <section className="mb-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div className="section-heading">
          <h3 className="font-display font-semibold text-lg text-white">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          <p className="text-xs text-gray-600 mt-1">{filtered.length} site{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {searchable && services.length > 6 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input
              type="text"
              placeholder="Filter sites..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-field pl-9 py-2 text-sm"
            />
          </div>
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-600 py-8 text-center">No sites match your search.</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 animate-stagger">
          {filtered.map((svc) => (
            <ServiceCard key={svc.url} service={svc} />
          ))}
        </div>
      )}
    </section>
  );
}
