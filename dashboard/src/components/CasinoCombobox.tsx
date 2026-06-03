import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search, Star } from 'lucide-react';
import type { Casino } from '../types';

interface CasinoComboboxProps {
  label: string;
  casinos: Casino[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export default function CasinoCombobox({
  label,
  casinos,
  value,
  onChange,
  placeholder = 'Search by name…',
}: CasinoComboboxProps) {
  const selected = casinos.find((c) => c.id === value);
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const c = casinos.find((x) => x.id === value);
    setQuery(c?.name ?? '');
    if (!value) setOpen(false);
  }, [value, casinos]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return casinos.slice(0, 10);
    return casinos.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 10);
  }, [casinos, query]);

  const pick = (casino: Casino) => {
    onChange(casino.id);
    setQuery(casino.name);
    setOpen(false);
  };

  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-gray-500 mb-2 block">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
        <input
          className="input-field pl-9 pr-3"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onChange('');
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {selected && (
          <p className="text-[10px] text-gray-600 mt-1.5 flex items-center gap-1">
            <Star className="w-3 h-3 text-brand-light fill-brand-light" />
            {selected.rating.toFixed(1)} stars · verified catalog
          </p>
        )}
        {open && filtered.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-surface-border bg-surface-raised shadow-xl overflow-hidden">
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => pick(c)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm transition-colors border-b border-surface-border last:border-0 ${
                  c.id === value ? 'bg-glow/10 text-glow' : 'text-gray-300 hover:bg-glow/5'
                }`}
              >
                <span className="font-medium truncate">{c.name}</span>
                <span className="flex items-center gap-2 shrink-0 text-gray-500">
                  <Star className="w-3 h-3 text-brand-light fill-brand-light" />
                  {c.rating.toFixed(1)}
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
