import { useState, type ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

export type SavedFilterOption = {
  id: string;
  label: string;
  group: 'top' | 'public';
  /** When true AND `onRenameFilter` is provided, this option can be renamed
   *  via double-click. Ignored when rename is not wired up. */
  editable?: boolean;
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
    filter: { id: string; kind: 'public' | 'custom'; currentLabel: string },
    newLabel: string,
  ) => void;
}

// ── Shared class strings (kept at module scope to avoid re-allocating each
//    render and to make design tweaks visible in one place) ─────────────────

const ROW_BASE =
  'relative w-full flex items-center justify-between px-3 text-left transition-colors';
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
}: SavedFiltersSidebarProps) {
  // Collapsible "Public" section — internal UI state, no page ever controlled this.
  const [publicFiltersOpen, setPublicFiltersOpen] = useState(true);

  // Inline rename state — internal. Only activated when `onRenameFilter` is provided.
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
    filter: { id: string; kind: 'public' | 'custom'; currentLabel: string },
  ) => {
    if (onRenameFilter) {
      onRenameFilter(filter, renamingValue);
    }
    setRenamingFilterId(null);
    setRenamingValue('');
  };

  const topOptions = filterOptions.filter((o) => o.group === 'top');
  const publicOptions = filterOptions.filter((o) => o.group === 'public');

  const renderRenameInput = (
    filter: { id: string; kind: 'public' | 'custom'; currentLabel: string },
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

  return (
    <aside
      className={`shrink-0 flex flex-col overflow-hidden transition-all duration-200 ${
        sidebarOpen ? 'w-72 bg-[#f8f9fa] dark:bg-muted/30' : 'w-[72px] bg-[#eef0f2] dark:bg-muted/50'
      }`}
    >
      {sidebarOpen && (
        <div className="w-72 pl-4 flex-1 overflow-y-auto">
          {/* Header: "Saved Filters" + create action slot */}
          <div className="px-6 pt-5 pb-3 flex items-center justify-between">
            <span className="text-[20px] font-bold tracking-tight text-[#1f1f1f] dark:text-foreground">
              Saved Filters
            </span>
            <div className="flex items-center gap-1">{createFilterAction}</div>
          </div>

          {/* Search Filters input — non-functional placeholder, preserved from
              current pages. Wire up in a future PR. */}
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
            {/* Top group — e.g. "All Opportunities" / "All Contacts" */}
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

            {/* Public section header (collapsible) */}
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
                {publicOptions.map((opt) => {
                  const isActive = activeFilter === opt.id;
                  const count = filterCounts?.[opt.id] ?? 0;
                  const canRename = !!onRenameFilter && !!opt.editable;
                  const isRenaming = canRename && renamingFilterId === opt.id;

                  if (isRenaming) {
                    return (
                      <div key={opt.id}>
                        {renderRenameInput({ id: opt.id, kind: 'public', currentLabel: opt.label })}
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
                      <span className={`text-[14px] truncate ${isActive ? 'font-medium' : ''}`}>
                        {opt.label}
                      </span>
                      {count > 0 && (
                        <span className={COUNT_BADGE}>{count.toLocaleString()}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Custom filters (only rendered when the page has any) */}
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
