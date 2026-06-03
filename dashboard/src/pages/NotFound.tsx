import { Link } from 'react-router-dom';
import { Compass, Scale } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import Breadcrumb from '../components/Breadcrumb';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('Page Not Found — The Method Casinos');

  return (
    <div className="page-container-narrow min-h-[60vh] flex flex-col justify-center">
      <Breadcrumb items={[{ label: 'Not found' }]} />
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="That route doesn't exist — head back to the catalog or dashboard."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/" className="btn-primary text-sm">Home</Link>
            <Link to="/casinos" className="btn-glow text-sm">Browse casinos</Link>
            <Link to="/dashboard" className="btn-secondary text-sm">Dashboard</Link>
            <Link to="/legal" className="btn-secondary text-sm inline-flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" /> Legal
            </Link>
          </div>
        }
      />
    </div>
  );
}
