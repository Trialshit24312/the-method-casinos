interface NoticeBannerProps {
  message: string;
  variant?: 'success' | 'info';
}

export default function NoticeBanner({ message, variant = 'info' }: NoticeBannerProps) {
  const styles =
    variant === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : 'border-glow/25 bg-glow/10 text-glow';

  return (
    <p className={`text-sm mb-4 p-3 rounded-xl border ${styles}`}>{message}</p>
  );
}
