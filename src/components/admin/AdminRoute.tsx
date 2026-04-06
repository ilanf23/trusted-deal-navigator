import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/ui/loading-screen';

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { teamMember, loading: teamLoading } = useTeamMember();
  const location = useLocation();

  if (authLoading || teamLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Allow access if user is a team member OR has an admin role
  if (!teamMember && !isAdmin) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
