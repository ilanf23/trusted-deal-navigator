import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, Users, DollarSign, User, LogOut } from 'lucide-react';
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

const navItems = [
  { title: 'Dashboard', path: '/partner/dashboard', icon: LayoutDashboard },
  { title: 'My Referrals', path: '/partner/referrals', icon: Users },
  { title: 'Commissions', path: '/partner/commissions', icon: DollarSign },
  { title: 'Profile', path: '/partner/profile', icon: User },
];

const PartnerSidebar = () => {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const isActive = (path: string) => {
    if (path === '/partner') return location.pathname === '/partner';
    return location.pathname.startsWith(path);
  };

  return (
    <Sidebar
      className="border-r-0 bg-[#0a1628] font-sans !text-white [&_[data-sidebar=sidebar]]:bg-[#0a1628]"
      collapsible="icon"
      style={{
        '--sidebar-width': '16rem',
        '--sidebar-width-icon': '3.5rem',
        '--sidebar-foreground': '0 0% 100%',
        '--sidebar-background': '215 55% 10%',
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      } as React.CSSProperties}
    >
      <SidebarHeader className={`pt-0 pb-0 border-b-0 ${isCollapsed ? 'px-1' : 'px-3'}`}>
        <Link to="/partner" className="flex items-center justify-center group">
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
        {navItems.map((item) =>
          isCollapsed ? (
            <Tooltip key={item.path}>
              <TooltipTrigger asChild>
                <Link
                  to={item.path}
                  className={`
                    flex items-center justify-center py-2 px-2 rounded-md transition-all duration-150
                    ${isActive(item.path)
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
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-2.5 py-2 px-3 rounded-md transition-all duration-150 text-[13px] tracking-tight
                ${isActive(item.path)
                  ? 'bg-white/15 text-white'
                  : 'text-white/90 hover:bg-white/5 hover:text-white'
                }
              `}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
              <span className="font-semibold">{item.title}</span>
            </Link>
          )
        )}
      </SidebarContent>

      <SidebarFooter className={`border-t border-white/10 ${isCollapsed ? 'p-1' : 'p-3'}`}>
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className="flex items-center justify-center py-2 px-2 rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-all duration-150 w-full"
              >
                <LogOut className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-slate-900 text-white border-slate-700">
              Sign Out
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 py-2 px-3 w-full rounded-md text-white/70 hover:bg-white/5 hover:text-white transition-all duration-150 text-[13px] tracking-tight"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
            <span className="font-semibold">Sign Out</span>
          </button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default PartnerSidebar;
