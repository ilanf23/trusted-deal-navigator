import { getLeadDisplayName } from '@/lib/utils';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import PipelineSettingsPopover from '@/components/admin/PipelineSettingsDialog';
import UnderwritingDetailPanel from '@/components/admin/UnderwritingDetailPanel';
import CreateFilterDialog, { CustomFilterValues } from '@/components/admin/CreateFilterDialog';
import { SavedFiltersSidebar, type SavedFilterOption } from '@/components/admin/SavedFiltersSidebar';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { useAutoFitColumns, CHAR_W_SM } from '@/hooks/useAutoFitColumns';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import {
  ArrowUpDown,
  ArrowLeft,
  PanelLeft,
  Filter,
  Settings2,
  ChevronDown,
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
  Check,
  X,
  LayoutGrid,
  Table2,
  Columns3,
  GripVertical,
  PanelRightOpen,
  Sparkles,
  Loader2,
  Download,
  PlusCircle,
  Maximize2,
  Search,
  BarChart3,
  Equal,
  Landmark,
  AtSign,
} from 'lucide-react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter, useDroppable,
} from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectAllHeader } from '@/components/admin/SelectAllHeader';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import PipelineBulkToolbar from '@/components/admin/PipelineBulkToolbar';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useSystemPipelineByName } from '@/hooks/useSystemPipelineByName';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { useUnderwritingDeals, type FlatPipelineLead } from '@/hooks/usePipelineLeads';
import { useCrmMutations } from '@/hooks/usePipelineMutations';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { buildStageConfig } from '@/utils/pipelineStageConfig';
import { AddOpportunityDialog } from '@/components/admin/AddOpportunityDialog';

type Lead = Database['public']['Tables']['underwriting']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];


