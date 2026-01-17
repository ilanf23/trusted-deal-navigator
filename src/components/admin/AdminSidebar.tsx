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
  User,
  Mail,
  Sparkles,
  ChevronRight,
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

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

const peopleItems = [
  { title: "Evan's Page", url: '/admin/people/evans', icon: User },
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

  const getUserInitials = (email?: string) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  return (
    <Sidebar className="border-r border-border/40 bg-white/80 backdrop-blur-xl w-72">
      <SidebarHeader className="p-6 pb-5">
        <Link to="/admin" className="flex items-center gap-4 group">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-foreground to-foreground/80 flex items-center justify-center shadow-sm">
            <span className="text-background font-bold text-xl">C</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold tracking-tight text-foreground">Commercial Lending</span>
            <span className="text-sm text-muted-foreground font-medium">Admin Portal</span>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="px-4">
        {/* Pages Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-sm font-medium text-muted-foreground/70 uppercase tracking-wider mb-2">
            Pages
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {pageItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.url)} 
                    className={`
                      py-3.5 px-4 rounded-xl transition-all duration-200
                      ${isActive(item.url) 
                        ? 'bg-foreground text-background shadow-sm' 
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      }
                    `}
                  >
                    <Link to={item.url} className="flex items-center gap-4">
                      <item.icon className="w-[22px] h-[22px]" strokeWidth={1.75} />
                      <span className="text-base font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* People Section */}
        <SidebarGroup className="mt-8">
          <SidebarGroupLabel className="px-4 text-sm font-medium text-muted-foreground/70 uppercase tracking-wider mb-2">
            Team
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {peopleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.url)} 
                    className={`
                      py-3.5 px-4 rounded-xl transition-all duration-200
                      ${isActive(item.url) 
                        ? 'bg-foreground text-background shadow-sm' 
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                      }
                    `}
                  >
                    <Link to={item.url} className="flex items-center gap-4">
                      <item.icon className="w-[22px] h-[22px]" strokeWidth={1.75} />
                      <span className="text-base font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tools Section */}
        <SidebarGroup className="mt-8">
          <SidebarGroupLabel className="px-4 text-sm font-medium text-muted-foreground/70 uppercase tracking-wider mb-2">
            Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={onInboxToggle}
                  isActive={inboxOpen}
                  className={`
                    py-3.5 px-4 rounded-xl cursor-pointer transition-all duration-200
                    ${inboxOpen 
                      ? 'bg-foreground text-background shadow-sm' 
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }
                  `}
                >
                  <div className="flex items-center gap-4">
                    <Mail className="w-[22px] h-[22px]" strokeWidth={1.75} />
                    <span className="text-base font-medium">Email</span>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto opacity-40" />
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={onAIAssistantToggle}
                  isActive={aiAssistantOpen}
                  className={`
                    py-3.5 px-4 rounded-xl cursor-pointer transition-all duration-200
                    ${aiAssistantOpen 
                      ? 'bg-foreground text-background shadow-sm' 
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }
                  `}
                >
                  <div className="flex items-center gap-4">
                    <Sparkles className="w-[22px] h-[22px]" strokeWidth={1.75} />
                    <span className="text-base font-medium">AI Agent</span>
                  </div>
                  <ChevronRight className="w-5 h-5 ml-auto opacity-40" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-5 border-t border-border/40">
        <div className="flex items-center gap-4 mb-4 px-1">
          <Avatar className="w-11 h-11 ring-2 ring-border/50">
            <AvatarFallback className="bg-muted text-muted-foreground text-base font-medium">
              {getUserInitials(user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-foreground truncate">
              {user?.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-4 text-muted-foreground hover:text-foreground hover:bg-muted/60 h-12 rounded-xl text-base" 
          onClick={signOut}
        >
          <LogOut className="w-[22px] h-[22px]" strokeWidth={1.75} />
          <span className="font-medium">Sign Out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
