import { getLeadDisplayName } from '@/lib/utils';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useAutoFitColumns, CHAR_W_SM } from '@/hooks/useAutoFitColumns';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import { PipelineTableRow } from '@/components/admin/pipeline/PipelineTableRow';
import PipelineDetailPanel from '@/components/admin/PipelineDetailPanel';
import PipelineBulkToolbar from '@/components/admin/PipelineBulkToolbar';
import PipelineSettingsPopover from '@/components/admin/PipelineSettingsDialog';
import CreateFilterDialog, { CustomFilterValues } from '@/components/admin/CreateFilterDialog';
import { SavedFiltersSidebar, type SavedFilterOption } from '@/components/admin/SavedFiltersSidebar';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectAllHeader } from '@/components/admin/SelectAllHeader';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  ArrowUpDown,
  ArrowLeft,
  PanelLeft,
  Filter,
  Settings2,
  ChevronDown,
  Plus,
  DollarSign,
  Check,
  X,
  LayoutGrid,
  Table2,
  Columns3,
  PanelRightOpen,
  FileSearch,
  Building2,
  Maximize2,
  Download,
  PlusCircle,
  Search,
  BarChart3,
  Landmark,
  AtSign,
  User,
  CalendarDays,
  MessageSquare,
  Moon,
  CheckSquare,
  Tag,
  Clock,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter, useDroppable,
} from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format } from 'date-fns';
import { useSystemPipelineByName } from '@/hooks/useSystemPipelineByName';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { useLenderManagementDeals, type FlatPipelineLead } from '@/hooks/usePipelineLeads';
import { useCrmMutations } from '@/hooks/usePipelineMutations';
import { AddOpportunityDialog } from '@/components/admin/AddOpportunityDialog';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { buildStageConfig } from '@/utils/pipelineStageConfig';
import { CrmAvatar } from '@/components/admin/CrmAvatar';

type Lead = Database['public']['Tables']['lender_management']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];


const FILTER_OPTIONS: SavedFilterOption[] = [
  { id: 'all', label: 'All Opportunities', group: 'top' },
  { id: 'my_open', label: 'My Open Opportunities', group: 'public' },
  { id: 'open', label: 'Open Opportunities', group: 'public' },
  { id: 'following', label: "Opportunities I'm Following", group: 'public' },
  { id: 'won', label: 'Won Opportunities', group: 'public' },
  { id: 'closed_2025', label: 'Closed Loans 2025', group: 'public' },
  { id: 'closed_2026', label: 'Closed Loans 2026', group: 'public' },
  { id: 'weeklys', label: "Weekly's", group: 'public' },
];

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
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fakeTasks(id: string): number {
  return Math.floor(seededRand(id, 2) * 9);
}

function fakeInteractions(id: string): number {
  return Math.floor(seededRand(id, 3) * 26);
}

function fakeClosedYear(id: string): number | null {
  const r = seededRand(id, 5);
  if (r < 0.15) return 2025;
  if (r < 0.30) return 2026;
  return null;
}

function fakeIsWeekly(id: string): boolean {
  return seededRand(id, 6) < 0.25;
}

type SortField = 'name' | 'company_name' | 'status' | 'last_activity_at' | 'assigned_to' | 'updated_at';
type SortDir = 'asc' | 'desc';

type ColumnKey = 'company' | 'contact' | 'value' | 'ownedBy' | 'tasks' | 'status' | 'stage' | 'daysInStage' | 'stageUpdated' | 'lastContacted' | 'interactions' | 'inactiveDays' | 'tags';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  company: 'Company',
  contact: 'Contact',
  value: 'Value',
  ownedBy: 'Owner',
  tasks: 'Tasks',
  status: 'Status',
  stage: 'Stage',
  daysInStage: 'Days in Stage',
  stageUpdated: 'Stage Updated',
  lastContacted: 'Last Contacted',
  interactions: 'Interactions',
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

