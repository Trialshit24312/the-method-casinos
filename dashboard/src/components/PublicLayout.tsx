import { Link, Outlet } from 'react-router-dom';
import SiteFooter from './SiteFooter';
import BrandLogo from './BrandLogo';
import BackToTop from './BackToTop';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col app-background">
      <header className="sticky top-0 z-20 border-b border-surface-border px-6 py-4 flex items-center justify-between gap-4 bg-surface-raised/80 backdrop-blur-xl">
        <Link to="/" className="hover:opacity-90 transition-opacity">
          <BrandLogo size="md" />
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
      <BackToTop />
    </div>
  );
}
