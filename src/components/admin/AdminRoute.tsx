import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAuth } from '@/contexts/AuthContext';

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { teamMember, loading: teamLoading } = useTeamMember();
  const location = useLocation();

  if (authLoading || teamLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!teamMember) {
    return <Navigate to="/user" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
