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
  Calendar,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AvatarUpload from '@/components/admin/AvatarUpload';
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
          { title: 'Gmail', url: '/admin/ilan/gmail', icon: Mail },
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
              { title: 'Notes', url: '/admin/ilan/team/evan/notes', icon: FileText },
              { title: 'Dev Notes', url: '/admin/ilan/team/evan/dev-notes', icon: Code2 },
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
          { title: 'Calendar', url: `/team/${employeeName.toLowerCase()}/calendar`, icon: Calendar },
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
    <Sidebar className="border-r-0 bg-[#0a1628]" style={{ '--sidebar-width': '16rem' } as React.CSSProperties}>
      <SidebarHeader className="pt-0 pb-0 px-3 border-b-0">
        <Link to={homeUrl} className="flex items-center justify-center group">
          <img 
            src="/logo.png" 
            alt="CommercialLendingX" 
            className="max-h-[140px] max-w-full object-contain brightness-0 invert opacity-95"
          />
        </Link>
        <div className="h-px bg-white/15 mx-2 -mt-2" />
      </SidebarHeader>
      
      <SidebarContent className="px-3 pt-3 space-y-0.5">
        {navSections.map((section) => (
          section.noCollapse ? (
            // Render direct links without collapsible wrapper - use Fragment to avoid extra div
            section.items.map((item) => (
              item.subItems ? (
                // Render collapsible for items with subItems
                <Collapsible
                  key={item.title}
                  open={openSections[item.title]}
                  onOpenChange={() => toggleSection(item.title)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className={`
                      flex items-center gap-2.5 py-2 px-3 rounded-md transition-all duration-150 cursor-pointer text-[13px]
                      ${openSections[item.title] 
                        ? 'bg-white/10 text-white' 
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }
                    `}>
                      <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                      <span className="font-medium flex-1 text-left">{item.title}</span>
                      <ChevronDown 
                        className={`w-3.5 h-3.5 transition-transform duration-150 opacity-60 ${
                          openSections[item.title] ? '' : '-rotate-90'
                        }`} 
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.title}
                          to={subItem.url}
                          className={`
                            flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-150 text-[12px]
                            ${isActive(subItem.url) 
                              ? 'bg-white/15 text-white' 
                              : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                            }
                          `}
                        >
                          <subItem.icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                          <span className="font-medium">{subItem.title}</span>
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
                    flex items-center gap-2.5 py-2 px-3 rounded-md transition-all duration-150 text-[13px]
                    ${isActive(item.url) 
                      ? 'bg-white/15 text-white' 
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-medium">{item.title}</span>
                </Link>
              )
            ))
          ) : (
            <Collapsible
              key={section.title}
              open={openSections[section.title]}
              onOpenChange={() => toggleSection(section.title)}
            >
              <CollapsibleTrigger className="w-full">
                <div className={`
                  flex items-center gap-2.5 py-2 px-3 rounded-md transition-all duration-150 cursor-pointer text-[13px]
                  ${openSections[section.title] 
                    ? 'bg-white/10 text-white' 
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }
                `}>
                  <section.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-medium flex-1 text-left">{section.title}</span>
                  <ChevronDown 
                    className={`w-3.5 h-3.5 transition-transform duration-150 opacity-60 ${
                      openSections[section.title] ? '' : '-rotate-90'
                    }`} 
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
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
                            flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-150 cursor-pointer text-[12px]
                            ${openSections[item.title] 
                              ? 'bg-white/10 text-white' 
                              : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                            }
                          `}>
                            <item.icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                            <span className="font-medium flex-1 text-left">{item.title}</span>
                            <ChevronDown 
                              className={`w-3 h-3 transition-transform duration-150 opacity-60 ${
                                openSections[item.title] ? '' : '-rotate-90'
                              }`} 
                            />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                            {item.subItems.map((subItem) => (
                              <Link
                                key={subItem.title}
                                to={subItem.url}
                                className={`
                                  flex items-center gap-2 py-1.5 px-2 rounded-md transition-all duration-150 text-[11px]
                                  ${isActive(subItem.url) 
                                    ? 'bg-white/15 text-white' 
                                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                                  }
                                `}
                              >
                                <subItem.icon className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
                                <span className="font-medium">{subItem.title}</span>
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
                          flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-150 text-[12px]
                          ${isActive(item.url) 
                            ? 'bg-white/15 text-white' 
                            : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                          }
                        `}
                      >
                        <item.icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    )
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        ))}

      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3 px-1">
          <AvatarUpload
            userId={user?.id || ''}
            currentAvatarUrl={teamMember?.avatar_url}
            fallbackInitials={getUserInitials(user?.email)}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white truncate">
              {teamMember?.name || user?.email?.split('@')[0] || 'User'}
            </p>
            <p className="text-[11px] text-white/50 truncate">
              {user?.email}
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-2.5 text-white/60 hover:text-white hover:bg-white/5 h-9 rounded-md text-[13px] px-3" 
          onClick={signOut}
        >
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
          <span className="font-medium">Sign Out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AdminSidebar;
