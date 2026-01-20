import { useState } from 'react';
import { SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import AdminSidebar from './AdminSidebar';
import FloatingInbox from './FloatingInbox';
import AIEmailAssistant from './AIEmailAssistant';
import { IncomingCallPopup } from '@/components/evan/IncomingCallPopup';
import { Menu } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const SidebarHeaderSeamMask = () => {
  const { open, isMobile } = useSidebar();

  // Only needed on desktop when the sidebar is open.
  if (isMobile || !open) return null;

  return (
    <>
      {/* Horizontal mask to blend sidebar top with header */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-50 h-16 w-[var(--sidebar-width)] bg-gradient-to-r from-slate-50 via-slate-50 to-transparent dark:from-slate-900 dark:via-slate-900"
      />
      {/* Corner blend element */}
      <div
        aria-hidden
        className="pointer-events-none fixed top-16 left-[calc(var(--sidebar-width)-1px)] z-50 w-4 h-4 bg-gradient-to-br from-slate-50 to-transparent dark:from-slate-900"
      />
    </>
  );
};

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [inboxOpen, setInboxOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full admin-portal bg-background">
        <AdminSidebar 
          onInboxToggle={() => setInboxOpen(!inboxOpen)} 
          inboxOpen={inboxOpen}
          onAIAssistantToggle={() => setAiAssistantOpen(!aiAssistantOpen)}
          aiAssistantOpen={aiAssistantOpen}
        />

        <SidebarHeaderSeamMask />

        <main className="flex-1 flex flex-col min-h-screen">
          {/* Top Bar */}
          <header className="h-16 flex items-center justify-between border-b border-border/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-8">
            <div className="flex items-center gap-5">
              <SidebarTrigger className="w-11 h-11 rounded-xl border border-border/40 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center group shadow-sm">
                <Menu className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
              </SidebarTrigger>
            </div>
            
            {/* Time Display */}
            <div className="flex items-center gap-8">
              <time className="text-base text-muted-foreground font-medium tabular-nums">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </time>
            </div>
          </header>
          
          {/* Main Content Area */}
          <div className="flex-1 p-8 lg:p-10 animate-fade-in">
            <div className="max-w-[1800px] mx-auto">
              {children}
            </div>
          </div>
        </main>
        
        <FloatingInbox isOpen={inboxOpen} onClose={() => setInboxOpen(false)} />
        <AIEmailAssistant 
          isOpen={aiAssistantOpen} 
          onClose={() => setAiAssistantOpen(false)}
          lead={null}
          onUseEmail={() => {}}
        />
        <IncomingCallPopup />
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
