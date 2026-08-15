import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { paths } from './paths';
import { Icon } from '@/components/icon';

/**
 * Gate for authenticated routes. While the `me` query resolves we show a
 * spinner; unauthenticated users are redirected to login with a `from` state
 * so they can be returned after signing in.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted">
        <Icon variant="icon-loading" size={28} spin />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={paths.login} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
