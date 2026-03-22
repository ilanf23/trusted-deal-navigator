import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/ui/loading-screen';

interface EmployeeRouteProps {
  children: ReactNode;
  employeeName: string;
}

const EmployeeRoute = ({ children, employeeName }: EmployeeRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { teamMember, loading: teamLoading, canAccessDashboard, isOwner } = useTeamMember();
  const location = useLocation();

  if (authLoading || teamLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If user is not a team member at all, they can't access employee dashboards
  if (!teamMember) {
    return <Navigate to="/user" replace />;
  }

  // Check if user can access this specific employee's dashboard
  if (!canAccessDashboard(employeeName)) {
    const founderUsers = ['brad', 'adam'];
    const isFounder = founderUsers.includes(teamMember.name.toLowerCase());
    const redirectPath = isFounder 
      ? `/superadmin/${teamMember.name.toLowerCase()}`
      : `/admin/${teamMember.name.toLowerCase()}`;
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default EmployeeRoute;
