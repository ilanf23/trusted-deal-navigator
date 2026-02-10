import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  clientOnly?: boolean;
}

// Team members who should NOT have admin access
const TEAM_MEMBER_EMAILS: Record<string, string> = {
  'evan@test.com': '/admin/evan',
  'evan@commerciallendingx.com': '/admin/evan',
  'maura@test.com': '/admin/maura',
  'wendy@test.com': '/admin/wendy',
};

const ProtectedRoute = ({ children, requireAdmin = false, clientOnly = false }: ProtectedRouteProps) => {
  const { user, loading, isAdmin, userRole } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const userEmail = (user.email ?? '').toLowerCase();

  // Redirect partners away from admin and client routes
  if (userRole === 'partner') {
    return <Navigate to="/partner" replace />;
  }

  // Check if user is a team member trying to access admin routes
  if (requireAdmin && TEAM_MEMBER_EMAILS[userEmail]) {
    return <Navigate to={TEAM_MEMBER_EMAILS[userEmail]} replace />;
  }

  // Redirect admins away from client portal
  if (clientOnly && isAdmin) {
    return <Navigate to="/superadmin" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
