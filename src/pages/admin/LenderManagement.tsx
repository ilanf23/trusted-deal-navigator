import { getLeadDisplayName } from '@/lib/utils';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EvanLayout from '@/components/evan/EvanLayout';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import PipelineDetailPanel from '@/components/admin/PipelineDetailPanel';
import PipelineBulkToolbar from '@/components/admin/PipelineBulkToolbar';
import PipelineSettingsPopover from '@/components/admin/PipelineSettingsDialog';
import CreateFilterDialog, { CustomFilterValues } from '@/components/admin/CreateFilterDialog';
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
  ChevronUp,
  Plus,
  DollarSign,
  Check,
  X,
  LayoutGrid,
  Table2,
  PanelRightOpen,
  FileSearch,
  Building2,
  Flame,
  Maximize2,
  Download,
  PlusCircle,
  Search,
  Bookmark,
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
import { usePipelineLeads, type FlatPipelineLead } from '@/hooks/usePipelineLeads';
import { usePipelineMutations } from '@/hooks/usePipelineMutations';
import { buildStageConfig } from '@/utils/pipelineStageConfig';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];


const AVATAR_COLORS = [
  'bg-[#5C9EAD]', 'bg-[#4CAF50]', 'bg-[#C62828]', 'bg-[#EF6C00]',
  'bg-[#546E7A]', 'bg-[#26A69A]', 'bg-[#6D8B74]', 'bg-[#3E7CB1]',
  'bg-[#8D6E63]', 'bg-[#78909C]',
];

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Opportunities', group: 'top' },
  { id: 'my_open', label: 'My Open Opportunities', group: 'public' },
  { id: 'open', label: 'Open Opportunities', group: 'public' },
  { id: 'following', label: "Opportunities I'm Following", group: 'public' },
  { id: 'won', label: 'Won Opportunities', group: 'public' },
  { id: 'closed_2025', label: 'Closed Loans 2025', group: 'public' },
  { id: 'closed_2026', label: 'Closed Loans 2026', group: 'public' },
  { id: 'weeklys', label: "Weekly's", group: 'public' },
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

