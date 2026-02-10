import { useState, useMemo } from 'react';
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
  navigateOnClick?: string; // If set, clicking the section header navigates to this URL
}

const AdminSidebar = ({ onInboxToggle, inboxOpen, onAIToggle, aiChatOpen }: AdminSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { teamMember, isOwner, loading: teamLoading } = useTeamMember();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  // Build navigation sections based on user's role
  const navSections: NavSection[] = useMemo(() => {
    const sections: NavSection[] = [];

    // Check if user is Ilan first (developer with special dashboard)
    if (teamMember?.name.toLowerCase() === 'ilan') {
      sections.push({
        title: 'Dashboard',
        icon: LayoutDashboard,
        items: [
          { title: 'Dev Dashboard', url: '/superadmin/ilan/dev', icon: Code2 },
          { title: 'Gmail', url: '/superadmin/ilan/gmail', icon: Mail },
          { title: 'CRM Board', url: '/superadmin/crm', icon: Kanban },
          { title: 'Leads', url: '/superadmin/leads', icon: UserPlus },
          { title: 'Rate Watch', url: '/superadmin/rate-watch', icon: TrendingDown },
          { title: 'Lender Programs', url: '/superadmin/lender-programs', icon: Building2 },
          { title: 'Clients', url: '/superadmin/clients', icon: Users },
          { title: 'Contracts', url: '/superadmin/contracts', icon: FileText },
          { title: 'Invoices', url: '/superadmin/invoices', icon: Receipt },
          { title: 'Messages', url: '/superadmin/messages', icon: MessageSquare },
          { title: 'Bug Testing', url: '/superadmin/ilan/bugs', icon: Bug },
          { title: 'Tracking', url: '/superadmin/tracking', icon: Crosshair },
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

      sections.push({
        title: 'Team',
        icon: Users,
        items: [
          { title: 'Team Performance', url: '/superadmin/ilan', icon: BarChart3 },
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

      sections.push({
        title: `${employeeName}'s Page`,
        icon: User,
        items: [
          { title: 'Dashboard', url: employeeUrl, icon: LayoutDashboard },
          { title: 'Scorecard', url: `/admin/${employeeName.toLowerCase()}/scorecard`, icon: ClipboardList },
          { title: "To Do's", url: `/admin/${employeeName.toLowerCase()}/tasks`, icon: ListTodo },
          { title: 'Calendar', url: `/admin/${employeeName.toLowerCase()}/calendar`, icon: Calendar },
          { title: 'Calls', url: `/admin/${employeeName.toLowerCase()}/calls`, icon: Phone },
          { title: 'LP', url: `/admin/${employeeName.toLowerCase()}/lender-programs`, icon: Building2 },
          { title: 'Gmail', url: `/admin/${employeeName.toLowerCase()}/gmail`, icon: Mail },
        ],
        noCollapse: true,
      });

      sections.push({
        title: 'Pipeline',
        icon: Kanban,
        items: [
          { title: 'Pipeline', url: `/admin/${employeeName.toLowerCase()}/pipeline`, icon: Kanban },
        ],
        noCollapse: true,
      });

      sections.push({
        title: 'Tools',
        icon: TrendingDown,
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
    return location.pathname.startsWith(path);
  };

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
      className="border-r-0 bg-[#0a1628] font-sans !text-white [&_[data-sidebar=sidebar]]:bg-[#0a1628]" 
      collapsible="icon"
      style={{ 
        '--sidebar-width': '16rem', 
        '--sidebar-width-icon': '3.5rem',
        '--sidebar-foreground': '0 0% 100%',
        '--sidebar-background': '215 55% 10%',
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" 
      } as React.CSSProperties}
    >
      <SidebarHeader className={`pt-0 pb-0 border-b-0 ${isCollapsed ? 'px-1' : 'px-3'}`}>
        <Link to={homeUrl} className="flex items-center justify-center group">
          {isCollapsed ? (
            <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center my-2">
              <span className="text-white font-bold text-sm">CX</span>
            </div>
          ) : (
            <img 
              src="/logo.png" 
              alt="CommercialLendingX" 
              className="max-h-[180px] max-w-full object-contain brightness-0 invert opacity-95"
            />
          )}
        </Link>
        {!isCollapsed && <div className="h-px bg-white/15 -mt-8" />}
      </SidebarHeader>
      
      <SidebarContent className={`pt-3 space-y-0.5 ${isCollapsed ? 'px-1' : 'px-3'}`}>
        {navSections.map((section) => (
          section.noCollapse ? (
            // Render direct links without collapsible wrapper - use Fragment to avoid extra div
            section.items.map((item) => (
              item.subItems && !isCollapsed ? (
                // Render collapsible for items with subItems (only when expanded)
                <Collapsible
                  key={item.title}
                  open={openSections[item.title]}
                  onOpenChange={() => toggleSection(item.title)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className={`
                      flex items-center gap-2.5 py-2 px-3 rounded-md transition-all duration-150 cursor-pointer text-[13px] tracking-tight
                      ${openSections[item.title] 
                        ? 'bg-white/10 text-white' 
                        : 'text-white/90 hover:bg-white/5 hover:text-white'
                      }
                    `}>
                      <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                      <span className="font-semibold flex-1 text-left">{item.title}</span>
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
                            flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-150 text-[12px] tracking-tight
                            ${isActive(subItem.url) 
                              ? 'bg-white/15 text-white' 
                              : 'text-white/80 hover:bg-white/5 hover:text-white'
                            }
                          `}
                        >
                          <subItem.icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
                          <span className="font-semibold">{subItem.title}</span>
                        </Link>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : isCollapsed ? (
                // Collapsed state: show icon only with tooltip
                <Tooltip key={item.title}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.url}
                      className={`
                        flex items-center justify-center py-2 px-2 rounded-md transition-all duration-150
                        ${isActive(item.url) 
                          ? 'bg-white/15 text-white' 
                          : 'text-white/90 hover:bg-white/5 hover:text-white'
                        }
                      `}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-slate-900 text-white border-slate-700">
                    {item.title}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  key={item.title}
                  to={item.url}
                  className={`
                    flex items-center gap-2.5 py-2 px-3 rounded-md transition-all duration-150 text-[13px] tracking-tight
                    ${isActive(item.url) 
                      ? 'bg-white/15 text-white' 
                      : 'text-white/90 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                  <span className="font-semibold">{item.title}</span>
                </Link>
              )
            ))
          ) : isCollapsed ? (
            // Collapsed state for collapsible sections: show first item's icon with tooltip
            <Tooltip key={section.title}>
              <TooltipTrigger asChild>
                <Link
                  to={section.items[0]?.url || '#'}
                  className={`
                    flex items-center justify-center py-2 px-2 rounded-md transition-all duration-150
                    ${section.items.some(item => isActive(item.url)) 
                      ? 'bg-white/15 text-white' 
                      : 'text-white/90 hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <section.icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-slate-900 text-white border-slate-700">
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
                className="w-full"
                onClick={() => {
                  // If section has navigateOnClick, navigate to that URL
                  if (section.navigateOnClick) {
                    navigate(section.navigateOnClick);
                  }
                }}
              >
                <div className={`
                  flex items-center gap-2.5 py-2 px-3 rounded-md transition-all duration-150 cursor-pointer text-[13px] tracking-tight
                  ${openSections[section.title] || (section.navigateOnClick && isActive(section.navigateOnClick))
                    ? 'bg-white/10 text-white' 
                    : 'text-white/90 hover:bg-white/5 hover:text-white'
                  }
                `}>
                  <section.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                  <span className="font-semibold flex-1 text-left">{section.title}</span>
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
                            flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-150 cursor-pointer text-[12px] tracking-tight
                            ${openSections[item.title] 
                              ? 'bg-white/10 text-white' 
                              : 'text-white/80 hover:bg-white/5 hover:text-white'
                            }
                          `}>
                            <item.icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
                            <span className="font-semibold flex-1 text-left">{item.title}</span>
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
                                  flex items-center gap-2 py-1.5 px-2 rounded-md transition-all duration-150 text-[11px] tracking-tight
                                  ${isActive(subItem.url) 
                                    ? 'bg-white/15 text-white' 
                                    : 'text-white/75 hover:bg-white/5 hover:text-white'
                                  }
                                `}
                              >
                                <subItem.icon className="w-3 h-3 flex-shrink-0" strokeWidth={1.75} />
                                <span className="font-semibold">{subItem.title}</span>
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
                          flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-150 text-[12px] tracking-tight
                          ${isActive(item.url) 
                            ? 'bg-white/15 text-white' 
                            : 'text-white/80 hover:bg-white/5 hover:text-white'
                          }
                        `}
                      >
                        <item.icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
                        <span className="font-semibold">{item.title}</span>
                      </Link>
                    )
                  ))}
                  
                  {/* Add New Pipeline button for CRM section */}
                  {section.title === 'CRM' && teamMember && (
                    <button
                      onClick={() => setCreatePipelineOpen(true)}
                      className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-md transition-all duration-150 text-[12px] tracking-tight text-[#0066FF]/80 hover:bg-[#0066FF]/10 hover:text-[#0066FF] w-full"
                    >
                      <Plus className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                      <span className="font-semibold">New Pipeline</span>
                    </button>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        ))}

      </SidebarContent>

      <SidebarFooter className={`border-t border-white/10 ${isCollapsed ? 'p-1' : 'p-3'}`}>
        {/* AI Assistant Button */}
        {onAIToggle && (
          isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className={`w-full h-9 ${
                    aiChatOpen 
                      ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                  onClick={onAIToggle}
                >
                  <img src={chatgptLogo} alt="AI" className="w-5 h-5 invert" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-slate-900 text-white border-slate-700">
                AI Assistant
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button 
              variant="ghost" 
              className={`w-full justify-start gap-2.5 h-9 rounded-md text-[13px] px-3 mb-2 ${
                aiChatOpen 
                  ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
              onClick={onAIToggle}
            >
              <img src={chatgptLogo} alt="AI" className="w-4 h-4 invert" />
              <span className="font-semibold">AI Assistant</span>
            </Button>
          )
        )}

        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center py-2">
                <AvatarUpload
                  userId={user?.id || ''}
                  currentAvatarUrl={teamMember?.avatar_url}
                  fallbackInitials={getUserInitials(user?.email)}
                  size="sm"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-slate-900 text-white border-slate-700">
              {teamMember?.name || user?.email?.split('@')[0] || 'User'}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-3 mb-3 px-1">
            <AvatarUpload
              userId={user?.id || ''}
              currentAvatarUrl={teamMember?.avatar_url}
              fallbackInitials={getUserInitials(user?.email)}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate tracking-tight">
                {teamMember?.name || user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-[11px] text-white/50 truncate tracking-tight">
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
                className="w-full h-9 text-white/60 hover:text-white hover:bg-white/5" 
                onClick={signOut}
              >
                <LogOut className="w-5 h-5" strokeWidth={1.5} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-slate-900 text-white border-slate-700">
              Sign Out
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2.5 text-white/60 hover:text-white hover:bg-white/5 h-9 rounded-md text-[13px] px-3" 
            onClick={signOut}
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
            <span className="font-medium">Sign Out</span>
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
