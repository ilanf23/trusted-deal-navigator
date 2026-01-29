import { Outlet } from 'react-router-dom';
import { CallProvider } from '@/contexts/CallContext';
import { IncomingCallPopup } from '@/components/evan/IncomingCallPopup';

/**
 * Wrapper for all Evan portal routes.
 * Provides the CallProvider context at a level that persists across route changes,
 * allowing calls to continue when navigating between pages.
 */
const EvanPortalWrapper = () => {
  return (
    <CallProvider>
      <Outlet />
      {/* Global incoming call popup - persists across all Evan routes */}
      <IncomingCallPopup />
    </CallProvider>
  );
};

export default EvanPortalWrapper;
