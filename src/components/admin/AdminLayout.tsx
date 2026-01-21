import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AdminSidebar from './AdminSidebar';
import FloatingInbox from './FloatingInbox';
import FloatingBugReport from './FloatingBugReport';
import FloatingAIChat from './FloatingAIChat';
import AIEmailAssistant from './AIEmailAssistant';
import { IncomingCallPopup } from '@/components/evan/IncomingCallPopup';
import { Menu } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

// Removed the seam mask as it's no longer needed with sidebar above header

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [inboxOpen, setInboxOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full admin-portal bg-background">
        <AdminSidebar 
          onInboxToggle={() => setInboxOpen(!inboxOpen)} 
          inboxOpen={inboxOpen}
          onAIToggle={() => setAiChatOpen(!aiChatOpen)}
          aiChatOpen={aiChatOpen}
        />

        <main className="flex-1 flex flex-col min-h-screen">
          {/* Top Bar - only spans the content area, not the sidebar */}
          <header className="h-16 flex items-center justify-between border-b border-border bg-card sticky top-0 z-[5] pl-4 pr-8">
            <div className="flex items-center gap-5 ml-24">
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
        <FloatingAIChat isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} />
        <AIEmailAssistant 
          isOpen={false} 
          onClose={() => {}}
          lead={null}
          onUseEmail={() => {}}
        />
        <IncomingCallPopup />
        <FloatingBugReport />
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
