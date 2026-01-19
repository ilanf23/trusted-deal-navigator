import { useState, useMemo } from 'react';
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
  ChevronDown,
  ChevronRight,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AdminSidebarProps {
  onInboxToggle: () => void;
  inboxOpen: boolean;
  onAIAssistantToggle?: () => void;
  aiAssistantOpen?: boolean;
}

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface NavSection {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

const AdminSidebar = ({ onInboxToggle, inboxOpen, onAIAssistantToggle, aiAssistantOpen }: AdminSidebarProps) => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { teamMember, isOwner, loading: teamLoading } = useTeamMember();

  // Build navigation sections based on user's role
  const navSections: NavSection[] = useMemo(() => {
    const sections: NavSection[] = [];

    // Dashboard section - show to owners, or customized for employees
    if (isOwner) {
      sections.push({
        title: 'Dashboard',
        icon: LayoutDashboard,
        items: [
          { title: 'Overview', url: '/admin', icon: LayoutDashboard },
          { title: 'CRM Board', url: '/admin/crm', icon: Kanban },
          { title: 'Leads', url: '/admin/leads', icon: UserPlus },
          { title: 'Rate Watch', url: '/admin/rate-watch', icon: TrendingDown },
          { title: 'Lender Programs', url: '/admin/lender-programs', icon: Building2 },
          { title: 'Clients', url: '/admin/clients', icon: Users },
          { title: 'Contracts', url: '/admin/contracts', icon: FileText },
          { title: 'Invoices', url: '/admin/invoices', icon: Receipt },
          { title: 'Messages', url: '/admin/messages', icon: MessageSquare },
        ],
      });

      sections.push({
        title: 'Marketing',
        icon: BarChart3,
        items: [
          { title: 'Newsletter', url: '/admin/newsletter', icon: Newspaper },
          { title: 'Analytics', url: '/admin/marketing', icon: BarChart3 },
        ],
      });

      // Employee Users section for owners - can see all dashboards
      sections.push({
        title: 'Employee Users',
        icon: Users,
        items: [
          { title: 'Brad', url: '/admin/brad', icon: User },
          { title: 'Adam', url: '/admin/adam', icon: User },
          { title: 'Evan', url: '/user/evan', icon: User },
          { title: 'Maura', url: '/user/maura', icon: User },
          { title: 'Wendy', url: '/user/wendy', icon: User },
        ],
      });
    } else if (teamMember) {
      // For regular employees, show their own dashboard and limited navigation
      const employeeName = teamMember.name;
      const employeeUrl = `/user/${employeeName.toLowerCase()}`;

      // Employee's Page - their personal dashboard
      sections.push({
        title: `${employeeName}'s Page`,
        icon: User,
        items: [
          { title: 'Dashboard', url: employeeUrl, icon: LayoutDashboard },
          { title: `${employeeName}'s Leads`, url: `${employeeUrl}/leads`, icon: UserPlus },
        ],
      });

      // CLX CRM section
      sections.push({
        title: 'CLX CRM',
        icon: Kanban,
        items: [
          { title: 'Pipeline', url: '/admin/crm', icon: Kanban },
          { title: 'Leads', url: '/admin/leads', icon: UserPlus },
          { title: 'Messages', url: '/admin/messages', icon: MessageSquare },
        ],
      });
    }

    return sections;
  }, [isOwner, teamMember]);

  // Determine which sections should be open based on current route
  const getSectionOpenState = () => {
    const openSections: Record<string, boolean> = {};
    navSections.forEach((section) => {
      const hasActiveItem = section.items.some((item) => {
        if (item.url === '/admin') {
          return location.pathname === '/admin';
        }
        return location.pathname.startsWith(item.url);
      });
      openSections[section.title] = hasActiveItem;
    });
    return openSections;
  };

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(getSectionOpenState);
  const [toolsOpen, setToolsOpen] = useState(false);

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

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
    <Sidebar className="border-r border-sidebar-border bg-gradient-to-b from-sidebar to-white/90 backdrop-blur-xl w-72">
      <SidebarHeader className="p-4 border-b border-sidebar-border/50">
        <Link to="/admin" className="flex items-center justify-center group">
          <img 
            src="/logo.png" 
            alt="CommercialLendingX" 
            className="max-h-[200px] max-w-full object-contain"
          />
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="px-4 space-y-2">
        {navSections.map((section) => (
          <Collapsible
            key={section.title}
            open={openSections[section.title]}
            onOpenChange={() => toggleSection(section.title)}
          >
            <CollapsibleTrigger className="w-full">
              <div className={`
                flex items-center justify-between py-3 px-4 rounded-xl transition-all duration-200 cursor-pointer
                ${openSections[section.title] 
                  ? 'bg-admin-blue-light text-admin-blue-dark' 
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }
              `}>
                <div className="flex items-center gap-3">
                  <ChevronDown 
                    className={`w-4 h-4 transition-transform duration-200 ${
                      openSections[section.title] ? '' : '-rotate-90'
                    }`} 
                  />
                  <section.icon className={`w-5 h-5 ${openSections[section.title] ? 'text-admin-blue' : ''}`} strokeWidth={1.75} />
                  <span className="text-base font-medium">{section.title}</span>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-4 mt-1 space-y-1 border-l-2 border-admin-blue/30">
                {section.items.map((item) => (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={`
                      flex items-center gap-3 py-2.5 px-4 ml-2 rounded-lg transition-all duration-200
                      ${isActive(item.url) 
                        ? 'bg-gradient-to-r from-admin-blue to-admin-blue-dark text-white shadow-md' 
                        : 'text-muted-foreground hover:bg-admin-blue-light hover:text-admin-blue-dark'
                      }
                    `}
                  >
                    <item.icon className="w-4 h-4" strokeWidth={1.75} />
                    <span className="text-sm font-medium">{item.title}</span>
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}

        {/* Tools Section */}
        <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
          <CollapsibleTrigger className="w-full">
            <div className={`
              flex items-center justify-between py-3 px-4 rounded-xl transition-all duration-200 cursor-pointer
              ${toolsOpen 
                ? 'bg-admin-orange-light text-admin-orange-dark' 
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }
            `}>
              <div className="flex items-center gap-3">
                <ChevronDown 
                  className={`w-4 h-4 transition-transform duration-200 ${
                    toolsOpen ? '' : '-rotate-90'
                  }`} 
                />
                <Sparkles className={`w-5 h-5 ${toolsOpen ? 'text-admin-orange' : ''}`} strokeWidth={1.75} />
                <span className="text-base font-medium">Tools</span>
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-admin-orange/30">
              <button
                onClick={onInboxToggle}
                className={`
                  w-full flex items-center justify-between gap-3 py-2.5 px-4 ml-2 rounded-lg transition-all duration-200
                  ${inboxOpen 
                    ? 'bg-gradient-to-r from-admin-orange to-admin-orange-dark text-white shadow-md' 
                    : 'text-muted-foreground hover:bg-admin-orange-light hover:text-admin-orange-dark'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4" strokeWidth={1.75} />
                  <span className="text-sm font-medium">Email</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>
              <button
                onClick={onAIAssistantToggle}
                className={`
                  w-full flex items-center justify-between gap-3 py-2.5 px-4 ml-2 rounded-lg transition-all duration-200
                  ${aiAssistantOpen 
                    ? 'bg-gradient-to-r from-admin-orange to-admin-orange-dark text-white shadow-md' 
                    : 'text-muted-foreground hover:bg-admin-orange-light hover:text-admin-orange-dark'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4" strokeWidth={1.75} />
                  <span className="text-sm font-medium">AI Agent</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </button>
            </div>
          </CollapsibleContent>
        </Collapsible>
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
