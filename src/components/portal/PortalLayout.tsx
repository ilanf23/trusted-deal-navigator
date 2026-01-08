import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import PortalSidebar from './PortalSidebar';

interface PortalLayoutProps {
  children: React.ReactNode;
}

const PortalLayout = ({ children }: PortalLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <PortalSidebar />
        <main className="flex-1 bg-muted/30">
          <header className="h-14 flex items-center border-b border-border bg-card px-4">
            <SidebarTrigger />
          </header>
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default PortalLayout;
