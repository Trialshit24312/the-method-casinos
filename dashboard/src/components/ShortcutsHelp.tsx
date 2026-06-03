import { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { keys: 'Ctrl + K', desc: 'Focus global search' },
  { keys: '?', desc: 'Show this shortcuts panel' },
  { keys: 'Esc', desc: 'Close menus / dialogs' },
];

export default function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/70" role="dialog" aria-modal>
      <div className="glass-glow w-full max-w-sm p-6 relative">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute top-3 right-3 text-gray-500 hover:text-white"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-glow mb-4">
          <Keyboard className="w-5 h-5" />
          <h2 className="font-display font-semibold text-lg text-white">Keyboard shortcuts</h2>
        </div>
        <ul className="space-y-3">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-gray-400">{s.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-white/10 border border-white/15 text-gray-300 text-xs font-mono">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-600 mt-4">Press <kbd className="text-gray-500">?</kbd> again to close.</p>
      </div>
    </div>
  );
}
