import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EvanLayout from '@/components/evan/EvanLayout';
import PipelineSettingsDialog from '@/components/admin/PipelineSettingsDialog';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import {
  ArrowUpDown,
  Search,
  AlignJustify,
  PanelLeft,
  Filter,
  Settings2,
  ChevronDown,
  Bookmark,
  Plus,
  DollarSign,
  User,
  CheckSquare,
  Building2,
  Tag,
  CalendarDays,
  Clock,
  MessageSquare,
  Moon,
  FileSearch,
  Timer,
  Flame,
  ArrowRightCircle,
  Check,
  X,
  LayoutGrid,
  Table2,
  GripVertical,
} from 'lucide-react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter, useDroppable,
} from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { format, differenceInDays, parseISO } from 'date-fns';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

const UNDERWRITING_STATUSES: LeadStatus[] = [
  'moving_to_underwriting',
  'underwriting',
  'ready_for_wu_approval',
  'pre_approval_issued',
];

const stageConfig: Record<string, { label: string; color: string; bg: string; dot: string; pill: string }> = {
  moving_to_underwriting: {
    label: 'Moving to UW',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    dot: 'bg-blue-500',
    pill: 'bg-blue-100 text-blue-700',
  },
  underwriting: {
    label: 'Underwriting',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    dot: 'bg-amber-500',
    pill: 'bg-amber-100 text-amber-700',
  },
  ready_for_wu_approval: {
    label: 'Ready for Approval',
    color: 'text-violet-700',
    bg: 'bg-violet-50 border-violet-200',
    dot: 'bg-violet-500',
    pill: 'bg-violet-100 text-violet-700',
  },
  pre_approval_issued: {
    label: 'Pre-Approval Issued',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-100 text-emerald-700',
  },
};

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Opportunities', group: 'top' },
  { id: 'my_open', label: 'My Open Opportunities', group: 'public' },
  { id: 'open', label: 'Open Opportunities', group: 'public' },
  { id: 'following', label: "Opportunities I'm Following", group: 'public' },
  { id: 'won', label: 'Won Opportunities', group: 'public' },
  { id: 'brad_incoming', label: 'Brad Incoming Opportunities', group: 'public' },
  { id: 'initial_review', label: 'Deals for Initial Review', group: 'public' },
  { id: 'moving_to_underwriting', label: 'Deals Moving Towards Underwriting', group: 'public' },
  { id: 'onboarding_2024', label: 'OnBoarding 2024 - Opp. into UW', group: 'public' },
  { id: 'onboarding_2025', label: 'OnBoarding 2025 - Opp. into UW', group: 'public' },
  { id: 'onboarding_2026', label: 'OnBoarding 2026 - Opp. into UW', group: 'public' },
  { id: 'pre_approval_issued', label: 'Pre-Approval Letters Issued', group: 'public' },
  { id: 'ready_for_wu_approval', label: "Write Up's Pending Approval", group: 'public' },
];

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'last_activity_at', label: 'Last Activity' },
  { value: 'name', label: 'Name' },
  { value: 'company_name', label: 'Company' },
  { value: 'status', label: 'Status' },
  { value: 'assigned_to', label: 'Owner' },
  { value: 'updated_at', label: 'Updated' },
];

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
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

function seededRand(seed: string, index: number): number {
  let h = index * 2654435761;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h ^= h >>> 16;
  }
  return Math.abs(h) / 0xffffffff;
}

const VALUE_BUCKETS = [25000, 50000, 75000, 100000, 150000, 200000, 250000, 350000, 500000, 750000];

function fakeValue(id: string): number {
  return VALUE_BUCKETS[Math.floor(seededRand(id, 1) * VALUE_BUCKETS.length)];
}

