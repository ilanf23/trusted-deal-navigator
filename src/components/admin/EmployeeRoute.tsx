import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAuth } from '@/contexts/AuthContext';

interface EmployeeRouteProps {
  children: ReactNode;
  employeeName: string;
}

const EmployeeRoute = ({ children, employeeName }: EmployeeRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { teamMember, loading: teamLoading, canAccessDashboard, isOwner } = useTeamMember();

  if (authLoading || teamLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If user is not a team member at all, they can't access employee dashboards
  if (!teamMember) {
    return <Navigate to="/auth" replace />;
  }

  // Check if user can access this specific employee's dashboard
  if (!canAccessDashboard(employeeName)) {
    // Redirect to their own dashboard - use /user/ path for employees
    return <Navigate to={`/user/${teamMember.name.toLowerCase()}`} replace />;
  }

  return <>{children}</>;
};

export default EmployeeRoute;
