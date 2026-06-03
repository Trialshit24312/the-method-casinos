import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-6 right-6 z-40 p-3 rounded-xl border border-glow/35 bg-surface-raised/90 backdrop-blur-xl
                 text-glow shadow-method-glow hover:bg-glow/10 transition-all"
      aria-label="Back to top"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );

}
