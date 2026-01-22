import { useEffect } from 'react';
import { useTheme } from 'next-themes';

interface PublicLayoutProps {
  children: React.ReactNode;
}

const PublicLayout = ({ children }: PublicLayoutProps) => {
  const { setTheme, theme } = useTheme();

  // Force light mode on public pages
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className="light" data-theme="light">
      <div className="bg-background text-foreground min-h-screen">
        {children}
      </div>
    </div>
  );
};

export default PublicLayout;
