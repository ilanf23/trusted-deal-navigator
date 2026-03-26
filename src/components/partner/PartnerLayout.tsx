import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import PartnerSidebar from './PartnerSidebar';
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
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
