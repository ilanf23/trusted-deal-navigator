import { lazy } from 'react';
import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Rss,
  Kanban,
  Users,
  User,
  Building2,
  ListTodo,
  Calendar,
  Phone,
  Mail,
  HardDrive,
  TrendingDown,
  MessageSquare,
  Bug,
  type LucideIcon,
} from 'lucide-react';

export interface PageEntry {
  key: string;
  label: string;
  icon: LucideIcon;
  component: React.LazyExoticComponent<ComponentType<any>>;
  section: 'Top' | 'CRM' | 'Workspace' | 'Tools';
}

const pages: PageEntry[] = [
  // Top
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    component: lazy(() => import('@/pages/admin/Dashboard')),
    section: 'Top',
  },
  {
    key: 'scorecard',
    label: 'Scorecard',
    icon: ClipboardList,
    component: lazy(() => import('@/pages/admin/Scorecard')),
    section: 'Top',
  },
  // CRM
  {
    key: 'feed',
    label: 'Feed',
    icon: Rss,
    component: lazy(() => import('@/pages/admin/PipelineFeed')),
    section: 'CRM',
  },
  {
    key: 'pipeline',
    label: 'Pipeline',
    icon: Kanban,
    component: lazy(() => import('@/pages/admin/Pipeline')),
    section: 'CRM',
  },
  {
    key: 'underwriting',
    label: 'Underwriting',
    icon: ClipboardList,
    component: lazy(() => import('@/pages/admin/Underwriting')),
    section: 'CRM',
  },
  {
    key: 'people',
    label: 'People',
    icon: User,
    component: lazy(() => import('@/pages/admin/People')),
    section: 'CRM',
  },
  {
    key: 'companies',
    label: 'Companies',
    icon: Building2,
    component: lazy(() => import('@/pages/admin/Companies')),
    section: 'CRM',
  },
  {
    key: 'lender-programs',
    label: 'Lender Programs',
    icon: Building2,
    component: lazy(() => import('@/pages/admin/LenderPrograms')),
    section: 'CRM',
  },
  // Workspace
  {
    key: 'tasks',
    label: "To Do's",
    icon: ListTodo,
    component: lazy(() => import('@/pages/admin/Tasks')),
    section: 'Workspace',
  },
  {
    key: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    component: lazy(() => import('@/pages/admin/Calendar')),
    section: 'Workspace',
  },
  {
    key: 'calls',
    label: 'Calls',
    icon: Phone,
    component: lazy(() => import('@/pages/admin/Calls')),
    section: 'Workspace',
  },
  {
    key: 'gmail',
    label: 'Gmail',
    icon: Mail,
    component: lazy(() => import('@/pages/admin/Gmail')),
    section: 'Workspace',
  },
  {
    key: 'dropbox',
    label: 'Dropbox',
    icon: HardDrive,
    component: lazy(() => import('@/pages/admin/Dropbox')),
    section: 'Workspace',
  },
  // Tools
  {
    key: 'rate-watch',
    label: 'Rate Watch',
    icon: TrendingDown,
    component: lazy(() => import('@/pages/admin/RateWatch')),
    section: 'Tools',
  },
  {
    key: 'messages',
    label: 'Messages',
    icon: MessageSquare,
    component: lazy(() => import('@/pages/admin/Messages')),
    section: 'Tools',
  },
  {
    key: 'bug-reporting',
    label: 'Bug Reporting',
    icon: Bug,
    component: lazy(() => import('@/pages/admin/BugReporting')),
    section: 'Tools',
  },
];

export const pageRegistry = new Map<string, PageEntry>(
  pages.map(p => [p.key, p])
);

export const pagesBySection = pages.reduce<Record<string, PageEntry[]>>(
  (acc, page) => {
    (acc[page.section] ??= []).push(page);
    return acc;
  },
  {}
);

export const allPages = pages;
