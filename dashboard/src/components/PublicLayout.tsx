import { Link, Outlet } from 'react-router-dom';
import SiteFooter from './SiteFooter';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col app-background">
      <header className="border-b border-surface-border px-6 py-4 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="w-10 h-10 object-contain" />
          <span className="font-display font-bold text-white tracking-wide">THE METHOD</span>
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link to="/terms" className="text-gray-400 hover:text-glow">
            Terms
          </Link>
          <Link to="/rules" className="text-gray-400 hover:text-glow">
            Rules
          </Link>
          <Link to="/privacy" className="text-gray-400 hover:text-glow">
            Privacy
          </Link>
          <Link to="/login" className="text-glow hover:underline font-medium">
            Sign in
          </Link>
        </nav>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
