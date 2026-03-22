import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/ui/loading-screen';

interface PartnerRouteProps {
  children: React.ReactNode;
}

const PartnerRoute = ({ children }: PartnerRouteProps) => {
  const { user, loading, userRole } = useAuth();

  if (loading) {
    return <LoadingScreen />;
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
