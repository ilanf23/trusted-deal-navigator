import AdminLayout from '@/components/admin/AdminLayout';

interface EvanLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout wrapper for Evan's portal pages.
 * The CallProvider is handled by EvanPortalWrapper at a higher level
 * so call state persists across navigation.
 */
const EvanLayout = ({ children }: EvanLayoutProps) => {
  return (
    <AdminLayout>
      {children}
    </AdminLayout>
  );
};

export default EvanLayout;
