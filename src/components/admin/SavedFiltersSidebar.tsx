import { useState, type ReactNode } from 'react';
import { ChevronUp, MoreVertical, Star, Lock, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ── Types ──────────────────────────────────────────────────────────────────

export type SavedFilterGroup = 'top' | 'public' | 'private';

export type SavedFilterOption = {
  id: string;
  label: string;
  group: SavedFilterGroup;
  /** When true AND `onRenameFilter` is provided, this option can be renamed
   *  via double-click. Ignored when rename is not wired up. */
  editable?: boolean;
  /** Optional badge — when set, the row shows a globe (public) or lock (private) icon. */
  visibility?: 'public' | 'private';
  /** Whether this filter is the user's current default. Renders a star. */
  isDefault?: boolean;
  /** Whether the current user owns this filter. Used to gate per-row actions. */
  ownedByCurrentUser?: boolean;
  /** When false (and any of the optional handlers below are passed), the kebab
   *  menu is hidden for this row. Defaults to true. */
  showActions?: boolean;
};

/** Structural — any object with `id` and `label` works, so pages can pass
 *  their richer `{ id, label, values }` custom filter objects directly. */
export type SavedCustomFilter = {
  id: string;
  label: string;
};

export interface SavedFiltersSidebarProps {
  /** Controls the outer aside width. Collapsed (false) renders an empty narrow
   *  strip, preserving the current transition animation. Width contract:
   *  `w-72` when open, `w-[72px]` when collapsed — the page-level collapse
   *  toggle button positions itself against this width. */
  sidebarOpen: boolean;

  filterOptions: SavedFilterOption[];
  customFilters: SavedCustomFilter[];
  /** Optional map of filter id → count. Displayed as a small right-aligned
   *  number on any option whose count is > 0. */
  filterCounts?: Record<string, number>;

  activeFilter: string;
  onSelectFilter: (id: string) => void;

  /** Element rendered in the header next to "Saved Filters". Pages pass either
   *  a `<CreateFilterDialog ... />` or a custom button that opens a drawer.
   *  The wrapping layout div is owned by this component — pass only the
   *  trigger itself. */
  createFilterAction: ReactNode;

  /** Optional rename support. When provided:
   *   - Public options with `editable: true` get double-click-to-rename
   *   - All custom filters get double-click-to-rename
   *   - Inline-edit UI state is owned internally by this component
   *   - `kind` lets the parent branch persistence logic without leaking
   *     domain terms into this component's API */
  onRenameFilter?: (
    filter: { id: string; kind: 'public' | 'custom' | 'private'; currentLabel: string },
    newLabel: string,
  ) => void;

  /** Optional per-row actions. When ANY of these is provided, a kebab menu
   *  appears on hover for any row whose `showActions !== false`. Existing
   *  callers that don't pass these get zero visual change. */
  onToggleVisibility?: (id: string, next: 'public' | 'private') => void;
  onSetDefault?: (id: string | null) => void;
  onDeleteFilter?: (id: string) => void;
  onDuplicateFilter?: (id: string) => void;
  onEditFilter?: (id: string) => void;
}

// ── Shared class strings ──────────────────────────────────────────────────

const ROW_BASE =
  'group/row relative w-full flex items-center justify-between px-3 text-left transition-colors';
const ROW_ACTIVE =
  'bg-[#e0d4f0] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400 rounded-lg font-medium';
const ROW_INACTIVE =
  'text-[#3c4043] dark:text-muted-foreground hover:bg-[#f0eaf7] dark:hover:bg-purple-950/30 hover:text-[#3b2778] dark:hover:text-purple-300 rounded-lg';

const SECTION_HEADER =
  'text-[11px] uppercase tracking-wider font-semibold text-[#5f6368] dark:text-muted-foreground';
const COUNT_BADGE =
  'ml-1 shrink-0 text-[11px] font-medium text-[#5f6368] dark:text-muted-foreground';
const RENAME_INPUT =
  'w-full h-8 px-2 text-[14px] rounded-md bg-white dark:bg-muted border border-[#1a73e8] dark:border-blue-500 text-[#1f1f1f] dark:text-foreground outline-none';

// ── Component ──────────────────────────────────────────────────────────────

export function SavedFiltersSidebar({
  sidebarOpen,
  filterOptions,
  customFilters,
  filterCounts,
  activeFilter,
  onSelectFilter,
  createFilterAction,
  onRenameFilter,
  onToggleVisibility,
  onSetDefault,
  onDeleteFilter,
  onDuplicateFilter,
  onEditFilter,
}: SavedFiltersSidebarProps) {
  const [publicFiltersOpen, setPublicFiltersOpen] = useState(true);
  const [privateFiltersOpen, setPrivateFiltersOpen] = useState(true);

  const [renamingFilterId, setRenamingFilterId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');

  const startRename = (id: string, currentLabel: string) => {
    setRenamingFilterId(id);
    setRenamingValue(currentLabel);
  };

  const cancelRename = () => {
    setRenamingFilterId(null);
    setRenamingValue('');
  };

  const commitRename = (
    filter: { id: string; kind: 'public' | 'custom' | 'private'; currentLabel: string },
  ) => {
    if (onRenameFilter) {
      onRenameFilter(filter, renamingValue);
    }
    setRenamingFilterId(null);
    setRenamingValue('');
  };

  const topOptions = filterOptions.filter((o) => o.group === 'top');
  const publicOptions = filterOptions.filter((o) => o.group === 'public');
  const privateOptions = filterOptions.filter((o) => o.group === 'private');

  const hasRowActions = !!(onToggleVisibility || onSetDefault || onDeleteFilter || onDuplicateFilter || onEditFilter);

  const renderRenameInput = (
    filter: { id: string; kind: 'public' | 'custom' | 'private'; currentLabel: string },
  ) => (
    <div className="py-1.5">
      <input
        autoFocus
        value={renamingValue}
        onChange={(e) => setRenamingValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitRename(filter);
          if (e.key === 'Escape') cancelRename();
        }}
        onBlur={() => commitRename(filter)}
        className={RENAME_INPUT}
      />
    </div>
  );

  const renderRowActions = (opt: SavedFilterOption) => {
    if (!hasRowActions) return null;
    if (opt.showActions === false) return null;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover/row:opacity-100 data-[state=open]:opacity-100 ml-1 h-6 w-6 flex items-center justify-center rounded text-[#5f6368] dark:text-muted-foreground hover:bg-[#e8defc] dark:hover:bg-purple-950/40 transition-opacity"
            aria-label="Filter actions"
            data-state="closed"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {onEditFilter && (
            <DropdownMenuItem onClick={() => onEditFilter(opt.id)}>Edit</DropdownMenuItem>
          )}
          {onRenameFilter && opt.editable !== false && (
            <DropdownMenuItem onClick={() => startRename(opt.id, opt.label)}>Rename</DropdownMenuItem>
          )}
          {onSetDefault && (
            <DropdownMenuItem onClick={() => onSetDefault(opt.isDefault ? null : opt.id)}>
              {opt.isDefault ? 'Clear default' : 'Set as default'}
            </DropdownMenuItem>
          )}
          {onToggleVisibility && opt.visibility && (
            <DropdownMenuItem
              onClick={() =>
                onToggleVisibility(opt.id, opt.visibility === 'public' ? 'private' : 'public')
              }
            >
              {opt.visibility === 'public' ? 'Make private' : 'Make public'}
            </DropdownMenuItem>
          )}
          {onDuplicateFilter && (
            <DropdownMenuItem onClick={() => onDuplicateFilter(opt.id)}>Duplicate</DropdownMenuItem>
          )}
          {onDeleteFilter && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                onClick={() => onDeleteFilter(opt.id)}
              >
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderRow = (
    opt: SavedFilterOption,
    kind: 'public' | 'private',
  ) => {
    const isActive = activeFilter === opt.id;
    const count = filterCounts?.[opt.id] ?? 0;
    const canRename = !!onRenameFilter && opt.editable !== false;
    const isRenaming = canRename && renamingFilterId === opt.id;

    if (isRenaming) {
      return (
        <div key={opt.id}>
          {renderRenameInput({ id: opt.id, kind, currentLabel: opt.label })}
        </div>
      );
    }

    return (
      <button
        key={opt.id}
        onClick={() => onSelectFilter(opt.id)}
        onDoubleClick={canRename ? () => startRename(opt.id, opt.label) : undefined}
        className={`${ROW_BASE} py-2.5 ${isActive ? ROW_ACTIVE : ROW_INACTIVE}`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {opt.isDefault && (
            <Star className="h-3 w-3 shrink-0 text-[#f59e0b] fill-[#f59e0b]" />
          )}
          {opt.visibility === 'private' && (
            <Lock className="h-3 w-3 shrink-0 text-[#5f6368] dark:text-muted-foreground" />
          )}
          {opt.visibility === 'public' && kind === 'private' && (
            <Globe className="h-3 w-3 shrink-0 text-[#5f6368] dark:text-muted-foreground" />
          )}
          <span className={`text-[14px] truncate ${isActive ? 'font-medium' : ''}`}>
            {opt.label}
          </span>
        </span>
        <span className="flex items-center">
          {count > 0 && <span className={COUNT_BADGE}>{count.toLocaleString()}</span>}
          {renderRowActions(opt)}
        </span>
      </button>
    );
  };

  return (
    <aside
      className={`shrink-0 flex flex-col overflow-hidden transition-all duration-200 ${
        sidebarOpen ? 'w-72 bg-[#f8f9fa] dark:bg-muted/30' : 'w-[72px] bg-[#eef0f2] dark:bg-muted/50'
      }`}
    >
      {sidebarOpen && (
        <div className="w-72 pl-4 flex-1 overflow-y-auto">
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <span className="text-[20px] font-bold tracking-tight text-[#1f1f1f] dark:text-foreground">
              Saved Filters
            </span>
            <div className="flex items-center gap-1">{createFilterAction}</div>
          </div>

          <div className="px-6 pb-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search Filters"
                className="w-full h-8 px-3 text-[13px] rounded-lg bg-[#f1f3f4] dark:bg-muted/50 border border-[#dadce0] dark:border-border text-[#1f1f1f] dark:text-foreground placeholder:text-[#80868b] dark:placeholder:text-muted-foreground/60 outline-none focus:border-[#3b2778] dark:focus:border-purple-400 transition-colors"
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto pb-4 px-3">
            {topOptions.map((opt) => {
              const isActive = activeFilter === opt.id;
              const count = filterCounts?.[opt.id] ?? 0;
              return (
                <button
                  key={opt.id}
                  onClick={() => onSelectFilter(opt.id)}
                  className={`${ROW_BASE} py-3 ${isActive ? ROW_ACTIVE : ROW_INACTIVE}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[14px] font-medium truncate">{opt.label}</span>
                  </span>
                  {count > 0 && (
                    <span className={COUNT_BADGE}>{count.toLocaleString()}</span>
                  )}
                </button>
              );
            })}

            {publicOptions.length > 0 && (
              <>
                <button
                  onClick={() => setPublicFiltersOpen((v) => !v)}
                  aria-expanded={publicFiltersOpen}
                  aria-controls="saved-filters-public-section"
                  className="w-full px-3 pt-4 pb-1 flex items-center justify-between group"
                >
                  <span className={SECTION_HEADER}>Public</span>
                  <ChevronUp
                    className={`h-3.5 w-3.5 text-[#80868b] dark:text-muted-foreground transition-transform duration-200 ${
                      publicFiltersOpen ? '' : 'rotate-180'
                    }`}
                  />
                </button>

                {publicFiltersOpen && (
                  <div id="saved-filters-public-section">
                    {publicOptions.map((opt) => renderRow(opt, 'public'))}
                  </div>
                )}
              </>
            )}

            {privateOptions.length > 0 && (
              <>
                <button
                  onClick={() => setPrivateFiltersOpen((v) => !v)}
                  aria-expanded={privateFiltersOpen}
                  aria-controls="saved-filters-private-section"
                  className="w-full px-3 pt-4 pb-1 flex items-center justify-between group"
                >
                  <span className={SECTION_HEADER}>Private</span>
                  <ChevronUp
                    className={`h-3.5 w-3.5 text-[#80868b] dark:text-muted-foreground transition-transform duration-200 ${
                      privateFiltersOpen ? '' : 'rotate-180'
                    }`}
                  />
                </button>

                {privateFiltersOpen && (
                  <div id="saved-filters-private-section">
                    {privateOptions.map((opt) => renderRow(opt, 'private'))}
                  </div>
                )}
              </>
            )}

            {customFilters.length > 0 && (
              <>
                <div className="pt-4 pb-1">
                  <span className={SECTION_HEADER}>Custom</span>
                </div>
                {customFilters.map((cf) => {
                  const isActive = activeFilter === cf.id;
                  const canRename = !!onRenameFilter;
                  const isRenaming = canRename && renamingFilterId === cf.id;

                  if (isRenaming) {
                    return (
                      <div key={cf.id}>
                        {renderRenameInput({ id: cf.id, kind: 'custom', currentLabel: cf.label })}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={cf.id}
                      onClick={() => onSelectFilter(cf.id)}
                      onDoubleClick={canRename ? () => startRename(cf.id, cf.label) : undefined}
                      className={`${ROW_BASE} py-2.5 ${isActive ? ROW_ACTIVE : ROW_INACTIVE}`}
                    >
                      <span className={`text-[14px] truncate ${isActive ? 'font-medium' : ''}`}>
                        {cf.label}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </nav>
        </div>
      )}
    </aside>
  );
}
