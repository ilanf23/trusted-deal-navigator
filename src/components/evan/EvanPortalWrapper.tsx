import { Outlet } from 'react-router-dom';
import { CallProvider } from '@/contexts/CallContext';
import { DraftProvider } from '@/contexts/DraftContext';
import { IncomingCallPopup } from '@/components/evan/IncomingCallPopup';

/**
 * Wrapper for all Evan portal routes.
 * Provides the CallProvider and DraftProvider contexts at a level that persists across route changes,
 * allowing calls to continue and email drafts to persist when navigating between pages.
 * 
 * Note: AIAssistantProvider is now in AdminLayout for site-wide persistence.
 */
const EvanPortalWrapper = () => {
  return (
    <CallProvider>
      <DraftProvider>
        <Outlet />
        {/* Global incoming call popup - persists across all Evan routes */}
        <IncomingCallPopup />
      </DraftProvider>
    </CallProvider>
  );
};

export default EvanPortalWrapper;
