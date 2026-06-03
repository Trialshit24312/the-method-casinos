import { RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  variant?: 'error' | 'warning';
}

export default function ErrorBanner({ message, onRetry, variant = 'error' }: ErrorBannerProps) {
  const styles =
    variant === 'warning'
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
      : 'border-accent-red/30 bg-accent-red/10 text-red-400';

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border text-sm mb-4 ${styles}`}>
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary text-xs flex items-center gap-1.5 shrink-0">
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      )}
    </div>
  );
}
