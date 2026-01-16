import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  FileText, 
  Receipt, 
  MessageSquare,
  UserPlus,
  LogOut,
  Kanban,
  TrendingDown,
  Newspaper,
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
import gmailLogo from '@/assets/gmail-logo.png';
import chatgptLogo from '@/assets/chatgpt-logo.png';

interface AdminSidebarProps {
  onInboxToggle: () => void;
  inboxOpen: boolean;
  onAIAssistantToggle?: () => void;
  aiAssistantOpen?: boolean;
}

const pageItems = [
  { title: 'Dashboard', url: '/admin', icon: LayoutDashboard },
  { title: 'CRM Board', url: '/admin/crm', icon: Kanban },
  { title: 'Leads', url: '/admin/leads', icon: UserPlus },
  { title: 'Rate Watch', url: '/admin/rate-watch', icon: TrendingDown },
  { title: 'Clients', url: '/admin/clients', icon: Users },
  { title: 'Contracts', url: '/admin/contracts', icon: FileText },
  { title: 'Invoices', url: '/admin/invoices', icon: Receipt },
  { title: 'Messages', url: '/admin/messages', icon: MessageSquare },
  { title: 'Newsletter', url: '/admin/newsletter', icon: Newspaper },
  { title: 'Marketing', url: '/admin/marketing', icon: BarChart3 },
];

const AdminSidebar = ({ onInboxToggle, inboxOpen, onAIAssistantToggle, aiAssistantOpen }: AdminSidebarProps) => {
  const location = useLocation();
  const { signOut, user } = useAuth();

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <Link to="/admin" className="flex items-center">
          <img
            src={logo}
            alt="Commercial Lending X logo"
            className="h-40 w-auto object-contain"
            loading="lazy"
          />
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Pages Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Pages</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pageItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} className="py-4 px-4">
                    <Link to={item.url} className="flex items-center gap-4">
                      <item.icon className="w-6 h-6" />
                      <span className="text-base font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={onInboxToggle}
                  isActive={inboxOpen}
                  className="cursor-pointer py-4 px-4"
                >
                  <div className="flex items-center gap-4">
                    <img src={gmailLogo} alt="Gmail" className="w-6 h-6 object-contain" />
                    <span className="text-base font-medium">Email</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={onAIAssistantToggle}
                  isActive={aiAssistantOpen}
                  className="cursor-pointer py-4 px-4"
                >
                  <div className="flex items-center gap-4">
                    <img src={chatgptLogo} alt="AI Agent" className="w-6 h-6 object-contain" />
                    <span className="text-base font-medium">AI Agent</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
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

export default AdminSidebar;