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
  ChevronDown,
  Building2,
  ListTodo,
  Phone,
  Code2,
  Bug,
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
  subItems?: NavItem[];
}

interface NavSection {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
  noCollapse?: boolean;
}

const AdminSidebar = ({ onInboxToggle, inboxOpen, onAIAssistantToggle, aiAssistantOpen }: AdminSidebarProps) => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { teamMember, isOwner, loading: teamLoading } = useTeamMember();

  // Build navigation sections based on user's role
  const navSections: NavSection[] = useMemo(() => {
    const sections: NavSection[] = [];

    // Check if user is Ilan first (developer with special dashboard)
    if (teamMember?.name.toLowerCase() === 'ilan') {
      // Dashboard section for Ilan - developer overview
      sections.push({
        title: 'Dashboard',
        icon: LayoutDashboard,
        items: [
          { title: 'Overview', url: '/admin/ilan', icon: LayoutDashboard },
          { title: 'CRM Board', url: '/admin/crm', icon: Kanban },
          { title: 'Leads', url: '/admin/leads', icon: UserPlus },
          { title: 'Rate Watch', url: '/admin/rate-watch', icon: TrendingDown },
          { title: 'Lender Programs', url: '/admin/lender-programs', icon: Building2 },
          { title: 'Clients', url: '/admin/clients', icon: Users },
          { title: 'Contracts', url: '/admin/contracts', icon: FileText },
          { title: 'Invoices', url: '/admin/invoices', icon: Receipt },
          { title: 'Messages', url: '/admin/messages', icon: MessageSquare },
          { title: 'Bug Testing', url: '/admin/ilan/bugs', icon: Bug },
        ],
      });

      // Marketing section for Ilan
      sections.push({
        title: 'Marketing',
        icon: BarChart3,
        items: [
          { title: 'Newsletter', url: '/admin/newsletter', icon: Newspaper },
          { title: 'Analytics', url: '/admin/marketing', icon: BarChart3 },
        ],
      });

      // Team section for Ilan
      sections.push({
        title: 'Team',
        icon: Users,
        items: [
          { 
            title: 'Evan', 
            url: '/admin/ilan/team/evan', 
            icon: User,
            subItems: [
              { title: 'Dev Notes', url: '/admin/ilan/team/evan/dev-notes', icon: FileText },
              { title: 'Bug Reports', url: '/admin/ilan/team/evan/bugs', icon: Bug },
            ],
          },
        ],
      });
    } else if (isOwner) {
      // Dashboard section - show to owners
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
          { title: 'Bug Reporting', url: '/admin/bug-reporting', icon: Bug },
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
    } else if (teamMember) {
      // For regular team members (employees), show their own dashboard and limited navigation
      const employeeName = teamMember.name;
      const employeeUrl = `/team/${employeeName.toLowerCase()}`;

      // Employee's Page - their personal dashboard (no dropdown)
      sections.push({
        title: `${employeeName}'s Page`,
        icon: User,
        items: [
          { title: 'Dashboard', url: employeeUrl, icon: LayoutDashboard },
          { title: `${employeeName}'s Tasks`, url: `/team/${employeeName.toLowerCase()}/tasks`, icon: ListTodo },
          { title: 'Calls', url: `/team/${employeeName.toLowerCase()}/calls`, icon: Phone },
          { title: 'Gmail', url: `/team/${employeeName.toLowerCase()}/gmail`, icon: Mail },
        ],
        noCollapse: true,
      });

      // CRM section (collapsible dropdown)
      sections.push({
        title: 'CRM',
        icon: Kanban,
        items: [
          { title: `${employeeName}'s CRM`, url: `/team/${employeeName.toLowerCase()}/pipeline`, icon: Kanban },
          { title: `${employeeName}'s Leads`, url: `/team/${employeeName.toLowerCase()}/leads`, icon: UserPlus },
          { title: 'CRM', url: '/admin/crm', icon: Kanban },
          { title: 'Leads', url: '/admin/leads', icon: UserPlus },
        ],
      });

      // Standalone pages below CRM
      sections.push({
        title: 'Tools',
        icon: TrendingDown,
        items: [
          { title: 'Rate Watch', url: '/admin/rate-watch', icon: TrendingDown },
          { title: 'Messages', url: '/admin/messages', icon: MessageSquare },
          { title: 'Bug Reporting', url: `/team/${employeeName.toLowerCase()}/bug-reporting`, icon: Bug },
        ],
        noCollapse: true,
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

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

  const isActive = (path: string) => {
    // Exact match for base routes like /admin or /team/evan or /admin/ilan
    if (path === '/admin' || path.match(/^\/team\/[^/]+$/) || path.match(/^\/admin\/[^/]+$/)) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const getUserInitials = (email?: string) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  // Determine home page based on user role
  const homeUrl = useMemo(() => {
    if (!teamMember) return '/admin';
    
    // Ilan, Brad, Adam use /admin/ paths; other team members use /team/ paths
    const adminUsers = ['ilan', 'brad', 'adam'];
    const isAdminUser = adminUsers.includes(teamMember.name.toLowerCase());
    
    if (isOwner && !isAdminUser) return '/admin';
    if (isAdminUser) return `/admin/${teamMember.name.toLowerCase()}`;
    return `/team/${teamMember.name.toLowerCase()}`;
  }, [isOwner, teamMember]);

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar" style={{ '--sidebar-width': '18rem' } as React.CSSProperties}>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link to={homeUrl} className="flex items-center justify-center group">
          <img 
            src="/logo.png" 
            alt="CommercialLendingX" 
            className="max-h-[200px] max-w-full object-contain brightness-0 invert opacity-90"
          />
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="px-4 pt-4 space-y-2">
        {navSections.map((section) => (
          section.noCollapse ? (
            // Render direct links without collapsible wrapper
            <div key={section.title} className="space-y-1">
              {section.items.map((item) => (
                item.subItems ? (
                  // Render collapsible for items with subItems
                  <Collapsible
                    key={item.title}
                    open={openSections[item.title]}
                    onOpenChange={() => toggleSection(item.title)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className={`
                        flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-200 cursor-pointer
                        ${openSections[item.title] 
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                        }
                      `}>
                        <item.icon className="w-5 h-5" strokeWidth={1.75} />
                        <span className="text-base font-medium">{item.title}</span>
                        <ChevronDown 
                          className={`w-4 h-4 ml-auto transition-transform duration-200 ${
                            openSections[item.title] ? '' : '-rotate-90'
                          }`} 
                        />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-1 space-y-1 border-l-2 border-sidebar-primary/30">
                        {item.subItems.map((subItem) => (
                          <Link
                            key={subItem.title}
                            to={subItem.url}
                            className={`
                              flex items-center gap-3 py-2.5 px-4 ml-2 rounded-lg transition-all duration-200
                              ${isActive(subItem.url) 
                                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md' 
                                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                              }
                            `}
                          >
                            <subItem.icon className="w-4 h-4" strokeWidth={1.75} />
                            <span className="text-sm font-medium">{subItem.title}</span>
                          </Link>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <Link
                    key={item.title}
                    to={item.url}
                    className={`
                      flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-200
                      ${isActive(item.url) 
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md' 
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5" strokeWidth={1.75} />
                    <span className="text-base font-medium">{item.title}</span>
                  </Link>
                )
              ))}
            </div>
          ) : (
            <Collapsible
              key={section.title}
              open={openSections[section.title]}
              onOpenChange={() => toggleSection(section.title)}
            >
              <CollapsibleTrigger className="w-full">
                <div className={`
                  flex items-center justify-between py-3 px-4 rounded-xl transition-all duration-200 cursor-pointer
                  ${openSections[section.title] 
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                  }
                `}>
                  <div className="flex items-center gap-3">
                    <ChevronDown 
                      className={`w-4 h-4 transition-transform duration-200 ${
                        openSections[section.title] ? '' : '-rotate-90'
                      }`} 
                    />
                    <section.icon className={`w-5 h-5 ${openSections[section.title] ? 'text-sidebar-primary' : ''}`} strokeWidth={1.75} />
                    <span className="text-base font-medium">{section.title}</span>
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-sidebar-primary/30">
                  {section.items.map((item) => (
                    item.subItems ? (
                      // Render nested collapsible for items with subItems
                      <Collapsible
                        key={item.title}
                        open={openSections[item.title]}
                        onOpenChange={() => toggleSection(item.title)}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className={`
                            flex items-center gap-3 py-2.5 px-4 ml-2 rounded-lg transition-all duration-200 cursor-pointer
                            ${openSections[item.title] 
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                            }
                          `}>
                            <ChevronDown 
                              className={`w-3 h-3 transition-transform duration-200 ${
                                openSections[item.title] ? '' : '-rotate-90'
                              }`} 
                            />
                            <item.icon className="w-4 h-4" strokeWidth={1.75} />
                            <span className="text-sm font-medium">{item.title}</span>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-6 mt-1 space-y-1 border-l-2 border-sidebar-primary/20">
                            {item.subItems.map((subItem) => (
                              <Link
                                key={subItem.title}
                                to={subItem.url}
                                className={`
                                  flex items-center gap-3 py-2 px-4 ml-2 rounded-lg transition-all duration-200
                                  ${isActive(subItem.url) 
                                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md' 
                                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                                  }
                                `}
                              >
                                <subItem.icon className="w-4 h-4" strokeWidth={1.75} />
                                <span className="text-sm font-medium">{subItem.title}</span>
                              </Link>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <Link
                        key={item.title}
                        to={item.url}
                        className={`
                          flex items-center gap-3 py-2.5 px-4 ml-2 rounded-lg transition-all duration-200
                          ${isActive(item.url) 
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md' 
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                          }
                        `}
                      >
                        <item.icon className="w-4 h-4" strokeWidth={1.75} />
                        <span className="text-sm font-medium">{item.title}</span>
                      </Link>
                    )
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        ))}

      </SidebarContent>

      <SidebarFooter className="p-5 border-t border-sidebar-border">
        <div className="flex items-center gap-4 mb-4 px-1">
          <Avatar className="w-11 h-11 ring-2 ring-sidebar-border">
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-base font-medium">
              {getUserInitials(user?.email)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium text-sidebar-foreground truncate">
              {user?.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-sm text-sidebar-foreground/60 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-4 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 h-12 rounded-xl text-base" 
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
