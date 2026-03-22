import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/ui/loading-screen';

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { teamMember, loading: teamLoading } = useTeamMember();
  const location = useLocation();

  if (authLoading || teamLoading) {
    return <LoadingScreen />;
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