const FILTER_OPTIONS: SavedFilterOption[] = [
  { id: 'all', label: 'All Opportunities', group: 'top' },
  { id: 'my_open', label: 'My Open Opportunities', group: 'public' },
  { id: 'open', label: 'Open Opportunities', group: 'public' },
  { id: 'following', label: "Opportunities I'm Following", group: 'public' },
  { id: 'won', label: 'Won Opportunities', group: 'public' },
  { id: 'lost', label: 'Lost Opportunities', group: 'public' },
  { id: 'brad_incoming', label: 'Brad Incoming Opportunities', group: 'public' },
  { id: 'initial_review', label: 'Deals for Initial Review', group: 'public' },
  { id: 'review_kill_keep', label: 'Deals Moving Towards Underwriting', group: 'public' },
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

const COLUMN_SORT_OPTIONS: Record<string, { label: string; field: SortField; dir: SortDir }[]> = {
  opportunity: [
    { label: 'Name ascending', field: 'name', dir: 'asc' },
    { label: 'Name descending', field: 'name', dir: 'desc' },
  ],
  company: [
    { label: 'Company ascending', field: 'company_name', dir: 'asc' },
    { label: 'Company descending', field: 'company_name', dir: 'desc' },
  ],
};

// Column visibility keys
type ColumnKey = 'company' | 'contact' | 'value' | 'ownedBy' | 'tasks' | 'status' | 'stage' | 'daysInStage' | 'stageUpdated' | 'lastContacted' | 'interactions' | 'inactiveDays' | 'tags';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  company: 'Company',
  contact: 'Contact',
  value: 'Value',
  ownedBy: 'Owned By',
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
              type="button"
              onClick={(e) => { e.stopPropagation(); navigate(`/admin/pipeline/underwriting/expanded-view/${lead.id}`); }}
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

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl flex-1 min-w-[220px] max-w-[300px] transition-all ${
        isOver ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-background bg-blue-50/30 dark:bg-blue-950/20' : 'bg-muted/30'
      }`}
    >
      <div className="px-3 py-2.5 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span className="text-xs font-bold text-foreground uppercase tracking-wide">{label}</span>
        <span className="ml-auto text-[11px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {leads.length}
        </span>
        {onAdd && (
          <button onClick={onAdd} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" title="Add opportunity">
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
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

const Underwriting = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Pipeline data from DB
  const { data: pipeline } = useSystemPipelineByName('Underwriting');
  const { data: stages = [] } = usePipelineStages(pipeline?.id);
  const { leads: pipelineLeadsList, isLoading: isPipelineLeadsLoading } = useUnderwritingDeals();
  const { moveLeadToStage, bulkRemoveLeadsFromPipeline } = useCrmMutations('underwriting');
  const dynamicStageConfig = useMemo(() => buildStageConfig(stages), [stages]);

  // ── Core state ──
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_activity_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // ── Column sort menu state ──
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);

  // Bulk action state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [addTagsDialogOpen, setAddTagsDialogOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState('');
  const [moveBoxesDialogOpen, setMoveBoxesDialogOpen] = useState(false);
  const [moveBoxesTargetStage, setMoveBoxesTargetStage] = useState('');

  // ── Toolbar state ──
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [rowDensity, setRowDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [customFilters, setCustomFilters] = useState<Array<{ id: string; label: string; values: CustomFilterValues }>>([]);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    company: true, contact: true, value: true, ownedBy: true, tasks: true,
    status: true, stage: true, daysInStage: true, stageUpdated: true, lastContacted: true,
    interactions: true, inactiveDays: true, tags: true,
  });

  // ── Top bar: inject title + search into AdminLayout header ──
  const { setPageTitle, setSearchComponent } = useAdminTopBar();

  useEffect(() => {
    setPageTitle('Underwriting');
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

  // Close column sort menu on outside click
  useEffect(() => {
    if (!colMenuOpen) return;
    function handleClick() { setColMenuOpen(null); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colMenuOpen]);

  const sortFieldLabel = SORT_FIELD_OPTIONS.find(o => o.value === sortField)?.label ?? sortField;

  function clearAllFilters() {
    setActiveFilter('all');
    setSearchTerm('');
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

  // ── Stage move handler for Kanban drag ──
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

  // ── Add Opportunity state ──
  // The full form lives inside <AddOpportunityDialog>; the parent only tracks
  // whether the dialog is open and which stage to pre-select.
  const [addOpportunityOpen, setAddOpportunityOpen] = useState(false);
  const [addOpportunityStage, setAddOpportunityStage] = useState<string>('');

  const openAddDialog = (stageId?: string) => {
    setAddOpportunityStage(stageId ?? stages[0]?.id ?? '');
    setAddOpportunityOpen(true);
  };

  function handleDragStart(event: DragStartEvent) {
    const lead = filteredAndSorted.find(l => l.id === event.active.id);
    setDraggedLead(lead ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedLead(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const targetStageId = stages.find(s => s.id === over.id)?.id
      ?? leads.find(l => l.id === over.id)?._stageId;

    if (!targetStageId) return;

    const lead = leads.find(l => l.id === active.id);
    if (!lead || lead._stageId === targetStageId) return;

    handleStageMove(lead.id, targetStageId);
  }

  // ── Queries ──
  const { data: teamMembers = [] } = useAssignableUsers();

  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) map[m.id] = m.name;
    return map;
  }, [teamMembers]);

  const uwAutoFitConfig = useMemo(() => ({
    opportunity: { getText: (l: any) => getLeadDisplayName(l), extraPx: 58 },
    company: { getText: (l: any) => l.company_name, extraPx: 32 },
    contact: { getText: (l: any) => l.name },
    value: { getText: (l: any) => formatValue(fakeValue(l.id)) },
    ownedBy: { getText: (l: any) => teamMemberMap[l.assigned_to ?? ''] ?? '', extraPx: 32 },
    stage: { getText: (l: any) => dynamicStageConfig[l._stageId]?.title ?? l.status, charWidth: CHAR_W_SM, extraPx: 40 },
  }), [teamMemberMap, dynamicStageConfig]);

  const teamAvatarMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) {
      if (m.avatar_url) map[m.id] = m.avatar_url;
    }
    return map;
  }, [teamMembers]);

  const leads = pipelineLeadsList;
  const isLoading = isPipelineLeadsLoading;

  const { data: taskCountMap = {} } = useQuery({
    queryKey: ['underwriting-task-counts'],
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
    queryKey: ['underwriting-interaction-counts'],
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

  // Opportunities the current user is following — real entity_followers query.
  // Shared query key with the expanded-view toolbar so toggling follow
  // invalidates this automatically.
  const { teamMember: currentTeamMember } = useTeamMember();
  const { data: followedLeadIdsArray = [] } = useQuery({
    queryKey: ['followed-deals', 'underwriting', currentTeamMember?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('entity_followers')
        .select('entity_id')
        .eq('entity_type', 'underwriting')
        .eq('team_member_id', currentTeamMember!.id);
      return (data ?? []).map((r) => r.entity_id);
    },
    enabled: !!currentTeamMember?.id,
  });
  const followedLeadIds = useMemo(() => new Set(followedLeadIdsArray), [followedLeadIdsArray]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    for (const stage of stages) {
      counts[stage.id] = leads.filter((l) => l._stageId === stage.id).length;
    }
    counts['my_open'] = leads.length;
    counts['open'] = leads.length;
    counts['following'] = leads.filter((l) => followedLeadIds.has(l.id)).length;
    counts['won'] = leads.filter(l => l.status === 'won' as any).length;
    counts['lost'] = leads.filter(l => l.status === 'lost' as any).length;
    counts['brad_incoming'] = leads.filter(l => (l.assigned_to ?? '').toLowerCase().includes('brad') || teamMemberMap[l.assigned_to ?? '']?.toLowerCase().includes('brad')).length;
    counts['initial_review'] = leads.filter(l => l.status === ('initial_review' as LeadStatus)).length;
    counts['review_kill_keep'] = leads.filter(l => l.status === ('review_kill_keep' as LeadStatus)).length;
    counts['onboarding_2024'] = leads.filter(l => l.cohort_year === 2024).length;
    counts['onboarding_2025'] = leads.filter(l => l.cohort_year === 2025).length;
    counts['onboarding_2026'] = leads.filter(l => l.cohort_year === 2026).length;
    counts['pre_approval_issued'] = leads.filter(l => l.status === ('pre_approval_issued' as LeadStatus)).length;
    counts['ready_for_wu_approval'] = leads.filter(l => l.status === ('ready_for_wu_approval' as LeadStatus)).length;
    return counts;
  }, [leads, teamMemberMap, stages, followedLeadIds]);

  const filteredAndSorted = useMemo(() => {
    let result = leads;

    if (activeFilter !== 'all') {
      if (stages.some(s => s.id === activeFilter)) {
        result = result.filter((l) => l._stageId === activeFilter);
      } else if (activeFilter === 'won') {
        result = result.filter((l) => l.status === ('won' as LeadStatus));
      } else if (activeFilter === 'lost') {
        result = result.filter((l) => l.status === ('lost' as LeadStatus));
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
      } else if (activeFilter === 'initial_review') {
        result = result.filter((l) => l.status === ('initial_review' as LeadStatus));
      } else if (activeFilter === 'review_kill_keep') {
        result = result.filter((l) => l.status === ('review_kill_keep' as LeadStatus));
      } else if (activeFilter === 'pre_approval_issued') {
        result = result.filter((l) => l.status === ('pre_approval_issued' as LeadStatus));
      } else if (activeFilter === 'ready_for_wu_approval') {
        result = result.filter((l) => l.status === ('ready_for_wu_approval' as LeadStatus));
      } else if (activeFilter === 'brad_incoming') {
        result = result.filter((l) => teamMemberMap[l.assigned_to ?? '']?.toLowerCase().includes('brad'));
      } else if (activeFilter === 'onboarding_2024') {
        result = result.filter((l) => l.cohort_year === 2024);
      } else if (activeFilter === 'onboarding_2025') {
        result = result.filter((l) => l.cohort_year === 2025);
      } else if (activeFilter === 'onboarding_2026') {
        result = result.filter((l) => l.cohort_year === 2026);
      } else if (activeFilter === 'following') {
        result = result.filter((l) => followedLeadIds.has(l.id));
      }
      // 'my_open', 'open' show all for now
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
  }, [leads, activeFilter, searchTerm, sortField, sortDir, teamMemberMap, customFilters, followedLeadIds]);

  const totalValue = useMemo(
    () => leads.reduce((sum, l) => sum + fakeValue(l.id), 0),
    [leads]
  );

  const { columnWidths, handleColumnResize } = useAutoFitColumns({
    minWidths: {
      opportunity: 220, company: 100, contact: 100, value: 80, ownedBy: 80,
      tasks: 55, status: 100, stage: 120, daysInStage: 55, stageUpdated: 85,
      lastContacted: 90, interactions: 65, inactiveDays: 70, tags: 100,
    },
    autoFitConfig: uwAutoFitConfig,
    data: filteredAndSorted,
    storageKey: 'uw-col-widths-v2',
  });

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

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (dealIds: string[]) => {
      const { error } = await supabase
        .from('underwriting')
        .delete()
        .in('id', dealIds);
      if (error) throw error;
      return dealIds;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
      toast.success(`${ids.length} lead(s) removed`);
      clearSelection();
      setDeleteConfirmOpen(false);
    },
    onError: () => toast.error('Failed to delete leads'),
  });

  const handleBulkDelete = () => {
    const dealIds = filteredAndSorted
      .filter(l => selectedLeadIds.has(l.id))
      .map(l => l.id)
      .filter(Boolean);
    if (dealIds.length > 0) {
      bulkDeleteMutation.mutate(dealIds);
    }
  };

  // Bulk assign owner mutation
  const bulkAssignOwnerMutation = useMutation({
    mutationFn: async ({ leadIds, ownerId }: { leadIds: string[]; ownerId: string }) => {
      const { error } = await supabase
        .from('underwriting')
        .update({ assigned_to: ownerId })
        .in('id', leadIds);
      if (error) throw error;
      return { leadIds, ownerId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
      const ownerName = teamMemberMap[result.ownerId] || 'team member';
      toast.success(`${result.leadIds.length} lead(s) assigned to ${ownerName}`);
      clearSelection();
    },
    onError: () => toast.error('Failed to assign owner'),
  });

  const handleBulkAssignOwner = (ownerId: string) => {
    bulkAssignOwnerMutation.mutate({ leadIds: Array.from(selectedLeadIds), ownerId });
  };

  // Bulk add tags mutation
  const bulkAddTagsMutation = useMutation({
    mutationFn: async ({ leadIds, tags }: { leadIds: string[]; tags: string[] }) => {
      const { data: currentLeads, error: fetchError } = await supabase
        .from('underwriting')
        .select('id, tags')
        .in('id', leadIds);
      if (fetchError) throw fetchError;

      for (const lead of (currentLeads || [])) {
        const existingTags: string[] = (lead.tags as string[]) || [];
        const mergedTags = Array.from(new Set([...existingTags, ...tags]));
        const { error } = await supabase
          .from('underwriting')
          .update({ tags: mergedTags })
          .eq('id', lead.id);
        if (error) throw error;
      }
      return { count: leadIds.length, tags };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
      toast.success(`Added ${result.tags.length} tag(s) to ${result.count} lead(s)`);
      clearSelection();
      setAddTagsDialogOpen(false);
      setBulkTagValue('');
    },
    onError: () => toast.error('Failed to add tags'),
  });

  const handleBulkAddTags = () => {
    const tags = bulkTagValue.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length === 0) return;
    bulkAddTagsMutation.mutate({ leadIds: Array.from(selectedLeadIds), tags });
  };

  // Bulk move boxes (stage change)
  const handleBulkMoveBoxes = () => {
    if (!moveBoxesTargetStage) return;
    const targetStage = stages.find(s => s.id === moveBoxesTargetStage);
    const leadsToMove = filteredAndSorted.filter(l => selectedLeadIds.has(l.id));
    for (const lead of leadsToMove) {
      const pipelineLeadId = (lead as any)._pipelineLeadId;
      const currentStageId = (lead as any)._stageId;
      if (pipelineLeadId && currentStageId !== moveBoxesTargetStage) {
        const currentStage = stages.find(s => s.id === currentStageId);
        moveLeadToStage.mutate({
          pipelineLeadId,
          newStageId: moveBoxesTargetStage,
          newStageName: targetStage?.name,
          oldStageName: currentStage?.name,
          leadId: lead.id,
        });
      }
    }
    toast.success(`Moving ${leadsToMove.length} lead(s) to ${targetStage?.name || 'new stage'}`);
    clearSelection();
    setMoveBoxesDialogOpen(false);
    setMoveBoxesTargetStage('');
  };

  // Row padding based on density
  const rowPad = rowDensity === 'comfortable' ? 'py-1.5' : 'py-0.5';

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
    const widthKey = colKey ?? 'opportunity';
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
                &#8942;
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
                        <span style={{ color: '#3b2778', fontSize: 16 }}>&#8593;</span>
                      ) : (
                        <span style={{ color: '#5f6368', fontSize: 16 }}>&#8595;</span>
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
      <div className="underwriting-font system-font flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-background -m-3 sm:-m-4 md:-m-6 lg:-m-8 xl:-m-10">

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
                stageConfig={dynamicStageConfig}
                onSave={(filter) => {
                  const id = `custom_${Date.now()}`;
                  setCustomFilters(prev => [...prev, { id, label: filter.filterName, values: filter }]);
                  toast.success(`Filter "${filter.filterName}" created`);
                }}
              />
            }
          />

          {/* ── Main Table Area ── */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* ── Copper-Style Content Title Bar ── */}
            <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 bg-[#f8f9fa] dark:bg-muted/30">

              <div className="flex items-center gap-3 ml-24">
                <h2 className="text-[16px] font-bold text-[#1f1f1f] dark:text-foreground whitespace-nowrap">
                  {FILTER_OPTIONS.find(o => o.id === activeFilter)?.label ?? customFilters.find(cf => cf.id === activeFilter)?.label ?? 'All Opportunities'}
                </h2>
                {!isLoading && (
                  <span className="text-[#5f6368] dark:text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                    # {filteredAndSorted.length.toLocaleString()} opportunities
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

            {/* ── Content Area: Table or Kanban ── */}
            {viewMode === 'table' ? (
              <div className="flex-1 overflow-auto">
                {/* Bulk Selection Toolbar */}
                {selectedLeadIds.size > 0 && (
                  <div className="sticky top-0 z-40 px-4 py-2 bg-white dark:bg-background border-b border-border">
                    <PipelineBulkToolbar
                      selectedCount={selectedLeadIds.size}
                      totalCount={filteredAndSorted.length}
                      onClearSelection={clearSelection}
                      onDeleteBoxes={() => setDeleteConfirmOpen(true)}
                      onAssignOwner={handleBulkAssignOwner}
                      onAddTags={() => setAddTagsDialogOpen(true)}
                      onMoveBoxes={() => setMoveBoxesDialogOpen(true)}
                      teamMembers={teamMembers}
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
                      <ColHeader className="sticky top-0 z-30 group/hdr" style={{ left: 0, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                        <div className="shrink-0">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={(checked) => checked ? selectAll() : clearSelection()}
                            className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                          />
                        </div>
                        <User className="h-4 w-4" /> Opportunity
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
                      <ColHeader colKey="tags" className="sticky top-0 z-10" style={{ borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>
                        <Tag className="h-4 w-4" /> Tags
                      </ColHeader>
                      <th className="w-10 px-2 py-1.5 sticky top-0 z-10" style={{ backgroundColor: '#eee6f6', border: '1px solid #c8bdd6' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSorted.length === 0 ? (
                      <tr>
                        <td colSpan={14} style={{ border: '1px solid #c8bdd6' }}>
                          <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted">
                              <FileSearch className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold text-foreground">No opportunities found</p>
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
                        const stageCfg = dynamicStageConfig[lead._stageId];
                        const assignedName = lead.assigned_to
                          ? (teamMemberMap[lead.assigned_to] ?? null)
                          : null;
                        const assignedAvatar = lead.assigned_to ? (teamAvatarMap[lead.assigned_to] ?? null) : null;
                        const taskCount = taskCountMap[lead.id] ?? fakeTasks(lead.id);
                        const interactionCount = interactionCountMap[lead.id] ?? fakeInteractions(lead.id);
                        const daysInStage = daysSince(lead.updated_at);
                        const inactiveDays = daysSince(lead.last_activity_at);
                        const dealValue = fakeValue(lead.id);
                        const isDetailSelected = selectedLead?.id === lead.id;
                        const isBulkSelected = selectedLeadIds.has(lead.id);

                        const stickyBg = isDetailSelected
                          ? 'bg-[#eee6f6] dark:bg-purple-950 group-hover:bg-[#e0d4f0] dark:group-hover:bg-purple-900'
                          : isBulkSelected
                            ? 'bg-[#eee6f6] dark:bg-violet-950/30 group-hover:bg-[#e0d4f0] dark:group-hover:bg-violet-900/40'
                            : 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted';

                        return (
                          <tr
                            key={lead.id}
                            onClick={() => handleRowClick(lead)}
                            className={`cursor-pointer transition-colors duration-100 group ${
                              isDetailSelected
                                ? 'bg-[#eee6f6] dark:bg-purple-950/30 hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40'
                                : isBulkSelected
                                  ? 'bg-[#eee6f6]/60 dark:bg-violet-950/20 hover:bg-[#eee6f6]/80'
                                  : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                            }`}
                          >
                            {/* Opportunity + Checkbox (sticky) */}
                            <td className={`pl-2 pr-1.5 py-1.5 overflow-hidden sticky left-0 z-[5] transition-colors ${stickyBg} ${isDetailSelected ? 'border-l-[3px] border-l-[#3b2778]' : ''}`} style={{ width: columnWidths.opportunity, border: '1px solid #c8bdd6', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                              <div className="flex items-center gap-2">
                                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isBulkSelected}
                                    onCheckedChange={() => toggleLeadSelection(lead.id)}
                                    className="h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                                  />
                                </div>
                                <div className="flex items-center gap-2 min-w-0 flex-1 bg-[#f1f3f4] dark:bg-muted rounded-full pl-0.5 pr-3 py-0.5">
                                  <CrmAvatar name={lead.name} />
                                  <span className="text-[16px] text-[#202124] dark:text-foreground truncate">{getLeadDisplayName(lead)}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/pipeline/underwriting/expanded-view/${lead.id}`); }}
                                  className="shrink-0 ml-auto -mr-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                                >
                                  <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
                                </button>
                              </div>
                            </td>

                            {/* Company */}
                            {columnVisibility.company && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.company, border: '1px solid #c8bdd6' }}>
                                {lead.company_name ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{lead.company_name}</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Contact */}
                            {columnVisibility.contact && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.contact, border: '1px solid #c8bdd6' }}>
                                {lead.name ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{lead.name}</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Value */}
                            {columnVisibility.value && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.value, border: '1px solid #c8bdd6' }}>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{formatValue(dealValue)}</span>
                              </td>
                            )}

                            {/* Owner */}
                            {columnVisibility.ownedBy && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.ownedBy, border: '1px solid #c8bdd6' }}>
                                {assignedName ? (
                                  <span className="inline-flex items-center gap-2 pl-0.5 pr-3 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted max-w-full">
                                    <CrmAvatar name={assignedName} imageUrl={assignedAvatar} size="sm" />
                                    <span className="text-[16px] text-[#202124] dark:text-foreground truncate">{assignedName}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Tasks */}
                            {columnVisibility.tasks && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.tasks, border: '1px solid #c8bdd6' }}>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">{taskCount}</span>
                              </td>
                            )}

                            {/* Status */}
                            {columnVisibility.status && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.status ?? 100, border: '1px solid #c8bdd6' }}>
                                {lead.status ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{lead.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Stage */}
                            {columnVisibility.stage && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.stage, border: '1px solid #c8bdd6' }}>
                                {(stageCfg?.label ?? lead._stageName ?? lead.status) ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{stageCfg?.label ?? lead._stageName ?? lead.status}</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Days in Stage */}
                            {columnVisibility.daysInStage && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.daysInStage, border: '1px solid #c8bdd6' }}>
                                {daysInStage !== null ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">{daysInStage}d</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Stage Updated */}
                            {columnVisibility.stageUpdated && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.stageUpdated, border: '1px solid #c8bdd6' }}>
                                {formatShortDate(lead.updated_at) ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{formatShortDate(lead.updated_at)}</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Last Contacted */}
                            {columnVisibility.lastContacted && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.lastContacted, border: '1px solid #c8bdd6' }}>
                                {formatShortDate(lead.last_activity_at) ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{formatShortDate(lead.last_activity_at)}</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Interactions */}
                            {columnVisibility.interactions && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.interactions, border: '1px solid #c8bdd6' }}>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">{interactionCount}</span>
                              </td>
                            )}

                            {/* Inactive Days */}
                            {columnVisibility.inactiveDays && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.inactiveDays, border: '1px solid #c8bdd6' }}>
                                {inactiveDays !== null ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">{inactiveDays}d</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Tags */}
                            {columnVisibility.tags && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.tags, border: '1px solid #c8bdd6' }}>
                                {lead.tags && lead.tags.length > 0 ? (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    {lead.tags.slice(0, 2).map((tag) => (
                                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted text-[11px] font-medium text-[#202124] dark:text-foreground">
                                        {tag}
                                      </span>
                                    ))}
                                    {lead.tags.length > 2 && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted text-[11px] font-medium text-[#202124] dark:text-foreground">+{lead.tags.length - 2}</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Detail arrow */}
                            <td className="px-2 py-1.5 w-10" style={{ border: '1px solid #c8bdd6' }}>
                              <PanelRightOpen className={`h-4 w-4 transition-all duration-150 ${
                                isDetailSelected
                                  ? 'text-[#3b2778]'
                                  : 'text-transparent group-hover:text-muted-foreground'
                              }`} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                )}
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
                          onLeadClick={(lead) => handleRowClick(lead)}
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

          {/* ── Right Detail Panel ── */}
          {selectedLead && (
            <UnderwritingDetailPanel
              lead={selectedLead}
              stageConfig={dynamicStageConfig}
              currentStageId={(selectedLead as any)?._stageId}
              teamMemberMap={teamMemberMap}
              teamMembers={teamMembers}
              formatValue={formatValue}
              fakeValue={fakeValue}
              onClose={() => setSelectedLead(null)}
              onExpand={() => navigate(`/admin/pipeline/underwriting/expanded-view/${selectedLead.id}`)}
              onStageChange={(leadId, newStatus) => {
                // Find stage ID by matching the status name from the detail panel
                const targetStage = stages.find(s => s.name === newStatus || s.id === newStatus);
                if (targetStage) {
                  handleStageMove(leadId, targetStage.id);
                }
              }}
              onLeadUpdate={(updatedLead) => {
                setSelectedLead(updatedLead);
                queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
              }}
            />
          )}
        </div>
      </div>



      {/* ── Add Opportunity Dialog ── */}
      <AddOpportunityDialog
        open={addOpportunityOpen}
        onOpenChange={setAddOpportunityOpen}
        tableName="underwriting"
        stages={stages}
        stageConfig={dynamicStageConfig}
        ownerOptions={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
        initialStageId={addOpportunityStage}
        onCreated={(lead) => setSelectedLead(lead as Lead)}
      />

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedLeadIds.size} {selectedLeadIds.size === 1 ? 'lead' : 'leads'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedLeadIds.size === 1 ? 'this lead' : 'these leads'} from the pipeline. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Add Tags Dialog */}
      <Dialog open={addTagsDialogOpen} onOpenChange={setAddTagsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Tags to {selectedLeadIds.size} Lead{selectedLeadIds.size !== 1 ? 's' : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="bulk-tags-uw" className="text-sm font-medium">Tags (comma-separated)</Label>
            <Input
              id="bulk-tags-uw"
              placeholder="e.g. hot lead, follow up, Q1"
              value={bulkTagValue}
              onChange={(e) => setBulkTagValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleBulkAddTags(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddTagsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkAddTags} disabled={bulkAddTagsMutation.isPending || !bulkTagValue.trim()}>
              {bulkAddTagsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Apply Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Boxes Dialog */}
      <Dialog open={moveBoxesDialogOpen} onOpenChange={setMoveBoxesDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Move {selectedLeadIds.size} Lead{selectedLeadIds.size !== 1 ? 's' : ''} to Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-sm font-medium">Target Stage</Label>
            <Select value={moveBoxesTargetStage} onValueChange={setMoveBoxesTargetStage}>
              <SelectTrigger>
                <SelectValue placeholder="Select a stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {dynamicStageConfig[stage.id]?.title || stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveBoxesDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkMoveBoxes} disabled={!moveBoxesTargetStage || moveLeadToStage.isPending}>
              {moveLeadToStage.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EmployeeLayout>
  );
};

// Temporary error boundary to debug white screen
class UWErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('UW crash:', error, info); }
  render() {
    if (this.state.error) return <div style={{ padding: 40, color: 'red' }}><h2>Underwriting Error</h2><pre>{this.state.error.message}</pre><pre>{this.state.error.stack}</pre></div>;
    return this.props.children;
  }
}

function UWWithBoundary() {
  return <UWErrorBoundary><Underwriting /></UWErrorBoundary>;
}

export default UWWithBoundary;
