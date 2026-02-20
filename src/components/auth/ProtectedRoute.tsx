import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  clientOnly?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false, clientOnly = false }: ProtectedRouteProps) => {
  const { user, loading, isAdmin, userRole } = useAuth();
  const { teamMember, loading: teamLoading } = useTeamMember();
  const location = useLocation();

  if (loading || teamLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Redirect partners away from admin and client routes
  if (userRole === 'partner') {
    return <Navigate to="/partner" replace />;
  }

  // If requireAdmin, redirect non-owner team members to their own dashboard
  if (requireAdmin && teamMember && !teamMember.is_owner) {
    const redirectPath = `/admin/${teamMember.name.toLowerCase()}`;
    return <Navigate to={redirectPath} replace />;
  }

  // Redirect admins away from client portal
  if (clientOnly && isAdmin) {
    return <Navigate to="/superadmin" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/user" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
