import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AdminSidebar from './AdminSidebar';
import FloatingInbox from './FloatingInbox';
import FloatingBugReport from './FloatingBugReport';
import AIEmailAssistant from './AIEmailAssistant';
import { Menu, Moon, Sun, Undo2, Loader2, Columns2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { UndoProvider, useUndo } from '@/contexts/UndoContext';
import { useAIAssistant } from '@/contexts/AIAssistantContext';
import { SplitViewProvider, useSplitView } from '@/contexts/SplitViewContext';
import SplitViewContainer from './splitview/SplitViewContainer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useState, createContext, useContext } from 'react';
import { AdminTopBarProvider, useAdminTopBar } from '@/contexts/AdminTopBarContext';

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
            className={`h-10 w-10 md:h-11 md:w-11 rounded-xl hidden lg:inline-flex ${
              isActive ? 'bg-primary/10 text-primary' : ''
            }`}
          >
            <Columns2 className="h-5 w-5 md:h-6 md:w-6" />
            <span className="sr-only">Toggle split view</span>
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

const AdminLayoutContent = ({ children }: AdminLayoutProps) => {
  const [inboxOpen, setInboxOpen] = useState(false);
  const { theme, setTheme } = useTheme();
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

            {/* Center: search bar or spacer */}
            <div className="flex-1 flex justify-center min-w-0" key="topbar-center">
              {searchComponent && (
                <div className="w-full max-w-2xl">
                  {searchComponent}
                </div>
              )}
            </div>

            {/* Right: page actions + global actions */}
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              {actionsComponent}
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

              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="relative inline-flex items-center h-9 w-[4.25rem] md:h-10 md:w-[4.75rem] rounded-full bg-muted/60 border border-border/40 p-0.5 cursor-pointer transition-colors duration-300 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Toggle theme"
                role="switch"
                aria-checked={theme === 'dark'}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-8 w-8 md:h-9 md:w-9 rounded-full shadow-md transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    theme === 'dark'
                      ? 'translate-x-[100%] bg-slate-700'
                      : 'translate-x-0 bg-white'
                  }`}
                />
                <span className="relative z-10 flex items-center justify-center h-8 w-8 md:h-9 md:w-9">
                  <Sun className={`h-4 w-4 md:h-[1.125rem] md:w-[1.125rem] transition-colors duration-300 ${
                    theme === 'dark' ? 'text-muted-foreground/40' : 'text-amber-500'
                  }`} />
                </span>
                <span className="relative z-10 flex items-center justify-center h-8 w-8 md:h-9 md:w-9">
                  <Moon className={`h-4 w-4 md:h-[1.125rem] md:w-[1.125rem] transition-colors duration-300 ${
                    theme === 'dark' ? 'text-blue-400' : 'text-muted-foreground/40'
                  }`} />
                </span>
                <span className="sr-only">Toggle theme</span>
              </button>
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
