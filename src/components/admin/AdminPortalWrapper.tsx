import { Outlet } from 'react-router-dom';
import { DraftProvider } from '@/contexts/DraftContext';
import { EmployeeUIStateProvider } from '@/contexts/EmployeeUIStateContext';
import EmployeeLayout from '@/components/employee/EmployeeLayout';

/**
 * Wrapper for all admin portal routes.
 * Provides DraftProvider and EmployeeUIStateProvider contexts at a level
 * that persists across route changes, allowing email drafts to persist
 * and UI state (filters, dialogs, view modes) to survive navigation.
 * CallProvider is now at App level for global device registration.
 *
 * EmployeeLayout is lifted here so AdminSidebar mounts once and persists
 * across all admin route navigations (prevents scroll reset on nav).
 * Individual pages that still wrap in EmployeeLayout are safe — the
 * alreadyMounted guard in AdminLayout turns them into no-ops.
 */
const AdminPortalWrapper = () => {
  return (
    <DraftProvider>
      <EmployeeUIStateProvider>
        <EmployeeLayout>
          <Outlet />
        </EmployeeLayout>
      </EmployeeUIStateProvider>
    </DraftProvider>
  );
};

export default AdminPortalWrapper;
