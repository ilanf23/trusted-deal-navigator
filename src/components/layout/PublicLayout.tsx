interface PublicLayoutProps {
  children: React.ReactNode;
}

const PublicLayout = ({ children }: PublicLayoutProps) => {
  return (
    <div 
      className="min-h-screen"
      style={{
        // Force light mode colors regardless of dark mode setting
        '--background': '0 0% 100%',
        '--foreground': '222.2 84% 4.9%',
        '--card': '0 0% 100%',
        '--card-foreground': '222.2 84% 4.9%',
        '--popover': '0 0% 100%',
        '--popover-foreground': '222.2 84% 4.9%',
        '--primary': '221.2 83.2% 25%',
        '--primary-foreground': '210 40% 98%',
        '--secondary': '39 50% 95%',
        '--secondary-foreground': '39 60% 35%',
        '--muted': '210 40% 96.1%',
        '--muted-foreground': '215.4 16.3% 46.9%',
        '--accent': '25 95% 53%',
        '--accent-foreground': '0 0% 100%',
        '--border': '214.3 31.8% 91.4%',
        '--input': '214.3 31.8% 91.4%',
        '--ring': '221.2 83.2% 53.3%',
        backgroundColor: 'hsl(0 0% 100%)',
        color: 'hsl(222.2 84% 4.9%)',
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
};

export default PublicLayout;
