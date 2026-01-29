import AdminLayout from '@/components/admin/AdminLayout';
import { IncomingCallPopup } from '@/components/evan/IncomingCallPopup';

interface EvanLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout wrapper for Evan's portal pages.
 * Includes the global incoming call popup so Evan can navigate between tabs while on a call.
 */
const EvanLayout = ({ children }: EvanLayoutProps) => {
  return (
    <AdminLayout>
      {children}
      {/* Global incoming call popup - allows navigation while on call */}
      <IncomingCallPopup />
    </AdminLayout>
  );
};

export default EvanLayout;
