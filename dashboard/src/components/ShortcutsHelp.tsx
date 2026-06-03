import { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { keys: 'Ctrl + K', desc: 'Focus global search' },
  { keys: '?', desc: 'Show this shortcuts panel' },
  { keys: '↑ ↓', desc: 'Navigate search dropdown' },
  { keys: 'Esc', desc: 'Close menus / dialogs' },
  { keys: '/', desc: 'Focus search (catalog filter on Browse page)' },
  { keys: 'Enter', desc: 'Submit report modal / URL check' },
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
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('method-open-shortcuts', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('method-open-shortcuts', onOpen);
    };
  }, []);

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal aria-labelledby="shortcuts-title">
      <div className="modal-panel max-w-sm p-6">
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
          <h2 id="shortcuts-title" className="font-display font-semibold text-lg text-white">Keyboard shortcuts</h2>
        </div>
        <ul className="space-y-3">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-gray-400">{s.desc}</span>
              <kbd className="kbd">{s.keys}</kbd>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-600 mt-4">Press <kbd className="kbd">?</kbd> again to close.</p>
      </div>
    </div>
  );
}
