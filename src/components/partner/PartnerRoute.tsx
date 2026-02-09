import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface PartnerRouteProps {
  children: React.ReactNode;
}

const PartnerRoute = ({ children }: PartnerRouteProps) => {
  const { user, loading, userRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (userRole !== 'partner') {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

export default PartnerRoute;
