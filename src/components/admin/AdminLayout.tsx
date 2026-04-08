import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AdminSidebar from './AdminSidebar';
import FloatingInbox from './FloatingInbox';
import FloatingBugReport from './FloatingBugReport';
import AIEmailAssistant from './AIEmailAssistant';
import { Menu, Undo2, Loader2, Columns2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UndoProvider, useUndo } from '@/contexts/UndoContext';
import { useAIAssistant } from '@/contexts/AIAssistantContext';
import { SplitViewProvider, useSplitView } from '@/contexts/SplitViewContext';
import SplitViewContainer from './splitview/SplitViewContainer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useState, createContext, useContext } from 'react';
import { AdminTopBarProvider, useAdminTopBar } from '@/contexts/AdminTopBarContext';
import NotificationBell from './NotificationBell';
import AdminTopBarSearch from './AdminTopBarSearch';

export const AdminLayoutMountedContext = createContext(false);

interface AdminLayoutProps {
  children: React.ReactNode;
}

const SplitViewToggle = () => {
  const { isActive, toggleSplitView } = useSplitView();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSplitView}
            aria-pressed={isActive}
            aria-label={isActive ? 'Exit split view' : 'Enter split view'}
            className={`hidden lg:flex h-10 w-10 md:h-11 md:w-11 rounded-xl transition-all ${
              isActive
                ? 'text-violet-600 bg-violet-50 hover:bg-violet-100 dark:text-violet-400 dark:bg-violet-900/20 dark:hover:bg-violet-900/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Columns2 className="h-5 w-5 md:h-6 md:w-6" />
            <span className="sr-only">Split View</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isActive ? 'Exit Split View' : 'Split View'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const SplitViewContent = ({ children }: AdminLayoutProps) => {
  const { isActive } = useSplitView();

  if (isActive) {
    return (
      <div data-split-view className="flex-1 min-h-0 overflow-hidden relative">
        <SplitViewContainer />
      </div>
    );
  }

  return (
    <div className="flex-1 p-3 sm:p-4 md:p-6 lg:p-8 xl:p-10 animate-fade-in overflow-x-auto bg-muted/40">
      <div className="max-w-[1800px] mx-auto">
        {children}
      </div>
    </div>
  );
};

const DefaultTopBarSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  return (
    <AdminTopBarSearch
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  );
};

const AdminLayoutContent = ({ children }: AdminLayoutProps) => {
  const [inboxOpen, setInboxOpen] = useState(false);
  const { lastAction, isUndoing, executeUndo } = useUndo();
  const { isOpen: aiChatOpen, setIsOpen: setAiChatOpen } = useAIAssistant();
  const { pageTitle, searchComponent, actionsComponent } = useAdminTopBar();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full admin-portal bg-background overflow-hidden">
        <AdminSidebar
          onInboxToggle={() => setInboxOpen(!inboxOpen)}
          inboxOpen={inboxOpen}
          onAIToggle={() => setAiChatOpen(!aiChatOpen)}
          aiChatOpen={aiChatOpen}
        />

        <main className="flex-1 flex flex-col h-screen min-w-0 overflow-x-auto">
          {/* Top Bar - responsive padding and layout */}
          <header className="h-14 md:h-16 flex items-center border-b border-border bg-card sticky top-0 z-[5] px-3 md:px-4 lg:pl-4 lg:pr-8 gap-3">
            {/* Left: hamburger + page title */}
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <SidebarTrigger className="w-10 h-10 md:w-11 md:h-11 rounded-xl hover:bg-muted transition-colors flex items-center justify-center group">
                <Menu className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground group-hover:text-foreground" />
              </SidebarTrigger>
              {pageTitle && (
                <h1 className="text-lg font-bold text-foreground whitespace-nowrap hidden sm:block">
                  {pageTitle}
                </h1>
              )}
            </div>

            {/* Center: search bar (page-specific or default CRM search) */}
            <div className="flex-1 flex justify-center min-w-0" key="topbar-center">
              <div className="w-full max-w-[614px]">
                {searchComponent || <DefaultTopBarSearch />}
              </div>
            </div>

            {/* Right: page actions + global actions */}
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              {actionsComponent}
              {/* Notification Bell */}
              <NotificationBell />
              {/* Undo Button - Always Visible */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={executeUndo}
                      disabled={!lastAction || isUndoing}
                      className={`h-10 w-10 md:h-11 md:w-11 rounded-xl transition-all ${
                        lastAction 
                          ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20' 
                          : 'text-muted-foreground/40'
                      }`}
                    >
                      {isUndoing ? (
                        <Loader2 className="h-5 w-5 md:h-6 md:w-6 animate-spin" />
                      ) : (
                        <Undo2 className="h-5 w-5 md:h-6 md:w-6" />
                      )}
                      <span className="sr-only">Undo last action</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {lastAction ? (
                      <p>Undo: {lastAction.label}</p>
                    ) : (
                      <p>No actions to undo</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Split View Toggle */}
              <SplitViewToggle />
            </div>
          </header>
          
          {/* Main Content Area */}
          <SplitViewContent>{children}</SplitViewContent>
        </main>
        
        <FloatingInbox isOpen={inboxOpen} onClose={() => setInboxOpen(false)} />
        <AIEmailAssistant 
          isOpen={false} 
          onClose={() => {}}
          lead={null}
          onUseEmail={() => {}}
        />
        <FloatingBugReport />
      </div>
    </SidebarProvider>
  );
};

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const alreadyMounted = useContext(AdminLayoutMountedContext);
  
  // If already inside an AdminLayout (e.g. via AdminRouteLayout), just render children
  if (alreadyMounted) {
    return <>{children}</>;
  }

  return (
    <AdminLayoutMountedContext.Provider value={true}>
      <UndoProvider>
        <SplitViewProvider>
          <AdminTopBarProvider>
            <AdminLayoutContent>{children}</AdminLayoutContent>
          </AdminTopBarProvider>
        </SplitViewProvider>
      </UndoProvider>
    </AdminLayoutMountedContext.Provider>
  );
};

export default AdminLayout;
