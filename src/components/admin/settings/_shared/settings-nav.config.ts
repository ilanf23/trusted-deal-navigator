import {
  Bell,
  Filter,
  Mail,
  Palette,
  Pencil,
  Plug,
  Settings as SettingsIcon,
  Sliders,
  User,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';

export type SettingsGroupId = 'personal' | 'workspace';

export interface SettingsNavItem {
  /** URL slug under the settings base (e.g. 'profile' → /admin/settings/profile). */
  slug: string;
  /** Sidebar label. */
  label: string;
  /** Lucide icon shown next to the label. */
  icon: LucideIcon;
  /** Hidden from non-admins; direct visits redirect to /profile. */
  adminOnly?: boolean;
}

export interface SettingsNavGroup {
  id: SettingsGroupId;
  label: string;
  items: SettingsNavItem[];
}

/**
 * Source of truth for the Settings sidebar.
 *
 * Phase 1 keeps every slug that already routes today so existing links and
 * bookmarks continue to resolve. New sections introduced in later phases
 * (custom-fields, pipeline-stages, security, sessions, keyboard-shortcuts)
 * will be added to this config when they ship.
 */
export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    id: 'personal',
    label: 'Personal',
    items: [
      { slug: 'profile', label: 'Profile', icon: User },
      { slug: 'preferences', label: 'Preferences', icon: Sliders },
      { slug: 'notifications', label: 'Notifications', icon: Bell },
      { slug: 'email-templates', label: 'Email & templates', icon: Mail },
      { slug: 'saved-filters', label: 'Saved filters', icon: Filter },
    ],
  },
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { slug: 'branding', label: 'Branding', icon: Palette, adminOnly: true },
      { slug: 'users', label: 'Team members', icon: UserPlus, adminOnly: true },
      { slug: 'navigation', label: 'Navigation editor', icon: Pencil, adminOnly: true },
      { slug: 'customization', label: 'Customization', icon: SettingsIcon, adminOnly: true },
      { slug: 'integrations', label: 'Integrations', icon: Plug, adminOnly: true },
    ],
  },
];

/**
 * Old slugs that should redirect to a current slug. When the IA shifts
 * (e.g. customization splits into custom-fields + pipeline-stages),
 * legacy bookmarks land on the closest match instead of 404'ing to /profile.
 */
export const LEGACY_SLUGS: Record<string, string> = {
  'notifications-matrix': 'notifications',
};

const ALL_ITEMS: SettingsNavItem[] = SETTINGS_NAV.flatMap(g => g.items);

export const findSettingsItem = (slug: string): SettingsNavItem | undefined =>
  ALL_ITEMS.find(item => item.slug === slug);

export const isAdminOnlySlug = (slug: string): boolean =>
  ALL_ITEMS.some(item => item.slug === slug && item.adminOnly === true);
