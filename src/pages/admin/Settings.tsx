import { useEffect, useMemo } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAuth } from '@/contexts/AuthContext';
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
import SettingsLayout from '@/components/admin/settings/_shared/SettingsLayout';
import {
  SETTINGS_NAV,
  LEGACY_SLUGS,
  findSettingsItem,
  isAdminOnlySlug,
} from '@/components/admin/settings/_shared/settings-nav.config';

const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  profile: ProfileSection,
  preferences: PreferencesSection,
  notifications: NotificationsMatrixSection,
  'email-templates': EmailTemplatesSection,
  'saved-filters': SavedFiltersSection,
  branding: BrandingSection,
  users: InviteUsersSection,
  navigation: EditNavigationSection,
  customization: CustomizationSection,
  integrations: IntegrationsSection,
};

const Settings = () => {
  const { section } = useParams<{ section: string }>();
  const { pathname } = useLocation();
  const { setPageTitle } = useAdminTopBar();
  const { teamMember, isOwner } = useTeamMember();
  const { userRole } = useAuth();
  const isAdmin = isOwner || userRole === 'super_admin' || userRole === 'admin';

  useEffect(() => {
    setPageTitle('Settings');
    return () => setPageTitle(null);
  }, [setPageTitle]);

  // Derive base path from current URL so the same component can serve both
  // /admin/settings/* and /superadmin/settings/* without hardcoding.
  const basePath = useMemo(() => {
    const idx = pathname.indexOf('/settings');
    return idx >= 0 ? pathname.slice(0, idx + '/settings'.length) : '/admin/settings';
  }, [pathname]);

  // Filter sidebar by role.
  const visibleGroups = useMemo(
    () =>
      SETTINGS_NAV.map(group => ({
        ...group,
        items: group.items.filter(item => !item.adminOnly || isAdmin),
      })).filter(group => group.items.length > 0),
    [isAdmin]
  );

  if (!section) {
    return <Navigate to={`${basePath}/profile`} replace />;
  }

  // Legacy slug → current slug.
  const legacyTarget = LEGACY_SLUGS[section];
  if (legacyTarget) {
    return <Navigate to={`${basePath}/${legacyTarget}`} replace />;
  }

  const item = findSettingsItem(section);

  // Unknown slug → /profile.
  if (!item) {
    return <Navigate to={`${basePath}/profile`} replace />;
  }

  // Non-admin trying to reach a workspace-only section.
  if (isAdminOnlySlug(section) && !isAdmin) {
    return <Navigate to={`${basePath}/profile`} replace />;
  }

  const SectionComponent = SECTION_COMPONENTS[section];

  const description = `Manage ${
    isAdmin ? 'workspace and personal' : 'your personal'
  } settings${teamMember?.name ? ` for ${teamMember.name}` : ''}.`;

  return (
    <SettingsLayout
      groups={visibleGroups}
      basePath={basePath}
      activeSlug={section}
      title="Settings"
      description={description}
    >
      {SectionComponent ? <SectionComponent /> : null}
    </SettingsLayout>
  );
};

export default Settings;
