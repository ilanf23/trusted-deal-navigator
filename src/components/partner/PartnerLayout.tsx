import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import PartnerSidebar from './PartnerSidebar';

interface PartnerLayoutProps {
  children: React.ReactNode;
}

const PartnerLayout = ({ children }: PartnerLayoutProps) => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <PartnerSidebar />
        <main className="flex-1 bg-muted/30">
          <header className="h-14 flex items-center border-b border-border bg-card px-4">
            <SidebarTrigger />
            <span className="ml-3 text-sm font-medium text-muted-foreground">Partner Portal</span>
          </header>
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default PartnerLayout;
