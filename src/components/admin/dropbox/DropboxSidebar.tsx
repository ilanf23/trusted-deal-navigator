import {
  Home, FolderOpen, Image, Users,
  ChevronDown, ChevronRight, Star,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { DropboxEntry } from '@/hooks/useDropbox';

export type SidebarSection = 'home' | 'all-files' | 'photos' | 'shared';

interface DropboxSidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
  onNavigateToRoot: () => void;
  starredEntries: DropboxEntry[];
  onStarredEntryClick: (entry: DropboxEntry) => void;
}

const NAV_ITEMS: { id: SidebarSection; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'all-files', label: 'All files', icon: FolderOpen },
  { id: 'photos', label: 'Photos', icon: Image },
  { id: 'shared', label: 'Shared', icon: Users },
];

export function DropboxSidebar({
  activeSection,
  onSectionChange,
  onNavigateToRoot,
  starredEntries,
  onStarredEntryClick,
}: DropboxSidebarProps) {
  const [starredOpen, setStarredOpen] = useState(true);

  const handleNavClick = (item: typeof NAV_ITEMS[number]) => {
    onSectionChange(item.id);
    if (item.id === 'home' || item.id === 'all-files') {
      onNavigateToRoot();
    }
  };

  return (
    <div className="w-[220px] flex-shrink-0 border-r border-[#e8eaed] dark:border-border bg-[#f8f9fa] dark:bg-muted/30 flex flex-col h-full hidden lg:flex">
      {/* Top nav */}
      <div className="flex-1 overflow-auto py-3">
        <nav className="space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2 rounded-md text-[13px] font-medium tracking-[-0.01em] transition-colors',
                  isActive
                    ? 'bg-[#e0d4f0] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-300'
                    : 'text-[#3c4043] dark:text-zinc-300 hover:bg-[#f0eaf7] dark:hover:bg-purple-950/30',
                )}
              >
                <Icon className={cn('h-[18px] w-[18px] flex-shrink-0', isActive && 'text-[#3b2778] dark:text-purple-300')} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <Separator className="my-3 mx-3" />

        {/* Quick access */}
        <div className="px-2">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5f6368] dark:text-muted-foreground">Quick access</span>
          </div>

          <Collapsible open={starredOpen} onOpenChange={setStarredOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-[13px] font-medium text-[#3c4043] dark:text-zinc-300 hover:bg-[#f0eaf7] dark:hover:bg-purple-950/30 transition-colors">
              {starredOpen ? <ChevronDown className="h-3 w-3 text-zinc-400" /> : <ChevronRight className="h-3 w-3 text-zinc-400" />}
              <Star className="h-3.5 w-3.5 text-zinc-400" />
              Starred
            </CollapsibleTrigger>
            <CollapsibleContent>
              {starredEntries.length > 0 ? (
                <div className="ml-6 space-y-0.5">
                  {starredEntries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => onStarredEntryClick(entry)}
                      className="block w-full text-left px-3 py-1 text-xs truncate text-[#3c4043] dark:text-muted-foreground hover:bg-[#f0eaf7] dark:hover:bg-purple-950/30 hover:text-[#3b2778] dark:hover:text-purple-300 rounded-md transition-colors"
                    >
                      {entry.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="ml-9 px-3 py-1.5 text-xs text-[#5f6368] dark:text-muted-foreground">Drag important items here.</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

    </div>
  );
}