function fakeIsFollowing(id: string): boolean {
  return seededRand(id, 4) < 0.3;
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
          <p className="text-sm font-semibold text-foreground leading-tight truncate flex-1">{getLeadDisplayName(lead)}</p>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/pipeline/lender-management/expanded-view/${lead.id}`); }}
            className="shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity"
          >
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            {formatValue(dealValue)}
          </span>
          {daysInStage !== null && (
            <span className={`text-[10px] font-medium ${daysInStage > 14 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
              {daysInStage}d
            </span>
          )}
        </div>
        {assignedName && (
          <p className="text-[10px] text-muted-foreground mt-1">{assignedName}</p>
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
  const [publicFiltersOpen, setPublicFiltersOpen] = useState(true);
  const [draggedLead, setDraggedLead] = useState<FlatPipelineLead | null>(null);

  // Column sort menu state
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);

  // Custom filters
  const [customFilters, setCustomFilters] = useState<Array<{ id: string; label: string; values: CustomFilterValues }>>([]);

  // Add Opportunity state
  const [addOpportunityOpen, setAddOpportunityOpen] = useState(false);
  const [addOpportunityStage, setAddOpportunityStage] = useState<string>('');
  const [newOpp, setNewOpp] = useState({ name: '', company_name: '', email: '', phone: '' });

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
      <Input
        type="text"
        placeholder="Search by name, email, domain or phone number"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full h-9 px-4 text-sm rounded-full bg-[#f1f3f4] dark:bg-muted/50 border-transparent focus:border-[#d2d5d9] dark:focus:border-border focus:bg-white dark:focus:bg-background placeholder:text-[#5f6368]/70 dark:placeholder:text-muted-foreground/60"
      />
    );
  }, [searchTerm]);

  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    company: true, contact: true, value: true, ownedBy: true, tasks: true,
    status: true, stage: true, daysInStage: true, stageUpdated: true, lastContacted: true,
    interactions: true, inactiveDays: true, tags: true,
  });

  const DEFAULT_COLUMN_WIDTHS: Record<string, number> = useMemo(() => ({
    deal: 200, company: 130, contact: 110, value: 90, ownedBy: 80,
    tasks: 55, status: 100, stage: 160, daysInStage: 55, stageUpdated: 85,
    lastContacted: 90, interactions: 65, inactiveDays: 70, tags: 100,
  }), []);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('lm-column-widths');
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
      localStorage.setItem('lm-column-widths', JSON.stringify(next));
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
  const { leads: pipelineLeadsList, isLoading: isPipelineLeadsLoading } = usePipelineLeads(pipeline?.id);
  const { moveLeadToStage, addLeadToPipeline } = usePipelineMutations(pipeline?.id);
  const dynamicStageConfig = useMemo(() => buildStageConfig(stages), [stages]);

  const leads = pipelineLeadsList;
  const isLoading = isPipelineLeadsLoading;

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['lm-team-members'],
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

  // Create opportunity mutation
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
      setDetailDialogLead(lead as any);
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
    queryKey: ['lm-task-counts'],
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

  // Filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    for (const stage of stages) {
      counts[stage.id] = leads.filter((l) => l._stageId === stage.id).length;
    }
    counts['my_open'] = leads.length;
    counts['open'] = leads.length;
    counts['following'] = leads.filter(l => fakeIsFollowing(l.id)).length;
    counts['won'] = leads.filter(l => l.status === 'won' as any).length;
    counts['closed_2025'] = leads.filter(l => fakeClosedYear(l.id) === 2025).length;
    counts['closed_2026'] = leads.filter(l => fakeClosedYear(l.id) === 2026).length;
    counts['weeklys'] = leads.filter(l => fakeIsWeekly(l.id)).length;
    return counts;
  }, [leads, stages]);

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let result = leads;

    if (activeFilter !== 'all') {
      if (stages.some(s => s.id === activeFilter)) {
        result = result.filter((l) => l._stageId === activeFilter);
      } else if (activeFilter === 'won') {
        result = result.filter((l) => l.status === ('won' as LeadStatus));
      } else if (activeFilter === 'following') {
        result = result.filter((l) => fakeIsFollowing(l.id));
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
  }, [leads, activeFilter, searchTerm, sortField, sortDir, teamMemberMap, stages]);

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
    <EvanLayout>
      <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background system-font">

        {/* ── Body: Sidebar + Table ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden gap-3">


          {/* ── Left Sidebar (Copper style) ── */}
          <aside
            className={`shrink-0 border-r border-[#e8eaed] dark:border-border bg-[#f8f9fa] dark:bg-muted/30 flex flex-col overflow-hidden transition-all duration-200 ${
              sidebarOpen ? 'w-72' : 'w-0 border-r-0'
            }`}
          >
            <div className="w-72 pl-4 flex-1 overflow-y-auto">
              <div className="px-6 pt-3 pb-2 flex items-center justify-between">
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
                    className="w-full h-8 px-3 text-[13px] rounded-lg bg-[#f1f3f4] dark:bg-muted/50 border border-[#dadce0] dark:border-border text-[#1f1f1f] dark:text-foreground placeholder:text-[#80868b] dark:placeholder:text-muted-foreground/60 outline-none focus:border-[#1a73e8] dark:focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <nav className="flex-1 overflow-y-auto pb-4">
                {/* All Opportunities — top item */}
                {FILTER_OPTIONS.filter(o => o.group === 'top').map((opt) => {
                  const isActive = activeFilter === opt.id;
                  const count = filterCounts[opt.id] ?? 0;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setActiveFilter(opt.id)}
                      className={`relative w-full flex items-center justify-between px-6 py-3 text-left transition-colors ${
                        isActive ? 'bg-[#eee6f6] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400' : 'text-[#3c4043] dark:text-muted-foreground hover:bg-[#f1f3f4] dark:hover:bg-muted hover:text-[#1f1f1f] dark:hover:text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Bookmark className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-[#3b2778] dark:text-purple-400' : 'text-[#80868b] dark:text-muted-foreground'}`} />
                        <span className={`text-[14px] font-medium truncate`}>{opt.label}</span>
                      </span>
                      {count > 0 && (
                        <span className="ml-1 shrink-0 text-[11px] font-medium text-[#5f6368] dark:text-muted-foreground">
                          {count.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Public section */}
                <button
                  onClick={() => setPublicFiltersOpen(v => !v)}
                  className="w-full px-6 pt-4 pb-1 flex items-center justify-between group"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5f6368] dark:text-muted-foreground">Public</span>
                  <ChevronUp className={`h-3.5 w-3.5 text-[#80868b] dark:text-muted-foreground transition-transform duration-200 ${publicFiltersOpen ? '' : 'rotate-180'}`} />
                </button>

                {publicFiltersOpen && FILTER_OPTIONS.filter(o => o.group === 'public').map((opt) => {
                  const isActive = activeFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setActiveFilter(opt.id)}
                      className={`relative w-full flex items-center px-6 py-2.5 text-left transition-colors ${
                        isActive ? 'bg-[#eee6f6] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400' : 'text-[#3c4043] dark:text-muted-foreground hover:bg-[#f1f3f4] dark:hover:bg-muted hover:text-[#1f1f1f] dark:hover:text-foreground'
                      }`}
                    >
                      <span className={`text-[14px] truncate ${isActive ? 'font-medium' : ''}`}>{opt.label}</span>
                    </button>
                  );
                })}

                {/* Custom Filters */}
                {customFilters.length > 0 && (
                  <>
                    <div className="px-6 pt-4 pb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5f6368] dark:text-muted-foreground">Custom</span>
                    </div>
                    {customFilters.map((cf) => {
                      const isActive = activeFilter === cf.id;
                      return (
                        <button
                          key={cf.id}
                          onClick={() => setActiveFilter(cf.id)}
                          className={`relative w-full flex items-center px-6 py-2.5 text-left transition-colors ${
                            isActive ? 'bg-[#eee6f6] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400' : 'text-[#3c4043] dark:text-muted-foreground hover:bg-[#f1f3f4] dark:hover:bg-muted hover:text-[#1f1f1f] dark:hover:text-foreground'
                          }`}
                        >
                          <span className={`text-[14px] truncate ${isActive ? 'font-medium' : ''}`}>{cf.label}</span>
                        </button>
                      );
                    })}
                  </>
                )}
              </nav>
            </div>
            <div className="w-72 shrink-0 border-t border-[#e8eaed] dark:border-border px-6 py-3">
              <button
                onClick={() => setSidebarOpen(false)}
                title="Hide filters"
                className="flex items-center gap-2 text-[13px] font-medium text-black dark:text-foreground hover:text-[#5f6368] dark:hover:text-muted-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Hide Filters</span>
              </button>
            </div>
          </aside>

          {/* Main Table Area */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* ── Copper-Style Content Title Bar ── */}
            <div className="shrink-0 border-b-0 px-4 py-2.5 flex items-center justify-between gap-3 bg-white dark:bg-background">

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(v => !v)}
                  title={sidebarOpen ? 'Hide filters' : 'Show filters'}
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] dark:hover:bg-muted transition-colors text-[#5f6368] dark:text-muted-foreground"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>

                <h2 className="text-[16px] font-bold text-[#1f1f1f] dark:text-foreground whitespace-nowrap">
                  {FILTER_OPTIONS.find(o => o.id === activeFilter)?.label ?? customFilters.find(cf => cf.id === activeFilter)?.label ?? 'All Opportunities'}
                </h2>
                <Bookmark className="h-4 w-4 text-[#80868b] dark:text-muted-foreground shrink-0" />
                {!isLoading && (
                  <span className="text-[#5f6368] dark:text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                    # {filteredAndSorted.length.toLocaleString()} {filteredAndSorted.length === 1 ? 'deal' : 'deals'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Sort */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      title="Sort options"
                      className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${
                        isNonDefaultSort ? 'bg-[#eee6f6] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400' : 'hover:bg-[#f1f3f4] dark:hover:bg-muted text-[#5f6368] dark:text-muted-foreground'
                      }`}
                    >
                      <BarChart3 className="h-4 w-4" />
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

                {/* Filter */}
                <button
                  onClick={isFiltersActive ? clearAllFilters : undefined}
                  title={isFiltersActive ? 'Clear all filters' : 'No active filters'}
                  className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${
                    isFiltersActive ? 'bg-[#eee6f6] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400' : 'hover:bg-[#f1f3f4] dark:hover:bg-muted text-[#5f6368] dark:text-muted-foreground'
                  }`}
                >
                  {isFiltersActive ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
                </button>

                {/* Column visibility */}
                <div className="relative" ref={columnsMenuRef}>
                  <button
                    onClick={() => setShowColumnsMenu(v => !v)}
                    title="Show/hide columns"
                    className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${
                      showColumnsMenu ? 'bg-[#eee6f6] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400' : 'hover:bg-[#f1f3f4] dark:hover:bg-muted text-[#5f6368] dark:text-muted-foreground'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>

                  {showColumnsMenu && (
                    <div className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-popover border border-[#dadce0] dark:border-border rounded-lg shadow-lg w-52 py-1.5 overflow-hidden">
                      <div className="px-3 py-1.5 border-b border-[#dadce0] dark:border-border">
                        <p className="text-[11px] font-semibold text-[#5f6368] dark:text-muted-foreground uppercase tracking-wider">Visible Columns</p>
                      </div>
                      <div className="py-1">
                        {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
                          <button
                            key={key}
                            onClick={() => toggleColumn(key)}
                            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#f1f3f4] dark:hover:bg-muted transition-colors"
                          >
                            <span className="text-[13px] text-[#1f1f1f] dark:text-foreground">{COLUMN_LABELS[key]}</span>
                            <span className={`flex items-center justify-center h-4 w-4 rounded border transition-colors ${
                              columnVisibility[key]
                                ? 'bg-[#1a73e8] border-[#1a73e8]'
                                : 'border-[#dadce0] dark:border-border bg-white dark:bg-card'
                            }`}>
                              {columnVisibility[key] && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="px-3 py-1.5 border-t border-[#dadce0] dark:border-border">
                        <button
                          onClick={() => {
                            const allTrue = Object.fromEntries(
                              (Object.keys(COLUMN_LABELS) as ColumnKey[]).map(k => [k, true])
                            ) as Record<ColumnKey, boolean>;
                            setColumnVisibility(allTrue);
                          }}
                          className="text-[11px] text-[#1a73e8] hover:text-[#174ea6] font-medium"
                        >
                          Show all columns
                        </button>
                      </div>
                    </div>
                  )}
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
                <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
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
                      <ColHeader colKey="tags" className="sticky top-0 z-10">
                        <Tag className="h-4 w-4" /> Tags
                      </ColHeader>
                      <th className="w-10 px-2 py-1.5 sticky top-0 z-10 bg-white dark:bg-background" style={{ border: '1px solid #c8bdd6' }} />
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
                        const daysInStage = daysSince(lead.updated_at);
                        const inactiveDays = daysSince(lead.last_activity_at);
                        const isStale = inactiveDays !== null && inactiveDays > 7;
                        const isLingering = daysInStage !== null && daysInStage > 14;
                        const tp = touchpoints[lead.id];
                        const isDetailOpen = detailDialogLead?.id === lead.id;
                        const isSelected = selectedLeadIds.has(lead.id);

                        const stickyBg = isDetailOpen
                          ? 'bg-[#e8f0fe] dark:bg-blue-950 group-hover:bg-[#d2e3fc] dark:group-hover:bg-blue-900'
                          : isSelected
                            ? 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted'
                            : 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted';

                        return (
                          <tr
                            key={lead.id}
                            onClick={() => handleRowClick(lead)}
                            className={`cursor-pointer transition-colors duration-100 group ${
                              isDetailOpen
                                ? 'bg-[#e8f0fe] dark:bg-blue-950/30 hover:bg-[#d2e3fc] dark:hover:bg-blue-950/40'
                                : isSelected
                                  ? 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                                  : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                            }`}
                          >
                            {/* Deal + Checkbox (sticky) */}
                            <td className={`pl-2 pr-4 ${rowPad} overflow-hidden sticky left-0 z-[5] transition-colors ${stickyBg}`} style={{ width: columnWidths.deal, border: '1px solid #c8bdd6', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                              <div className="flex items-center gap-2.5">
                                <div className={`shrink-0`} onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleLeadSelection(lead.id)}
                                    className="h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                                  />
                                </div>
                                <div className={`h-7 w-7 rounded-full ${avatarColor} flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm`}>
                                  {initial}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="relative flex items-center">
                                    <p className="font-semibold text-[#202124] dark:text-foreground truncate text-[13px] leading-tight flex-1 min-w-0">
                                      {getLeadDisplayName(lead)}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/pipeline/lender-management/expanded-view/${lead.id}`); }}
                                      className="absolute right-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                                    >
                                      <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Company */}
                            {columnVisibility.company && (
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.company, border: '1px solid #c8bdd6' }}>
                                {lead.company_name ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                                      <Building2 className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                    <span className="text-[13px] text-[#202124] dark:text-foreground/80 truncate max-w-[120px]">{lead.company_name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Contact */}
                            {columnVisibility.contact && (
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.contact, border: '1px solid #c8bdd6' }}>
                                <span className="text-[13px] text-[#5f6368] dark:text-foreground/80 truncate block max-w-[110px]">{lead.name}</span>
                              </td>
                            )}

                            {/* Value */}
                            {columnVisibility.value && (
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.value, border: '1px solid #c8bdd6' }}>
                                <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                  {formatValue(fakeValue(lead.id))}
                                </span>
                              </td>
                            )}

                            {/* Owner */}
                            {columnVisibility.ownedBy && (
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.ownedBy, border: '1px solid #c8bdd6' }}>
                                {assignedName && assignedInitial ? (
                                  <div className="flex items-center gap-2">
                                    {assignedAvatar ? (
                                      <img src={assignedAvatar} alt={assignedName} className="h-6 w-6 rounded-full object-cover shrink-0 shadow-sm" />
                                    ) : (
                                      <div className={`h-6 w-6 rounded-full ${assignedColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm`}>
                                        {assignedInitial}
                                      </div>
                                    )}
                                    <span className="text-[13px] text-[#5f6368] dark:text-foreground/80 truncate max-w-[80px]">{assignedName}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/40 text-[13px]">—</span>
                                )}
                              </td>
                            )}

                            {/* Tasks */}
                            {columnVisibility.tasks && (
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.tasks, border: '1px solid #c8bdd6' }}>
                                {(taskCountMap[lead.id] ?? fakeTasks(lead.id)) > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[12px] text-[#5f6368] dark:text-muted-foreground">
                                    <CheckSquare className="h-3.5 w-3.5 text-[#80868b] dark:text-muted-foreground" />
                                    {taskCountMap[lead.id] ?? fakeTasks(lead.id)}
                                  </span>
                                ) : (
                                  <CheckSquare className="h-3.5 w-3.5 text-[#dadce0] dark:text-muted-foreground/30" />
                                )}
                              </td>
                            )}

                            {/* Status */}
                            {columnVisibility.status && (
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.status ?? 100, border: '1px solid #c8bdd6' }}>
                                <span className="text-[12px] text-[#5f6368] dark:text-muted-foreground">{lead.status}</span>
                              </td>
                            )}

                            {/* Stage */}
                            {columnVisibility.stage && (
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.stage, border: '1px solid #c8bdd6' }}>
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
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.daysInStage, border: '1px solid #c8bdd6' }}>
                                {daysInStage !== null ? (
                                  <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${
                                    isLingering ? 'text-amber-600 dark:text-amber-400' : 'text-[#5f6368] dark:text-muted-foreground'
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
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.stageUpdated, border: '1px solid #c8bdd6' }}>
                                <span className="text-[12px] text-[#5f6368] dark:text-muted-foreground tabular-nums">{formatShortDate(lead.updated_at)}</span>
                              </td>
                            )}

                            {/* Last Contacted */}
                            {columnVisibility.lastContacted && (
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.lastContacted, border: '1px solid #c8bdd6' }}>
                                <span className="text-[12px] text-[#5f6368] dark:text-muted-foreground tabular-nums">{formatShortDate(lead.last_activity_at)}</span>
                              </td>
                            )}

                            {/* Interactions */}
                            {columnVisibility.interactions && (
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.interactions, border: '1px solid #c8bdd6' }}>
                                {(interactionCountMap[lead.id] ?? fakeInteractions(lead.id)) > 0 ? (
                                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                    {interactionCountMap[lead.id] ?? fakeInteractions(lead.id)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40 text-[13px]">0</span>
                                )}
                              </td>
                            )}

                            {/* Inactive Days */}
                            {columnVisibility.inactiveDays && (
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.inactiveDays, border: '1px solid #c8bdd6' }}>
                                {isStale ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">
                                    {inactiveDays}d
                                  </span>
                                ) : inactiveDays !== null ? (
                                  <span className="text-[12px] text-[#5f6368] dark:text-muted-foreground tabular-nums">{inactiveDays}d</span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Tags */}
                            {columnVisibility.tags && (
                              <td className={`px-4 ${rowPad} overflow-hidden`} style={{ width: columnWidths.tags, border: '1px solid #c8bdd6' }}>
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
                            <td className={`px-2 ${rowPad} w-10`} style={{ border: '1px solid #c8bdd6' }}>
                              <PanelRightOpen className={`h-4 w-4 transition-all duration-150 ${
                                isDetailOpen
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
                queryClient.invalidateQueries({ queryKey: ['pipeline-leads', pipeline?.id] });
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
    </EvanLayout>
  );
};

export default LenderManagement;
