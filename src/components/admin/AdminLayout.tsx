import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AdminSidebar from './AdminSidebar';
import FloatingInbox from './FloatingInbox';
import AIEmailAssistant from './AIEmailAssistant';
import { IncomingCallPopup } from '@/components/evan/IncomingCallPopup';
import { Menu } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [inboxOpen, setInboxOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full admin-portal bg-[hsl(220_14%_97%)]">
        <AdminSidebar 
          onInboxToggle={() => setInboxOpen(!inboxOpen)} 
          inboxOpen={inboxOpen}
          onAIAssistantToggle={() => setAiAssistantOpen(!aiAssistantOpen)}
          aiAssistantOpen={aiAssistantOpen}
        />
        <main className="flex-1 flex flex-col min-h-screen">
          {/* Top Bar - Minimal */}
          <header className="h-14 flex items-center justify-between border-b border-border/40 bg-white/80 backdrop-blur-xl sticky top-0 z-40 px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="w-9 h-9 rounded-lg hover:bg-muted/60 transition-colors flex items-center justify-center">
                <Menu className="w-5 h-5 text-muted-foreground" />
              </SidebarTrigger>
            </div>
            
            {/* Time Display */}
            <div className="flex items-center gap-6">
              <time className="text-sm text-muted-foreground font-medium tabular-nums">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </time>
            </div>
          </header>
          
          {/* Main Content Area */}
          <div className="flex-1 p-6 lg:p-8 animate-fade-in">
            <div className="max-w-[1600px] mx-auto">
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