// Column sort menu options per column (colKey or 'deal')
const COLUMN_SORT_OPTIONS: Record<string, { label: string; field: SortField; dir: SortDir }[]> = {
  deal: [
    { label: 'Name ascending', field: 'name', dir: 'asc' },
    { label: 'Name descending', field: 'name', dir: 'desc' },
  ],
  company: [
    { label: 'Company ascending', field: 'company_name', dir: 'asc' },
    { label: 'Company descending', field: 'company_name', dir: 'desc' },
  ],
  status: [
    { label: 'Status ascending', field: 'status', dir: 'asc' },
    { label: 'Status descending', field: 'status', dir: 'desc' },
  ],
  lastContacted: [
    { label: 'Last contacted ascending', field: 'last_activity_at', dir: 'asc' },
    { label: 'Last contacted descending', field: 'last_activity_at', dir: 'desc' },
  ],
  ownedBy: [
    { label: 'Owner ascending', field: 'assigned_to', dir: 'asc' },
    { label: 'Owner descending', field: 'assigned_to', dir: 'desc' },
  ],
};

// ── Kanban sub-components ──
function KanbanDealCard({ lead, teamMemberMap, isDragging, onClick }: {
  lead: Lead;
  teamMemberMap: Record<string, string>;
  isDragging?: boolean;
  onClick: () => void;
}) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? null) : null;
  const lastActivity = lead.last_activity_at ? format(parseISO(lead.last_activity_at), 'MMM d') : null;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="group/card cursor-grab active:cursor-grabbing shadow-sm border border-border/60 hover:shadow-md transition-shadow bg-card overflow-hidden"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <div className="p-3 pb-2.5">
          <div className="flex items-start justify-between gap-1 mb-2">
            <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">{getLeadDisplayName(lead)}</p>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/admin/pipeline/lender-management/expanded-view/${lead.id}`); }}
              className="shrink-0 mt-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity"
            >
              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          {lead.company_name && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <Landmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{lead.company_name}</span>
            </div>
          )}
          {lead.deal_value != null && lead.deal_value > 0 && (
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-foreground">{formatValue(lead.deal_value)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/50 bg-muted/20">
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            {lastActivity && (
              <div className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3 shrink-0" />
                <span className="text-[11px]">{lastActivity}</span>
              </div>
            )}
            {assignedName && (
              <span className="text-[11px] font-medium truncate">{assignedName.charAt(0)}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {lead.status === 'won' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">Won</span>}
            {lead.status === 'lost' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-red-200 text-red-600 dark:border-red-800 dark:text-red-400">Lost</span>}
          </div>
        </div>
      </Card>
    </div>
  );
}

function KanbanDropColumn({ status, label, color, leads, teamMemberMap, draggedId, onLeadClick, onAdd }: {
  status: string;
  label: string;
  color: string;
  leads: any[];
  teamMemberMap: Record<string, string>;
  draggedId: string | null;
  onLeadClick: (lead: any) => void;
  onAdd?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const totalVal = leads.reduce((sum, l) => sum + fakeValue(l.id), 0);
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-64 shrink-0 rounded-xl transition-colors ${isOver ? 'bg-blue-50/70 dark:bg-blue-950/30' : 'bg-muted/30'}`}
    >
      <div className="px-3 py-2.5 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${color}`} />
        <span className="text-xs font-semibold text-foreground truncate">{label}</span>
        <span className="text-[11px] text-muted-foreground font-medium ml-auto">{leads.length}</span>
        {onAdd && (
          <button onClick={onAdd} className="text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="px-2 pb-1">
        <span className="text-[10px] text-muted-foreground font-medium">{formatValue(totalVal)}</span>
      </div>
      <ScrollArea className="flex-1 px-2 pb-2">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {leads.map((lead) => (
              <KanbanDealCard
                key={lead.id}
                lead={lead}
                teamMemberMap={teamMemberMap}
                isDragging={lead.id === draggedId}
                onClick={() => onLeadClick(lead)}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

const LenderManagement = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Core state
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_activity_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // Toolbar state
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [rowDensity, setRowDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggedLead, setDraggedLead] = useState<FlatPipelineLead | null>(null);

  // Column sort menu state
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);

  // Custom filters
  const [customFilters, setCustomFilters] = useState<Array<{ id: string; label: string; values: CustomFilterValues }>>([]);

  // Add Opportunity — full form lives inside <AddOpportunityDialog>
  const [addOpportunityOpen, setAddOpportunityOpen] = useState(false);
  const [addOpportunityStage, setAddOpportunityStage] = useState<string>('');

  // ── Top bar: inject title + search into AdminLayout header ──
  const { setPageTitle, setSearchComponent } = useAdminTopBar();

  useEffect(() => {
    setPageTitle('Lender Management');
    return () => {
      setPageTitle(null);
      setSearchComponent(null);
    };
  }, []);

  useEffect(() => {
    setSearchComponent(
      <AdminTopBarSearch value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
    );
  }, [searchTerm]);

  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    company: true, contact: true, value: true, ownedBy: true, tasks: true,
    status: true, stage: true, daysInStage: true, stageUpdated: true, lastContacted: true,
    interactions: true, inactiveDays: true, tags: true,
  });


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

  // Close column sort menu on outside click
  useEffect(() => {
    if (!colMenuOpen) return;
    function handleClick() { setColMenuOpen(null); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colMenuOpen]);

  // Close detail panel on Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && detailDialogLead) setDetailDialogLead(null);
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [detailDialogLead]);

  function clearAllFilters() {
    setActiveFilter('all');
    setSearchTerm('');
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

  // Pipeline data from DB
  const { data: pipeline } = useSystemPipelineByName('Lender Management');
  const { data: stages = [] } = usePipelineStages(pipeline?.id);
  const { leads: pipelineLeadsList, isLoading: isPipelineLeadsLoading } = useLenderManagementDeals();
  const { moveLeadToStage } = useCrmMutations('lender_management');
  const dynamicStageConfig = useMemo(() => buildStageConfig(stages), [stages]);

  const leads = pipelineLeadsList;
  const isLoading = isPipelineLeadsLoading;

  // Fetch team members
  const { data: teamMembers = [] } = useAssignableUsers();

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
    queryKey: ['lm-touchpoints'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
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

  const handleStageMove = (leadId: string, newStageId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;
    const oldStageName = dynamicStageConfig[lead._stageId]?.title;
    const newStageName = dynamicStageConfig[newStageId]?.title;
    moveLeadToStage.mutate({
      pipelineLeadId: lead._pipelineLeadId,
      newStageId,
      newStageName,
      oldStageName,
      leadId: lead.id,
    });
  };

  const openAddDialog = (stageId?: string) => {
    setAddOpportunityStage(stageId ?? stages[0]?.id ?? '');
    setAddOpportunityOpen(true);
  };

  // Task and interaction count queries
  const { data: taskCountMap = {} } = useQuery({
    queryKey: ['lm-task-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
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
    queryKey: ['lm-interaction-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
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

  // Total value
  const totalValue = useMemo(
    () => leads.reduce((sum, l) => sum + fakeValue(l.id), 0),
    [leads]
  );

  // Opportunities the current user is following — real entity_followers query.
  // Shared query key with the expanded-view toolbar so toggling follow
  // invalidates this automatically.
  const { teamMember: currentTeamMember } = useTeamMember();
  const { data: followedLeadIdsArray = [] } = useQuery({
    queryKey: ['followed-deals', 'lender_management', currentTeamMember?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('entity_followers')
        .select('entity_id')
        .eq('entity_type', 'lender_management')
        .eq('team_member_id', currentTeamMember!.id);
      return (data ?? []).map((r) => r.entity_id);
    },
    enabled: !!currentTeamMember?.id,
  });
  const followedLeadIds = useMemo(() => new Set(followedLeadIdsArray), [followedLeadIdsArray]);

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    for (const stage of stages) {
      counts[stage.id] = leads.filter((l) => l._stageId === stage.id).length;
    }
    counts['my_open'] = leads.length;
    counts['open'] = leads.length;
    counts['following'] = leads.filter((l) => followedLeadIds.has(l.id)).length;
    counts['won'] = leads.filter(l => l.status === 'won' as any).length;
    counts['closed_2025'] = leads.filter(l => fakeClosedYear(l.id) === 2025).length;
    counts['closed_2026'] = leads.filter(l => fakeClosedYear(l.id) === 2026).length;
    counts['weeklys'] = leads.filter(l => fakeIsWeekly(l.id)).length;
    return counts;
  }, [leads, stages, followedLeadIds]);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let result = leads;

    if (activeFilter !== 'all') {
      if (stages.some(s => s.id === activeFilter)) {
        result = result.filter((l) => l._stageId === activeFilter);
      } else if (activeFilter === 'won') {
        result = result.filter((l) => l.status === ('won' as LeadStatus));
      } else if (activeFilter === 'following') {
        result = result.filter((l) => followedLeadIds.has(l.id));
      } else if (activeFilter === 'closed_2025') {
        result = result.filter((l) => fakeClosedYear(l.id) === 2025);
      } else if (activeFilter === 'closed_2026') {
        result = result.filter((l) => fakeClosedYear(l.id) === 2026);
      } else if (activeFilter === 'weeklys') {
        result = result.filter((l) => fakeIsWeekly(l.id));
      } else if (activeFilter.startsWith('custom_')) {
        const cf = customFilters.find(f => f.id === activeFilter);
        if (cf) {
          const v = cf.values;
          result = result.filter((l) => {
            if (v.stage.length > 0 && !v.stage.includes(l.status)) return false;
            if (v.status.length > 0 && !v.status.includes(l.status)) return false;
            if (v.source.length > 0 && !v.source.includes(l.source ?? '')) return false;
            if (v.ownedBy.length > 0 && !v.ownedBy.includes(l.assigned_to ?? '')) return false;

            if (v.company.trim() && !(l.company_name ?? '').toLowerCase().includes(v.company.toLowerCase())) return false;
            if (v.name.trim() && !l.name.toLowerCase().includes(v.name.toLowerCase())) return false;
            if (v.uwNumber.trim() && !(l.uw_number ?? '').toLowerCase().includes(v.uwNumber.toLowerCase())) return false;

            if (v.tags.trim()) {
              const filterTags = v.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
              const leadTags = (l.tags ?? []).map(t => t.toLowerCase());
              if (!filterTags.some(ft => leadTags.includes(ft))) return false;
            }

            if (v.clientWorkingWithOtherLenders && !l.client_other_lenders) return false;
            if (v.weeklys && !l.flagged_for_weekly) return false;

            if (v.dateAddedFrom && new Date(l.created_at) < v.dateAddedFrom) return false;
            if (v.dateAddedTo && new Date(l.created_at) > v.dateAddedTo) return false;

            return true;
          });
        }
      }
      // 'my_open', 'open', 'following' show all for now
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.opportunity_name ?? '').toLowerCase().includes(q) ||
          (l.company_name ?? '').toLowerCase().includes(q) ||
          (l.email ?? '').toLowerCase().includes(q) ||
          (l.phone ?? '').toLowerCase().includes(q) ||
          (l.title ?? '').toLowerCase().includes(q) ||
          (l.source ?? '').toLowerCase().includes(q) ||
          (l.contact_type ?? '').toLowerCase().includes(q) ||
          (l.known_as ?? '').toLowerCase().includes(q) ||
          (l.linkedin ?? '').toLowerCase().includes(q) ||
          (l.website ?? '').toLowerCase().includes(q) ||
          (l.uw_number ?? '').toLowerCase().includes(q) ||
          (l.lender_name ?? '').toLowerCase().includes(q) ||
          (l.tags ?? []).some(t => t.toLowerCase().includes(q)) ||
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
  }, [leads, activeFilter, searchTerm, sortField, sortDir, teamMemberMap, stages, followedLeadIds]);

  const lmAutoFitConfig = useMemo(() => ({
    deal: { getText: (l: any) => getLeadDisplayName(l), extraPx: 58 },
    company: { getText: (l: any) => l.company_name, extraPx: 32 },
    contact: { getText: (l: any) => l.name },
    ownedBy: { getText: (l: any) => teamMemberMap[l.assigned_to ?? ''] ?? '', extraPx: 32 },
    stage: { getText: (l: any) => dynamicStageConfig[l._stageId]?.title ?? l.status, charWidth: CHAR_W_SM, extraPx: 40 },
  }), [teamMemberMap, dynamicStageConfig]);

  const { columnWidths, handleColumnResize } = useAutoFitColumns({
    minWidths: {
      deal: 280, company: 180, contact: 150, value: 110, ownedBy: 120,
      tasks: 70, status: 130, stage: 200, daysInStage: 80, stageUpdated: 120,
      lastContacted: 130, interactions: 90, inactiveDays: 100, tags: 250,
    },
    autoFitConfig: lmAutoFitConfig,
    data: filteredAndSorted,
    storageKey: 'lm-col-widths-v3',
  });

  // Group leads by stage for Kanban
  const leadsByStage = useMemo(() => {
    const grouped: Record<string, typeof leads> = {};
    for (const stage of stages) {
      grouped[stage.id] = filteredAndSorted.filter((l) => l._stageId === stage.id);
    }
    return grouped;
  }, [filteredAndSorted, stages]);

  function handleDragStart(event: DragStartEvent) {
    const lead = filteredAndSorted.find(l => l.id === event.active.id);
    setDraggedLead(lead ?? null);
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedLead(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Check if dropped on a stage column or on a lead in a stage
    const targetStageId = stages.find(s => s.id === over.id)?.id
      ?? leads.find(l => l.id === over.id)?._stageId;

    if (!targetStageId) return;

    const lead = leads.find(l => l.id === active.id);
    if (!lead || lead._stageId === targetStageId) return;

    handleStageMove(lead.id, targetStageId);
  };

  // Row padding based on density
  const rowPad = rowDensity === 'comfortable' ? 'py-1.5' : 'py-0.5';

  function handleRowClick(lead: any) {
    setDetailDialogLead(lead);
  }

  // Selection helpers
  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const isAllSelected = useMemo(() => {
    return filteredAndSorted.length > 0 && filteredAndSorted.every(l => selectedLeadIds.has(l.id));
  }, [filteredAndSorted, selectedLeadIds]);

  const selectAll = () => setSelectedLeadIds(new Set(filteredAndSorted.map(l => l.id)));
  const clearSelection = () => setSelectedLeadIds(new Set());

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
    const sortOptions = COLUMN_SORT_OPTIONS[widthKey];
    const isMenuOpen = colMenuOpen === widthKey;
    return (
      <th
        className={`px-4 py-1.5 text-left whitespace-nowrap group/col ${extraClassName ?? ''}`}
        style={{ width: `${width}px`, minWidth: 60, maxWidth: 500, backgroundColor: '#eee6f6', border: '1px solid #c8bdd6', ...extraStyle }}
      >
        <ResizableColumnHeader
          columnId={widthKey}
          currentWidth={`${width}px`}
          onResize={handleColumnResize}
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-[#3b2778] dark:text-muted-foreground">
            {children}
          </span>
          {/* Three-dot menu button */}
          {sortOptions && (
            <div className="relative ml-auto shrink-0" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <button
                onClick={() => setColMenuOpen(isMenuOpen ? null : widthKey)}
                style={{ color: '#202124', backgroundColor: isMenuOpen ? '#d8cce8' : undefined, width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 'bold', lineHeight: 1 }}
                onMouseEnter={(e) => { if (!isMenuOpen) (e.currentTarget as HTMLElement).style.backgroundColor = '#d8cce8'; }}
                onMouseLeave={(e) => { if (!isMenuOpen) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                ⋮
              </button>
              {isMenuOpen && (
                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50, backgroundColor: '#fff', border: '1px solid #e4dced', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', minWidth: 220, padding: '4px 0', overflow: 'hidden' }}>
                  {sortOptions.map((opt) => (
                    <button
                      key={`${opt.field}-${opt.dir}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSortField(opt.field);
                        setSortDir(opt.dir);
                        setColMenuOpen(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#f5f0fa] transition-colors"
                    >
                      {opt.dir === 'asc' ? (
                        <span style={{ color: '#3b2778', fontSize: 16 }}>↑</span>
                      ) : (
                        <span style={{ color: '#5f6368', fontSize: 16 }}>↓</span>
                      )}
                      <span style={{ fontSize: 14, color: '#202124' }}>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
    <EmployeeLayout>
      <div className="flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-background system-font -m-3 sm:-m-4 md:-m-6 lg:-m-8 xl:-m-10">

        {/* ── Body: Sidebar + Table ── */}
        <div className="relative flex flex-1 min-h-0 overflow-y-hidden overflow-x-clip">


          {/* ── Sidebar collapse button (straddles border) ── */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? 'Hide filters' : 'Show filters'}
            style={{ left: sidebarOpen ? 'calc(18rem - 1.3125rem + 19px)' : 'calc(72px - 21px + 19px)', borderRadius: '50%', transition: 'left 200ms ease' }}
            className="absolute top-[9px] z-20 h-[42px] w-[42px] border border-gray-300 dark:border-border bg-white dark:bg-card flex items-center justify-center text-black dark:text-foreground hover:bg-gray-50 dark:hover:bg-muted hover:border-gray-400 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} style={{ transform: `scale(2) ${sidebarOpen ? '' : 'rotate(180deg)'}`, transition: 'transform 200ms ease' }} />
          </button>

          {/* ── Left Sidebar (Copper style) ── */}
          <SavedFiltersSidebar
            sidebarOpen={sidebarOpen}
            filterOptions={FILTER_OPTIONS}
            customFilters={customFilters}
            filterCounts={filterCounts}
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            createFilterAction={
              <CreateFilterDialog
                teamMemberMap={teamMemberMap}
                stageConfig={Object.fromEntries(Object.entries(dynamicStageConfig).map(([k, v]) => [k, { label: v.title }]))}
                onSave={(filter) => {
                  const id = `custom_${Date.now()}`;
                  setCustomFilters(prev => [...prev, { id, label: filter.filterName, values: filter }]);
                  toast.success(`Filter "${filter.filterName}" created`);
                }}
              />
            }
          />

          {/* Main Table Area */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* ── Copper-Style Content Title Bar ── */}
            <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 bg-[#f8f9fa] dark:bg-muted/30">

              <div className="flex items-center gap-3 ml-24">
                <h2 className="text-[16px] font-bold text-[#1f1f1f] dark:text-foreground whitespace-nowrap">
                  {FILTER_OPTIONS.find(o => o.id === activeFilter)?.label ?? customFilters.find(cf => cf.id === activeFilter)?.label ?? 'All Opportunities'}
                </h2>
                {!isLoading && (
                  <span className="text-[#5f6368] dark:text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                    # {filteredAndSorted.length.toLocaleString()} {filteredAndSorted.length === 1 ? 'deal' : 'deals'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* View toggle: Table / Kanban segmented pill */}
                <div className="flex items-center bg-[#f0ebf5] dark:bg-purple-950/40 rounded-xl p-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`h-8 w-8 !p-0 flex items-center justify-center rounded-lg transition-all ${
                          viewMode === 'table'
                            ? 'bg-white dark:bg-card shadow-sm border-2 border-[#3b2778] dark:border-purple-500 text-[#3b2778] dark:text-purple-400'
                            : 'text-[#8c7bab] dark:text-purple-600 hover:text-[#3b2778] dark:hover:text-purple-400'
                        }`}
                      >
                        <Table2 className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Table view</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode('kanban')}
                        className={`h-8 w-8 !p-0 flex items-center justify-center rounded-lg transition-all ${
                          viewMode === 'kanban'
                            ? 'bg-white dark:bg-card shadow-sm border-2 border-[#3b2778] dark:border-purple-500 text-[#3b2778] dark:text-purple-400'
                            : 'text-[#8c7bab] dark:text-purple-600 hover:text-[#3b2778] dark:hover:text-purple-400'
                        }`}
                      >
                        <Columns3 className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Kanban view</TooltipContent>
                  </Tooltip>
                </div>

                {/* Add Opportunity button (Copper dark indigo style) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="h-9 pl-4 pr-3 text-[13px] font-semibold rounded-md shrink-0 flex items-center gap-2 text-white bg-[#3b2778] hover:bg-[#4a3490] active:scale-[0.97] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2778] focus-visible:ring-offset-2 ml-2"
                    >
                      <span>Add Opportunity</span>
                      <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-lg shadow-xl border border-[#dadce0] dark:border-border bg-white dark:bg-popover">
                    <DropdownMenuItem
                      onClick={() => openAddDialog()}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-[14px] font-medium text-[#1f1f1f] dark:text-foreground hover:bg-[#f1f3f4] dark:hover:bg-muted focus:bg-[#f1f3f4] dark:focus:bg-muted transition-colors"
                    >
                      <PlusCircle className="h-4 w-4 text-[#5f6368] dark:text-muted-foreground" />
                      Add Opportunity
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-[14px] font-medium text-[#1f1f1f] dark:text-foreground hover:bg-[#f1f3f4] dark:hover:bg-muted focus:bg-[#f1f3f4] dark:focus:bg-muted transition-colors"
                    >
                      <Download className="h-4 w-4 text-[#5f6368] dark:text-muted-foreground" />
                      Import Opportunities
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Content Area: Table or Kanban */}
            {viewMode === 'table' ? (
              <div className="flex-1 overflow-auto">
                {/* ── Bulk Selection Toolbar ── */}
                {selectedLeadIds.size > 0 && (
                  <div className="sticky top-0 z-40 px-4 py-2 bg-white dark:bg-background border-b border-border">
                    <PipelineBulkToolbar
                      selectedCount={selectedLeadIds.size}
                      totalCount={filteredAndSorted.length}
                      onClearSelection={clearSelection}
                      onEdit={() => {/* TODO */}}
                      onExport={() => {/* TODO */}}
                    />
                  </div>
                )}
                {isLoading ? (
                  <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                <table className="w-full text-sm" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#eee6f6' }}>
                      <ColHeader className="sticky top-0 z-30 group/hdr" style={{ left: 0, borderLeft: 'none', boxShadow: 'inset 1px 0 0 #c8bdd6, 2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                        <div className={`shrink-0`}>
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={(checked) => checked ? selectAll() : clearSelection()}
                            className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                          />
                        </div>
                        <User className="h-4 w-4" /> Deal
                      </ColHeader>
                      <ColHeader colKey="company" className="sticky top-0 z-10">
                        <Landmark className="h-4 w-4" /> Company
                      </ColHeader>
                      <ColHeader colKey="contact" className="sticky top-0 z-10">
                        <User className="h-4 w-4" /> Contact
                      </ColHeader>
                      <ColHeader colKey="value" className="sticky top-0 z-10">
                        <DollarSign className="h-4 w-4" /> Value
                      </ColHeader>
                      <ColHeader colKey="ownedBy" className="sticky top-0 z-10">
                        <User className="h-4 w-4" /> Owner
                      </ColHeader>
                      <ColHeader colKey="tasks" className="sticky top-0 z-10">
                        <CheckSquare className="h-4 w-4" /> Tasks
                      </ColHeader>
                      <ColHeader colKey="status" className="sticky top-0 z-10">
                        <Tag className="h-4 w-4" /> Status
                      </ColHeader>
                      <ColHeader colKey="stage" className="sticky top-0 z-10">
                        <Sparkles className="h-4 w-4" /> Stage
                      </ColHeader>
                      <ColHeader colKey="daysInStage" className="sticky top-0 z-10">
                        <Clock className="h-4 w-4" /> Days
                      </ColHeader>
                      <ColHeader colKey="stageUpdated" className="sticky top-0 z-10">
                        <CalendarDays className="h-4 w-4" /> Updated
                      </ColHeader>
                      <ColHeader colKey="lastContacted" className="sticky top-0 z-10">
                        <CalendarDays className="h-4 w-4" /> Contacted
                      </ColHeader>
                      <ColHeader colKey="interactions" className="sticky top-0 z-10">
                        <MessageSquare className="h-4 w-4" /> Activity
                      </ColHeader>
                      <ColHeader colKey="inactiveDays" className="sticky top-0 z-10">
                        <Moon className="h-4 w-4" /> Dormant
                      </ColHeader>
                      <ColHeader colKey="tags" className="sticky top-0 z-10">
                        <Tag className="h-4 w-4" /> Tags
                      </ColHeader>
                      <th className="w-10 px-2 py-1.5 sticky top-0 z-10 bg-white dark:bg-background" style={{ border: '1px solid #c8bdd6' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSorted.length === 0 ? (
                      <tr>
                        <td colSpan={15}>
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
                      filteredAndSorted.map((lead) => {
                        const stageCfg = dynamicStageConfig[lead._stageId];
                        const assignedName = lead.assigned_to
                          ? (teamMemberMap[lead.assigned_to] ?? null)
                          : null;
                        const assignedAvatar = lead.assigned_to ? (teamAvatarMap[lead.assigned_to] ?? null) : null;
                        const daysInStage = daysSince(lead.updated_at);
                        const inactiveDays = daysSince(lead.last_activity_at);
                        const isDetailOpen = detailDialogLead?.id === lead.id;
                        const isSelected = selectedLeadIds.has(lead.id);

                        return (
                          <PipelineTableRow
                            key={lead.id}
                            leadId={lead.id}
                            firstColumnKey="deal"
                            opportunityDisplayName={getLeadDisplayName(lead)}
                            avatarName={lead.name}
                            companyName={lead.company_name}
                            showCompanyIcon
                            contactName={lead.name}
                            dealValueDisplay={formatValue(fakeValue(lead.id))}
                            ownerName={assignedName}
                            ownerAvatarUrl={assignedAvatar}
                            taskCount={taskCountMap[lead.id] ?? fakeTasks(lead.id)}
                            statusLabel={lead.status}
                            stageLabel={stageCfg?.title ?? lead.status}
                            daysInStage={daysInStage}
                            stageUpdatedDate={formatShortDate(lead.updated_at)}
                            lastContactedDate={formatShortDate(lead.last_activity_at)}
                            interactionCount={interactionCountMap[lead.id] ?? fakeInteractions(lead.id)}
                            inactiveDays={inactiveDays}
                            tags={lead.tags}
                            columnVisibility={columnVisibility}
                            columnWidths={columnWidths}
                            isDetailSelected={isDetailOpen}
                            isBulkSelected={isSelected}
                            rowPad={rowPad}
                            onRowClick={() => handleRowClick(lead)}
                            onToggleSelection={() => toggleLeadSelection(lead.id)}
                            onExpand={() => navigate(`/admin/pipeline/lender-management/expanded-view/${lead.id}`)}
                          />
                        );
                      })
                    )}
                  </tbody>
                </table>
                )}
              </div>
            ) : (
              /* Kanban View */
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex-1 overflow-auto p-4">
                  <div className="flex gap-4 h-full min-h-[500px]">
                    {stages.map((stage) => {
                      const config = dynamicStageConfig[stage.id];
                      const columnLeads = filteredAndSorted.filter(l => l._stageId === stage.id);
                      return (
                        <KanbanDropColumn
                          key={stage.id}
                          status={stage.id}
                          label={config?.title ?? stage.name}
                          color={config?.dot ?? 'bg-gray-400'}
                          leads={columnLeads}
                          teamMemberMap={teamMemberMap}
                          draggedId={draggedLead?.id ?? null}
                          onLeadClick={(lead) => setDetailDialogLead(lead)}
                          onAdd={() => openAddDialog(stage.id)}
                        />
                      );
                    })}
                  </div>
                </div>
                <DragOverlay>
                  {draggedLead ? (
                    <Card className="p-3 shadow-lg border border-blue-300 rotate-2 cursor-grabbing w-56 bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <CrmAvatar name={draggedLead.name} size="xs" />
                        <p className="text-sm font-semibold text-foreground truncate">{getLeadDisplayName(draggedLead)}</p>
                      </div>
                    </Card>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </main>

          {/* Right Detail Panel */}
          {detailDialogLead && (
            <PipelineDetailPanel
              lead={detailDialogLead}
              stageConfig={Object.fromEntries(Object.entries(dynamicStageConfig).map(([k, v]) => [k, { title: v.title, color: v.color, dot: v.dot, pill: v.pill }]))}
              currentStageId={(detailDialogLead as any)?._stageId}
              teamMemberMap={teamMemberMap}
              teamMembers={teamMembers}
              formatValue={formatValue}
              fakeValue={fakeValue}
              onClose={() => setDetailDialogLead(null)}
              onExpand={() => {
                navigate(`/admin/pipeline/lender-management/expanded-view/${detailDialogLead.id}`);
              }}
              onStageChange={(leadId, newStatus) => {
                // Find the stage ID for this status
                const stageId = stages.find(s => s.name === newStatus || s.id === newStatus)?.id;
                if (stageId) handleStageMove(leadId, stageId);
              }}
              onLeadUpdate={(updatedLead) => {
                setDetailDialogLead(updatedLead);
                queryClient.invalidateQueries({ queryKey: ['lender-management-deals'] });
              }}
            />
          )}
        </div>
      </div>

      {/* Add Opportunity Dialog */}
      <AddOpportunityDialog
        open={addOpportunityOpen}
        onOpenChange={setAddOpportunityOpen}
        tableName="lender_management"
        stages={stages}
        stageConfig={dynamicStageConfig}
        ownerOptions={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
        initialStageId={addOpportunityStage}
        onCreated={(lead) => setDetailDialogLead(lead as unknown as Lead)}
      />
    </EmployeeLayout>
  );
};

export default LenderManagement;
