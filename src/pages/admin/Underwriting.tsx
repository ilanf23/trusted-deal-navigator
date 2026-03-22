import { getLeadDisplayName } from '@/lib/utils';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EvanLayout from '@/components/evan/EvanLayout';
import PipelineSettingsPopover from '@/components/admin/PipelineSettingsDialog';
import UnderwritingDetailPanel from '@/components/admin/UnderwritingDetailPanel';
import CreateFilterDialog, { CustomFilterValues } from '@/components/admin/CreateFilterDialog';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import {
  ArrowUpDown,
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
  PanelRightOpen,
  Sparkles,
  Loader2,
  Download,
  PlusCircle,
  Maximize2,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import PipelineBulkToolbar from '@/components/admin/PipelineBulkToolbar';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useSystemPipelineByName } from '@/hooks/useSystemPipelineByName';
import { usePipelineStages } from '@/hooks/usePipelineStages';
import { usePipelineLeads, type FlatPipelineLead } from '@/hooks/usePipelineLeads';
import { usePipelineMutations } from '@/hooks/usePipelineMutations';
import { buildStageConfig } from '@/utils/pipelineStageConfig';
import { DbTableBadge } from '@/components/admin/DbTableBadge';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];


const FILTER_OPTIONS = [
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
  const avatarColor = getAvatarColor(lead.name);
  const initial = lead.name[0]?.toUpperCase() ?? '?';
  const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? null) : null;
  const dealValue = fakeValue(lead.id);
  const daysInStage = daysSince(lead.updated_at);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="group/card p-3 cursor-grab active:cursor-grabbing shadow-sm border border-border/60 hover:shadow-md transition-shadow bg-card"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`h-6 w-6 rounded-full ${avatarColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
            {initial}
          </div>
          <p className="text-sm font-semibold text-foreground leading-tight truncate">{getLeadDisplayName(lead)}</p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/pipeline/underwriting/expanded-view/${lead.id}`); }}
            className="ml-auto shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity hover:text-foreground"
          >
            <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
          </button>
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
  const { leads: pipelineLeadsList, isLoading: isPipelineLeadsLoading } = usePipelineLeads(pipeline?.id);
  const { moveLeadToStage, addLeadToPipeline, bulkRemoveLeadsFromPipeline } = usePipelineMutations(pipeline?.id);
  const dynamicStageConfig = useMemo(() => buildStageConfig(stages), [stages]);

  // ── Core state ──
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_activity_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

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
  const [publicFiltersOpen, setPublicFiltersOpen] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [customFilters, setCustomFilters] = useState<Array<{ id: string; label: string; values: CustomFilterValues }>>([]);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    company: true, contact: true, value: true, ownedBy: true, tasks: true,
    status: true, stage: true, daysInStage: true, stageUpdated: true, lastContacted: true,
    interactions: true, inactiveDays: true, tags: true,
  });

  const MIN_COLUMN_WIDTHS: Record<string, number> = useMemo(() => ({
    opportunity: 220, company: 100, contact: 100, value: 80, ownedBy: 80,
    tasks: 55, status: 100, stage: 120, daysInStage: 55, stageUpdated: 85,
    lastContacted: 90, interactions: 65, inactiveDays: 70, tags: 100,
  }), []);

  // User-saved widths from manual column resizing
  const [savedColumnWidths, setSavedColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('uw-col-widths-v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setSavedColumnWidths(prev => {
      const next = { ...prev, [columnId]: newWidth };
      localStorage.setItem('uw-col-widths-v2', JSON.stringify(next));
      return next;
    });
  }, []);

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
  const [addOpportunityOpen, setAddOpportunityOpen] = useState(false);
  const [addOpportunityStage, setAddOpportunityStage] = useState<string>('');
  const [newOpp, setNewOpp] = useState({ name: '', company_name: '', email: '', phone: '' });

  const createOpportunityMutation = useMutation({
    mutationFn: async (data: { name: string; company_name: string; email: string; phone: string; stageId: string }) => {
      const evanMember = teamMembers.find(m => m.name === 'Evan');
      const result = await addLeadToPipeline.mutateAsync({
        leadData: {
          name: data.name,
          company_name: data.company_name || undefined,
          email: data.email || undefined,
          phone: data.phone || undefined,
          assigned_to: evanMember?.id || null,
        },
        stageId: data.stageId,
      });
      return result;
    },
    onSuccess: (lead) => {
      setAddOpportunityOpen(false);
      setNewOpp({ name: '', company_name: '', email: '', phone: '' });
      toast.success(`"${lead.name}" added to ${dynamicStageConfig[addOpportunityStage]?.title ?? 'pipeline'}`);
      setSelectedLead(lead);
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
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, name, avatar_url')
        .eq('is_active', true);
      return (data || []) as { id: string; name: string; avatar_url: string | null }[];
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

  const leads = pipelineLeadsList;
  const isLoading = isPipelineLeadsLoading;

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

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    for (const stage of stages) {
      counts[stage.id] = leads.filter((l) => l._stageId === stage.id).length;
    }
    counts['my_open'] = leads.length;
    counts['open'] = leads.length;
    counts['following'] = 0;
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
  }, [leads, teamMemberMap, stages]);

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
  }, [leads, activeFilter, searchTerm, sortField, sortDir, teamMemberMap, customFilters]);

  const totalValue = useMemo(
    () => leads.reduce((sum, l) => sum + fakeValue(l.id), 0),
    [leads]
  );

  // Auto-fit column widths based on actual data content
  const columnWidths = useMemo(() => {
    const CHAR_W = 7.8; // approx px per char at 13px font
    const CHAR_W_SM = 6.5; // approx px per char at 11px font
    const CELL_PAD = 32; // px-4 each side

    const maxTextW = (items: (string | null | undefined)[], charWidth = CHAR_W, extra = 0) => {
      let max = 0;
      for (const s of items) {
        const len = (s ?? '').length;
        if (len > max) max = len;
      }
      return Math.ceil(max * charWidth + CELL_PAD + extra);
    };

    const auto: Record<string, number> = {};

    if (filteredAndSorted.length > 0) {
      // Opportunity: avatar(28) + gap(10) + name + expand btn(20)
      auto.opportunity = maxTextW(filteredAndSorted.map(l => getLeadDisplayName(l)), CHAR_W, 58);
      // Company: icon(24) + gap(8) + text
      auto.company = maxTextW(filteredAndSorted.map(l => l.company_name), CHAR_W, 32);
      // Contact: plain name text
      auto.contact = maxTextW(filteredAndSorted.map(l => l.name));
      // Value: formatted currency
      auto.value = maxTextW(filteredAndSorted.map(l => formatValue(fakeValue(l.id))));
      // Owner: avatar(24) + gap(8) + name
      auto.ownedBy = maxTextW(
        filteredAndSorted.map(l => teamMemberMap[l.assigned_to ?? ''] ?? ''),
        CHAR_W, 32
      );
      // Stage: dot(6) + gap(6) + label + badge padding(20)
      auto.stage = maxTextW(
        filteredAndSorted.map(l => dynamicStageConfig[l._stageId]?.title ?? l.status),
        CHAR_W_SM, 40
      );
    }

    // Merge: minimums → auto-fit → user-saved overrides
    const merged: Record<string, number> = { ...MIN_COLUMN_WIDTHS };
    for (const key of Object.keys(merged)) {
      if (auto[key] !== undefined) {
        merged[key] = Math.max(merged[key], auto[key]);
      }
      if (savedColumnWidths[key] !== undefined) {
        merged[key] = savedColumnWidths[key];
      }
    }
    return merged;
  }, [filteredAndSorted, teamMemberMap, savedColumnWidths, MIN_COLUMN_WIDTHS]);

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
    mutationFn: async (pipelineLeadIds: string[]) => {
      const { error } = await supabase
        .from('pipeline_leads')
        .delete()
        .in('id', pipelineLeadIds);
      if (error) throw error;
      return pipelineLeadIds;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads', pipeline?.id] });
      toast.success(`${ids.length} lead(s) removed from pipeline`);
      clearSelection();
      setDeleteConfirmOpen(false);
    },
    onError: () => toast.error('Failed to delete leads'),
  });

  const handleBulkDelete = () => {
    const pipelineLeadIds = filteredAndSorted
      .filter(l => selectedLeadIds.has(l.id))
      .map(l => (l as any)._pipelineLeadId as string)
      .filter(Boolean);
    if (pipelineLeadIds.length > 0) {
      bulkDeleteMutation.mutate(pipelineLeadIds);
    }
  };

  // Bulk assign owner mutation
  const bulkAssignOwnerMutation = useMutation({
    mutationFn: async ({ leadIds, ownerId }: { leadIds: string[]; ownerId: string }) => {
      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: ownerId })
        .in('id', leadIds);
      if (error) throw error;
      return { leadIds, ownerId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads', pipeline?.id] });
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
        .from('leads')
        .select('id, tags')
        .in('id', leadIds);
      if (fetchError) throw fetchError;

      for (const lead of (currentLeads || [])) {
        const existingTags: string[] = (lead.tags as string[]) || [];
        const mergedTags = Array.from(new Set([...existingTags, ...tags]));
        const { error } = await supabase
          .from('leads')
          .update({ tags: mergedTags })
          .eq('id', lead.id);
        if (error) throw error;
      }
      return { count: leadIds.length, tags };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads', pipeline?.id] });
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
  const rowPad = rowDensity === 'comfortable' ? 'py-2.5' : 'py-1';

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

  // Toolbar icon button base class
  const iconBtn = (active = false) =>
    `relative flex items-center justify-center h-7 w-7 rounded transition-all ${
      active
        ? 'bg-card shadow-sm text-foreground border border-border'
        : 'text-muted-foreground hover:bg-card hover:shadow-sm hover:text-foreground hover:border hover:border-border'
    }`;

  return (
    <EvanLayout>
      <div className="underwriting-font flex flex-col h-full min-h-0 overflow-hidden bg-background">

        {/* ── CRM-Style Header ── */}
        <div className="shrink-0 border-b border-border bg-background px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-[15px] font-bold text-foreground whitespace-nowrap">All Opportunities</h1>
            <DbTableBadge tables={['leads']} />
          </div>

          <div className="flex-1 min-w-0" />

          {/* Connected toolbar — Table | Kanban | Sort | Settings */}
          <div className="flex items-center h-7 gap-0.5 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              title="Table view"
              className={`flex items-center justify-center h-full px-2 rounded-md transition-all ${
                viewMode === 'table'
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              title="Kanban view"
              className={`flex items-center justify-center h-full px-2 rounded-md transition-all ${
                viewMode === 'kanban'
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Sort"
                  className={`flex items-center justify-center h-full px-2 rounded-md transition-all ${
                    isNonDefaultSort
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-muted-foreground hover:text-foreground'
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
            <PipelineSettingsPopover open={settingsOpen} onOpenChange={setSettingsOpen} />
          </div>

          {/* Add Opportunity button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="group relative h-9 pl-4 pr-3 text-[13px] font-semibold rounded-full shrink-0 flex items-center gap-2 text-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                style={{ background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)' }}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                <span>Add Opportunity</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-xl border border-border bg-popover">
              <DropdownMenuItem
                onClick={() => openAddDialog()}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-[14px] font-medium text-foreground hover:bg-muted focus:bg-muted transition-colors"
              >
                <PlusCircle className="h-4.5 w-4.5 text-muted-foreground" />
                Add Opportunity
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-[14px] font-medium text-foreground hover:bg-muted focus:bg-muted transition-colors"
              >
                <Download className="h-4.5 w-4.5 text-muted-foreground" />
                Import Opportunities
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search bar */}
        <div className="shrink-0 px-5 py-2.5 border-b border-border bg-background">
          <Input
            type="text"
            placeholder="Search by name, email, domain or phone number"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-9 px-3 text-sm rounded-full bg-muted/50 border-transparent focus:border-border focus:bg-background placeholder:text-muted-foreground/60"
          />
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
                <CreateFilterDialog
                  teamMemberMap={teamMemberMap}
                  stageConfig={dynamicStageConfig}
                  onSave={(filter) => {
                    const id = `custom_${Date.now()}`;
                    setCustomFilters(prev => [...prev, { id, label: filter.filterName, values: filter }]);
                    toast.success(`Filter "${filter.filterName}" created`);
                  }}
                />
              </div>

              <nav className="flex-1 overflow-y-auto pb-4">
                {FILTER_OPTIONS.filter(o => o.group === 'top').map((opt) => {
                  const isActive = activeFilter === opt.id;
                  const count = filterCounts[opt.id] ?? 0;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setActiveFilter(opt.id)}
                      className={`relative w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                        isActive ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {isActive && <span className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-r-full bg-blue-600" />}
                      <span className={`text-[13px] font-medium truncate ${isActive ? 'text-blue-700 dark:text-blue-400' : ''}`}>{opt.label}</span>
                      {count > 0 && (
                        <span className={`ml-1 shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-600 text-white' : 'text-muted-foreground'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPublicFiltersOpen(v => !v)}
                  className="w-full px-3 pt-3 pb-1 flex items-center justify-between group"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Public</span>
                  <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${publicFiltersOpen ? '' : '-rotate-90'}`} />
                </button>

                {publicFiltersOpen && FILTER_OPTIONS.filter(o => o.group === 'public').map((opt) => {
                  const isActive = activeFilter === opt.id;
                  const count = filterCounts[opt.id] ?? 0;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setActiveFilter(opt.id)}
                      className={`relative w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                        isActive ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {isActive && <span className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-r-full bg-blue-600" />}
                      <span className={`text-[13px] truncate ${isActive ? 'font-medium text-blue-700 dark:text-blue-400' : ''}`}>{opt.label}</span>
                      {count > 0 && (
                        <span className={`ml-1 shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-600 text-white' : 'text-muted-foreground'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Custom Filters */}
                {customFilters.length > 0 && (
                  <>
                    <div className="px-3 pt-3 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Custom</span>
                    </div>
                    {customFilters.map((cf) => {
                      const isActive = activeFilter === cf.id;
                      return (
                        <button
                          key={cf.id}
                          onClick={() => setActiveFilter(cf.id)}
                          className={`relative w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                            isActive ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {isActive && <span className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-r-full bg-blue-600" />}
                          <span className={`text-[13px] truncate ${isActive ? 'font-medium text-blue-700 dark:text-blue-400' : ''}`}>{cf.label}</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </nav>
            </div>
          </aside>

          {/* ── Main Table Area ── */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* ── Toolbar ── */}
            <div className="shrink-0 border-b border-border px-3 py-2 flex items-center justify-between gap-2 bg-muted/50">

              {/* Left group: view toggles */}
              <div className="flex items-center gap-2">


                {/* Sidebar toggle */}
                <button
                  onClick={() => setSidebarOpen(v => !v)}
                  title={sidebarOpen ? 'Hide filters' : 'Show filters'}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border text-xs font-medium transition-all bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <PanelLeft className="h-3.5 w-3.5 shrink-0" />
                </button>

                {!isLoading && (
                  <span className="text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                    # {filteredAndSorted.length.toLocaleString()} {filteredAndSorted.length === 1 ? 'opportunity' : 'opportunities'}
                  </span>
                )}
                {!isLoading && (
                  <span className="text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                    ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                )}

                {/* Sort indicator */}
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

              {/* Right group: action buttons + CTA */}
              <div className="flex items-center gap-0.5">

                {/* Sort */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      title="Sort options"
                      className={iconBtn(isNonDefaultSort)}
                    >
                      <ArrowUpDown className={`h-3.5 w-3.5 ${isNonDefaultSort ? 'text-blue-600' : ''}`} />
                      {isNonDefaultSort && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-600" />
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
                    <X className="h-3.5 w-3.5 text-blue-600" />
                  ) : (
                    <Filter className="h-3.5 w-3.5" />
                  )}
                  {isFiltersActive && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-600" />
                  )}
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

            {/* Bulk Selection Toolbar */}
            {selectedLeadIds.size > 0 && (
              <div className="mb-3">
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

            {/* ── Content Area: Table or Kanban ── */}
            {viewMode === 'table' ? (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                  <thead className="border-b border-border">
                    <tr>
                      <th className="w-10 px-4 py-3 sticky top-0 left-0 z-30 bg-gray-100 dark:bg-muted">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={(checked) => checked ? selectAll() : clearSelection()}
                          className="h-4 w-4 rounded-none border-slate-300 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                        />
                      </th>
                      <ColHeader className="sticky top-0 z-30 bg-gray-100 dark:bg-muted border-r border-border/50" style={{ left: 40 }}>
                        Opportunity
                      </ColHeader>
                      <ColHeader colKey="company" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Company
                      </ColHeader>
                      <ColHeader colKey="contact" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Contact
                      </ColHeader>
                      <ColHeader colKey="value" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Value
                      </ColHeader>
                      <ColHeader colKey="ownedBy" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Owner
                      </ColHeader>
                      <ColHeader colKey="tasks" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Tasks
                      </ColHeader>
                      <ColHeader colKey="status" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Status
                      </ColHeader>
                      <ColHeader colKey="stage" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Stage
                      </ColHeader>
                      <ColHeader colKey="daysInStage" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Days
                      </ColHeader>
                      <ColHeader colKey="stageUpdated" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Updated
                      </ColHeader>
                      <ColHeader colKey="lastContacted" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Contacted
                      </ColHeader>
                      <ColHeader colKey="interactions" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Activity
                      </ColHeader>
                      <ColHeader colKey="inactiveDays" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Dormant
                      </ColHeader>
                      <ColHeader colKey="tags" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Tags
                      </ColHeader>
                      <th className="w-10 px-2 py-3 sticky top-0 z-10 bg-white dark:bg-card" />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 7 }).map((_, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                          <td className="px-4 py-3.5 w-10 sticky left-0 z-[5] bg-white dark:bg-card"><Skeleton className="h-4 w-4 rounded" /></td>
                          <td className="px-4 py-3.5 sticky z-[5] border-r border-border/50 bg-white dark:bg-card" style={{ width: columnWidths.opportunity, left: 40 }}>
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
                          {columnVisibility.value && <td className="px-4 py-3.5" style={{ width: columnWidths.value }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                          {columnVisibility.ownedBy && <td className="px-4 py-3.5" style={{ width: columnWidths.ownedBy }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.tasks && <td className="px-4 py-3.5" style={{ width: columnWidths.tasks }}><Skeleton className="h-3.5 w-8 rounded" /></td>}
                          {columnVisibility.status && <td className="px-4 py-3.5" style={{ width: columnWidths.status ?? 100 }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.stage && <td className="px-4 py-3.5" style={{ width: columnWidths.stage }}><Skeleton className="h-5 w-28 rounded-full" /></td>}
                          {columnVisibility.daysInStage && <td className="px-4 py-3.5" style={{ width: columnWidths.daysInStage }}><Skeleton className="h-3.5 w-10 rounded" /></td>}
                          {columnVisibility.stageUpdated && <td className="px-4 py-3.5" style={{ width: columnWidths.stageUpdated }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.lastContacted && <td className="px-4 py-3.5" style={{ width: columnWidths.lastContacted }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.interactions && <td className="px-4 py-3.5" style={{ width: columnWidths.interactions }}><Skeleton className="h-3.5 w-8 rounded" /></td>}
                          {columnVisibility.inactiveDays && <td className="px-4 py-3.5" style={{ width: columnWidths.inactiveDays }}><Skeleton className="h-3.5 w-10 rounded" /></td>}
                          {columnVisibility.tags && <td className="px-4 py-3.5" style={{ width: columnWidths.tags }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                        </tr>
                      ))
                    ) : filteredAndSorted.length === 0 ? (
                      <tr>
                        <td colSpan={15}>
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
                        const initial = lead.name[0]?.toUpperCase() ?? '?';
                        const avatarColor = getAvatarColor(lead.name);
                        const stageCfg = dynamicStageConfig[lead._stageId];
                        const assignedName = lead.assigned_to
                          ? (teamMemberMap[lead.assigned_to] ?? null)
                          : null;
                        const assignedInitial = assignedName?.[0]?.toUpperCase() ?? null;
                        const assignedColor = assignedName ? getAvatarColor(assignedName) : '';
                        const assignedAvatar = lead.assigned_to ? (teamAvatarMap[lead.assigned_to] ?? null) : null;
                        const taskCount = taskCountMap[lead.id] ?? fakeTasks(lead.id);
                        const interactionCount = interactionCountMap[lead.id] ?? fakeInteractions(lead.id);
                        const daysInStage = daysSince(lead.updated_at);
                        const inactiveDays = daysSince(lead.last_activity_at);
                        const isStale = inactiveDays !== null && inactiveDays > 7;
                        const isLingering = daysInStage !== null && daysInStage > 14;
                        const dealValue = fakeValue(lead.id);
                        const isDetailSelected = selectedLead?.id === lead.id;
                        const isBulkSelected = selectedLeadIds.has(lead.id);

                        const stickyBg = isDetailSelected
                          ? 'bg-blue-50 dark:bg-blue-950 group-hover:bg-blue-100 dark:group-hover:bg-blue-900'
                          : 'bg-white dark:bg-card group-hover:bg-gray-50 dark:group-hover:bg-muted';

                        return (
                          <tr
                            key={lead.id}
                            onClick={() => handleRowClick(lead)}
                            className={`cursor-pointer transition-colors duration-100 group border-b border-border/60 last:border-b-0 ${
                              isDetailSelected
                                ? 'bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-50/80 dark:hover:bg-blue-950/40'
                                : isBulkSelected
                                  ? 'bg-violet-50/60 dark:bg-violet-950/20 hover:bg-violet-50/80'
                                  : rowIdx % 2 === 0
                                    ? 'bg-card hover:bg-muted/50'
                                    : 'bg-muted/30 hover:bg-muted/50'
                            }`}
                          >
                            {/* Checkbox */}
                            <td
                              className={`px-4 py-3 w-10 sticky left-0 z-[5] transition-colors ${stickyBg}`}
                              onClick={(e) => { e.stopPropagation(); toggleLeadSelection(lead.id); }}
                            >
                              <Checkbox
                                checked={isBulkSelected}
                                onCheckedChange={() => toggleLeadSelection(lead.id)}
                                className="h-4 w-4 rounded-none border-slate-300 data-[state=checked]:bg-violet-500 data-[state=checked]:border-violet-500"
                              />
                            </td>

                            {/* Opportunity */}
                            <td className={`px-4 py-3 overflow-hidden sticky z-[5] border-r border-border/50 transition-colors ${stickyBg}`} style={{ width: columnWidths.opportunity, left: 40 }}>
                              <div className="flex items-center gap-2.5">
                                <div className={`h-7 w-7 rounded-full ${avatarColor} flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm`}>
                                  {initial}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-semibold text-foreground truncate text-[13px] leading-tight">
                                      {getLeadDisplayName(lead)}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/pipeline/underwriting/expanded-view/${lead.id}`); }}
                                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                                    >
                                      <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
                                    </button>
                                  </div>
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
                                    <span className="text-[13px] text-foreground/80 truncate">{lead.company_name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Contact */}
                            {columnVisibility.contact && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.contact }}>
                                <span className="text-[13px] text-foreground/80 truncate block">{lead.name}</span>
                              </td>
                            )}

                            {/* Value */}
                            {columnVisibility.value && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.value }}>
                                <span className="text-[13px] text-foreground font-semibold tabular-nums tracking-tight">{formatValue(dealValue)}</span>
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
                                    <span className="text-[13px] text-foreground/80 truncate">{assignedName}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/40 text-[13px]">—</span>
                                )}
                              </td>
                            )}

                            {/* Tasks */}
                            {columnVisibility.tasks && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.tasks }}>
                                {taskCount > 0 ? (
                                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-md bg-muted text-[11px] font-bold text-foreground/70">
                                    {taskCount}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40 text-[13px]">0</span>
                                )}
                              </td>
                            )}

                            {/* Status */}
                            {columnVisibility.status && (
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.status ?? 100 }}>
                                <span className="text-[12px] text-muted-foreground">{lead.status}</span>
                              </td>
                            )}

                            {/* Stage */}
                            {columnVisibility.stage && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.stage }}>
                                {stageCfg ? (
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${stageCfg.bg} ${stageCfg.textColor}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${stageCfg.dot}`} />
                                    {stageCfg.label}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">{lead._stageName ?? lead.status}</span>
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

                            {/* Stage Updated */}
                            {columnVisibility.stageUpdated && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.stageUpdated }}>
                                <span className="text-[12px] text-muted-foreground tabular-nums">{formatShortDate(lead.updated_at)}</span>
                              </td>
                            )}

                            {/* Last Contacted */}
                            {columnVisibility.lastContacted && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.lastContacted }}>
                                <span className="text-[12px] text-muted-foreground tabular-nums">{formatShortDate(lead.last_activity_at)}</span>
                              </td>
                            )}

                            {/* Interactions */}
                            {columnVisibility.interactions && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.interactions }}>
                                {interactionCount > 0 ? (
                                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                    {interactionCount}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40 text-[13px]">0</span>
                                )}
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
                                isDetailSelected
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
                        <div className={`h-5 w-5 rounded-full ${getAvatarColor(draggedLead.name)} flex items-center justify-center text-white text-[10px] font-bold`}>
                          {draggedLead.name[0]?.toUpperCase()}
                        </div>
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
                queryClient.invalidateQueries({ queryKey: ['pipeline-leads', pipeline?.id] });
              }}
            />
          )}
        </div>
      </div>



      {/* ── Add Opportunity Dialog ── */}
      <Dialog open={addOpportunityOpen} onOpenChange={setAddOpportunityOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          {/* Header with gradient */}
          <div className="px-6 pt-6 pb-4" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)' }}>
            <DialogHeader>
              <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                  <Plus className="h-4 w-4 text-white" />
                </div>
                New Opportunity
              </DialogTitle>
            </DialogHeader>
            {/* Stage selector pills */}
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

          {/* Form body */}
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

          {/* Footer */}
          <div className="px-6 py-4 bg-muted/50 border-t border-border flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddOpportunityOpen(false)}
              className="h-9 px-4 rounded-xl text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <button
              onClick={handleCreateOpportunity}
              disabled={!newOpp.name.trim() || createOpportunityMutation.isPending}
              className="h-9 px-5 rounded-xl text-[13px] font-semibold text-white flex items-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
              style={{ background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)' }}
            >
              {createOpportunityMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Create Opportunity
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
    </EvanLayout>
  );
};

export default Underwriting;
