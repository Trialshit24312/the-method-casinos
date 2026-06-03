import { Link } from 'react-router-dom';
import { Sparkles, ShieldCheck, Dices, Wrench, Scale, Crown } from 'lucide-react';
import { discordInviteUrl, publicSiteUrl } from '../lib/site';

export default function SiteFooter() {
  const invite = discordInviteUrl();

  return (
    <footer className="relative border-t border-surface-border/80 bg-surface-raised/50 backdrop-blur-sm px-6 py-8 mt-auto">
      <div className="max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8 text-left">
          <div>
            <p className="font-display font-semibold text-white mb-2 flex items-center gap-2">
              <img src="/logo.png" alt="" className="w-5 h-5" /> The Method
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              Verified US sweepstakes catalog, free web discovery, and safety tools.
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-light/70 mb-2">Explore</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link to="/casinos" className="text-gray-500 hover:text-glow transition-colors flex items-center gap-1.5">
                <Dices className="w-3.5 h-3.5" /> Casinos
              </Link>
              <Link to="/similar" className="text-gray-500 hover:text-glow transition-colors flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Similar search
              </Link>
              <Link to="/tools" className="text-gray-500 hover:text-glow transition-colors flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" /> Tools
              </Link>
              <Link to="/pricing" className="text-gray-500 hover:text-brand-light transition-colors flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" /> Membership
              </Link>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-light/70 mb-2">Safety</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link to="/tools/checker" className="text-gray-500 hover:text-glow transition-colors flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> URL checker
              </Link>
              <Link to="/blocked" className="text-gray-500 hover:text-red-400 transition-colors">Blocklist</Link>
              <Link to="/guides" className="text-gray-500 hover:text-glow transition-colors">Guides</Link>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-brand-light/70 mb-2">Legal</p>
            <div className="flex flex-col gap-1.5 text-sm">
              <Link to="/legal" className="text-gray-500 hover:text-glow transition-colors flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5" /> Legal hub
              </Link>
              <Link to="/terms" className="text-gray-500 hover:text-glow transition-colors">Terms</Link>
              <Link to="/privacy" className="text-gray-500 hover:text-glow transition-colors">Privacy</Link>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-surface-border text-center text-xs text-gray-600">
          <p className="mb-2">
            The Method Casinos —{' '}
            <a href={publicSiteUrl()} className="text-glow/80 hover:text-glow hover:underline" target="_blank" rel="noreferrer">
              {publicSiteUrl()}
            </a>
          </p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link to="/login" className="hover:text-glow transition-colors">Dashboard login</Link>
            {invite && (
              <a href={invite} className="text-[#5865F2] hover:underline" target="_blank" rel="noreferrer">
                Discord
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
