import {
  Upload, FolderPlus,
  ChevronRight, ChevronDown, Home, Clock, Star,
  LayoutGrid, List, ArrowUp, ArrowDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { SidebarSection } from './DropboxSidebar';

export type ViewMode = 'list' | 'grid';
export type ActiveTab = 'all' | 'recents' | 'starred';
export type SortField = 'name' | 'modified';
export type SortDirection = 'asc' | 'desc';

const SECTION_TITLES: Record<SidebarSection, string> = {
  'home': 'Home',
  'all-files': 'All files',
  'photos': 'Photos',
  'shared': 'Shared',
};

interface DropboxToolbarProps {
  currentPath: string;
  pathParts: { name: string; path: string }[];
  onNavigate: (path: string) => void;
  onUpload: () => void;
  onNewFolder: () => void;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onToggleSort: (field: SortField) => void;
  connectedEmail: string | null;
  activeSection: SidebarSection;
}

export function DropboxToolbar({
  currentPath,
  pathParts,
  onNavigate,
  onUpload,
  onNewFolder,
  activeTab,
  onTabChange,
  viewMode,
  onViewModeChange,
  sortField,
  sortDirection,
  onToggleSort,
  connectedEmail,
  activeSection,
}: DropboxToolbarProps) {
  const avatarInitial = connectedEmail?.charAt(0).toUpperCase() || '?';
  const isBrowseMode = activeSection === 'home' || activeSection === 'all-files';

  return (
    <div className="px-6 pt-4 pb-0 space-y-3 border-b border-[#e8eaed] dark:border-border">
      {/* Row 1: Heading + breadcrumbs */}
      <div className="flex items-center gap-2">
        <h2 className="text-[20px] font-bold tracking-tight">{SECTION_TITLES[activeSection]}</h2>
        {isBrowseMode && pathParts.length > 0 && (
          <div className="flex items-center gap-1 ml-2 text-sm text-muted-foreground">
            <button
              onClick={() => onNavigate('')}
              className="hover:text-foreground transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
            </button>
            {pathParts.map((part) => (
              <span key={part.path} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                <button
                  onClick={() => onNavigate(part.path)}
                  className="hover:text-foreground transition-colors truncate max-w-[120px]"
                >
                  {part.name}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Row 2: Action buttons (browse mode only) */}
      {isBrowseMode && (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[13px] text-[#3c4043] dark:text-zinc-300 hover:bg-[#f0eaf7] dark:hover:bg-purple-950/30 hover:text-[#3b2778] dark:hover:text-purple-300 border border-[#dadce0] dark:border-border rounded-md"
            onClick={onUpload}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-[13px] text-[#3c4043] dark:text-zinc-300 hover:bg-[#f0eaf7] dark:hover:bg-purple-950/30 hover:text-[#3b2778] dark:hover:text-purple-300 border border-[#dadce0] dark:border-border rounded-md"
            onClick={onNewFolder}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New folder
          </Button>

          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[9px] bg-[#3b2778] text-white">{avatarInitial}</AvatarFallback>
            </Avatar>
            <span>Only you</span>
          </div>
        </div>
      )}

      {/* Row 3: Tabs + View toggle */}
      <div className="flex items-center justify-between -mb-px">
        {isBrowseMode ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onTabChange('recents')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md border-b-2 transition-colors',
                activeTab === 'recents'
                  ? 'border-[#3b2778] text-[#3b2778] dark:border-purple-400 dark:text-purple-300 font-medium'
                  : 'border-transparent text-[#5f6368] dark:text-muted-foreground hover:text-[#3b2778] dark:hover:text-purple-300',
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              Recents
            </button>
            <button
              onClick={() => onTabChange('starred')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md border-b-2 transition-colors',
                activeTab === 'starred'
                  ? 'border-[#3b2778] text-[#3b2778] dark:border-purple-400 dark:text-purple-300 font-medium'
                  : 'border-transparent text-[#5f6368] dark:text-muted-foreground hover:text-[#3b2778] dark:hover:text-purple-300',
              )}
            >
              <Star className="h-3.5 w-3.5" />
              Starred
            </button>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', viewMode === 'grid' && 'bg-[#e0d4f0] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-300')}
            onClick={() => onViewModeChange('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-7 w-7', viewMode === 'list' && 'bg-[#e0d4f0] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-300')}
            onClick={() => onViewModeChange('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Column headers (list view only) */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-[1fr_160px_200px] items-center px-6 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#3b2778]/70 dark:text-muted-foreground bg-[#eee6f6]/50 dark:bg-purple-950/20 -mx-2">
          <button
            onClick={() => onToggleSort('name')}
            className="flex items-center gap-1 hover:text-foreground transition-colors text-left"
          >
            Name
            {sortField === 'name' && (
              sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
          </button>
          <span>Who can access</span>
          <button
            onClick={() => onToggleSort('modified')}
            className="flex items-center gap-1 hover:text-foreground transition-colors text-left"
          >
            Modified
            {sortField === 'modified' && (
              sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
