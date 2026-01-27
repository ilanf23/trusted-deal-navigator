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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import logo from '@/assets/logo.png';

const menuItems = [
  { title: 'Dashboard', url: '/user', icon: LayoutDashboard },
  { title: 'Contracts', url: '/user/contracts', icon: FileText },
  { title: 'Invoices', url: '/user/invoices', icon: Receipt },
  { title: 'Messages', url: '/user/messages', icon: MessageSquare },
  { title: 'Profile', url: '/user/profile', icon: User },
];

const PortalSidebar = () => {
  const location = useLocation();
  const { signOut, user } = useAuth();

  const isActive = (path: string) => {
    if (path === '/user') {
      return location.pathname === '/user';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar className="border-r-0 bg-[#0a1628]">
      <SidebarHeader className="p-0 border-b-0">
        <Link to="/user" className="flex items-center justify-center py-4">
          <img
            src={logo}
            alt="Commercial Lending X logo"
            className="h-44 w-auto object-contain"
            loading="lazy"
          />
        </Link>
        <div className="h-px bg-white/20 mx-4 -mt-2" />
      </SidebarHeader>
      
      <SidebarContent className="px-3 pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.url)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all
                      ${isActive(item.url) 
                        ? 'bg-white/10 text-white' 
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }
                    `}
                  >
                    <Link to={item.url}>
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

      <SidebarFooter className="p-4 border-t border-white/10">
        <div className="text-xs text-white/50 mb-3 truncate font-medium">
          {user?.email}
        </div>
        <Button 
          variant="outline" 
          className="w-full bg-transparent border-white/20 text-white/80 hover:bg-white/10 hover:text-white hover:border-white/30 text-sm font-medium"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default PortalSidebar;