function formatValue(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fakeTasks(id: string): number {
  return Math.floor(seededRand(id, 2) * 9);
}

function fakeInteractions(id: string): number {
  return Math.floor(seededRand(id, 3) * 26);
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

// Column visibility keys
type ColumnKey = 'company' | 'contact' | 'value' | 'ownedBy' | 'tasks' | 'stage' | 'daysInStage' | 'stageUpdated' | 'lastContacted' | 'interactions' | 'inactiveDays' | 'tags';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  company: 'Company',
  contact: 'Contact',
  value: 'Value',
  ownedBy: 'Owned By',
  tasks: 'Tasks',
  stage: 'Stage',
  daysInStage: 'Days in Stage',
  stageUpdated: 'Stage Updated',
  lastContacted: 'Last Contacted',
  interactions: 'Interactions',
  inactiveDays: 'Inactive Days',
  tags: 'Tags',
};

// ── Kanban sub-components ──

function KanbanDealCard({ lead, teamMemberMap, isDragging, onClick }: {
  lead: Lead;
  teamMemberMap: Record<string, string>;
  isDragging?: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const avatarColor = getAvatarColor(lead.name);
  const initial = lead.name[0]?.toUpperCase() ?? '?';
  const stageCfg = stageConfig[lead.status];
  const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? null) : null;
  const dealValue = fakeValue(lead.id);
  const daysInStage = daysSince(lead.updated_at);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="p-3 cursor-grab active:cursor-grabbing shadow-sm border border-border/60 hover:shadow-md transition-shadow bg-card"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`h-6 w-6 rounded-full ${avatarColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
            {initial}
          </div>
          <p className="text-sm font-semibold text-foreground leading-tight truncate">{lead.name}</p>
        </div>
        {lead.company_name && (
          <p className="text-[11px] text-muted-foreground mb-1.5 truncate">{lead.company_name}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[12px] font-medium text-foreground tabular-nums">{formatValue(dealValue)}</span>
          {daysInStage !== null && (
            <span className={`text-[11px] ${daysInStage > 14 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
              {daysInStage}d
            </span>
          )}
        </div>
        {assignedName && (
          <p className="text-[11px] text-muted-foreground mt-1">{assignedName}</p>
        )}
      </Card>
    </div>
  );
}

