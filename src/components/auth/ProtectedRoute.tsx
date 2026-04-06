import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import LoadingScreen from '@/components/ui/loading-screen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, loading, isAdmin, userRole } = useAuth();
  const { teamMember, loading: teamLoading } = useTeamMember();
  const location = useLocation();

  if (loading || teamLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Redirect partners away from admin routes
  if (userRole === 'partner') {
    return <Navigate to="/partner" replace />;
  }

  // If requireAdmin, redirect non-owner team members to their own dashboard
  // But allow access if they're already on an /admin/ path (their own routes)
  if (requireAdmin && teamMember && !teamMember.is_owner) {
    const isOnAdminPath = location.pathname.startsWith('/admin/');
    if (!isOnAdminPath) {
      const redirectPath = `/admin/${teamMember.name.toLowerCase()}`;
      return <Navigate to={redirectPath} replace />;
    }
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
