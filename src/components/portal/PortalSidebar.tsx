import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Receipt, 
  MessageSquare,
  User,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

const menuItems = [
  { title: 'Dashboard', url: '/portal', icon: LayoutDashboard },
  { title: 'Contracts', url: '/portal/contracts', icon: FileText },
  { title: 'Invoices', url: '/portal/invoices', icon: Receipt },
  { title: 'Messages', url: '/portal/messages', icon: MessageSquare },
  { title: 'Profile', url: '/portal/profile', icon: User },
];

const PortalSidebar = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();

  const isActive = (path: string) => {
    if (path === '/portal') {
      return location.pathname === '/portal';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <Link to="/portal" className="flex items-center">
          <img
            src={logo}
            alt="Commercial Lending X logo"
            className="h-40 w-auto object-contain"
            loading="lazy"
          />
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Client Portal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url} className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        <div className="text-sm text-muted-foreground mb-2 truncate">
          {user?.email}
        </div>
        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default PortalSidebar;
