import { useState, useMemo, useRef, useEffect } from 'react';
import { useAutoFitColumns, CHAR_W_SM } from '@/hooks/useAutoFitColumns';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import { InlineEditableCell } from '@/components/admin/InlineEditableCell';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import PipelineDetailPanel from '@/components/admin/PipelineDetailPanel';
import PipelineBulkToolbar from '@/components/admin/PipelineBulkToolbar';
import PipelineSettingsPopover from '@/components/admin/PipelineSettingsDialog';
import CreateFilterDialog, { CustomFilterValues } from '@/components/admin/CreateFilterDialog';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectAllHeader } from '@/components/admin/SelectAllHeader';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  ArrowUpDown,
  ArrowLeft,
  PanelLeft,
  Filter,
  Settings2,
  ChevronDown,
  ChevronUp,
  Plus,
  DollarSign,
  Check,
  X,
  Table2,
  Columns3,
  PanelRightOpen,
  FileSearch,
  Maximize2,
  Download,
  PlusCircle,
  Loader2,
  Search,
  BarChart3,
  Landmark,
  User,
  CalendarDays,
  MessageSquare,
  Moon,
  CheckSquare,
  Tag,
  Clock,
  Sparkles,
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
import { usePipelineDeals, type FlatPipelineLead } from '@/hooks/usePipelineLeads';
import { useCrmMutations } from '@/hooks/usePipelineMutations';
import { buildStageConfig } from '@/utils/pipelineStageConfig';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useUndo } from '@/contexts/UndoContext';

type Lead = Database['public']['Tables']['potential']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];


