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
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-[var(--sidebar-width)] z-50 h-16 w-px bg-card/90 backdrop-blur-xl"
    />
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
          <header className="h-16 flex items-center justify-between border-b border-border bg-card/90 backdrop-blur-xl sticky top-0 z-40 px-8">
            <div className="flex items-center gap-5">
              <SidebarTrigger className="w-11 h-11 rounded-xl hover:bg-muted transition-colors flex items-center justify-center group">
                <Menu className="w-6 h-6 text-muted-foreground group-hover:text-foreground" />
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
