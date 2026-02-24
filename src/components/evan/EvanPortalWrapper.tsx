import { Outlet } from 'react-router-dom';
import { DraftProvider } from '@/contexts/DraftContext';
import { EvanUIStateProvider } from '@/contexts/EvanUIStateContext';
import EvanLayout from '@/components/evan/EvanLayout';

/**
 * Wrapper for all Evan portal routes.
 * Provides DraftProvider and EvanUIStateProvider contexts at a level
 * that persists across route changes, allowing email drafts to persist
 * and UI state (filters, dialogs, view modes) to survive navigation.
 * CallProvider is now at App level for global device registration.
 *
 * EvanLayout is lifted here so AdminSidebar mounts once and persists
 * across all Evan route navigations (prevents scroll reset on nav).
 * Individual pages that still wrap in EvanLayout are safe — the
 * alreadyMounted guard in AdminLayout turns them into no-ops.
 */
const EvanPortalWrapper = () => {
  return (
    <DraftProvider>
      <EvanUIStateProvider>
        <EvanLayout>
          <Outlet />
        </EvanLayout>
      </EvanUIStateProvider>
    </DraftProvider>
  );
};

export default EvanPortalWrapper;
