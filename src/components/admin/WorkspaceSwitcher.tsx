import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Settings as SettingsIcon,
  Palette,
  Plug,
  UserPlus,
  Pencil,
  User,
  Sliders,
  Mail,
  Bell,
  Gift,
  LogOut,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useWorkspaceSettings } from '@/hooks/useWorkspaceSettings';

const SETTINGS_BASE = '/admin/settings';

interface WorkspaceMenuProps {
  children: ReactNode;
}

const WorkspaceMenu = ({ children }: WorkspaceMenuProps) => {
  const navigate = useNavigate();
  const { signOut, userRole } = useAuth();
  const { teamMember, isOwner } = useTeamMember();
  const { workspace } = useWorkspaceSettings();

  const isAdmin = isOwner || userRole === 'super_admin' || userRole === 'admin';

  const goto = (section: string) => navigate(`${SETTINGS_BASE}/${section}`);

  const userInitials = (teamMember?.name ?? 'U').slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground font-normal text-xs px-2 py-1.5">
          <div className="h-5 w-5 rounded bg-[#eee6f6] flex items-center justify-center">
            <Building2 className="h-3 w-3 text-[#3b2778]" />
          </div>
          {workspace.workspace_name}
        </DropdownMenuLabel>

        {isAdmin && (
          <>
            <DropdownMenuItem onClick={() => goto('customization')}>
              <SettingsIcon className="h-4 w-4 mr-2" /> Customization
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => goto('branding')}>
              <Palette className="h-4 w-4 mr-2" /> Branding & Appearance
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => goto('integrations')}>
              <Plug className="h-4 w-4 mr-2" /> Integrations
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => goto('users')}>
              <UserPlus className="h-4 w-4 mr-2" /> Invite users
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => goto('navigation')}>
              <Pencil className="h-4 w-4 mr-2" /> Edit Navigation
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground font-normal text-xs px-2 py-1.5">
          <Avatar className="h-5 w-5">
            <AvatarImage src={teamMember?.avatar_url ?? undefined} />
            <AvatarFallback className="text-[9px]">{userInitials}</AvatarFallback>
          </Avatar>
          {teamMember?.name ?? 'You'}
        </DropdownMenuLabel>

        <DropdownMenuItem onClick={() => goto('profile')}>
          <User className="h-4 w-4 mr-2" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => goto('preferences')}>
          <Sliders className="h-4 w-4 mr-2" /> Preferences
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => goto('email-templates')}>
          <Mail className="h-4 w-4 mr-2" /> Email Settings & Templates
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => goto('notifications')}>
          <Bell className="h-4 w-4 mr-2" /> Notifications
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/admin/refer')}>
          <Gift className="h-4 w-4 mr-2" /> Refer a friend & earn
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut()}
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <LogOut className="h-4 w-4 mr-2" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default WorkspaceMenu;
