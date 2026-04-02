import AdminLayout from '@/components/admin/AdminLayout';

interface EmployeeLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout wrapper for Evan's portal pages.
 * The CallProvider is handled by EmployeePortalWrapper at a higher level
 * so call state persists across navigation.
 */
const EmployeeLayout = ({ children }: EmployeeLayoutProps) => {
  return (
    <AdminLayout>
      {children}
    </AdminLayout>
  );
};

export default EmployeeLayout;
