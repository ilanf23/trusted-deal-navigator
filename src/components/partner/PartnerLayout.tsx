import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import PartnerSidebar from './PartnerSidebar';
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

interface PartnerLayoutProps {
  children: React.ReactNode;
}

const PartnerLayout = ({ children }: PartnerLayoutProps) => {
  const { theme, setTheme } = useTheme();

  // Default to light mode on first visit
  useEffect(() => {
    if (!localStorage.getItem('partner-theme-set')) {
      setTheme('light');
      localStorage.setItem('partner-theme-set', 'true');
    }
  }, [setTheme]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <PartnerSidebar />
        <main className="flex-1 flex flex-col min-h-screen w-full overflow-x-hidden">
          <header className="h-14 md:h-16 flex items-center justify-between border-b border-border bg-card sticky top-0 z-[5] px-3 md:px-4 lg:pl-4 lg:pr-8">
            <div className="flex items-center gap-2 md:gap-5 ml-0 md:ml-12">
              <SidebarTrigger className="w-10 h-10 md:w-11 md:h-11 rounded-xl hover:bg-muted transition-colors flex items-center justify-center group">
                <Menu className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground group-hover:text-foreground" />
              </SidebarTrigger>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <time className="text-sm md:text-base text-muted-foreground font-medium tabular-nums hidden sm:block">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </time>
              <time className="text-sm text-muted-foreground font-medium tabular-nums sm:hidden">
                {new Date().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </time>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="h-10 w-10 md:h-11 md:w-11 rounded-xl"
              >
                <Sun className="h-5 w-5 md:h-6 md:w-6 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 md:h-6 md:w-6 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </div>
          </header>

          <div className="flex-1 p-4 md:p-6 lg:p-8 xl:p-10 animate-fade-in overflow-x-auto">
            <div className="max-w-[1800px] mx-auto">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default PartnerLayout;
