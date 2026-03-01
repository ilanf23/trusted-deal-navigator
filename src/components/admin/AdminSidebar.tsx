import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  ClipboardList,
  Calendar,
  Plus,
  Crosshair,
  Rss,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import chatgptLogo from '@/assets/chatgpt-logo.png';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AvatarUpload from '@/components/admin/AvatarUpload';
import CreatePipelineModal from '@/components/admin/CreatePipelineModal';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface AdminSidebarProps {
  onInboxToggle: () => void;
  inboxOpen: boolean;
  onAIToggle?: () => void;
  aiChatOpen?: boolean;
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
  navigateOnClick?: string;
  isLabel?: boolean; // Renders title as a non-interactive section heading
}

const AdminSidebar = ({ onInboxToggle, inboxOpen, onAIToggle, aiChatOpen }: AdminSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { teamMember, isOwner, loading: teamLoading } = useTeamMember();
  const { state, isMobile, setOpenMobile, openMobile } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useRef(0);

  const closeMobileMenu = useCallback(() => {
    if (isMobile) {
      if (scrollRef.current) {
        savedScrollTop.current = scrollRef.current.scrollTop;
      }
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);

  // Restore scroll position when mobile sheet reopens
  useEffect(() => {
    if (openMobile && savedScrollTop.current > 0) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = savedScrollTop.current;
        }
      });
    }
  }, [openMobile]);

  // Continuously track scroll position so it survives route changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => { savedScrollTop.current = el.scrollTop; };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Restore scroll position after every route change (desktop)
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = savedScrollTop.current;
      }
    });
  }, [location.pathname]);

  // Build navigation sections based on user's role
  const navSections: NavSection[] = useMemo(() => {
    const sections: NavSection[] = [];

    // Check if user is Ilan first (developer with special dashboard)
    if (teamMember?.name.toLowerCase() === 'ilan') {
      // Top-level pages (no section heading)
      sections.push({
        title: '',
        icon: LayoutDashboard,
        items: [
          { title: 'WOP', url: '/superadmin/ilan', icon: Code2 },
          { title: 'Module Tracker', url: '/superadmin/ilan/module-tracker', icon: ClipboardList },
          { title: 'Users & Roles', url: '/superadmin/ilan/users-roles', icon: Users },
        ],
        noCollapse: true,
      });

      // Workspace section
      sections.push({
        title: 'Workspace',
        icon: Mail,
        isLabel: true,
        items: [
          { title: 'Gmail', url: '/superadmin/ilan/gmail', icon: Mail },
          { title: 'Bug Testing', url: '/superadmin/ilan/bugs', icon: Bug },
          { title: 'Tracking', url: '/superadmin/tracking', icon: Crosshair },
        ],
        noCollapse: true,
      });

      // Pipeline & CRM section
      sections.push({
        title: 'Pipeline',
        icon: Kanban,
        isLabel: true,
        items: [
          { title: 'Pipeline', url: '/superadmin/pipeline', icon: Kanban },
          { title: 'Pipeline Test', url: '/superadmin/pipeline-test', icon: Kanban },
          { title: 'CRM Board', url: '/superadmin/crm', icon: Kanban },
          { title: 'Leads', url: '/superadmin/leads', icon: UserPlus },
          { title: 'Lender Programs', url: '/superadmin/lender-programs', icon: Building2 },
          { title: 'Rate Watch', url: '/superadmin/rate-watch', icon: TrendingDown },
        ],
        noCollapse: true,
      });

      // Clients & Billing section
      sections.push({
        title: 'Clients & Billing',
        icon: Users,
        isLabel: true,
        items: [
          { title: 'Clients', url: '/superadmin/clients', icon: Users },
          { title: 'Contracts', url: '/superadmin/contracts', icon: FileText },
          { title: 'Invoices', url: '/superadmin/invoices', icon: Receipt },
          { title: 'Messages', url: '/superadmin/messages', icon: MessageSquare },
        ],
        noCollapse: true,
      });

      // Marketing section
      sections.push({
        title: 'Marketing',
        icon: BarChart3,
        isLabel: true,
        items: [
          { title: 'Newsletter', url: '/superadmin/newsletter', icon: Newspaper },
          { title: 'Analytics', url: '/superadmin/marketing', icon: BarChart3 },
        ],
        noCollapse: true,
      });

      // Team section
      sections.push({
        title: 'Team',
        icon: Users,
        isLabel: true,
        items: [
          { title: 'Team Performance', url: '/superadmin/ilan/dev', icon: BarChart3 },
          { 
            title: 'Evan', 
            url: '/superadmin/ilan/team/evan', 
            icon: User,
            subItems: [
              { title: 'Notes', url: '/superadmin/ilan/team/evan/notes', icon: FileText },
              { title: 'Dev Notes', url: '/superadmin/ilan/team/evan/dev-notes', icon: Code2 },
              { title: 'Bug Reports', url: '/superadmin/ilan/team/evan/bugs', icon: Bug },
            ],
          },
        ],
        noCollapse: true,
      });
    } else if (isOwner) {
      sections.push({
        title: 'Dashboard',
        icon: LayoutDashboard,
        items: [
          { title: 'Overview', url: '/superadmin', icon: LayoutDashboard },
          { title: 'CRM Board', url: '/superadmin/crm', icon: Kanban },
          { title: 'Leads', url: '/superadmin/leads', icon: UserPlus },
          { title: 'Rate Watch', url: '/superadmin/rate-watch', icon: TrendingDown },
          { title: 'Lender Programs', url: '/superadmin/lender-programs', icon: Building2 },
          { title: 'Clients', url: '/superadmin/clients', icon: Users },
          { title: 'Contracts', url: '/superadmin/contracts', icon: FileText },
          { title: 'Invoices', url: '/superadmin/invoices', icon: Receipt },
          { title: 'Messages', url: '/superadmin/messages', icon: MessageSquare },
          { title: 'Bug Reporting', url: '/superadmin/bug-reporting', icon: Bug },
          { title: 'Tracking', url: '/superadmin/tracking', icon: Crosshair },
        ],
      });

      sections.push({
        title: 'Team',
        icon: Users,
        items: [
          { title: 'Team Performance', url: '/superadmin/team-performance', icon: BarChart3 },
        ],
      });

      sections.push({
        title: 'Marketing',
        icon: BarChart3,
        items: [
          { title: 'Newsletter', url: '/superadmin/newsletter', icon: Newspaper },
          { title: 'Analytics', url: '/superadmin/marketing', icon: BarChart3 },
        ],
      });
    } else if (teamMember) {
      const employeeName = teamMember.name;
      const employeeUrl = `/admin/${employeeName.toLowerCase()}`;

      // Top-level pages (no section heading, direct links)
      sections.push({
        title: '',
        icon: LayoutDashboard,
        items: [
          { title: 'Dashboard', url: employeeUrl, icon: LayoutDashboard },
          { title: 'Scorecard', url: `/admin/${employeeName.toLowerCase()}/scorecard`, icon: ClipboardList },
        ],
        noCollapse: true,
      });

      // CRM section with heading
      sections.push({
        title: 'CRM',
        icon: Kanban,
        isLabel: true,
        items: [
          { title: 'Feed', url: `/admin/${employeeName.toLowerCase()}/pipeline/feed`, icon: Rss },
          {
            title: 'Pipeline',
            url: `/admin/${employeeName.toLowerCase()}/pipeline`,
            icon: Kanban,
            subItems: [
              { title: 'Underwriting', url: `/admin/${employeeName.toLowerCase()}/pipeline/underwriting`, icon: ClipboardList },
              { title: 'Lender Management', url: `/admin/${employeeName.toLowerCase()}/pipeline?view=lender-management`, icon: Building2 },
              { title: 'Potential', url: `/admin/${employeeName.toLowerCase()}/pipeline?view=potential`, icon: Crosshair },
            ],
          },
          {
            title: 'Contacts',
            url: `/admin/${employeeName.toLowerCase()}/pipeline/contacts`,
            icon: Users,
            subItems: [
              { title: 'People', url: `/admin/${employeeName.toLowerCase()}/pipeline/contacts/people`, icon: User },
              { title: 'Companies', url: `/admin/${employeeName.toLowerCase()}/pipeline/contacts/companies`, icon: Building2 },
            ],
          },
          { title: 'Lender Programs', url: `/admin/${employeeName.toLowerCase()}/lender-programs`, icon: Building2 },
        ],
        noCollapse: true,
      });

      // Workspace section with heading
      sections.push({
        title: 'Workspace',
        icon: ListTodo,
        isLabel: true,
        items: [
          { title: "To Do's", url: `/admin/${employeeName.toLowerCase()}/tasks`, icon: ListTodo },
          { title: 'Calendar', url: `/admin/${employeeName.toLowerCase()}/calendar`, icon: Calendar },
          { title: 'Calls', url: `/admin/${employeeName.toLowerCase()}/calls`, icon: Phone },
          { title: 'Gmail', url: `/admin/${employeeName.toLowerCase()}/gmail`, icon: Mail },
        ],
        noCollapse: true,
      });

      // Tools section with heading
      sections.push({
        title: 'Tools',
        icon: TrendingDown,
        isLabel: true,
        items: [
          { title: 'Rate Watch', url: `/admin/${employeeName.toLowerCase()}/rate-watch`, icon: TrendingDown },
          { title: 'Messages', url: `/admin/${employeeName.toLowerCase()}/messages`, icon: MessageSquare },
          { title: 'Bug Reporting', url: `/admin/${employeeName.toLowerCase()}/bug-reporting`, icon: Bug },
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
      // Check if any item in the section matches the current route
      const hasActiveItem = section.items.some((item) => {
        if (item.url === '/superadmin') {
          return location.pathname === '/superadmin';
        }
        return location.pathname.startsWith(item.url);
      });
      // Also check if the section's navigateOnClick matches
      const sectionNavigatesHere = section.navigateOnClick && location.pathname.startsWith(section.navigateOnClick);
      openSections[section.title] = hasActiveItem || !!sectionNavigatesHere;
    });
    return openSections;
  };

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(getSectionOpenState);
  const [createPipelineOpen, setCreatePipelineOpen] = useState(false);

  const toggleSection = (sectionTitle: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

  const isActive = (path: string) => {
    // Exact match for base routes like /superadmin or /admin/evan or /superadmin/ilan
    if (path === '/superadmin' || path.match(/^\/admin\/[^/]+$/) || path.match(/^\/superadmin\/[^/]+$/)) {
      return location.pathname === path;
    }
    // For pipeline sub-items, use exact match to avoid multiple highlights
    // e.g. /admin/evan/pipeline should not match /admin/evan/pipeline/feed
    if (path.match(/\/pipeline$/)) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const isRouteWithin = (url: string) => {
    if (url === '/superadmin') return location.pathname === '/superadmin';
    return location.pathname === url || location.pathname.startsWith(`${url}/`);
  };

  const isNavBranchActive = (item: NavItem): boolean => {
    if (isRouteWithin(item.url)) return true;
    return item.subItems?.some(isNavBranchActive) ?? false;
  };

  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/40 focus-visible:ring-offset-0 focus-visible:ring-offset-sidebar';
  const activeIndicator = "before:content-[''] before:absolute before:left-0 before:inset-y-1.5 before:w-[2.5px] before:rounded-full before:bg-sidebar-primary";
  const activeSurface = 'bg-sidebar-accent text-sidebar-accent-foreground';
  const inactiveItem = 'text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground';

  const getUserInitials = (email?: string) => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };

  // Determine home page based on user role
  const homeUrl = useMemo(() => {
    if (!teamMember) return '/superadmin';
    
    const founderUsers = ['ilan', 'brad', 'adam'];
    const isFounder = founderUsers.includes(teamMember.name.toLowerCase());
    
    if (isFounder) return `/superadmin/${teamMember.name.toLowerCase()}`;
    if (isOwner && !isFounder) return '/superadmin';
    return `/admin/${teamMember.name.toLowerCase()}`;
  }, [isOwner, teamMember]);

  return (
    <Sidebar 
      className="bg-sidebar font-sans text-sidebar-foreground [&_[data-sidebar=sidebar]]:bg-sidebar [&_[data-sidebar=sidebar]]:[box-shadow:1px_0_0_0_hsl(var(--sidebar-border))] [&_[data-sidebar=sidebar]]:[background-image:radial-gradient(ellipse_at_top,hsl(214_89%_62%/0.04)_0%,transparent_70%)]"
      collapsible="icon"
      style={{ 
        '--sidebar-width': '17rem', 
        '--sidebar-width-icon': '4rem',
      } as React.CSSProperties}
    >
      <SidebarHeader className={`pb-3 border-b border-sidebar-border/40 ${isCollapsed ? 'px-2 pt-3' : 'px-4 pt-4'}`}>
        <Link to={homeUrl} className="flex items-center justify-center group">
          {isCollapsed ? (
            <div className="w-12 h-12 rounded-xl bg-sidebar-accent flex items-center justify-center shadow-sm">
              <span className="text-sidebar-accent-foreground font-extrabold text-lg tracking-tight">CX</span>
            </div>
          ) : (
            <img 
              src="/logo.png" 
              alt="CommercialLendingX" 
              className="max-h-[180px] max-w-full object-contain brightness-0 invert opacity-95"
            />
          )}
        </Link>
      </SidebarHeader>
      
      <SidebarContent ref={scrollRef} className={`relative pt-1.5 ${isCollapsed ? 'px-1.5' : 'px-2.5'}`}>
        {/* Scroll shadow overlay */}
        <div className="sticky top-0 h-3 bg-gradient-to-b from-sidebar to-transparent pointer-events-none z-10 -mt-1.5 mb-0" />
        {navSections.map((section) => (
          section.noCollapse ? (
            <div key={section.title || 'top-links'} className={section.isLabel ? 'mt-3 first:mt-0' : ''}>
              {/* Section heading label */}
              {section.isLabel && section.title && !isCollapsed && (
                <div className="px-2.5 pt-2 pb-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/70 select-none">
                    {section.title}
                  </span>
                </div>
              )}
              {section.items.map((item) => (
                item.subItems && !isCollapsed ? (
                  <Collapsible
                    key={item.title}
                    open={openSections[item.title]}
                    onOpenChange={() => toggleSection(item.title)}
                  >
                    <CollapsibleTrigger asChild>
                      <button className={`
                        ${focusRing}
                        group relative w-full flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-200 ease-out cursor-pointer text-[13px] tracking-tight border-0 bg-transparent
                        ${isNavBranchActive(item) || openSections[item.title]
                          ? `${activeSurface} ${activeIndicator} font-medium`
                          : `${inactiveItem} font-normal`
                        }
                      `}>
                        <item.icon className={`w-[17px] h-[17px] flex-shrink-0 transition-all duration-200 ${isNavBranchActive(item) || openSections[item.title] ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:translate-x-[1px]'}`} strokeWidth={1.75} />
                        <span className="flex-1 text-left">{item.title}</span>
                        <ChevronDown 
                          className={`w-3.5 h-3.5 transition-transform duration-200 ease-out opacity-50 ${
                            openSections[item.title] ? '' : '-rotate-90'
                          }`} 
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-3 mt-1 space-y-0.5 border-l border-sidebar-border/40 pl-2">
                        {item.subItems.map((subItem) => (
                          subItem.subItems ? (
                            <Collapsible
                              key={subItem.title}
                              open={openSections[`sub-${subItem.title}`]}
                              onOpenChange={() => toggleSection(`sub-${subItem.title}`)}
                            >
                              <CollapsibleTrigger asChild>
                                <button className={`
                                  ${focusRing}
                                  group relative w-full flex items-center gap-2 py-1.5 px-2.5 rounded-md transition-all duration-200 ease-out cursor-pointer text-[12.5px] tracking-tight border-0 bg-transparent
                                  ${isNavBranchActive(subItem) || openSections[`sub-${subItem.title}`]
                                    ? `${activeSurface} ${activeIndicator} font-medium`
                                    : `${inactiveItem} font-normal`
                                  }
                                `}>
                                  <subItem.icon className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${isNavBranchActive(subItem) || openSections[`sub-${subItem.title}`] ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:translate-x-[1px]'}`} strokeWidth={1.75} />
                                  <span className="flex-1 text-left">{subItem.title}</span>
                                  <ChevronDown
                                    className={`w-3 h-3 transition-transform duration-200 ease-out opacity-50 ${
                                      openSections[`sub-${subItem.title}`] ? '' : '-rotate-90'
                                    }`}
                                  />
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="ml-2.5 mt-1 space-y-0.5 border-l border-sidebar-border/40 pl-2">
                                  {subItem.subItems.map((deepItem) => (
                                    <Link
                                      key={deepItem.title}
                                      to={deepItem.url}
                                      onClick={closeMobileMenu}
                                      className={`
                                        ${focusRing}
                                        group relative flex items-center gap-2 py-1.5 px-2 rounded-md transition-all duration-200 ease-out text-[12px] tracking-tight
                                        ${isActive(deepItem.url)
                                          ? `${activeSurface} ${activeIndicator} font-medium`
                                          : `${inactiveItem} font-normal`
                                        }
                                      `}
                                    >
                                      <deepItem.icon className={`w-3 h-3 flex-shrink-0 transition-all duration-200 ${isActive(deepItem.url) ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:translate-x-[1px]'}`} strokeWidth={1.75} />
                                      <span>{deepItem.title}</span>
                                    </Link>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ) : (
                            <Link
                              key={subItem.title}
                              to={subItem.url}
                              onClick={closeMobileMenu}
                              className={`
                                ${focusRing}
                                group relative flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-200 ease-out text-[12.5px] tracking-tight
                                ${isActive(subItem.url) 
                                  ? `${activeSurface} ${activeIndicator} font-medium`
                                  : `${inactiveItem} font-normal`
                                }
                              `}
                            >
                              <subItem.icon className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${isActive(subItem.url) ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:translate-x-[1px]'}`} strokeWidth={1.75} />
                              <span>{subItem.title}</span>
                            </Link>
                          )
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ) : isCollapsed ? (
                  <Tooltip key={item.title}>
                    <TooltipTrigger asChild>
                      <Link
                        to={item.url}
                        onClick={closeMobileMenu}
                        className={`
                          ${focusRing}
                          flex items-center justify-center py-2 px-2 rounded-md transition-all duration-200 ease-out
                          ${isActive(item.url) 
                            ? 'bg-sidebar-accent ring-1 ring-sidebar-primary/25 shadow-sm text-sidebar-accent-foreground' 
                            : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                          }
                        `}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-[hsl(224_20%_12%)] text-sidebar-foreground border-sidebar-border text-[12px] font-medium px-2.5 py-1.5 shadow-xl">
                      {item.title}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Link
                    key={item.title}
                    to={item.url}
                    onClick={closeMobileMenu}
                    className={`
                      ${focusRing}
                      group relative flex items-center gap-3 py-1.5 px-2.5 rounded-md transition-all duration-200 ease-out text-[13px] tracking-tight
                      ${isActive(item.url) 
                        ? `${activeSurface} ${activeIndicator} font-medium`
                        : `${inactiveItem} font-normal`
                      }
                    `}
                  >
                    <item.icon className={`w-[17px] h-[17px] flex-shrink-0 transition-all duration-200 ${isActive(item.url) ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:translate-x-[1px]'}`} strokeWidth={1.75} />
                    <span>{item.title}</span>
                  </Link>
                )
              ))}
            </div>
          ) : isCollapsed ? (
            // Collapsed state for collapsible sections: show first item's icon with tooltip
            <Tooltip key={section.title}>
              <TooltipTrigger asChild>
                <Link
                  to={section.items[0]?.url || '#'}
                  className={`
                    ${focusRing}
                    flex items-center justify-center py-2 px-2 rounded-md transition-all duration-200 ease-out
                    ${section.items.some(isNavBranchActive)
                      ? 'bg-sidebar-accent ring-1 ring-sidebar-primary/25 shadow-sm text-sidebar-accent-foreground' 
                      : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                    }
                  `}
                >
                  <section.icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[hsl(224_20%_12%)] text-sidebar-foreground border-sidebar-border text-[12px] font-medium px-2.5 py-1.5 shadow-xl">
                {section.title}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Collapsible
              key={section.title}
              open={openSections[section.title]}
              onOpenChange={() => toggleSection(section.title)}
            >
              <CollapsibleTrigger 
                className={`w-full ${focusRing}`}
                onClick={() => {
                  if (section.navigateOnClick) {
                    navigate(section.navigateOnClick);
                  }
                }}
              >
                <div className={`
                  group relative flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-200 ease-out cursor-pointer text-[13px] tracking-tight
                  ${openSections[section.title] || section.items.some(isNavBranchActive) || (section.navigateOnClick && isRouteWithin(section.navigateOnClick))
                    ? `${activeSurface} ${activeIndicator} font-medium`
                    : `${inactiveItem} font-normal`
                  }
                `}>
                  <section.icon className={`w-[17px] h-[17px] flex-shrink-0 transition-all duration-200 ${openSections[section.title] || section.items.some(isNavBranchActive) ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:translate-x-[1px]'}`} strokeWidth={1.75} />
                  <span className="flex-1 text-left">{section.title}</span>
                  <ChevronDown 
                    className={`w-3.5 h-3.5 transition-transform duration-200 ease-out opacity-50 ${
                      openSections[section.title] ? '' : '-rotate-90'
                    }`} 
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-3 mt-1 space-y-0.5 border-l border-sidebar-border/40 pl-2">
                  {section.items.map((item) => (
                    item.subItems ? (
                      // Render nested collapsible for items with subItems
                      <Collapsible
                        key={item.title}
                        open={openSections[item.title]}
                        onOpenChange={() => toggleSection(item.title)}
                      >
                        <CollapsibleTrigger className={`w-full ${focusRing}`}>
                          <div className={`
                            group relative flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-200 ease-out cursor-pointer text-[12.5px] tracking-tight
                            ${isNavBranchActive(item) || openSections[item.title] 
                              ? `${activeSurface} ${activeIndicator} font-medium`
                              : `${inactiveItem} font-normal`
                            }
                          `}>
                            <item.icon className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${isNavBranchActive(item) || openSections[item.title] ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:translate-x-[1px]'}`} strokeWidth={1.75} />
                            <span className="flex-1 text-left">{item.title}</span>
                            <ChevronDown 
                              className={`w-3 h-3 transition-transform duration-200 ease-out opacity-50 ${
                                openSections[item.title] ? '' : '-rotate-90'
                              }`} 
                            />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="ml-3 mt-1 space-y-0.5 border-l border-sidebar-border/40 pl-2">
                            {item.subItems.map((subItem) => (
                              subItem.subItems ? (
                                <Collapsible
                                  key={subItem.title}
                                  open={openSections[`sub-${subItem.title}`]}
                                  onOpenChange={() => toggleSection(`sub-${subItem.title}`)}
                                >
                                  <CollapsibleTrigger className={`w-full ${focusRing}`}>
                                    <div className={`
                                      group relative flex items-center gap-2 py-1.5 px-2 rounded-md transition-all duration-200 ease-out cursor-pointer text-[12px] tracking-tight
                                      ${isNavBranchActive(subItem) || openSections[`sub-${subItem.title}`]
                                        ? `${activeSurface} ${activeIndicator} font-medium`
                                        : `${inactiveItem} font-normal`
                                      }
                                    `}>
                                      <subItem.icon className={`w-3.5 h-3.5 flex-shrink-0 transition-all duration-200 ${isNavBranchActive(subItem) || openSections[`sub-${subItem.title}`] ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:translate-x-[1px]'}`} strokeWidth={1.75} />
                                      <span className="flex-1 text-left">{subItem.title}</span>
                                      <ChevronDown
                                        className={`w-2.5 h-2.5 transition-transform duration-200 ease-out opacity-50 ${
                                          openSections[`sub-${subItem.title}`] ? '' : '-rotate-90'
                                        }`}
                                      />
                                    </div>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="ml-2.5 mt-1 space-y-0.5 border-l border-sidebar-border/40 pl-2">
                                      {subItem.subItems.map((deepItem) => (
                                        <Link
                                          key={deepItem.title}
                                          to={deepItem.url}
                                          onClick={closeMobileMenu}
                                          className={`
                                            ${focusRing}
                                            group relative flex items-center gap-2 py-1.5 px-2 rounded-md transition-all duration-200 ease-out text-[11.5px] tracking-tight
                                            ${isActive(deepItem.url)
                                              ? `${activeSurface} ${activeIndicator} font-medium`
                                              : `${inactiveItem} font-normal`
                                            }
                                          `}
                                        >
                                          <deepItem.icon className={`w-3 h-3 flex-shrink-0 transition-all duration-200 ${isActive(deepItem.url) ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:translate-x-[1px]'}`} strokeWidth={1.75} />
                                          <span>{deepItem.title}</span>
                                        </Link>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              ) : (
                                <Link
                                  key={subItem.title}
                                  to={subItem.url}
                                  onClick={closeMobileMenu}
                                  className={`
                                    ${focusRing}
                                    group relative flex items-center gap-2 py-1.5 px-2 rounded-md transition-all duration-200 ease-out text-[12px] tracking-tight
                                    ${isActive(subItem.url) 
                                      ? `${activeSurface} ${activeIndicator} font-medium`
                                      : `${inactiveItem} font-normal`
                                    }
                                  `}
                                >
                                  <subItem.icon className={`w-3.5 h-3.5 flex-shrink-0 transition-all duration-200 ${isActive(subItem.url) ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:translate-x-[1px]'}`} strokeWidth={1.75} />
                                  <span>{subItem.title}</span>
                                </Link>
                              )
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <Link
                        key={item.title}
                        to={item.url}
                        onClick={closeMobileMenu}
                        className={`
                          ${focusRing}
                          group relative flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-200 ease-out text-[12.5px] tracking-tight
                          ${isActive(item.url) 
                            ? `${activeSurface} ${activeIndicator} font-medium`
                            : `${inactiveItem} font-normal`
                          }
                        `}
                      >
                        <item.icon className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${isActive(item.url) ? 'opacity-100' : 'opacity-80 group-hover:opacity-100 group-hover:translate-x-[1px]'}`} strokeWidth={1.75} />
                        <span>{item.title}</span>
                      </Link>
                    )
                  ))}
                  
                  {/* Add New Pipeline button for CRM section */}
                  {section.title === 'CRM' && teamMember && (
                    <button
                      onClick={() => setCreatePipelineOpen(true)}
                      className={`${focusRing} group flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-200 ease-out text-[12.5px] tracking-tight text-sidebar-primary hover:bg-sidebar-accent hover:text-sidebar-foreground/95 w-full`}
                    >
                      <Plus className="w-3.5 h-3.5 flex-shrink-0 opacity-70 group-hover:opacity-90" strokeWidth={2} />
                      <span>New Pipeline</span>
                    </button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        ))}

      </SidebarContent>

      <SidebarFooter className={`border-t border-sidebar-border/40 ${isCollapsed ? 'p-2' : 'p-3 pt-3'}`}>
        {/* AI Assistant Button */}
        {onAIToggle && (
          isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className={`w-full h-9 ${focusRing} transition-all duration-200 ease-out ${
                    aiChatOpen 
                      ? 'bg-sidebar-accent text-sidebar-primary ring-1 ring-sidebar-primary/25' 
                      : 'text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                  }`}
                  onClick={onAIToggle}
                >
                  <img src={chatgptLogo} alt="AI" className="w-5 h-5 invert object-contain" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-[hsl(224_20%_12%)] text-sidebar-foreground border-sidebar-border text-[12px] font-medium px-2.5 py-1.5 shadow-xl">
                AI Assistant
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button 
              variant="ghost" 
              className={`w-full justify-start gap-3 h-9 rounded-md text-[13px] px-2.5 mb-2 transition-all duration-200 ease-out ${focusRing} ${
                aiChatOpen 
                  ? 'bg-sidebar-accent text-sidebar-primary ring-1 ring-sidebar-primary/25' 
                  : 'text-sidebar-foreground/80 hover:text-sidebar-foreground/95 hover:bg-sidebar-accent'
              }`}
              onClick={onAIToggle}
            >
              <img src={chatgptLogo} alt="AI" className="w-4 h-4 invert opacity-80" />
              <span>AI Assistant</span>
            </Button>
          )
        )}

        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center py-2">
                <div className="relative">
                  <AvatarUpload
                    userId={user?.id || ''}
                    currentAvatarUrl={teamMember?.avatar_url}
                    fallbackInitials={getUserInitials(user?.email)}
                    size="sm"
                  />
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[hsl(224_20%_12%)] text-sidebar-foreground border-sidebar-border text-[12px] font-medium px-2.5 py-1.5 shadow-xl">
              {teamMember?.name || user?.email?.split('@')[0] || 'User'}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 mb-2 px-1 py-1.5 rounded-md hover:bg-sidebar-accent/70 transition-all duration-200 cursor-default group">
            <div className="relative flex-shrink-0">
              <AvatarUpload
                userId={user?.id || ''}
                currentAvatarUrl={teamMember?.avatar_url}
                fallbackInitials={getUserInitials(user?.email)}
                size="md"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-sidebar-accent-foreground truncate tracking-tight">
                {teamMember?.name || user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-[10.5px] text-sidebar-foreground/70 truncate">
                {user?.email}
              </p>
            </div>
          </div>
        )}
        
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className={`w-full h-9 text-sidebar-foreground/70 hover:text-sidebar-foreground/90 hover:bg-sidebar-accent transition-all duration-200 ease-out ${focusRing}`}
                onClick={signOut}
              >
                <LogOut className="w-4 h-4" strokeWidth={1.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-[hsl(224_20%_12%)] text-sidebar-foreground border-sidebar-border text-[12px] font-medium px-2.5 py-1.5 shadow-xl">
              Sign Out
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button 
            variant="ghost" 
            className={`w-full justify-start gap-2.5 text-sidebar-foreground/70 hover:text-sidebar-foreground/90 hover:bg-sidebar-accent h-8 rounded-md text-[12px] px-2.5 transition-all duration-200 ease-out ${focusRing}`}
            onClick={signOut}
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Sign Out</span>
          </Button>
        )}
      </SidebarFooter>
      
      {/* Create Pipeline Modal */}
      {teamMember && (
        <CreatePipelineModal
          open={createPipelineOpen}
          onOpenChange={setCreatePipelineOpen}
          ownerId={teamMember.id}
          onPipelineCreated={(pipelineId) => {
            console.log('Pipeline created:', pipelineId);
            // Could navigate to the new pipeline here
          }}
        />
      )}
    </Sidebar>
  );
};

export default AdminSidebar;
