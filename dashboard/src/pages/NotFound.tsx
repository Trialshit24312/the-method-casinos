import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('Page Not Found — The Method Casinos');

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6 md:p-8">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="That route doesn't exist — head back to the catalog or dashboard."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/" className="btn-primary text-sm">Home</Link>
            <Link to="/casinos" className="btn-glow text-sm">Browse casinos</Link>
            <Link to="/dashboard" className="btn-secondary text-sm">Dashboard</Link>
          </div>
        }
      />
    </div>
  );
}
