import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import PartnerLayout from './PartnerLayout';

const PartnerRouteLayout = () => {
  const { user, loading, userRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
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
