import { Outlet } from 'react-router-dom';
import { CallProvider } from '@/contexts/CallContext';
import { DraftProvider } from '@/contexts/DraftContext';
import { EvanUIStateProvider } from '@/contexts/EvanUIStateContext';
import { IncomingCallPopup } from '@/components/evan/IncomingCallPopup';

/**
 * Wrapper for all Evan portal routes.
 * Provides the CallProvider, DraftProvider, and EvanUIStateProvider contexts at a level
 * that persists across route changes, allowing calls to continue, email drafts to persist,
 * and UI state (filters, dialogs, view modes) to survive navigation.
 */
const EvanPortalWrapper = () => {
  return (
    <CallProvider>
      <DraftProvider>
        <EvanUIStateProvider>
          <Outlet />
          {/* Global incoming call popup - persists across all Evan routes */}
          <IncomingCallPopup />
        </EvanUIStateProvider>
      </DraftProvider>
    </CallProvider>
  );
};

export default EvanPortalWrapper;
