import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AdminSidebar from './AdminSidebar';
import FloatingInbox from './FloatingInbox';
import AIEmailAssistant from './AIEmailAssistant';
import { IncomingCallPopup } from '@/components/evan/IncomingCallPopup';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [inboxOpen, setInboxOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full admin-portal">
        <AdminSidebar 
          onInboxToggle={() => setInboxOpen(!inboxOpen)} 
          inboxOpen={inboxOpen}
          onAIAssistantToggle={() => setAiAssistantOpen(!aiAssistantOpen)}
          aiAssistantOpen={aiAssistantOpen}
        />
        <main className="flex-1 bg-muted/30">
          <header className="h-14 flex items-center border-b border-border bg-card px-4">
            <SidebarTrigger />
          </header>
          <div className="p-6">
            {children}
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