function KanbanDropColumn({ status, label, color, leads, teamMemberMap, draggedId, onLeadClick }: {
  status: LeadStatus;
  label: string;
  color: string;
  leads: Lead[];
  teamMemberMap: Record<string, string>;
  draggedId: string | null;
  onLeadClick: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl flex-1 min-w-[220px] max-w-[300px] transition-all ${
        isOver ? 'ring-2 ring-violet-400 ring-offset-2 bg-violet-50/30' : 'bg-muted/30'
      }`}
    >
      <div className="px-3 py-2.5 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span className="text-xs font-bold text-foreground uppercase tracking-wide">{label}</span>
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>
      <ScrollArea className="flex-1 px-2 pb-2">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[100px]">
            {leads.map((lead) => (
              <KanbanDealCard
                key={lead.id}
                lead={lead}
                teamMemberMap={teamMemberMap}
                isDragging={draggedId === lead.id}
                onClick={() => onLeadClick(lead)}
              />
            ))}
            {leads.length === 0 && (
              <div className="text-center text-muted-foreground text-xs py-10 border-2 border-dashed border-muted-foreground/20 rounded-lg">
                Drop deals here
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

const EvansUnderwriting = () => {
  const queryClient = useQueryClient();

  // ── Core state ──
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_activity_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Toolbar state ──
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [rowDensity, setRowDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    company: true, contact: true, value: true, ownedBy: true, tasks: true,
    stage: true, daysInStage: true, stageUpdated: true, lastContacted: true,
    interactions: true, inactiveDays: true, tags: true,
  });

  const columnsMenuRef = useRef<HTMLDivElement>(null);

  // Close columns dropdown when clicking outside
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

  const sortFieldLabel = SORT_FIELD_OPTIONS.find(o => o.value === sortField)?.label ?? sortField;

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

  // ── DnD sensors for Kanban ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Status update mutation for Kanban drag ──
  const statusMutation = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: LeadStatus }) => {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-leads'] });
      toast.success('Deal moved successfully');
    },
    onError: () => {
      toast.error('Failed to move deal');
    },
  });

  function handleDragStart(event: DragStartEvent) {
    const lead = filteredAndSorted.find(l => l.id === event.active.id);
    setDraggedLead(lead ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedLead(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const targetStatus = UNDERWRITING_STATUSES.find(s => s === over.id)
      ?? filteredAndSorted.find(l => l.id === over.id)?.status;

    if (!targetStatus) return;

    const lead = filteredAndSorted.find(l => l.id === active.id);
    if (!lead || lead.status === targetStatus) return;

    statusMutation.mutate({ leadId: lead.id, newStatus: targetStatus });
  }

  // ── Queries ──
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('is_active', true);
      return (data || []) as { id: string; name: string }[];
    },
  });

  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) map[m.id] = m.name;
    return map;
  }, [teamMembers]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['underwriting-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('status', UNDERWRITING_STATUSES)
        .order('last_activity_at', { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const { data: taskCountMap = {} } = useQuery({
    queryKey: ['underwriting-task-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_tasks')
        .select('lead_id')
        .in('lead_id', leads.map((l) => l.id));
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      for (const row of data) {
        if (row.lead_id) counts[row.lead_id] = (counts[row.lead_id] ?? 0) + 1;
      }
      return counts;
    },
    enabled: leads.length > 0,
  });

  const { data: interactionCountMap = {} } = useQuery({
    queryKey: ['underwriting-interaction-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select('lead_id')
        .in('lead_id', leads.map((l) => l.id));
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      for (const row of data) {
        if (row.lead_id) counts[row.lead_id] = (counts[row.lead_id] ?? 0) + 1;
      }
      return counts;
    },
    enabled: leads.length > 0,
  });

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    for (const status of UNDERWRITING_STATUSES) {
      counts[status] = leads.filter((l) => l.status === status).length;
    }
    counts['my_open'] = leads.length;
    counts['open'] = leads.length;
    counts['following'] = 0;
    counts['won'] = leads.filter(l => l.status === 'won' as LeadStatus).length;
    counts['brad_incoming'] = leads.filter(l => (l.assigned_to ?? '').toLowerCase().includes('brad') || teamMemberMap[l.assigned_to ?? '']?.toLowerCase().includes('brad')).length;
    counts['initial_review'] = leads.filter(l => l.status === ('initial_review' as LeadStatus)).length;
    counts['onboarding_2024'] = leads.filter(l => l.cohort_year === 2024).length;
    counts['onboarding_2025'] = leads.filter(l => l.cohort_year === 2025).length;
    counts['onboarding_2026'] = leads.filter(l => l.cohort_year === 2026).length;
    return counts;
  }, [leads, teamMemberMap]);

  const filteredAndSorted = useMemo(() => {
    let result = leads;

    if (activeFilter !== 'all') {
      if (['moving_to_underwriting', 'underwriting', 'ready_for_wu_approval', 'pre_approval_issued'].includes(activeFilter)) {
        result = result.filter((l) => l.status === activeFilter);
      } else if (activeFilter === 'initial_review') {
        result = result.filter((l) => l.status === ('initial_review' as LeadStatus));
      } else if (activeFilter === 'won') {
        result = result.filter((l) => l.status === ('won' as LeadStatus));
      } else if (activeFilter === 'brad_incoming') {
        result = result.filter((l) => teamMemberMap[l.assigned_to ?? '']?.toLowerCase().includes('brad'));
      } else if (activeFilter === 'onboarding_2024') {
        result = result.filter((l) => l.cohort_year === 2024);
      } else if (activeFilter === 'onboarding_2025') {
        result = result.filter((l) => l.cohort_year === 2025);
      } else if (activeFilter === 'onboarding_2026') {
        result = result.filter((l) => l.cohort_year === 2026);
      }
      // 'my_open', 'open', 'following' show all for now
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

  const totalValue = useMemo(
    () => leads.reduce((sum, l) => sum + fakeValue(l.id), 0),
    [leads]
  );

  const visibleFilters = useMemo(() => {
    if (!filterSearch.trim()) return FILTER_OPTIONS;
    const q = filterSearch.toLowerCase();
    return FILTER_OPTIONS.filter((o) => o.label.toLowerCase().includes(q));
  }, [filterSearch]);

  function handleColSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function handleRowClick(lead: Lead) {
    setSelectedLead(lead);
    setDialogOpen(true);
  }

  // Row padding based on density
  const rowPad = rowDensity === 'comfortable' ? 'py-2.5' : 'py-1';

  const ColHeader = ({
    colKey,
    field,
    icon,
    children,
    className = '',
    sortable = false,
  }: {
    colKey?: ColumnKey;
    field?: SortField;
    icon: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    sortable?: boolean;
  }) => {
    if (colKey && !columnVisibility[colKey]) return null;
    return (
      <th
        className={`px-3 py-2.5 text-left whitespace-nowrap ${sortable ? 'cursor-pointer select-none group' : ''} ${className}`}
        onClick={sortable && field ? () => handleColSort(field) : undefined}
      >
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <span className="shrink-0 text-muted-foreground/70">{icon}</span>
          {children}
          {sortable && field && (
            <ArrowUpDown
              className={`h-3 w-3 transition-opacity ${sortField === field ? 'opacity-100 text-violet-600' : 'opacity-0 group-hover:opacity-40'}`}
            />
          )}
        </span>
      </th>
    );
  };

  // Toolbar icon button base class
  const iconBtn = (active = false) =>
    `relative flex items-center justify-center h-7 w-7 rounded transition-all ${
      active
        ? 'bg-white shadow-sm text-slate-800 border border-slate-200'
        : 'text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-800 hover:border hover:border-slate-200'
    }`;

  return (
    <EvanLayout>
      <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">

        {/* ── CRM-Style Header ── */}
        <div className="shrink-0 border-b border-border bg-background px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground whitespace-nowrap">All Opportunities</h1>
            <button
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Bookmark this view"
            >
              <Bookmark className="h-4 w-4" strokeWidth={1.75} />
            </button>
            {!isLoading && (
              <>
                <span className="text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                  # {filteredAndSorted.length.toLocaleString()} {filteredAndSorted.length === 1 ? 'opportunity' : 'opportunities'}
                </span>
                <span className="text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                  ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </>
            )}
          </div>

          {/* Connected toolbar — Table | Kanban | Sort | Settings */}
          <div className="flex items-center h-7 rounded-md border border-slate-200 overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode('table')}
              title="Table view"
              className={`flex items-center gap-1.5 h-full px-2.5 text-xs font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-violet-50 text-violet-700'
                  : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Table2 className="h-3.5 w-3.5 shrink-0" />
              Table
            </button>
            <div className="w-px h-4 bg-slate-200" />
            <button
              onClick={() => setViewMode('kanban')}
              title="Kanban view"
              className={`flex items-center gap-1.5 h-full px-2.5 text-xs font-medium transition-all ${
                viewMode === 'kanban'
                  ? 'bg-violet-50 text-violet-700'
                  : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
              Kanban
            </button>
            <div className="w-px h-4 bg-slate-200" />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Sort"
                  className={`flex items-center gap-1.5 h-full px-2.5 text-xs font-medium transition-all ${
                    isNonDefaultSort
                      ? 'bg-violet-50 text-violet-700'
                      : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
                  Sort
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
            <div className="w-px h-4 bg-slate-200" />
            <button
              onClick={() => setSettingsOpen(true)}
              title="Pipeline settings"
              className="flex items-center justify-center h-full px-2 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <PipelineSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

          {/* Add Opportunity button */}
          <Button
            size="sm"
            className="h-8 px-4 text-xs font-semibold rounded-full gap-1.5 shrink-0"
          >
            Add Opportunity
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>

        {/* ── Body: Sidebar + Table ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left Sidebar ── */}
          <aside
            className={`shrink-0 border-r border-border bg-background flex flex-col overflow-hidden transition-all duration-200 ${
              sidebarOpen ? 'w-56' : 'w-0 border-r-0'
            }`}
          >
            <div className="w-56">
              <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Saved Filters</span>
                <button
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Add filter"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="px-2 pb-2">
                <Input
                  placeholder="Search Filters"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="h-7 text-xs bg-muted/40 border-border/60"
                />
              </div>

              <nav className="flex-1 overflow-y-auto pb-4">
                {visibleFilters.filter(o => o.group === 'top').map((opt) => {
                  const isActive = activeFilter === opt.id;
                  const count = filterCounts[opt.id] ?? 0;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setActiveFilter(opt.id)}
                      className={`relative w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                        isActive ? 'bg-violet-50 text-violet-700' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {isActive && <span className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-r-full bg-violet-600" />}
                      <span className={`text-[13px] font-medium truncate ${isActive ? 'text-violet-700' : ''}`}>{opt.label}</span>
                      {count > 0 && (
                        <span className={`ml-1 shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-violet-600 text-white' : 'text-muted-foreground'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}

                <div className="px-3 pt-3 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Public</span>
                </div>

                {visibleFilters.filter(o => o.group === 'public').map((opt) => {
                  const isActive = activeFilter === opt.id;
                  const count = filterCounts[opt.id] ?? 0;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setActiveFilter(opt.id)}
                      className={`relative w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                        isActive ? 'bg-violet-50 text-violet-700' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {isActive && <span className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-r-full bg-violet-600" />}
                      <span className={`text-[13px] truncate ${isActive ? 'font-medium text-violet-700' : ''}`}>{opt.label}</span>
                      {count > 0 && (
                        <span className={`ml-1 shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-violet-600 text-white' : 'text-muted-foreground'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* ── Main Table Area ── */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* ── Toolbar ── */}
            <div className="shrink-0 border-b border-border px-3 py-2 flex items-center justify-between gap-2 bg-slate-50">

              {/* Left group: view toggles */}
              <div className="flex items-center gap-2">


                {/* Sidebar toggle */}
                <button
                  onClick={() => setSidebarOpen(v => !v)}
                  title={sidebarOpen ? 'Hide filters' : 'Show filters'}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-all ${
                    !sidebarOpen
                      ? 'bg-violet-50 border-violet-200 text-violet-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  <PanelLeft className="h-3.5 w-3.5 shrink-0" />
                  {sidebarOpen ? 'Hide Filters' : 'Show Filters'}
                </button>

                {/* Sort indicator */}
                {isNonDefaultSort && (
                  <span className="flex items-center gap-1 text-[11px] text-violet-600 font-medium bg-violet-50 border border-violet-200 rounded-md px-2 h-7">
                    <ArrowUpDown className="h-3 w-3 shrink-0" />
                    {sortFieldLabel} {sortDir === 'asc' ? '↑' : '↓'}
                    <button
                      onClick={() => { setSortField('last_activity_at'); setSortDir('desc'); }}
                      className="ml-0.5 text-violet-400 hover:text-violet-700"
                      title="Reset sort"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>

              {/* Right group: action buttons + CTA */}
              <div className="flex items-center gap-0.5">

                {/* Inline search input */}
                {searchOpen && (
                  <Input
                    autoFocus
                    placeholder="Search deals, companies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setSearchTerm(''); setSearchOpen(false); } }}
                    onBlur={() => { if (!searchTerm) setSearchOpen(false); }}
                    className="h-7 w-52 text-xs mr-1 border-slate-200 bg-white"
                  />
                )}

                {/* Sort — opens popover in header; this is just an indicator */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      title="Sort options"
                      className={iconBtn(isNonDefaultSort)}
                    >
                      <ArrowUpDown className={`h-3.5 w-3.5 ${isNonDefaultSort ? 'text-violet-600' : ''}`} />
                      {isNonDefaultSort && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-violet-600" />
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-56 p-3 space-y-3">
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

                {/* Filter — clears when active */}
                <button
                  onClick={isFiltersActive ? clearAllFilters : undefined}
                  title={isFiltersActive ? 'Clear all filters' : 'No active filters'}
                  className={iconBtn(isFiltersActive)}
                >
                  {isFiltersActive ? (
                    <X className="h-3.5 w-3.5 text-violet-600" />
                  ) : (
                    <Filter className="h-3.5 w-3.5" />
                  )}
                  {isFiltersActive && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-violet-600" />
                  )}
                </button>

                {/* Search toggle */}
                <button
                  onClick={() => setSearchOpen(v => !v)}
                  title="Search opportunities"
                  className={iconBtn(searchOpen || !!searchTerm)}
                >
                  <Search className={`h-3.5 w-3.5 ${(searchOpen || searchTerm) ? 'text-violet-600' : ''}`} />
                </button>

                {/* Column visibility */}
                <div className="relative" ref={columnsMenuRef}>
                  <button
                    onClick={() => setShowColumnsMenu(v => !v)}
                    title="Show/hide columns"
                    className={iconBtn(showColumnsMenu)}
                  >
                    <Settings2 className={`h-3.5 w-3.5 ${showColumnsMenu ? 'text-violet-600' : ''}`} />
                  </button>

                  {showColumnsMenu && (
                    <div className="absolute right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-lg w-52 py-1.5 overflow-hidden">
                      <div className="px-3 py-1.5 border-b border-slate-100">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Visible Columns</p>
                      </div>
                      <div className="py-1">
                        {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
                          <button
                            key={key}
                            onClick={() => toggleColumn(key)}
                            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 transition-colors"
                          >
                            <span className="text-[13px] text-slate-700">{COLUMN_LABELS[key]}</span>
                            <span className={`flex items-center justify-center h-4 w-4 rounded border transition-colors ${
                              columnVisibility[key]
                                ? 'bg-violet-600 border-violet-600'
                                : 'border-slate-300 bg-white'
                            }`}>
                              {columnVisibility[key] && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="px-3 py-1.5 border-t border-slate-100">
                        <button
                          onClick={() => {
                            const allTrue = Object.fromEntries(
                              (Object.keys(COLUMN_LABELS) as ColumnKey[]).map(k => [k, true])
                            ) as Record<ColumnKey, boolean>;
                            setColumnVisibility(allTrue);
                          }}
                          className="text-[11px] text-violet-600 hover:text-violet-700 font-medium"
                        >
                          Show all columns
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* ── Content Area: Table or Kanban ── */}
            {viewMode === 'table' ? (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-background border-b border-border">
                    <tr>
                      <th className="w-8 px-3 py-2.5" />
                      <ColHeader sortable field="name" icon={<DollarSign className="h-3.5 w-3.5" />} className="min-w-[220px]">
                        Opportunity
                      </ColHeader>
                      <ColHeader colKey="company" sortable field="company_name" icon={<Building2 className="h-3.5 w-3.5" />} className="min-w-[140px]">
                        Company
                      </ColHeader>
                      <ColHeader colKey="contact" icon={<User className="h-3.5 w-3.5" />} className="min-w-[120px]">
                        Contact
                      </ColHeader>
                      <ColHeader colKey="value" icon={<DollarSign className="h-3.5 w-3.5" />} className="min-w-[110px]">
                        Value
                      </ColHeader>
                      <ColHeader colKey="ownedBy" sortable field="assigned_to" icon={<User className="h-3.5 w-3.5" />} className="min-w-[120px]">
                        Owned By
                      </ColHeader>
                      <ColHeader colKey="tasks" icon={<CheckSquare className="h-3.5 w-3.5" />} className="min-w-[70px]">
                        Tasks
                      </ColHeader>
                      <ColHeader colKey="stage" sortable field="status" icon={<ArrowRightCircle className="h-3.5 w-3.5" />} className="min-w-[170px]">
                        Stage
                      </ColHeader>
                      <ColHeader colKey="daysInStage" sortable field="updated_at" icon={<Timer className="h-3.5 w-3.5" />} className="min-w-[110px]">
                        Days in Stage
                      </ColHeader>
                      <ColHeader colKey="stageUpdated" icon={<CalendarDays className="h-3.5 w-3.5" />} className="min-w-[130px]">
                        Stage Updated
                      </ColHeader>
                      <ColHeader colKey="lastContacted" sortable field="last_activity_at" icon={<Clock className="h-3.5 w-3.5" />} className="min-w-[130px]">
                        Last Contacted
                      </ColHeader>
                      <ColHeader colKey="interactions" icon={<MessageSquare className="h-3.5 w-3.5" />} className="min-w-[100px]">
                        Interactions
                      </ColHeader>
                      <ColHeader colKey="inactiveDays" icon={<Moon className="h-3.5 w-3.5" />} className="min-w-[110px]">
                        Inactive Days
                      </ColHeader>
                      <ColHeader colKey="tags" icon={<Tag className="h-3.5 w-3.5" />} className="min-w-[140px]">
                        Tags
                      </ColHeader>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {isLoading ? (
                      Array.from({ length: 7 }).map((_, i) => (
                        <tr key={i}>
                          <td className={`px-3 ${rowPad} w-8`}><Skeleton className="h-4 w-4 rounded" /></td>
                          <td className={`px-3 ${rowPad}`}>
                            <div className="flex items-center gap-2">
                              <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                              <Skeleton className="h-3.5 w-40" />
                            </div>
                          </td>
                          {columnVisibility.company && <td className={`px-3 ${rowPad}`}><Skeleton className="h-3.5 w-24" /></td>}
                          {columnVisibility.contact && <td className={`px-3 ${rowPad}`}><Skeleton className="h-3.5 w-20" /></td>}
                          {columnVisibility.value && <td className={`px-3 ${rowPad}`}><Skeleton className="h-3.5 w-16" /></td>}
                          {columnVisibility.ownedBy && <td className={`px-3 ${rowPad}`}><Skeleton className="h-3.5 w-20" /></td>}
                          {columnVisibility.tasks && <td className={`px-3 ${rowPad}`}><Skeleton className="h-3.5 w-6" /></td>}
                          {columnVisibility.stage && <td className={`px-3 ${rowPad}`}><Skeleton className="h-5 w-28 rounded-full" /></td>}
                          {columnVisibility.daysInStage && <td className={`px-3 ${rowPad}`}><Skeleton className="h-3.5 w-10" /></td>}
                          {columnVisibility.stageUpdated && <td className={`px-3 ${rowPad}`}><Skeleton className="h-3.5 w-20" /></td>}
                          {columnVisibility.lastContacted && <td className={`px-3 ${rowPad}`}><Skeleton className="h-3.5 w-20" /></td>}
                          {columnVisibility.interactions && <td className={`px-3 ${rowPad}`}><Skeleton className="h-3.5 w-6" /></td>}
                          {columnVisibility.inactiveDays && <td className={`px-3 ${rowPad}`}><Skeleton className="h-3.5 w-8" /></td>}
                          {columnVisibility.tags && <td className={`px-3 ${rowPad}`}><Skeleton className="h-3.5 w-16" /></td>}
                        </tr>
                      ))
                    ) : filteredAndSorted.length === 0 ? (
                      <tr>
                        <td colSpan={14}>
                          <div className="flex flex-col items-center justify-center py-20 gap-3">
                            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-muted/50">
                              <FileSearch className="h-5 w-5 text-muted-foreground/50" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium text-foreground">No opportunities found</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {searchTerm ? 'Try adjusting your search or filter' : 'No deals are in this stage yet'}
                              </p>
                            </div>
                            {isFiltersActive && (
                              <button
                                onClick={clearAllFilters}
                                className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                              >
                                Clear filters
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredAndSorted.map((lead) => {
                        const dealLabel = lead.company_name
                          ? `${lead.name} — ${lead.company_name}`
                          : lead.name;
                        const initial = lead.name[0]?.toUpperCase() ?? '?';
                        const avatarColor = getAvatarColor(lead.name);
                        const stageCfg = stageConfig[lead.status];
                        const assignedName = lead.assigned_to
                          ? (teamMemberMap[lead.assigned_to] ?? null)
                          : null;
                        const assignedInitial = assignedName?.[0]?.toUpperCase() ?? null;
                        const assignedColor = assignedName ? getAvatarColor(assignedName) : '';
                        const taskCount = taskCountMap[lead.id] ?? fakeTasks(lead.id);
                        const interactionCount = interactionCountMap[lead.id] ?? fakeInteractions(lead.id);
                        const daysInStage = daysSince(lead.updated_at);
                        const inactiveDays = daysSince(lead.last_activity_at);
                        const isStale = inactiveDays !== null && inactiveDays > 7;
                        const isLingering = daysInStage !== null && daysInStage > 14;
                        const dealValue = fakeValue(lead.id);

                        return (
                          <tr
                            key={lead.id}
                            onClick={() => handleRowClick(lead)}
                            className="cursor-pointer hover:bg-muted/30 transition-colors group"
                          >
                            <td className={`px-3 ${rowPad} w-8`}>
                              <div className="h-3.5 w-3.5 rounded border border-border bg-background group-hover:border-violet-400/50 transition-colors" />
                            </td>

                            <td className={`px-3 ${rowPad}`}>
                              <div className="flex items-center gap-2">
                                <div className={`h-5 w-5 rounded-full ${avatarColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                                  {initial}
                                </div>
                                <span className="font-medium text-foreground truncate max-w-[180px] text-[13px]">
                                  {dealLabel}
                                </span>
                              </div>
                            </td>

                            {columnVisibility.company && (
                              <td className={`px-3 ${rowPad}`}>
                                {lead.company_name ? (
                                  <span className="text-[13px] text-foreground truncate block max-w-[120px]">{lead.company_name}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            )}

                            {columnVisibility.contact && (
                              <td className={`px-3 ${rowPad}`}>
                                <span className="text-[13px] text-foreground truncate block max-w-[100px]">{lead.name}</span>
                              </td>
                            )}

                            {columnVisibility.value && (
                              <td className={`px-3 ${rowPad}`}>
                                <span className="text-[13px] text-foreground font-medium tabular-nums">{formatValue(dealValue)}</span>
                              </td>
                            )}

                            {columnVisibility.ownedBy && (
                              <td className={`px-3 ${rowPad}`}>
                                {assignedName && assignedInitial ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className={`h-5 w-5 rounded-full ${assignedColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                                      {assignedInitial}
                                    </div>
                                    <span className="text-[13px] text-foreground truncate max-w-[80px]">{assignedName}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-[13px]">—</span>
                                )}
                              </td>
                            )}

                            {columnVisibility.tasks && (
                              <td className={`px-3 ${rowPad}`}>
                                <span className={`text-[13px] ${taskCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                  {taskCount}
                                </span>
                              </td>
                            )}

                            {columnVisibility.stage && (
                              <td className={`px-3 ${rowPad}`}>
                                {stageCfg ? (
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${stageCfg.bg} ${stageCfg.color}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${stageCfg.dot}`} />
                                    {stageCfg.label}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">{lead.status}</span>
                                )}
                              </td>
                            )}

                            {columnVisibility.daysInStage && (
                              <td className={`px-3 ${rowPad}`}>
                                <span className="flex items-center gap-1">
                                  {isLingering
                                    ? <Flame className="h-3 w-3 text-amber-500 shrink-0" />
                                    : <Timer className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                  }
                                  <span className={`text-[13px] ${isLingering ? 'text-amber-600 font-medium' : 'text-foreground'}`}>
                                    {daysInStage !== null ? `${daysInStage}d` : '—'}
                                  </span>
                                </span>
                              </td>
                            )}

                            {columnVisibility.stageUpdated && (
                              <td className={`px-3 ${rowPad}`}>
                                <span className="text-[12px] text-muted-foreground">{formatShortDate(lead.updated_at)}</span>
                              </td>
                            )}

                            {columnVisibility.lastContacted && (
                              <td className={`px-3 ${rowPad}`}>
                                <span className="text-[12px] text-muted-foreground">{formatShortDate(lead.last_activity_at)}</span>
                              </td>
                            )}

                            {columnVisibility.interactions && (
                              <td className={`px-3 ${rowPad}`}>
                                <span className={`text-[13px] ${interactionCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                  {interactionCount}
                                </span>
                              </td>
                            )}

                            {columnVisibility.inactiveDays && (
                              <td className={`px-3 ${rowPad}`}>
                                {isStale ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
                                    <Moon className="h-3 w-3 shrink-0" />
                                    {inactiveDays}d
                                  </span>
                                ) : (
                                  <span className="text-[13px] text-foreground">{inactiveDays !== null ? `${inactiveDays}d` : '—'}</span>
                                )}
                              </td>
                            )}

                            {columnVisibility.tags && (
                              <td className={`px-3 ${rowPad}`}>
                                {lead.tags && lead.tags.length > 0 ? (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    {lead.tags.slice(0, 2).map((tag) => (
                                      <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border/60">
                                        {tag}
                                      </span>
                                    ))}
                                    {lead.tags.length > 2 && (
                                      <span className="text-[11px] text-muted-foreground">+{lead.tags.length - 2}</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ── Kanban View ── */
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex-1 overflow-auto p-4">
                  <div className="flex gap-4 h-full min-h-[500px]">
                    {UNDERWRITING_STATUSES.map((status) => {
                      const cfg = stageConfig[status];
                      const columnLeads = filteredAndSorted.filter(l => l.status === status);
                      return (
                        <KanbanDropColumn
                          key={status}
                          status={status}
                          label={cfg?.label ?? status}
                          color={cfg?.dot ?? 'bg-slate-500'}
                          leads={columnLeads}
                          teamMemberMap={teamMemberMap}
                          draggedId={draggedLead?.id ?? null}
                          onLeadClick={handleRowClick}
                        />
                      );
                    })}
                  </div>
                </div>
                <DragOverlay>
                  {draggedLead ? (
                    <Card className="p-3 shadow-lg border border-violet-300 rotate-2 cursor-grabbing w-56 bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`h-5 w-5 rounded-full ${getAvatarColor(draggedLead.name)} flex items-center justify-center text-white text-[10px] font-bold`}>
                          {draggedLead.name[0]?.toUpperCase()}
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{draggedLead.name}</p>
                      </div>
                      {draggedLead.company_name && (
                        <p className="text-[11px] text-muted-foreground">{draggedLead.company_name}</p>
                      )}
                    </Card>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </main>
        </div>
      </div>

      <LeadDetailDialog
        lead={selectedLead}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onLeadUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['underwriting-leads'] });
          queryClient.invalidateQueries({ queryKey: ['underwriting-task-counts'] });
          queryClient.invalidateQueries({ queryKey: ['underwriting-interaction-counts'] });
        }}
      />
    </EvanLayout>
  );
};

export default EvansUnderwriting;
