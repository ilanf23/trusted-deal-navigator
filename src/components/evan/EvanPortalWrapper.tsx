import { Outlet } from 'react-router-dom';
import { DraftProvider } from '@/contexts/DraftContext';
import { EvanUIStateProvider } from '@/contexts/EvanUIStateContext';

/**
 * Wrapper for all Evan portal routes.
 * Provides DraftProvider and EvanUIStateProvider contexts at a level
 * that persists across route changes, allowing email drafts to persist
 * and UI state (filters, dialogs, view modes) to survive navigation.
 * CallProvider is now at App level for global device registration.
 */
const EvanPortalWrapper = () => {
  return (
    <DraftProvider>
      <EvanUIStateProvider>
        <Outlet />
      </EvanUIStateProvider>
    </DraftProvider>
  );
};

export default EvanPortalWrapper;
