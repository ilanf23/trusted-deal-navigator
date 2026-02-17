import { Outlet } from 'react-router-dom';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AdminLayout from './AdminLayout';

const AdminRouteLayout = () => {
  return (
    <ProtectedRoute requireAdmin>
      <AdminLayout>
        <Outlet />
      </AdminLayout>
    </ProtectedRoute>
  );
};

export default AdminRouteLayout;
