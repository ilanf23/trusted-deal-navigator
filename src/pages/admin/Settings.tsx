import { useEffect, useMemo } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAuth } from '@/contexts/AuthContext';
import {
  Settings as SettingsIcon,
  Palette,
  Plug,
  UserPlus,
  Pencil,
  User,
  Sliders,
  Mail,
  Bell,
  Filter,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfileSection from '@/components/admin/settings/ProfileSection';
import PreferencesSection from '@/components/admin/settings/PreferencesSection';
import NotificationsMatrixSection from '@/components/admin/settings/NotificationsMatrixSection';
import EmailTemplatesSection from '@/components/admin/settings/EmailTemplatesSection';
import InviteUsersSection from '@/components/admin/settings/InviteUsersSection';
import BrandingSection from '@/components/admin/settings/BrandingSection';
import IntegrationsSection from '@/components/admin/settings/IntegrationsSection';
import CustomizationSection from '@/components/admin/settings/CustomizationSection';
import EditNavigationSection from '@/components/admin/settings/EditNavigationSection';
import SavedFiltersSection from '@/components/admin/settings/SavedFiltersSection';

interface SettingsTabDef {
  to: string;
  icon: LucideIcon;
  label: string;
  /** When true, only admins/owners see this tab. */
  adminOnly?: boolean;
}

const TabLink = ({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
}) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        'inline-flex items-center gap-1.5 px-3 py-2 text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors',
        isActive
          ? 'border-[#3b2778] text-[#3b2778] font-semibold'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      )
    }
  >
    <Icon className="h-4 w-4 flex-shrink-0" />
    <span>{label}</span>
  </NavLink>
);

const Settings = () => {
  const { section } = useParams<{ section: string }>();
  const { setPageTitle } = useAdminTopBar();
  const { teamMember, isOwner } = useTeamMember();
  const { userRole } = useAuth();
  const isAdmin = isOwner || userRole === 'super_admin' || userRole === 'admin';

  useEffect(() => {
    setPageTitle('Settings');
    return () => setPageTitle(null);
  }, [setPageTitle]);

  if (!section) {
    return <Navigate to="profile" replace />;
  }

  const settingsBase = '/admin/settings';

  const renderSection = () => {
    switch (section) {
      case 'profile':
        return <ProfileSection />;
      case 'preferences':
        return <PreferencesSection />;
      case 'notifications':
        return <NotificationsMatrixSection />;
      case 'email-templates':
        return <EmailTemplatesSection />;
      case 'users':
        return <InviteUsersSection />;
      case 'branding':
        return <BrandingSection />;
      case 'integrations':
        return <IntegrationsSection />;
      case 'customization':
        return <CustomizationSection />;
      case 'navigation':
        return <EditNavigationSection />;
      case 'saved-filters':
        return <SavedFiltersSection />;
      default:
        return <Navigate to={`${settingsBase}/profile`} replace />;
    }
  };

  // Single ordered tab list. Workspace tabs first (admin-only), then personal.
  const tabs: SettingsTabDef[] = useMemo(() => [
    { to: `${settingsBase}/customization`, icon: SettingsIcon, label: 'Customization', adminOnly: true },
    { to: `${settingsBase}/branding`, icon: Palette, label: 'Branding', adminOnly: true },
    { to: `${settingsBase}/integrations`, icon: Plug, label: 'Integrations', adminOnly: true },
    { to: `${settingsBase}/users`, icon: UserPlus, label: 'Invite users', adminOnly: true },
    { to: `${settingsBase}/navigation`, icon: Pencil, label: 'Edit navigation', adminOnly: true },
    { to: `${settingsBase}/profile`, icon: User, label: 'Profile' },
    { to: `${settingsBase}/preferences`, icon: Sliders, label: 'Preferences' },
    { to: `${settingsBase}/saved-filters`, icon: Filter, label: 'Saved filters' },
    { to: `${settingsBase}/email-templates`, icon: Mail, label: 'Email & templates' },
    { to: `${settingsBase}/notifications`, icon: Bell, label: 'Notifications' },
  ], [settingsBase]);

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);

  // Renders directly inside the AdminPortalWrapper's AdminLayout — do NOT
  // wrap in another EmployeeLayout/AdminLayout. The previous version did,
  // which combined with an inner sidebar produced a "page inside a page"
  // visual + a duplicate notification bell next to a "Notifications" nav
  // item with the same Bell icon.
  return (
    <div className="flex flex-col min-h-[calc(100vh-7rem)] -m-3 sm:-m-4 md:-m-6 lg:-m-8 xl:-m-10 bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-6 pt-5">
          <div className="mb-3">
            <h1 className="text-xl font-semibold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage {isAdmin ? 'workspace and personal' : 'your personal'} settings
              {teamMember?.name ? ` for ${teamMember.name}` : ''}.
            </p>
          </div>
          <nav className="flex items-center gap-0.5 border-b border-border overflow-x-auto -mb-px">
            {visibleTabs.map(tab => (
              <TabLink key={tab.to} to={tab.to} icon={tab.icon} label={tab.label} />
            ))}
          </nav>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-4xl mx-auto px-6 py-8">{renderSection()}</div>
      </main>
    </div>
  );
};

export default Settings;
