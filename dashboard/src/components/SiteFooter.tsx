import { Link } from 'react-router-dom';
import { discordInviteUrl, publicSiteUrl } from '../lib/site';

export default function SiteFooter() {
  const invite = discordInviteUrl();

  return (
    <footer className="border-t border-surface-border bg-surface-raised/40 px-6 py-4 text-center text-xs text-gray-500">
      <p className="mb-2">
        The Method Casinos —{' '}
        <a href={publicSiteUrl()} className="text-glow hover:underline" target="_blank" rel="noreferrer">
          {publicSiteUrl()}
        </a>
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link to="/" className="text-glow hover:underline">Home</Link>
        <Link to="/casinos" className="text-glow hover:underline">Casinos</Link>
        <Link to="/terms" className="text-glow hover:underline">
          Terms
        </Link>
        <Link to="/rules" className="text-glow hover:underline">
          Rules
        </Link>
        <Link to="/privacy" className="text-glow hover:underline">
          Privacy
        </Link>
        <Link to="/login" className="text-glow hover:underline">
          Dashboard Login
        </Link>
        {invite && (
          <a href={invite} className="text-[#5865F2] hover:underline" target="_blank" rel="noreferrer">
            Join Discord
          </a>
        )}
      </div>
    </footer>
  );
}
