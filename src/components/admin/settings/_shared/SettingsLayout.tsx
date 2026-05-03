import { useNavigate, NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SettingsNavGroup } from './settings-nav.config';

interface SettingsLayoutProps {
  groups: SettingsNavGroup[];
  /** URL prefix for sidebar links, e.g. '/admin/settings' or '/superadmin/settings'. */
  basePath: string;
  /** Currently active slug — drives sidebar highlight + mobile select value. */
  activeSlug: string;
  /** Page heading shown above the rail on desktop and above the section selector on mobile. */
  title: string;
  description?: string;
  children: React.ReactNode;
}

const SettingsLayout = ({
  groups,
  basePath,
  activeSlug,
  title,
  description,
  children,
}: SettingsLayoutProps) => {
  const navigate = useNavigate();

  const allItems = groups.flatMap(g => g.items);
  const activeLabel = allItems.find(i => i.slug === activeSlug)?.label ?? '';

  return (
    <div className="flex flex-col min-h-[calc(100vh-7rem)] -m-3 sm:-m-4 md:-m-6 lg:-m-8 xl:-m-10 bg-background">
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>

      <div className="flex-1 max-w-6xl w-full mx-auto px-6 py-6 md:py-8 flex gap-8">
        {/* Desktop sidebar */}
        <aside
          className="hidden md:block w-[240px] flex-shrink-0"
          aria-label="Settings navigation"
        >
          <nav className="sticky top-6 space-y-6">
            {groups.map(group => (
              <div key={group.id}>
                <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    return (
                      <li key={item.slug}>
                        <NavLink
                          to={`${basePath}/${item.slug}`}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors',
                              isActive
                                ? 'bg-[#eee6f6] text-[#3b2778] font-semibold'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )
                          }
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Mobile section selector */}
        <div className="md:hidden w-full">
          <Select
            value={activeSlug}
            onValueChange={slug => navigate(`${basePath}/${slug}`)}
          >
            <SelectTrigger aria-label="Jump to section">
              <SelectValue placeholder="Jump to section…">
                {activeLabel || 'Jump to section…'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {groups.map(group => (
                <div key={group.id} className="py-1">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  {group.items.map(item => (
                    <SelectItem key={item.slug} value={item.slug}>
                      {item.label}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-6">{children}</div>
        </div>

        {/* Desktop content column */}
        <main className="hidden md:block flex-1 min-w-0 max-w-3xl">
          {children}
        </main>
      </div>
    </div>
  );
};

export default SettingsLayout;
