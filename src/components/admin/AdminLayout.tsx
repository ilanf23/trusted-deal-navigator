import { useState } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AdminSidebar from './AdminSidebar';
import FloatingInbox from './FloatingInbox';
import FloatingBugReport from './FloatingBugReport';
import FloatingAIChat from './FloatingAIChat';
import AIEmailAssistant from './AIEmailAssistant';
import { IncomingCallPopup } from '@/components/evan/IncomingCallPopup';
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

interface AdminLayoutProps {
  children: React.ReactNode;
}

// Removed the seam mask as it's no longer needed with sidebar above header

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [inboxOpen, setInboxOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full admin-portal bg-background">
        <AdminSidebar 
          onInboxToggle={() => setInboxOpen(!inboxOpen)} 
          inboxOpen={inboxOpen}
          onAIToggle={() => setAiChatOpen(!aiChatOpen)}
          aiChatOpen={aiChatOpen}
        />

        <main className="flex-1 flex flex-col min-h-screen w-full overflow-x-hidden">
          {/* Top Bar - responsive padding and layout */}
          <header className="h-14 md:h-16 flex items-center justify-between border-b border-border bg-card sticky top-0 z-[5] px-3 md:px-4 lg:pl-4 lg:pr-8">
            <div className="flex items-center gap-2 md:gap-5 ml-0 md:ml-12">
              <SidebarTrigger className="w-10 h-10 md:w-11 md:h-11 rounded-xl hover:bg-muted transition-colors flex items-center justify-center group">
                <Menu className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground group-hover:text-foreground" />
              </SidebarTrigger>
            </div>
            
            {/* Time Display - hidden on small screens */}
            <div className="flex items-center gap-4 md:gap-8">
              <time className="text-sm md:text-base text-muted-foreground font-medium tabular-nums hidden sm:block">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </time>
              <time className="text-sm text-muted-foreground font-medium tabular-nums sm:hidden">
                {new Date().toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </time>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="h-9 w-9 rounded-lg"
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </div>
          </header>
          
          {/* Main Content Area - responsive padding */}
          <div className="flex-1 p-4 md:p-6 lg:p-8 xl:p-10 animate-fade-in overflow-x-auto">
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
