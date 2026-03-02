import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EvanLayout from '@/components/evan/EvanLayout';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { KanbanColumn } from '@/components/admin/KanbanColumn';
import {
  ArrowUpDown,
  Search,
  PanelLeft,
  Filter,
  Settings2,
  ChevronDown,
  Check,
  X,
  LayoutGrid,
  Table2,
  PanelRightOpen,
  FileSearch,
  Building2,
  Flame,
} from 'lucide-react';
import {
  DndContext, DragEndEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format } from 'date-fns';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

const statusOrder: LeadStatus[] = [
  'initial_review',
  'moving_to_underwriting',
  'onboarding',
  'underwriting',
  'ready_for_wu_approval',
  'pre_approval_issued',
  'won',
];

const stageConfig: Record<string, { title: string; color: string; dot: string; pill: string }> = {
  initial_review: {
    title: 'Initial Review',
    color: 'bg-blue-600',
    dot: 'bg-blue-500',
    pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  moving_to_underwriting: {
    title: 'Moving to UW',
    color: 'bg-cyan-600',
    dot: 'bg-cyan-500',
    pill: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  },
  onboarding: {
    title: 'Onboarding',
    color: 'bg-amber-600',
    dot: 'bg-amber-500',
    pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  underwriting: {
    title: 'Underwriting',
    color: 'bg-orange-600',
    dot: 'bg-orange-500',
    pill: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  },
  ready_for_wu_approval: {
    title: 'Ready for Approval',
    color: 'bg-violet-600',
    dot: 'bg-violet-500',
    pill: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  },
  pre_approval_issued: {
    title: 'Pre-Approval Issued',
    color: 'bg-purple-600',
    dot: 'bg-purple-500',
    pill: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
  won: {
    title: 'Won',
    color: 'bg-emerald-600',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-orange-500', 'bg-pink-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    return differenceInDays(new Date(), parseISO(dateStr));
  } catch {
    return null;
  }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

type SortField = 'name' | 'company_name' | 'status' | 'last_activity_at' | 'assigned_to' | 'updated_at';
type SortDir = 'asc' | 'desc';

type ColumnKey = 'company' | 'contact' | 'ownedBy' | 'stage' | 'daysInStage' | 'lastTouchpoint' | 'lastContacted' | 'inactiveDays' | 'tags';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  company: 'Company',
  contact: 'Contact',
  ownedBy: 'Owner',
  stage: 'Stage',
  daysInStage: 'Days in Stage',
  lastTouchpoint: 'Last Touchpoint',
  lastContacted: 'Last Contacted',
  inactiveDays: 'Inactive Days',
  tags: 'Tags',
};

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'last_activity_at', label: 'Last Activity' },
  { value: 'name', label: 'Name' },
  { value: 'company_name', label: 'Company' },
  { value: 'status', label: 'Status' },
  { value: 'assigned_to', label: 'Owner' },
  { value: 'updated_at', label: 'Updated' },
];

const Pipeline = () => {
  const queryClient = useQueryClient();

  // Core state
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_activity_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);

  // Toolbar state
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [publicFiltersOpen, setPublicFiltersOpen] = useState(true);
  const [ownerFiltersOpen, setOwnerFiltersOpen] = useState(true);

  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    company: true, contact: true, ownedBy: true, stage: true,
    daysInStage: true, lastTouchpoint: true, lastContacted: true,
    inactiveDays: true, tags: true,
  });

  const DEFAULT_COLUMN_WIDTHS: Record<string, number> = useMemo(() => ({
    deal: 200, company: 140, contact: 120, ownedBy: 100,
    stage: 160, daysInStage: 65, lastTouchpoint: 140,
    lastContacted: 110, inactiveDays: 75, tags: 120,
  }), []);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('pipeline-column-widths');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
      }
    } catch {}
    return DEFAULT_COLUMN_WIDTHS;
  });

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [columnId]: newWidth };
      localStorage.setItem('pipeline-column-widths', JSON.stringify(next));
      return next;
    });
  }, []);

  const columnsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
        setShowColumnsMenu(false);
      }
    }
    if (showColumnsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnsMenu]);

  function clearAllFilters() {
    setActiveFilter('all');
    setSearchTerm('');
    setSearchOpen(false);
  }

  function toggleColumn(key: ColumnKey) {
    setColumnVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const isFiltersActive = activeFilter !== 'all' || searchTerm.trim() !== '';
  const isNonDefaultSort = sortField !== 'last_activity_at' || sortDir !== 'desc';
  const sortFieldLabel = SORT_FIELD_OPTIONS.find(o => o.value === sortField)?.label ?? sortField;

  // DnD sensors for Kanban
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Fetch leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['pipeline-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('status', statusOrder)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, avatar_url')
        .order('name');
      if (error) throw error;
      return data as { id: string; name: string; avatar_url: string | null }[];
    },
  });

  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) map[m.id] = m.name;
    return map;
  }, [teamMembers]);

  const teamAvatarMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) {
      if (m.avatar_url) map[m.id] = m.avatar_url;
    }
    return map;
  }, [teamMembers]);

  // Fetch latest touchpoints
  const { data: touchpoints = {} } = useQuery({
    queryKey: ['pipeline-touchpoints'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select('lead_id, communication_type, direction, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const map: Record<string, { type: string; direction: string; date: string }> = {};
      for (const row of data || []) {
        if (row.lead_id && !map[row.lead_id]) {
          map[row.lead_id] = {
            type: row.communication_type,
            direction: row.direction,
            date: row.created_at,
          };
        }
      }
      return map;
    },
  });

  // Update lead status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: LeadStatus }) => {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      toast.success('Lead moved successfully');
    },
    onError: () => {
      toast.error('Failed to move lead');
    },
  });

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    for (const status of statusOrder) {
      counts[status] = leads.filter((l) => l.status === status).length;
    }
    for (const tm of teamMembers) {
      counts[`owner_${tm.id}`] = leads.filter(l => l.assigned_to === tm.id).length;
    }
    counts['unassigned'] = leads.filter(l => !l.assigned_to).length;
    return counts;
  }, [leads, teamMembers]);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let result = leads;

    if (activeFilter !== 'all') {
      if ((statusOrder as string[]).includes(activeFilter)) {
        result = result.filter((l) => l.status === activeFilter);
      } else if (activeFilter.startsWith('owner_')) {
        const ownerId = activeFilter.replace('owner_', '');
        result = result.filter((l) => l.assigned_to === ownerId);
      } else if (activeFilter === 'unassigned') {
        result = result.filter((l) => !l.assigned_to);
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.company_name ?? '').toLowerCase().includes(q) ||
          (teamMemberMap[l.assigned_to ?? ''] ?? '').toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = ((a[sortField] ?? '') as string);
      const bVal = ((b[sortField] ?? '') as string);
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [leads, activeFilter, searchTerm, sortField, sortDir, teamMemberMap]);

  // Group leads by status for Kanban
  const leadsByStatus = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    for (const status of statusOrder) {
      grouped[status] = filteredAndSorted.filter((l) => l.status === status);
    }
    return grouped;
  }, [filteredAndSorted]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const leadId = active.id as string;
    const newStatus = over.id as LeadStatus;
    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.status !== newStatus) {
      updateStatusMutation.mutate({ leadId, newStatus });
    }
  };

  function handleRowClick(lead: Lead) {
    setDetailDialogLead(lead);
  }

  // Column header helper
  const ColHeader = ({
    colKey,
    children,
    className: extraClassName,
    style: extraStyle,
  }: {
    colKey?: ColumnKey;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }) => {
    if (colKey && !columnVisibility[colKey]) return null;
    const widthKey = colKey ?? 'deal';
    const width = columnWidths[widthKey] ?? 120;
    return (
      <th
        className={`px-4 py-3 text-left whitespace-nowrap ${extraClassName ?? ''}`}
        style={{ width: `${width}px`, minWidth: 60, maxWidth: 500, ...extraStyle }}
      >
        <ResizableColumnHeader
          columnId={widthKey}
          currentWidth={`${width}px`}
          onResize={handleColumnResize}
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {children}
          </span>
        </ResizableColumnHeader>
      </th>
    );
  };

  const iconBtn = (active = false) =>
    `relative flex items-center justify-center h-7 w-7 rounded transition-all ${
      active
        ? 'bg-card shadow-sm text-foreground border border-border'
        : 'text-muted-foreground hover:bg-card hover:shadow-sm hover:text-foreground hover:border hover:border-border'
    }`;

  return (
    <EvanLayout>
      <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">

        {/* Header */}
        <div className="shrink-0 border-b border-border bg-background px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-foreground whitespace-nowrap">Pipeline</h1>
          </div>

          {/* Table | Kanban | Sort toggle */}
          <div className="flex items-center h-7 rounded-md border border-border overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode('table')}
              title="Table view"
              className={`flex items-center justify-center h-full px-2 transition-all ${
                viewMode === 'table'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                  : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-border" />
            <button
              onClick={() => setViewMode('kanban')}
              title="Kanban view"
              className={`flex items-center justify-center h-full px-2 transition-all ${
                viewMode === 'kanban'
                  ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                  : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-border" />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Sort"
                  className={`flex items-center justify-center h-full px-2 transition-all ${
                    isNonDefaultSort
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400'
                      : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-3 space-y-3">
                <p className="text-xs font-semibold text-foreground">Sort by</p>
                <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_FIELD_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortDir} onValueChange={(v) => setSortDir(v as SortDir)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc" className="text-xs">Ascending</SelectItem>
                    <SelectItem value="desc" className="text-xs">Descending</SelectItem>
                  </SelectContent>
                </Select>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Body: Sidebar + Table */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left Sidebar */}
          <aside
            className={`shrink-0 border-r border-border bg-background flex flex-col overflow-hidden transition-all duration-200 ${
              sidebarOpen ? 'w-56' : 'w-0 border-r-0'
            }`}
          >
            <div className="w-56">
              <div className="px-3 pt-3 pb-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Filters</span>
              </div>

              <nav className="flex-1 overflow-y-auto pb-4">
                {/* All Deals */}
                {(() => {
                  const isActive = activeFilter === 'all';
                  const count = filterCounts['all'] ?? 0;
                  return (
                    <button
                      onClick={() => setActiveFilter('all')}
                      className={`relative w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                        isActive ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {isActive && <span className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-r-full bg-blue-600" />}
                      <span className={`text-[13px] font-medium truncate ${isActive ? 'text-blue-700 dark:text-blue-400' : ''}`}>All Deals</span>
                      {count > 0 && (
                        <span className={`ml-1 shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-600 text-white' : 'text-muted-foreground'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })()}

                {/* By Stage */}
                <button
                  onClick={() => setPublicFiltersOpen(v => !v)}
                  className="w-full px-3 pt-3 pb-1 flex items-center justify-between group"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">By Stage</span>
                  <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${publicFiltersOpen ? '' : '-rotate-90'}`} />
                </button>

                {publicFiltersOpen && statusOrder.map((status) => {
                  const isActive = activeFilter === status;
                  const count = filterCounts[status] ?? 0;
                  const cfg = stageConfig[status];
                  return (
                    <button
                      key={status}
                      onClick={() => setActiveFilter(status)}
                      className={`relative w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                        isActive ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {isActive && <span className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-r-full bg-blue-600" />}
                      <span className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className={`text-[13px] truncate ${isActive ? 'font-medium text-blue-700 dark:text-blue-400' : ''}`}>{cfg.title}</span>
                      </span>
                      {count > 0 && (
                        <span className={`ml-1 shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-600 text-white' : 'text-muted-foreground'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* By Owner */}
                <button
                  onClick={() => setOwnerFiltersOpen(v => !v)}
                  className="w-full px-3 pt-3 pb-1 flex items-center justify-between group"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">By Owner</span>
                  <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${ownerFiltersOpen ? '' : '-rotate-90'}`} />
                </button>

                {ownerFiltersOpen && (
                  <>
                    {teamMembers.map((tm) => {
                      const filterId = `owner_${tm.id}`;
                      const isActive = activeFilter === filterId;
                      const count = filterCounts[filterId] ?? 0;
                      return (
                        <button
                          key={filterId}
                          onClick={() => setActiveFilter(filterId)}
                          className={`relative w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                            isActive ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {isActive && <span className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-r-full bg-blue-600" />}
                          <span className={`text-[13px] truncate ${isActive ? 'font-medium text-blue-700 dark:text-blue-400' : ''}`}>{tm.name}</span>
                          {count > 0 && (
                            <span className={`ml-1 shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-600 text-white' : 'text-muted-foreground'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {(() => {
                      const isActive = activeFilter === 'unassigned';
                      const count = filterCounts['unassigned'] ?? 0;
                      return (
                        <button
                          onClick={() => setActiveFilter('unassigned')}
                          className={`relative w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                            isActive ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {isActive && <span className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-r-full bg-blue-600" />}
                          <span className={`text-[13px] truncate ${isActive ? 'font-medium text-blue-700 dark:text-blue-400' : ''}`}>Unassigned</span>
                          {count > 0 && (
                            <span className={`ml-1 shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-600 text-white' : 'text-muted-foreground'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })()}
                  </>
                )}
              </nav>
            </div>
          </aside>

          {/* Main Table Area */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Toolbar */}
            <div className="shrink-0 border-b border-border px-3 py-2 flex items-center justify-between gap-2 bg-muted/50">

              {/* Left group */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSidebarOpen(v => !v)}
                  title={sidebarOpen ? 'Hide filters' : 'Show filters'}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border text-xs font-medium transition-all bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <PanelLeft className="h-3.5 w-3.5 shrink-0" />
                </button>

                {!isLoading && (
                  <span className="text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                    # {filteredAndSorted.length.toLocaleString()} {filteredAndSorted.length === 1 ? 'deal' : 'deals'}
                  </span>
                )}

                {isNonDefaultSort && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-md px-2 h-7">
                    <ArrowUpDown className="h-3 w-3 shrink-0" />
                    {sortFieldLabel} {sortDir === 'asc' ? '↑' : '↓'}
                    <button
                      onClick={() => { setSortField('last_activity_at'); setSortDir('desc'); }}
                      className="ml-0.5 text-blue-400 hover:text-blue-700"
                      title="Reset sort"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>

              {/* Right group */}
              <div className="flex items-center gap-0.5">

                {searchOpen && (
                  <Input
                    autoFocus
                    placeholder="Search deals, companies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setSearchTerm(''); setSearchOpen(false); } }}
                    onBlur={() => { if (!searchTerm) setSearchOpen(false); }}
                    className="h-7 w-52 text-xs mr-1 border-border bg-card"
                  />
                )}

                {/* Sort */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button title="Sort options" className={iconBtn(isNonDefaultSort)}>
                      <ArrowUpDown className={`h-3.5 w-3.5 ${isNonDefaultSort ? 'text-blue-600' : ''}`} />
                      {isNonDefaultSort && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-600" />}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-56 p-3 space-y-3">
                    <p className="text-xs font-semibold text-foreground">Sort by</p>
                    <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SORT_FIELD_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={sortDir} onValueChange={(v) => setSortDir(v as SortDir)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asc" className="text-xs">Ascending</SelectItem>
                        <SelectItem value="desc" className="text-xs">Descending</SelectItem>
                      </SelectContent>
                    </Select>
                  </PopoverContent>
                </Popover>

                {/* Filter clear */}
                <button
                  onClick={isFiltersActive ? clearAllFilters : undefined}
                  title={isFiltersActive ? 'Clear all filters' : 'No active filters'}
                  className={iconBtn(isFiltersActive)}
                >
                  {isFiltersActive ? (
                    <X className="h-3.5 w-3.5 text-blue-600" />
                  ) : (
                    <Filter className="h-3.5 w-3.5" />
                  )}
                  {isFiltersActive && <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-600" />}
                </button>

                {/* Search toggle */}
                <button
                  onClick={() => setSearchOpen(v => !v)}
                  title="Search deals"
                  className={iconBtn(searchOpen || !!searchTerm)}
                >
                  <Search className={`h-3.5 w-3.5 ${(searchOpen || searchTerm) ? 'text-blue-600' : ''}`} />
                </button>

                {/* Column visibility */}
                <div className="relative" ref={columnsMenuRef}>
                  <button
                    onClick={() => setShowColumnsMenu(v => !v)}
                    title="Show/hide columns"
                    className={iconBtn(showColumnsMenu)}
                  >
                    <Settings2 className={`h-3.5 w-3.5 ${showColumnsMenu ? 'text-blue-600' : ''}`} />
                  </button>

                  {showColumnsMenu && (
                    <div className="absolute right-0 top-full mt-1.5 z-50 bg-popover border border-border rounded-xl shadow-lg w-52 py-1.5 overflow-hidden">
                      <div className="px-3 py-1.5 border-b border-border">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Visible Columns</p>
                      </div>
                      <div className="py-1">
                        {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
                          <button
                            key={key}
                            onClick={() => toggleColumn(key)}
                            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted transition-colors"
                          >
                            <span className="text-[13px] text-foreground">{COLUMN_LABELS[key]}</span>
                            <span className={`flex items-center justify-center h-4 w-4 rounded border transition-colors ${
                              columnVisibility[key]
                                ? 'bg-blue-600 border-blue-600'
                                : 'border-border bg-card'
                            }`}>
                              {columnVisibility[key] && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="px-3 py-1.5 border-t border-border">
                        <button
                          onClick={() => {
                            const allTrue = Object.fromEntries(
                              (Object.keys(COLUMN_LABELS) as ColumnKey[]).map(k => [k, true])
                            ) as Record<ColumnKey, boolean>;
                            setColumnVisibility(allTrue);
                          }}
                          className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Show all columns
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content Area: Table or Kanban */}
            {viewMode === 'table' ? (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                  <thead className="border-b border-border">
                    <tr>
                      <th className="w-10 px-4 py-3 sticky top-0 left-0 z-30 bg-gray-100 dark:bg-muted" />
                      <ColHeader className="sticky top-0 z-30 bg-gray-100 dark:bg-muted border-r border-border/50" style={{ left: 40 }}>
                        Deal
                      </ColHeader>
                      <ColHeader colKey="company" className="sticky top-0 z-10 bg-white dark:bg-card">Company</ColHeader>
                      <ColHeader colKey="contact" className="sticky top-0 z-10 bg-white dark:bg-card">Contact</ColHeader>
                      <ColHeader colKey="ownedBy" className="sticky top-0 z-10 bg-white dark:bg-card">Owner</ColHeader>
                      <ColHeader colKey="stage" className="sticky top-0 z-10 bg-white dark:bg-card">Stage</ColHeader>
                      <ColHeader colKey="daysInStage" className="sticky top-0 z-10 bg-white dark:bg-card">Days</ColHeader>
                      <ColHeader colKey="lastTouchpoint" className="sticky top-0 z-10 bg-white dark:bg-card">Last Touchpoint</ColHeader>
                      <ColHeader colKey="lastContacted" className="sticky top-0 z-10 bg-white dark:bg-card">Contacted</ColHeader>
                      <ColHeader colKey="inactiveDays" className="sticky top-0 z-10 bg-white dark:bg-card">Dormant</ColHeader>
                      <ColHeader colKey="tags" className="sticky top-0 z-10 bg-white dark:bg-card">Tags</ColHeader>
                      <th className="w-10 px-2 py-3 sticky top-0 z-10 bg-white dark:bg-card" />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 7 }).map((_, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                          <td className="px-4 py-3.5 w-10 sticky left-0 z-[5] bg-white dark:bg-card"><Skeleton className="h-4 w-4 rounded" /></td>
                          <td className="px-4 py-3.5 sticky z-[5] border-r border-border/50 bg-white dark:bg-card" style={{ width: columnWidths.deal, left: 40 }}>
                            <div className="flex items-center gap-2.5">
                              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3.5 w-36" />
                                <Skeleton className="h-2.5 w-24" />
                              </div>
                            </div>
                          </td>
                          {columnVisibility.company && <td className="px-4 py-3.5" style={{ width: columnWidths.company }}><Skeleton className="h-3.5 w-24 rounded" /></td>}
                          {columnVisibility.contact && <td className="px-4 py-3.5" style={{ width: columnWidths.contact }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.ownedBy && <td className="px-4 py-3.5" style={{ width: columnWidths.ownedBy }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.stage && <td className="px-4 py-3.5" style={{ width: columnWidths.stage }}><Skeleton className="h-5 w-28 rounded-full" /></td>}
                          {columnVisibility.daysInStage && <td className="px-4 py-3.5" style={{ width: columnWidths.daysInStage }}><Skeleton className="h-3.5 w-10 rounded" /></td>}
                          {columnVisibility.lastTouchpoint && <td className="px-4 py-3.5" style={{ width: columnWidths.lastTouchpoint }}><Skeleton className="h-3.5 w-24 rounded" /></td>}
                          {columnVisibility.lastContacted && <td className="px-4 py-3.5" style={{ width: columnWidths.lastContacted }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.inactiveDays && <td className="px-4 py-3.5" style={{ width: columnWidths.inactiveDays }}><Skeleton className="h-3.5 w-10 rounded" /></td>}
                          {columnVisibility.tags && <td className="px-4 py-3.5" style={{ width: columnWidths.tags }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                        </tr>
                      ))
                    ) : filteredAndSorted.length === 0 ? (
                      <tr>
                        <td colSpan={12}>
                          <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted">
                              <FileSearch className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold text-foreground">No deals found</p>
                              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                                {searchTerm ? 'Try adjusting your search or filter criteria' : 'No deals are in this stage yet'}
                              </p>
                            </div>
                            {isFiltersActive && (
                              <button
                                onClick={clearAllFilters}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold mt-1 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                              >
                                Clear all filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredAndSorted.map((lead, rowIdx) => {
                        const initial = lead.name[0]?.toUpperCase() ?? '?';
                        const avatarColor = getAvatarColor(lead.name);
                        const stageCfg = stageConfig[lead.status];
                        const assignedName = lead.assigned_to
                          ? (teamMemberMap[lead.assigned_to] ?? null)
                          : null;
                        const assignedInitial = assignedName?.[0]?.toUpperCase() ?? null;
                        const assignedColor = assignedName ? getAvatarColor(assignedName) : '';
                        const assignedAvatar = lead.assigned_to ? (teamAvatarMap[lead.assigned_to] ?? null) : null;
                        const daysInStage = daysSince(lead.updated_at);
                        const inactiveDays = daysSince(lead.last_activity_at);
                        const isStale = inactiveDays !== null && inactiveDays > 7;
                        const isLingering = daysInStage !== null && daysInStage > 14;
                        const tp = touchpoints[lead.id];
                        const isSelected = detailDialogLead?.id === lead.id;

                        const stickyBg = isSelected
                          ? 'bg-blue-50 dark:bg-blue-950 group-hover:bg-blue-100 dark:group-hover:bg-blue-900'
                          : 'bg-white dark:bg-card group-hover:bg-gray-50 dark:group-hover:bg-muted';

                        return (
                          <tr
                            key={lead.id}
                            onClick={() => handleRowClick(lead)}
                            className={`cursor-pointer transition-colors duration-100 group border-b border-border/60 last:border-b-0 ${
                              isSelected
                                ? 'bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-50/80 dark:hover:bg-blue-950/40'
                                : rowIdx % 2 === 0
                                  ? 'bg-card hover:bg-muted/50'
                                  : 'bg-muted/30 hover:bg-muted/50'
                            }`}
                          >
                            {/* Checkbox */}
                            <td className={`px-4 py-3 w-10 sticky left-0 z-[5] transition-colors ${stickyBg}`}>
                              <div className={`h-4 w-4 rounded border-2 transition-colors ${
                                isSelected ? 'border-blue-500 bg-blue-500' : 'border-border bg-card group-hover:border-muted-foreground/50'
                              } flex items-center justify-center`}>
                                {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                              </div>
                            </td>

                            {/* Deal (sticky) */}
                            <td className={`px-4 py-3 overflow-hidden sticky z-[5] border-r border-border/50 transition-colors ${stickyBg}`} style={{ width: columnWidths.deal, left: 40 }}>
                              <div className="flex items-center gap-2.5">
                                <div className={`h-7 w-7 rounded-full ${avatarColor} flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm`}>
                                  {initial}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-foreground truncate text-[13px] leading-tight">
                                    {lead.name}
                                  </p>
                                  {lead.company_name && (
                                    <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">{lead.company_name}</p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Company */}
                            {columnVisibility.company && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.company }}>
                                {lead.company_name ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                                      <Building2 className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                    <span className="text-[13px] text-foreground/80 truncate max-w-[120px]">{lead.company_name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Contact */}
                            {columnVisibility.contact && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.contact }}>
                                <span className="text-[13px] text-foreground/80 truncate block max-w-[110px]">{lead.name}</span>
                              </td>
                            )}

                            {/* Owner */}
                            {columnVisibility.ownedBy && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.ownedBy }}>
                                {assignedName && assignedInitial ? (
                                  <div className="flex items-center gap-2">
                                    {assignedAvatar ? (
                                      <img src={assignedAvatar} alt={assignedName} className="h-6 w-6 rounded-full object-cover shrink-0 shadow-sm" />
                                    ) : (
                                      <div className={`h-6 w-6 rounded-full ${assignedColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm`}>
                                        {assignedInitial}
                                      </div>
                                    )}
                                    <span className="text-[13px] text-foreground/80 truncate max-w-[80px]">{assignedName}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/40 text-[13px]">—</span>
                                )}
                              </td>
                            )}

                            {/* Stage */}
                            {columnVisibility.stage && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.stage }}>
                                {stageCfg ? (
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${stageCfg.pill}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${stageCfg.dot}`} />
                                    {stageCfg.title}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">{lead.status}</span>
                                )}
                              </td>
                            )}

                            {/* Days in Stage */}
                            {columnVisibility.daysInStage && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.daysInStage }}>
                                {daysInStage !== null ? (
                                  <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${
                                    isLingering ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                                  }`}>
                                    {isLingering && <Flame className="h-3 w-3 text-amber-500 shrink-0" />}
                                    {daysInStage}d
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Last Touchpoint */}
                            {columnVisibility.lastTouchpoint && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.lastTouchpoint }}>
                                {tp ? (
                                  <div className="min-w-0">
                                    <span className="text-[12px] text-foreground/80 capitalize">{tp.direction} {tp.type}</span>
                                    <p className="text-[11px] text-muted-foreground tabular-nums">{formatShortDate(tp.date)}</p>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Last Contacted */}
                            {columnVisibility.lastContacted && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.lastContacted }}>
                                <span className="text-[12px] text-muted-foreground tabular-nums">{formatShortDate(lead.last_activity_at)}</span>
                              </td>
                            )}

                            {/* Inactive Days */}
                            {columnVisibility.inactiveDays && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.inactiveDays }}>
                                {isStale ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">
                                    {inactiveDays}d
                                  </span>
                                ) : inactiveDays !== null ? (
                                  <span className="text-[12px] text-muted-foreground tabular-nums">{inactiveDays}d</span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Tags */}
                            {columnVisibility.tags && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.tags }}>
                                {lead.tags && lead.tags.length > 0 ? (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    {lead.tags.slice(0, 2).map((tag) => (
                                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60">
                                        {tag}
                                      </span>
                                    ))}
                                    {lead.tags.length > 2 && (
                                      <span className="text-[10px] text-muted-foreground font-medium">+{lead.tags.length - 2}</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Detail arrow */}
                            <td className="px-2 py-3 w-10">
                              <PanelRightOpen className={`h-4 w-4 transition-all duration-150 ${
                                isSelected
                                  ? 'text-blue-500'
                                  : 'text-transparent group-hover:text-muted-foreground'
                              }`} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Kanban View */
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-auto p-4">
                  <div className="flex gap-4 h-full min-h-[500px]">
                    {statusOrder.map((status) => {
                      const config = stageConfig[status];
                      return (
                        <KanbanColumn
                          key={status}
                          status={status}
                          leads={leadsByStatus[status] || []}
                          title={config.title}
                          color={config.color}
                          touchpoints={touchpoints}
                          onLeadClick={(lead) => setDetailDialogLead(lead)}
                        />
                      );
                    })}
                  </div>
                </div>
              </DndContext>
            )}
          </main>
        </div>

        {/* Lead Detail Dialog */}
        {detailDialogLead && (
          <LeadDetailDialog
            lead={detailDialogLead}
            open={!!detailDialogLead}
            onOpenChange={(open) => {
              if (!open) setDetailDialogLead(null);
            }}
          />
        )}
      </div>
    </EvanLayout>
  );
};

export default Pipeline;
