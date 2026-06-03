import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

export default function GlobalSearch() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/casinos?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search casinos…"
        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-surface-overlay/80 border border-surface-border
                   text-gray-200 placeholder-gray-600 focus:border-glow/40 focus:outline-none focus:ring-1 focus:ring-glow/30"
      />
    </form>
  );
}