const FILTER_OPTIONS = [
  { id: 'my_open', label: 'My Open Opportunities', group: 'public' },
  { id: 'open', label: 'Open Opportunities', group: 'public' },
  { id: 'following', label: "Opportunities I'm Following", group: 'public' },
  { id: 'won', label: 'Won Opportunities', group: 'public' },
  { id: 'lost', label: 'Lost / Closed Opportunities', group: 'public' },
  { id: 'brad_incoming', label: 'Brad Incoming Opportunities', group: 'public' },
  { id: 'initial_review', label: 'Deals for Initial Review', group: 'public' },
  { id: 'review_kill_keep', label: 'Deals Moving Towards Underwriting', group: 'public' },
  { id: 'onboarding_2024', label: 'OnBoarding 2024 - Opp. into UW', group: 'public' },
  { id: 'onboarding_2025', label: 'OnBoarding 2025 - Opp. into UW', group: 'public' },
  { id: 'onboarding_2026', label: 'OnBoarding 2026 - Opp. into UW', group: 'public' },
  { id: 'pre_approval_issued', label: 'Pre-Approval Letters Issued', group: 'public' },
  { id: 'ready_for_wu_approval', label: "Write Up's Pending Approval", group: 'public' },
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

function formatValue(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

type SortField = 'name' | 'opportunity_name' | 'company_name' | 'status' | 'last_activity_at' | 'assigned_to' | 'updated_at';
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

const COLUMN_SORT_OPTIONS: Record<string, { label: string; field: SortField; dir: SortDir }[]> = {
  deal: [
    { label: 'Deal name ascending', field: 'opportunity_name', dir: 'asc' },
    { label: 'Deal name descending', field: 'opportunity_name', dir: 'desc' },
  ],
  company: [
    { label: 'Company ascending', field: 'company_name', dir: 'asc' },
    { label: 'Company descending', field: 'company_name', dir: 'desc' },
  ],
  status: [
    { label: 'Status ascending', field: 'status', dir: 'asc' },
    { label: 'Status descending', field: 'status', dir: 'desc' },
  ],
  ownedBy: [
    { label: 'Owner ascending', field: 'assigned_to', dir: 'asc' },
    { label: 'Owner descending', field: 'assigned_to', dir: 'desc' },
  ],
  lastContacted: [
    { label: 'Last contacted ascending', field: 'last_activity_at', dir: 'asc' },
    { label: 'Last contacted descending', field: 'last_activity_at', dir: 'desc' },
  ],
  stageUpdated: [
    { label: 'Updated ascending', field: 'updated_at', dir: 'asc' },
    { label: 'Updated descending', field: 'updated_at', dir: 'desc' },
  ],
};

// ── Kanban sub-components ──
function KanbanDealCard({ lead, teamMemberMap, leadOwnerMap, isDragging, onClick }: {
  lead: Lead;
  teamMemberMap: Record<string, string>;
  leadOwnerMap: Record<string, string>;
  isDragging?: boolean;
  onClick: () => void;
}) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lead.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const effectiveOwnerId = leadOwnerMap[lead.id] ?? lead.assigned_to;
  const assignedName = effectiveOwnerId ? (teamMemberMap[effectiveOwnerId] ?? null) : null;
  const lastActivity = lead.last_activity_at ? format(parseISO(lead.last_activity_at), 'MMM d') : null;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="group/card cursor-grab active:cursor-grabbing shadow-sm border border-border/60 hover:shadow-md transition-shadow bg-card overflow-hidden"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        {/* Top section */}
        <div className="p-3 pb-2.5">
          <div className="flex items-start justify-between gap-1 mb-2">
            <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">{lead.name}</p>
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/admin/pipeline/potential/expanded-view/${lead.id}`); }}
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

        {/* Bottom bar */}
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

function KanbanDropColumn({ status, label, color, leads, teamMemberMap, leadOwnerMap, draggedId, onLeadClick, onAdd }: {
  status: string;
  label: string;
  color: string;
  leads: any[];
  teamMemberMap: Record<string, string>;
  leadOwnerMap: Record<string, string>;
  draggedId: string | null;
  onLeadClick: (lead: any) => void;
  onAdd?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const totalValue = leads.reduce((sum, l) => sum + (l.deal_value ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-[280px] shrink-0 rounded-xl transition-colors ${isOver ? 'bg-blue-50/70 dark:bg-blue-950/30' : 'bg-muted/30'}`}
    >
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full shrink-0 ${color}`} />
          <span className="text-xs font-semibold text-foreground truncate">{label}</span>
          <span className="text-[11px] text-muted-foreground font-medium">{leads.length}</span>
          <div className="ml-auto flex items-center gap-1">
            {onAdd && (
              <button onClick={onAdd} className="text-muted-foreground hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {totalValue > 0 && (
          <div className="flex items-center gap-1 mt-1 ml-4">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium">{formatValue(totalValue)}</span>
          </div>
        )}
      </div>
      <ScrollArea className="flex-1 px-2 pb-2 pt-1">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {leads.map((lead) => (
              <KanbanDealCard
                key={lead.id}
                lead={lead}
                teamMemberMap={teamMemberMap}
                leadOwnerMap={leadOwnerMap}
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

const CLOSED_STATUSES: LeadStatus[] = ['won', 'lost', 'funded'];

const Pipeline = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { teamMember: currentTeamMember } = useTeamMember();
  const { registerUndo } = useUndo();

  // Core state
  const [activeFilter, setActiveFilter] = useState<string>('my_open');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_activity_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [leadOwnerOverrides, setLeadOwnerOverrides] = useState<Record<string, string>>({});

  // Toolbar state
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [rowDensity, setRowDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publicFiltersOpen, setPublicFiltersOpen] = useState(true);
  const [draggedLead, setDraggedLead] = useState<FlatPipelineLead | null>(null);

  // Column sort menu state
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);

  // Bulk action state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [addTagsDialogOpen, setAddTagsDialogOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState('');
  const [moveBoxesDialogOpen, setMoveBoxesDialogOpen] = useState(false);
  const [moveBoxesTargetStage, setMoveBoxesTargetStage] = useState('');

  // Custom filters
  const [customFilters, setCustomFilters] = useState<Array<{ id: string; label: string; values: CustomFilterValues }>>([]);

  // Add Opportunity state
  const [addOpportunityOpen, setAddOpportunityOpen] = useState(false);
  const [addOpportunityStage, setAddOpportunityStage] = useState<string>('');
  const [newOpp, setNewOpp] = useState({ name: '', company_name: '', email: '', phone: '' });

  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    company: true, contact: true, value: true, ownedBy: true, tasks: true,
    status: true, stage: true, daysInStage: true, stageUpdated: true, lastContacted: true,
    interactions: true, inactiveDays: true, tags: true,
  });


  // ── Top bar: inject title + search into AdminLayout header ──
  const { setPageTitle, setSearchComponent } = useAdminTopBar();

  useEffect(() => {
    setPageTitle('Pipeline');
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
  const { data: pipeline } = useSystemPipelineByName('Potential');
  const { data: stages = [] } = usePipelineStages(pipeline?.id);
  const { leads: pipelineLeadsList, isLoading: isPipelineLeadsLoading } = usePipelineDeals();
  const { moveLeadToStage, addLeadToPipeline, removeLeadFromPipeline, bulkRemoveLeadsFromPipeline } = useCrmMutations('potential');
  const dynamicStageConfig = useMemo(() => buildStageConfig(stages), [stages]);

  const leads = pipelineLeadsList;
  const isLoading = isPipelineLeadsLoading;

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
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

  // Deterministically assign a random owner to each lead that has no assigned_to
  const leadOwnerMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (teamMembers.length === 0) return map;
    for (const lead of leads) {
      if (lead.assigned_to) {
        map[lead.id] = lead.assigned_to;
      } else {
        const idx = Math.floor(seededRand(lead.id, 10) * teamMembers.length);
        map[lead.id] = teamMembers[idx].id;
      }
    }
    // Apply optimistic overrides from inline edits
    for (const [id, ownerId] of Object.entries(leadOwnerOverrides)) {
      map[id] = ownerId;
    }
    return map;
  }, [leads, teamMembers, leadOwnerOverrides]);

  // Deterministic set of leads the current user is "following" (~25% of leads)
  const followedLeadIds = useMemo(() => {
    const set = new Set<string>();
    for (const lead of leads) {
      if (seededRand(lead.id, 20) < 0.25) set.add(lead.id);
    }
    return set;
  }, [leads]);

  // Fetch latest touchpoints
  const { data: touchpoints = {} } = useQuery({
    queryKey: ['pipeline-touchpoints', leads.map((l) => l.id)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('lead_id, communication_type, direction, created_at')
        .in('lead_id', leads.map((l) => l.id))
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
    enabled: leads.length > 0,
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

  // Create opportunity mutation
  const createOpportunityMutation = useMutation({
    mutationFn: async (data: { name: string; company_name: string; email: string; phone: string; stageId: string }) => {
      const result = await addLeadToPipeline.mutateAsync({
        leadData: {
          name: data.name,
          company_name: data.company_name || undefined,
          email: data.email || undefined,
          phone: data.phone || undefined,
          assigned_to: currentTeamMember?.id || teamMembers[0]?.id || null,
        },
        stageId: data.stageId,
      });
      return result;
    },
    onSuccess: (lead) => {
      setAddOpportunityOpen(false);
      setNewOpp({ name: '', company_name: '', email: '', phone: '' });
      toast.success(`"${lead.name}" added to ${dynamicStageConfig[addOpportunityStage]?.title ?? 'pipeline'}`);
      setDetailDialogLead(lead as any);
      registerUndo({
        label: `Created opportunity "${lead.name}"`,
        execute: async () => {
          const { error } = await supabase.from('potential').delete().eq('id', lead.id);
          if (error) throw error;
          setDetailDialogLead(null);
          queryClient.invalidateQueries({ queryKey: ['potential-deals'] });
        },
      });
    },
    onError: () => {
      toast.error('Failed to create opportunity');
    },
  });

  const handleCreateOpportunity = () => {
    if (!newOpp.name.trim()) {
      toast.error('Opportunity name is required');
      return;
    }
    createOpportunityMutation.mutate({ ...newOpp, stageId: addOpportunityStage });
  };

  const openAddDialog = (stageId?: string) => {
    setAddOpportunityStage(stageId ?? stages[0]?.id ?? '');
    setNewOpp({ name: '', company_name: '', email: '', phone: '' });
    setAddOpportunityOpen(true);
  };

  // Task and interaction count queries
  const { data: taskCountMap = {} } = useQuery({
    queryKey: ['pipeline-task-counts', leads.map((l) => l.id)],
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
    queryKey: ['pipeline-interaction-counts', leads.map((l) => l.id)],
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

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stage of stages) {
      counts[stage.id] = leads.filter((l) => l._stageId === stage.id).length;
    }
    const myId = currentTeamMember?.id;
    counts['my_open'] = leads.filter(l => leadOwnerMap[l.id] === myId && !CLOSED_STATUSES.includes(l.status)).length;
    counts['open'] = leads.filter(l => !CLOSED_STATUSES.includes(l.status)).length;
    counts['following'] = leads.filter(l => followedLeadIds.has(l.id)).length;
    counts['won'] = leads.filter(l => l.status === 'won' as any).length;
    counts['lost'] = leads.filter(l => l.status === 'lost' as any || l.status === 'funded' as any).length;
    counts['brad_incoming'] = leads.filter(l => {
      const ownerId = leadOwnerMap[l.id];
      return teamMemberMap[ownerId]?.toLowerCase().includes('brad');
    }).length;
    counts['initial_review'] = leads.filter(l => l.status === ('initial_review' as LeadStatus)).length;
    counts['review_kill_keep'] = leads.filter(l => l.status === ('review_kill_keep' as LeadStatus)).length;
    counts['onboarding_2024'] = leads.filter(l => l.cohort_year === 2024).length;
    counts['onboarding_2025'] = leads.filter(l => l.cohort_year === 2025).length;
    counts['onboarding_2026'] = leads.filter(l => l.cohort_year === 2026).length;
    counts['pre_approval_issued'] = leads.filter(l => l.status === ('pre_approval_issued' as LeadStatus)).length;
    counts['ready_for_wu_approval'] = leads.filter(l => l.status === ('ready_for_wu_approval' as LeadStatus)).length;
    return counts;
  }, [leads, teamMemberMap, stages, currentTeamMember, leadOwnerMap, followedLeadIds]);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let result = leads;

    {
      const myId = currentTeamMember?.id;
      if (stages.some(s => s.id === activeFilter)) {
        result = result.filter((l) => l._stageId === activeFilter);
      } else if (activeFilter === 'my_open') {
        result = result.filter((l) => leadOwnerMap[l.id] === myId && !CLOSED_STATUSES.includes(l.status));
      } else if (activeFilter === 'open') {
        result = result.filter((l) => !CLOSED_STATUSES.includes(l.status));
      } else if (activeFilter === 'following') {
        result = result.filter((l) => followedLeadIds.has(l.id));
      } else if (activeFilter === 'won') {
        result = result.filter((l) => l.status === ('won' as LeadStatus));
      } else if (activeFilter === 'lost') {
        result = result.filter((l) => l.status === ('lost' as LeadStatus) || l.status === ('funded' as LeadStatus));
      } else if (activeFilter.startsWith('custom_')) {
        const cf = customFilters.find(f => f.id === activeFilter);
        if (cf) {
          const v = cf.values;
          result = result.filter((l) => {
            if (v.stage.length > 0 && !v.stage.includes(l.status)) return false;
            if (v.status.length > 0 && !v.status.includes(l.status)) return false;
            if (v.source.length > 0 && !v.source.includes(l.source ?? '')) return false;
            if (v.ownedBy.length > 0 && !v.ownedBy.includes(leadOwnerMap[l.id] ?? '')) return false;

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
        result = result.filter((l) => teamMemberMap[leadOwnerMap[l.id]]?.toLowerCase().includes('brad'));
      } else if (activeFilter === 'onboarding_2024') {
        result = result.filter((l) => l.cohort_year === 2024);
      } else if (activeFilter === 'onboarding_2025') {
        result = result.filter((l) => l.cohort_year === 2025);
      } else if (activeFilter === 'onboarding_2026') {
        result = result.filter((l) => l.cohort_year === 2026);
      }
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
          (teamMemberMap[leadOwnerMap[l.id] ?? l.assigned_to ?? ''] ?? '').toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = ((a[sortField] ?? '') as string);
      const bVal = ((b[sortField] ?? '') as string);
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [leads, activeFilter, searchTerm, sortField, sortDir, teamMemberMap, stages, currentTeamMember, leadOwnerMap, followedLeadIds]);

  const pipelineAutoFitConfig = useMemo(() => ({
    deal: { getText: (l: any) => l.opportunity_name && l.opportunity_name !== l.name ? l.opportunity_name : (l.company_name ? `${l.name} - ${l.company_name}` : l.name), extraPx: 58 },
    company: { getText: (l: any) => l.company_name, extraPx: 32 },
    contact: { getText: (l: any) => l.name },
    ownedBy: { getText: (l: any) => teamMemberMap[l.assigned_to ?? ''] ?? '', extraPx: 32 },
    stage: { getText: (l: any) => dynamicStageConfig[l._stageId]?.title ?? l.status, charWidth: CHAR_W_SM, extraPx: 40 },
  }), [teamMemberMap, dynamicStageConfig]);

  const { columnWidths, handleColumnResize } = useAutoFitColumns({
    minWidths: {
      deal: 200, company: 130, contact: 110, value: 90, ownedBy: 80,
      tasks: 55, status: 100, stage: 160, daysInStage: 55, stageUpdated: 85,
      lastContacted: 90, interactions: 65, inactiveDays: 70, tags: 100,
    },
    autoFitConfig: pipelineAutoFitConfig,
    data: filteredAndSorted,
    storageKey: 'pipeline-col-widths-v2',
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

  // Inline cell save handler for direct Supabase updates
  const handleInlineCellSave = async (leadId: string, field: string, value: string) => {
    if (field === 'assigned_to') {
      setLeadOwnerOverrides(prev => ({ ...prev, [leadId]: value }));
    }

    // Coerce deal_value to number (or null) since the DB column is numeric
    let saveValue: any = value;
    if (field === 'deal_value') {
      const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
      saveValue = isNaN(num) ? null : num;
    }

    const { error } = await supabase
      .from('potential')
      .update({ [field]: saveValue, updated_at: new Date().toISOString() })
      .eq('id', leadId);

    if (error) {
      toast.error(`Failed to update ${field}`);
      if (field === 'assigned_to') {
        setLeadOwnerOverrides(prev => {
          const next = { ...prev };
          delete next[leadId];
          return next;
        });
      }
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['potential-deals'] });
  };

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
      // Capture pipeline records before deleting for undo
      const { data: deletedRecords } = await supabase
        .from('potential')
        .select('*')
        .in('id', dealIds);
      const { error } = await supabase
        .from('potential')
        .delete()
        .in('id', dealIds);
      if (error) throw error;
      return { ids: dealIds, deletedRecords: deletedRecords ?? [] };
    },
    onSuccess: ({ ids, deletedRecords }) => {
      queryClient.invalidateQueries({ queryKey: ['potential-deals'] });
      toast.success(`${ids.length} lead(s) removed from pipeline`);
      clearSelection();
      setDeleteConfirmOpen(false);
      if (deletedRecords.length > 0) {
        registerUndo({
          label: `Removed ${ids.length} lead(s) from pipeline`,
          execute: async () => {
            const { error: e } = await supabase.from('potential').insert(deletedRecords);
            if (e) throw e;
            queryClient.invalidateQueries({ queryKey: ['potential-deals'] });
          },
        });
      }
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
      // Capture previous owners for undo
      const { data: prevLeads } = await supabase
        .from('potential')
        .select('id, assigned_to')
        .in('id', leadIds);
      const previousOwners = (prevLeads ?? []).map(l => ({ id: l.id, assigned_to: l.assigned_to }));
      const { error } = await supabase
        .from('potential')
        .update({ assigned_to: ownerId })
        .in('id', leadIds);
      if (error) throw error;
      return { leadIds, ownerId, previousOwners };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['potential-deals'] });
      const ownerName = teamMemberMap[result.ownerId] || 'team member';
      toast.success(`${result.leadIds.length} lead(s) assigned to ${ownerName}`);
      clearSelection();
      registerUndo({
        label: `Assigned ${result.leadIds.length} lead(s) to ${ownerName}`,
        execute: async () => {
          for (const prev of result.previousOwners) {
            const { error: e } = await supabase.from('potential').update({ assigned_to: prev.assigned_to }).eq('id', prev.id);
            if (e) throw e;
          }
          queryClient.invalidateQueries({ queryKey: ['potential-deals'] });
        },
      });
    },
    onError: () => toast.error('Failed to assign owner'),
  });

  const handleBulkAssignOwner = (ownerId: string) => {
    bulkAssignOwnerMutation.mutate({ leadIds: Array.from(selectedLeadIds), ownerId });
  };

  // Bulk add tags mutation
  const bulkAddTagsMutation = useMutation({
    mutationFn: async ({ leadIds, tags }: { leadIds: string[]; tags: string[] }) => {
      // Fetch current tags for selected deals
      const { data: currentLeads, error: fetchError } = await supabase
        .from('potential')
        .select('id, tags')
        .in('id', leadIds);
      if (fetchError) throw fetchError;

      // Capture previous tags for undo
      const previousTags = (currentLeads || []).map(l => ({ id: l.id, tags: (l.tags as string[]) || [] }));

      // Update each deal, merging new tags with existing
      for (const lead of (currentLeads || [])) {
        const existingTags: string[] = (lead.tags as string[]) || [];
        const mergedTags = Array.from(new Set([...existingTags, ...tags]));
        const { error } = await supabase
          .from('potential')
          .update({ tags: mergedTags })
          .eq('id', lead.id);
        if (error) throw error;
      }
      return { count: leadIds.length, tags, previousTags };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['potential-deals'] });
      toast.success(`Added ${result.tags.length} tag(s) to ${result.count} lead(s)`);
      clearSelection();
      setAddTagsDialogOpen(false);
      setBulkTagValue('');
      registerUndo({
        label: `Added tags to ${result.count} lead(s)`,
        execute: async () => {
          for (const prev of result.previousTags) {
            const { error: e } = await supabase.from('potential').update({ tags: prev.tags }).eq('id', prev.id);
            if (e) throw e;
          }
          queryClient.invalidateQueries({ queryKey: ['potential-deals'] });
        },
      });
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
          {/* Three-dot menu button -- inline so it's never hidden */}
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
      <div className="system-font flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-background -m-3 sm:-m-4 md:-m-6 lg:-m-8 xl:-m-10">

        {/* Body: Sidebar + Table */}
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
          <aside
            className={`shrink-0 flex flex-col overflow-hidden transition-all duration-200 ${
              sidebarOpen ? 'w-72 bg-[#f8f9fa] dark:bg-muted/30' : 'w-[72px] bg-[#eef0f2] dark:bg-muted/50'
            }`}
          >
            {sidebarOpen && <div className="w-72 pl-4 flex-1 overflow-y-auto">
              <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                <span className="text-[20px] font-bold tracking-tight text-[#1f1f1f] dark:text-foreground">Saved Filters</span>
                <div className="flex items-center gap-1">
                  <CreateFilterDialog
                    teamMemberMap={teamMemberMap}
                    stageConfig={Object.fromEntries(Object.entries(dynamicStageConfig).map(([k, v]) => [k, { label: v.title }]))}
                    onSave={(filter) => {
                      const id = `custom_${Date.now()}`;
                      setCustomFilters(prev => [...prev, { id, label: filter.filterName, values: filter }]);
                      toast.success(`Filter "${filter.filterName}" created`);
                    }}
                  />
                </div>
              </div>

              {/* Search Filters input */}
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
                {/* All Opportunities — standalone above sections */}
                <button
                  onClick={() => setActiveFilter('all')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                    activeFilter === 'all'
                      ? 'bg-[#e0d4f0] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400 font-medium'
                      : 'text-[#3c4043] dark:text-muted-foreground hover:bg-[#f0eaf7] dark:hover:bg-purple-950/30 hover:text-[#3b2778] dark:hover:text-purple-300'
                  }`}
                >
                  <span className="text-[14px] font-medium">All Opportunities</span>
                  <span className={`text-[13px] tabular-nums ${activeFilter === 'all' ? 'text-[#3b2778] dark:text-purple-400' : 'text-[#80868b] dark:text-muted-foreground'}`}>
                    {leads.length}
                  </span>
                </button>

                {/* Public section */}
                <button
                  onClick={() => setPublicFiltersOpen(v => !v)}
                  className="w-full px-3 pt-4 pb-1 flex items-center justify-between group"
                >
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-[#5f6368] dark:text-muted-foreground">Public</span>
                  <ChevronUp className={`h-3.5 w-3.5 text-[#80868b] dark:text-muted-foreground transition-transform duration-200 ${publicFiltersOpen ? '' : 'rotate-180'}`} />
                </button>

                {publicFiltersOpen && FILTER_OPTIONS.filter(o => o.group === 'public').map((opt) => {
                  const isActive = activeFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setActiveFilter(opt.id)}
                      className={`relative w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                        isActive ? 'bg-[#e0d4f0] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400 rounded-lg font-medium' : 'text-[#3c4043] dark:text-muted-foreground hover:bg-[#f0eaf7] dark:hover:bg-purple-950/30 hover:text-[#3b2778] dark:hover:text-purple-300 rounded-lg'
                      }`}
                    >
                      <span className={`text-[14px] truncate ${isActive ? 'font-medium' : ''}`}>{opt.label}</span>
                    </button>
                  );
                })}

                {/* Custom Filters */}
                {customFilters.length > 0 && (
                  <>
                    <div className="pt-4 pb-1">
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-[#5f6368] dark:text-muted-foreground">Custom</span>
                    </div>
                    {customFilters.map((cf) => {
                      const isActive = activeFilter === cf.id;
                      return (
                        <button
                          key={cf.id}
                          onClick={() => setActiveFilter(cf.id)}
                          className={`relative w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                            isActive ? 'bg-[#e0d4f0] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400 rounded-lg font-medium' : 'text-[#3c4043] dark:text-muted-foreground hover:bg-[#f0eaf7] dark:hover:bg-purple-950/30 hover:text-[#3b2778] dark:hover:text-purple-300 rounded-lg'
                          }`}
                        >
                          <span className={`text-[14px] truncate ${isActive ? 'font-medium' : ''}`}>{cf.label}</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </nav>
            </div>}
          </aside>

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
                {/* Sort */}
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <button
                          className={`h-8 w-8 !p-0 flex items-center justify-center rounded-lg border transition-colors ${
                            isNonDefaultSort ? 'bg-[#eee6f6] dark:bg-purple-950/50 border-[#c8bdd6] dark:border-purple-700 text-[#3b2778] dark:text-purple-400' : 'bg-[#f5f0fa] hover:bg-[#eee6f6] dark:bg-purple-950/30 dark:hover:bg-purple-950/50 border-[#d4cae3] dark:border-purple-800 text-[#3b2778] dark:text-purple-300'
                          }`}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Sort options</TooltipContent>
                  </Tooltip>
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

                {/* Filter */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={isFiltersActive ? clearAllFilters : undefined}
                      className={`h-8 w-8 !p-0 flex items-center justify-center rounded-lg border transition-colors ${
                        isFiltersActive ? 'bg-[#eee6f6] dark:bg-purple-950/50 border-[#c8bdd6] dark:border-purple-700 text-[#3b2778] dark:text-purple-400' : 'bg-[#f5f0fa] hover:bg-[#eee6f6] dark:bg-purple-950/30 dark:hover:bg-purple-950/50 border-[#d4cae3] dark:border-purple-800 text-[#3b2778] dark:text-purple-300'
                      }`}
                    >
                      {isFiltersActive ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {isFiltersActive ? 'Clear all filters' : 'Filters'}
                  </TooltipContent>
                </Tooltip>

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
                {/* ── Bulk Selection Toolbar ── */}
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
                <table className="w-full text-sm" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#eee6f6' }}>
                      <ColHeader className="sticky top-0 z-30 group/hdr" style={{ left: 0, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
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
                      <ColHeader colKey="tags" className="sticky top-0 z-10" style={{ borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>
                        <Tag className="h-4 w-4" /> Tags
                      </ColHeader>
                      <th className="w-10 px-2 py-1.5 sticky top-0 z-10" style={{ backgroundColor: '#eee6f6', border: '1px solid #c8bdd6' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 7 }).map((_, i) => (
                        <tr key={i} className="bg-white dark:bg-card">
                          <td className="pl-2 pr-4 py-1.5 sticky left-0 z-[5] bg-white dark:bg-card" style={{ width: columnWidths.deal, border: '1px solid #c8bdd6', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                            <div className="flex items-center gap-2.5">
                              <Skeleton className="h-4 w-4 rounded shrink-0" />
                              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3.5 w-36" />
                                <Skeleton className="h-2.5 w-24" />
                              </div>
                            </div>
                          </td>
                          {columnVisibility.company && <td className="px-4 py-1.5" style={{ width: columnWidths.company, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-24 rounded" /></td>}
                          {columnVisibility.contact && <td className="px-4 py-1.5" style={{ width: columnWidths.contact, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.value && <td className="px-4 py-1.5" style={{ width: columnWidths.value, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                          {columnVisibility.ownedBy && <td className="px-4 py-1.5" style={{ width: columnWidths.ownedBy, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.tasks && <td className="px-4 py-1.5" style={{ width: columnWidths.tasks, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-8 rounded" /></td>}
                          {columnVisibility.status && <td className="px-4 py-1.5" style={{ width: columnWidths.status, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                          {columnVisibility.stage && <td className="px-4 py-1.5" style={{ width: columnWidths.stage, border: '1px solid #c8bdd6' }}><Skeleton className="h-5 w-28 rounded-full" /></td>}
                          {columnVisibility.daysInStage && <td className="px-4 py-1.5" style={{ width: columnWidths.daysInStage, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-10 rounded" /></td>}
                          {columnVisibility.stageUpdated && <td className="px-4 py-1.5" style={{ width: columnWidths.stageUpdated, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.lastContacted && <td className="px-4 py-1.5" style={{ width: columnWidths.lastContacted, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.interactions && <td className="px-4 py-1.5" style={{ width: columnWidths.interactions, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-8 rounded" /></td>}
                          {columnVisibility.inactiveDays && <td className="px-4 py-1.5" style={{ width: columnWidths.inactiveDays, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-10 rounded" /></td>}
                          {columnVisibility.tags && <td className="px-4 py-1.5" style={{ width: columnWidths.tags, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                        </tr>
                      ))
                    ) : filteredAndSorted.length === 0 ? (
                      <tr>
                        <td colSpan={15} style={{ border: '1px solid #c8bdd6' }}>
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
                        const stageCfg = dynamicStageConfig[lead._stageId];
                        const effectiveOwnerId = leadOwnerMap[lead.id] ?? lead.assigned_to;
                        const assignedName = effectiveOwnerId
                          ? (teamMemberMap[effectiveOwnerId] ?? null)
                          : null;
                        const assignedAvatar = effectiveOwnerId ? (teamAvatarMap[effectiveOwnerId] ?? null) : null;
                        const daysInStage = daysSince(lead.updated_at);
                        const inactiveDays = daysSince(lead.last_activity_at);
                        const tp = touchpoints[lead.id];
                        const isDetailOpen = detailDialogLead?.id === lead.id;
                        const isSelected = selectedLeadIds.has(lead.id);

                        const stickyBg = isDetailOpen
                          ? 'bg-[#eee6f6] dark:bg-purple-950 group-hover:bg-[#e0d4f0] dark:group-hover:bg-purple-900'
                          : isSelected
                            ? 'bg-[#eee6f6] dark:bg-violet-950/30 group-hover:bg-[#e0d4f0] dark:group-hover:bg-violet-900/40'
                            : 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted';

                        return (
                          <tr
                            key={lead.id}
                            onClick={() => handleRowClick(lead)}
                            className={`cursor-pointer transition-colors duration-100 group ${
                              isDetailOpen
                                ? 'bg-[#eee6f6] dark:bg-purple-950/30 hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40'
                                : isSelected
                                  ? 'bg-[#eee6f6]/60 dark:bg-violet-950/20 hover:bg-[#eee6f6]/80'
                                  : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                            }`}
                          >
                            {/* Deal + Checkbox (sticky) */}
                            <td className={`pl-2 pr-1.5 ${rowPad} overflow-hidden sticky left-0 z-[5] transition-colors ${stickyBg} ${isDetailOpen ? 'border-l-[3px] border-l-[#3b2778]' : ''}`} style={{ width: columnWidths.deal, border: '1px solid #c8bdd6', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                              <div className="flex items-center gap-2">
                                <div className={`shrink-0`} onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleLeadSelection(lead.id)}
                                    className="h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                                  />
                                </div>
                                <div className="flex items-center gap-2 min-w-0 flex-1 bg-[#f1f3f4] dark:bg-muted rounded-full pl-0.5 pr-3 py-0.5">
                                  <CrmAvatar name={lead.name} />
                                  <InlineEditableCell
                                    value={lead.opportunity_name || ''}
                                    onChange={(v) => handleInlineCellSave(lead.id, 'opportunity_name', v)}
                                    placeholder={lead.company_name ? `${lead.name} - ${lead.company_name}` : lead.name}
                                    displayClassName="text-[16px] text-[#202124] dark:text-foreground truncate"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/pipeline/potential/expanded-view/${lead.id}`); }}
                                  className="shrink-0 ml-auto -mr-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                                >
                                  <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
                                </button>
                                </div>
                            </td>

                            {/* Company */}
                            {columnVisibility.company && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.company, border: '1px solid #c8bdd6' }}>
                                <InlineEditableCell
                                  value={lead.company_name || ''}
                                  onChange={(v) => handleInlineCellSave(lead.id, 'company_name', v)}
                                  displayClassName="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full"
                                />
                              </td>
                            )}

                            {/* Contact */}
                            {columnVisibility.contact && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.contact, border: '1px solid #c8bdd6' }}>
                                <InlineEditableCell
                                  value={lead.name}
                                  onChange={(v) => handleInlineCellSave(lead.id, 'name', v)}
                                  displayClassName="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full"
                                />
                              </td>
                            )}

                            {/* Value */}
                            {columnVisibility.value && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.value, border: '1px solid #c8bdd6' }}>
                                <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted max-w-full">
                                  {lead.deal_value != null && <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                  <InlineEditableCell
                                    value={lead.deal_value != null ? lead.deal_value.toLocaleString('en-US') : ''}
                                    onChange={(v) => handleInlineCellSave(lead.id, 'deal_value', v)}
                                    placeholder="—"
                                    displayClassName="text-[16px] text-[#202124] dark:text-foreground tabular-nums truncate"
                                  />
                                </div>
                              </td>
                            )}

                            {/* Owner */}
                            {columnVisibility.ownedBy && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.ownedBy, border: '1px solid #c8bdd6' }}>
                                <InlineEditableCell
                                  type="select"
                                  value={effectiveOwnerId || ''}
                                  options={teamMembers.map(m => ({ id: m.id, label: m.name }))}
                                  onChange={(v) => handleInlineCellSave(lead.id, 'assigned_to', v)}
                                  placeholder="—"
                                />
                              </td>
                            )}

                            {/* Tasks */}
                            {columnVisibility.tasks && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.tasks, border: '1px solid #c8bdd6' }}>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">{taskCountMap[lead.id] ?? 0}</span>
                              </td>
                            )}

                            {/* Status */}
                            {columnVisibility.status && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.status ?? 100, border: '1px solid #c8bdd6' }}>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{lead.status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                              </td>
                            )}

                            {/* Stage */}
                            {columnVisibility.stage && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.stage, border: '1px solid #c8bdd6' }}>
                                <InlineEditableCell
                                  type="select"
                                  value={lead._stageId || ''}
                                  options={stages.map(s => ({ id: s.id, label: dynamicStageConfig[s.id]?.title || s.name }))}
                                  onChange={(v) => handleStageMove(lead.id, v)}
                                  placeholder="—"
                                />
                              </td>
                            )}

                            {/* Days in Stage */}
                            {columnVisibility.daysInStage && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.daysInStage, border: '1px solid #c8bdd6' }}>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">
                                  {daysInStage !== null ? `${daysInStage}d` : '—'}
                                </span>
                              </td>
                            )}

                            {/* Stage Updated */}
                            {columnVisibility.stageUpdated && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.stageUpdated, border: '1px solid #c8bdd6' }}>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground tabular-nums truncate max-w-full">{formatShortDate(lead.updated_at)}</span>
                              </td>
                            )}

                            {/* Last Contacted */}
                            {columnVisibility.lastContacted && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.lastContacted, border: '1px solid #c8bdd6' }}>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground tabular-nums truncate max-w-full">{formatShortDate(lead.last_activity_at)}</span>
                              </td>
                            )}

                            {/* Interactions */}
                            {columnVisibility.interactions && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.interactions, border: '1px solid #c8bdd6' }}>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">{interactionCountMap[lead.id] ?? 0}</span>
                              </td>
                            )}

                            {/* Inactive Days */}
                            {columnVisibility.inactiveDays && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.inactiveDays, border: '1px solid #c8bdd6' }}>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">
                                  {inactiveDays !== null ? `${inactiveDays}d` : '—'}
                                </span>
                              </td>
                            )}

                            {/* Tags */}
                            {columnVisibility.tags && (
                              <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.tags, border: '1px solid #c8bdd6' }}>
                                {lead.tags && lead.tags.length > 0 ? (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    {lead.tags.slice(0, 2).map((tag) => (
                                      <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[11px] font-medium text-[#202124] dark:text-foreground">
                                        {tag}
                                      </span>
                                    ))}
                                    {lead.tags.length > 2 && (
                                      <span className="text-[11px] text-muted-foreground font-medium">+{lead.tags.length - 2}</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Detail arrow */}
                            <td className={`px-2 ${rowPad} w-10`} style={{ border: '1px solid #c8bdd6' }}>
                              <PanelRightOpen className={`h-4 w-4 transition-all duration-150 ${
                                isDetailOpen
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
                          leadOwnerMap={leadOwnerMap}
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
                    <Card className="shadow-lg border border-blue-300 rotate-2 cursor-grabbing w-[280px] bg-card overflow-hidden">
                      <div className="p-3">
                        <p className="text-[13px] font-semibold text-foreground truncate">{draggedLead.name}</p>
                        {draggedLead.company_name && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Landmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{draggedLead.company_name}</span>
                          </div>
                        )}
                        {draggedLead.deal_value != null && draggedLead.deal_value > 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs font-medium text-foreground">{formatValue(draggedLead.deal_value)}</span>
                          </div>
                        )}
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
              
              onClose={() => setDetailDialogLead(null)}
              onExpand={() => {
                navigate(`/admin/pipeline/potential/expanded-view/${detailDialogLead.id}`);
              }}
              onStageChange={(leadId, newStatus) => {
                // Find the stage ID for this status
                const stageId = stages.find(s => s.name === newStatus || s.id === newStatus)?.id;
                if (stageId) handleStageMove(leadId, stageId);
              }}
              onLeadUpdate={(updatedLead) => {
                setDetailDialogLead(updatedLead);
                queryClient.invalidateQueries({ queryKey: ['potential-deals'] });
              }}
            />
          )}
        </div>
      </div>

      {/* Add Opportunity Dialog */}
      <Dialog open={addOpportunityOpen} onOpenChange={setAddOpportunityOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          <div className="px-6 pt-6 pb-4" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)' }}>
            <DialogHeader>
              <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                  <Plus className="h-4 w-4 text-white" />
                </div>
                New Opportunity
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {stages.map((stage) => {
                const cfg = dynamicStageConfig[stage.id];
                const isActive = addOpportunityStage === stage.id;
                return (
                  <button
                    key={stage.id}
                    onClick={() => setAddOpportunityStage(stage.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white text-slate-800 shadow-md scale-105 dark:bg-white/90 dark:text-slate-900'
                        : 'bg-white/15 text-white/90 hover:bg-white/25'
                    }`}
                  >
                    <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${isActive ? (cfg?.dot ?? 'bg-white/60') : 'bg-white/60'}`} />
                    {cfg?.title ?? stage.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="opp-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Opportunity Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="opp-name"
                placeholder="e.g. Riverside Plaza Acquisition"
                value={newOpp.name}
                onChange={(e) => setNewOpp(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && newOpp.name.trim()) handleCreateOpportunity(); }}
                className="h-10 rounded-xl border-border focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-muted-foreground/50"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opp-company" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company</Label>
              <Input
                id="opp-company"
                placeholder="Company name"
                value={newOpp.company_name}
                onChange={(e) => setNewOpp(prev => ({ ...prev, company_name: e.target.value }))}
                className="h-10 rounded-xl border-border focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-muted-foreground/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="opp-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</Label>
                <Input
                  id="opp-email"
                  placeholder="email@example.com"
                  type="email"
                  value={newOpp.email}
                  onChange={(e) => setNewOpp(prev => ({ ...prev, email: e.target.value }))}
                  className="h-10 rounded-xl border-border focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="opp-phone" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</Label>
                <Input
                  id="opp-phone"
                  placeholder="(555) 123-4567"
                  type="tel"
                  value={newOpp.phone}
                  onChange={(e) => setNewOpp(prev => ({ ...prev, phone: e.target.value }))}
                  className="h-10 rounded-xl border-border focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-muted-foreground/50"
                />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-muted/50 border-t border-border flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddOpportunityOpen(false)}
              className="h-9 px-4 rounded-xl text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateOpportunity}
              disabled={createOpportunityMutation.isPending}
              className="h-9 px-5 rounded-xl font-semibold"
              style={{ background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)' }}
            >
              {createOpportunityMutation.isPending ? 'Creating...' : 'Create Opportunity'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedLeadIds.size} {selectedLeadIds.size === 1 ? 'lead' : 'leads'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedLeadIds.size === 1 ? 'this lead' : 'these leads'} from the pipeline.
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
            <Label htmlFor="bulk-tags" className="text-sm font-medium">Tags (comma-separated)</Label>
            <Input
              id="bulk-tags"
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

export default Pipeline;
