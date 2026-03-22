import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import LoadingScreen from '@/components/ui/loading-screen';
import PartnerLayout from './PartnerLayout';

const PartnerRouteLayout = () => {
  const { user, loading, userRole } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user || userRole !== 'partner') {
    return <Navigate to="/auth" replace />;
  }

  return (
    <PartnerLayout>
      <Outlet />
    </PartnerLayout>
  );
};

export default PartnerRouteLayout;
