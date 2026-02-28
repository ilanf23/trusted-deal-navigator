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
  PanelRightOpen,
  Sparkles,
  Loader2,
  Download,
  PlusCircle,
} from 'lucide-react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter, useDroppable,
} from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { format, differenceInDays, parseISO } from 'date-fns';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

const UNDERWRITING_STATUSES: LeadStatus[] = [
  'review_kill_keep',
  'initial_review',
  'waiting_on_needs_list',
  'waiting_on_client',
  'complete_files_for_review',
  'need_structure_from_brad',
  'maura_underwriting',
  'brad_underwriting',
  'uw_paused',
  'ready_for_wu_approval',
];

const stageConfig: Record<string, { label: string; color: string; bg: string; dot: string; pill: string }> = {
  review_kill_keep: {
    label: 'Review Kill / Keep',
    color: 'text-red-700',
    bg: 'bg-red-50 border-red-200',
    dot: 'bg-red-500',
    pill: 'bg-red-100 text-red-700',
  },
  initial_review: {
    label: 'Initial Review',
    color: 'text-sky-700',
    bg: 'bg-sky-50 border-sky-200',
    dot: 'bg-sky-500',
    pill: 'bg-sky-100 text-sky-700',
  },
  waiting_on_needs_list: {
    label: 'Waiting on Needs List',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    dot: 'bg-amber-500',
    pill: 'bg-amber-100 text-amber-700',
  },
  waiting_on_client: {
    label: 'Waiting on Client',
    color: 'text-orange-700',
    bg: 'bg-orange-50 border-orange-200',
    dot: 'bg-orange-500',
    pill: 'bg-orange-100 text-orange-700',
  },
  complete_files_for_review: {
    label: 'Complete Files for Review',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    dot: 'bg-blue-500',
    pill: 'bg-blue-100 text-blue-700',
  },
  need_structure_from_brad: {
    label: 'Need Structure from Brad',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50 border-indigo-200',
    dot: 'bg-indigo-500',
    pill: 'bg-indigo-100 text-indigo-700',
  },
  maura_underwriting: {
    label: 'Maura Underwriting',
    color: 'text-pink-700',
    bg: 'bg-pink-50 border-pink-200',
    dot: 'bg-pink-500',
    pill: 'bg-pink-100 text-pink-700',
  },
  brad_underwriting: {
    label: 'Brad Underwriting',
    color: 'text-teal-700',
    bg: 'bg-teal-50 border-teal-200',
    dot: 'bg-teal-500',
    pill: 'bg-teal-100 text-teal-700',
  },
  uw_paused: {
    label: 'UW Paused',
    color: 'text-slate-600',
    bg: 'bg-slate-100 border-slate-300',
    dot: 'bg-slate-400',
    pill: 'bg-slate-200 text-slate-600',
  },
  ready_for_wu_approval: {
    label: 'Ready for WU Approval',
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Core state ──
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_activity_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  

  // ── Toolbar state ──
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [rowDensity, setRowDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [publicFiltersOpen, setPublicFiltersOpen] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [customFilters, setCustomFilters] = useState<Array<{ id: string; label: string; values: CustomFilterValues }>>([]);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    company: true, contact: true, value: true, ownedBy: true, tasks: true,
    stage: true, daysInStage: true, stageUpdated: true, lastContacted: true,
    interactions: true, inactiveDays: true, tags: true,
  });

  const DEFAULT_COLUMN_WIDTHS: Record<string, number> = useMemo(() => ({
    opportunity: 200, company: 130, contact: 110, value: 90, ownedBy: 80,
    tasks: 55, stage: 150, daysInStage: 55, stageUpdated: 85,
    lastContacted: 90, interactions: 65, inactiveDays: 70, tags: 100,
  }), []);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('evan-underwriting-column-widths');
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
      localStorage.setItem('evan-underwriting-column-widths', JSON.stringify(next));
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

  // ── Add Opportunity state ──
  const [addOpportunityOpen, setAddOpportunityOpen] = useState(false);
  const [addOpportunityStage, setAddOpportunityStage] = useState<LeadStatus>('review_kill_keep');
  const [newOpp, setNewOpp] = useState({ name: '', company_name: '', email: '', phone: '' });

  const createOpportunityMutation = useMutation({
    mutationFn: async (data: { name: string; company_name: string; email: string; phone: string; status: LeadStatus }) => {
      const evanMember = teamMembers.find(m => m.name === 'Evan');
      const { data: lead, error } = await supabase
        .from('leads')
        .insert({
          name: data.name,
          company_name: data.company_name || null,
          email: data.email || null,
          phone: data.phone || null,
          status: data.status,
          assigned_to: evanMember?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return lead;
    },
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-leads'] });
      setAddOpportunityOpen(false);
      setNewOpp({ name: '', company_name: '', email: '', phone: '' });
      toast.success(`"${lead.name}" added to ${stageConfig[lead.status]?.label ?? lead.status}`);
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
    createOpportunityMutation.mutate({ ...newOpp, status: addOpportunityStage });
  };

  const openAddDialog = (stage?: LeadStatus) => {
    setAddOpportunityStage(stage ?? 'review_kill_keep');
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

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['underwriting-leads'],
    queryFn: async () => {
      // Query using DB-known enum values; new values will work once migration is run
      const DB_KNOWN_UW_STATUSES: LeadStatus[] = [
        'initial_review', 'moving_to_underwriting', 'underwriting',
        'ready_for_wu_approval', 'pre_approval_issued',
      ];
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('status', [...new Set([...DB_KNOWN_UW_STATUSES, ...UNDERWRITING_STATUSES])])
        .order('last_activity_at', { ascending: false });
      // If query fails (new enum values not yet migrated), fall back to known values only
      if (error) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('leads')
          .select('*')
          .in('status', DB_KNOWN_UW_STATUSES)
          .order('last_activity_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        return fallbackData as Lead[];
      }
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
    counts['onboarding_2024'] = leads.filter(l => l.cohort_year === 2024).length;
    counts['onboarding_2025'] = leads.filter(l => l.cohort_year === 2025).length;
    counts['onboarding_2026'] = leads.filter(l => l.cohort_year === 2026).length;
    return counts;
  }, [leads, teamMemberMap]);

  const filteredAndSorted = useMemo(() => {
    let result = leads;

    if (activeFilter !== 'all') {
      if ((UNDERWRITING_STATUSES as string[]).includes(activeFilter)) {
        result = result.filter((l) => l.status === activeFilter);
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
  }

  // Row padding based on density
  const rowPad = rowDensity === 'comfortable' ? 'py-2.5' : 'py-1';

  const ColHeader = ({
    colKey,
    children,
  }: {
    colKey?: ColumnKey;
    children: React.ReactNode;
  }) => {
    if (colKey && !columnVisibility[colKey]) return null;
    const widthKey = colKey ?? 'opportunity';
    const width = columnWidths[widthKey] ?? 120;
    return (
      <th
        className="px-4 py-3 text-left whitespace-nowrap"
        style={{ width: `${width}px`, minWidth: 60, maxWidth: 500 }}
      >
        <ResizableColumnHeader
          columnId={widthKey}
          currentWidth={`${width}px`}
          onResize={handleColumnResize}
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
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
        ? 'bg-white shadow-sm text-slate-800 border border-slate-200'
        : 'text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-800 hover:border hover:border-slate-200'
    }`;

  return (
    <EvanLayout>
      <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">

        {/* ── CRM-Style Header ── */}
        <div className="shrink-0 border-b border-border bg-background px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-foreground whitespace-nowrap">All Opportunities</h1>
          </div>

          {/* Connected toolbar — Table | Kanban | Sort | Settings */}
          <div className="flex items-center h-7 rounded-md border border-slate-200 overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode('table')}
              title="Table view"
              className={`flex items-center justify-center h-full px-2 transition-all ${
                viewMode === 'table'
                  ? 'bg-violet-50 text-violet-700'
                  : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-200" />
            <button
              onClick={() => setViewMode('kanban')}
              title="Kanban view"
              className={`flex items-center justify-center h-full px-2 transition-all ${
                viewMode === 'kanban'
                  ? 'bg-violet-50 text-violet-700'
                  : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <div className="w-px h-4 bg-slate-200" />
            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Sort"
                  className={`flex items-center justify-center h-full px-2 transition-all ${
                    isNonDefaultSort
                      ? 'bg-violet-50 text-violet-700'
                      : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800'
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
            <div className="w-px h-4 bg-slate-200" />
            <PipelineSettingsPopover open={settingsOpen} onOpenChange={setSettingsOpen} />
          </div>

          {/* Add Opportunity button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="group relative h-9 pl-4 pr-3 text-[13px] font-semibold rounded-full shrink-0 flex items-center gap-2 text-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/25 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2"
                style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #5b21b6 50%, #6d28d9 100%)' }}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                <span>Add Opportunity</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-xl border border-slate-200/80 bg-white">
              <DropdownMenuItem
                onClick={() => openAddDialog()}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-[14px] font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-50 transition-colors"
              >
                <PlusCircle className="h-4.5 w-4.5 text-slate-500" />
                Add Opportunity
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-[14px] font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-50 transition-colors"
              >
                <Download className="h-4.5 w-4.5 text-slate-500" />
                Import Opportunities
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                  stageConfig={stageConfig}
                  onSave={(filter) => {
                    const id = `custom_${Date.now()}`;
                    setCustomFilters(prev => [...prev, { id, label: filter.filterName, values: filter }]);
                    toast.success(`Filter "${filter.filterName}" created`);
                  }}
                />
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

                <button
                  onClick={() => setPublicFiltersOpen(v => !v)}
                  className="w-full px-3 pt-3 pb-1 flex items-center justify-between group"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Public</span>
                  <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${publicFiltersOpen ? '' : '-rotate-90'}`} />
                </button>

                {publicFiltersOpen && visibleFilters.filter(o => o.group === 'public').map((opt) => {
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
                            isActive ? 'bg-violet-50 text-violet-700' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {isActive && <span className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-r-full bg-violet-600" />}
                          <span className={`text-[13px] truncate ${isActive ? 'font-medium text-violet-700' : ''}`}>{cf.label}</span>
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

                {!isLoading && (
                  <span className="text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                    # {filteredAndSorted.length.toLocaleString()} {filteredAndSorted.length === 1 ? 'opportunity' : 'opportunities'}
                  </span>
                )}
                {!isLoading && (
                  <span className="text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                    ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}

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
                <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                  <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-sm border-b border-slate-200">
                    <tr>
                      <th className="w-10 px-4 py-3" />
                      <ColHeader>
                        Opportunity
                      </ColHeader>
                      <ColHeader colKey="company">
                        Company
                      </ColHeader>
                      <ColHeader colKey="contact">
                        Contact
                      </ColHeader>
                      <ColHeader colKey="value">
                        Value
                      </ColHeader>
                      <ColHeader colKey="ownedBy">
                        Owner
                      </ColHeader>
                      <ColHeader colKey="tasks">
                        Tasks
                      </ColHeader>
                      <ColHeader colKey="stage">
                        Stage
                      </ColHeader>
                      <ColHeader colKey="daysInStage">
                        Days
                      </ColHeader>
                      <ColHeader colKey="stageUpdated">
                        Updated
                      </ColHeader>
                      <ColHeader colKey="lastContacted">
                        Contacted
                      </ColHeader>
                      <ColHeader colKey="interactions">
                        Activity
                      </ColHeader>
                      <ColHeader colKey="inactiveDays">
                        Dormant
                      </ColHeader>
                      <ColHeader colKey="tags">
                        Tags
                      </ColHeader>
                      <th className="w-10 px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 7 }).map((_, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                          <td className="px-4 py-3.5 w-10"><Skeleton className="h-4 w-4 rounded" /></td>
                          <td className="px-4 py-3.5" style={{ width: columnWidths.opportunity }}>
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
                            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-slate-100">
                              <FileSearch className="h-6 w-6 text-slate-400" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold text-slate-700">No opportunities found</p>
                              <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                                {searchTerm ? 'Try adjusting your search or filter criteria' : 'No deals are in this stage yet'}
                              </p>
                            </div>
                            {isFiltersActive && (
                              <button
                                onClick={clearAllFilters}
                                className="text-xs text-violet-600 hover:text-violet-700 font-semibold mt-1 px-3 py-1.5 rounded-lg hover:bg-violet-50 transition-colors"
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
                        const taskCount = taskCountMap[lead.id] ?? fakeTasks(lead.id);
                        const interactionCount = interactionCountMap[lead.id] ?? fakeInteractions(lead.id);
                        const daysInStage = daysSince(lead.updated_at);
                        const inactiveDays = daysSince(lead.last_activity_at);
                        const isStale = inactiveDays !== null && inactiveDays > 7;
                        const isLingering = daysInStage !== null && daysInStage > 14;
                        const dealValue = fakeValue(lead.id);
                        const isSelected = selectedLead?.id === lead.id;

                        return (
                          <tr
                            key={lead.id}
                            onClick={() => handleRowClick(lead)}
                            className={`cursor-pointer transition-colors duration-100 group border-b border-slate-100 last:border-b-0 ${
                              isSelected
                                ? 'bg-violet-50/60 hover:bg-violet-50/80'
                                : rowIdx % 2 === 0
                                  ? 'bg-white hover:bg-slate-50/80'
                                  : 'bg-slate-50/30 hover:bg-slate-100/60'
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="px-4 py-3 w-10">
                              <div className={`h-4 w-4 rounded border-2 transition-colors ${
                                isSelected ? 'border-violet-500 bg-violet-500' : 'border-slate-300 bg-white group-hover:border-slate-400'
                              } flex items-center justify-center`}>
                                {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                              </div>
                            </td>

                            {/* Opportunity */}
                            <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.opportunity }}>
                              <div className="flex items-center gap-2.5">
                                <div className={`h-7 w-7 rounded-full ${avatarColor} flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm`}>
                                  {initial}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-800 truncate text-[13px] leading-tight">
                                    {lead.name}
                                  </p>
                                  {lead.company_name && (
                                    <p className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">{lead.company_name}</p>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Company */}
                            {columnVisibility.company && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.company }}>
                                {lead.company_name ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                                      <Building2 className="h-3 w-3 text-slate-400" />
                                    </div>
                                    <span className="text-[13px] text-slate-600 truncate max-w-[110px]">{lead.company_name}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            )}

                            {/* Contact */}
                            {columnVisibility.contact && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.contact }}>
                                <span className="text-[13px] text-slate-600 truncate block max-w-[100px]">{lead.name}</span>
                              </td>
                            )}

                            {/* Value */}
                            {columnVisibility.value && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.value }}>
                                <span className="text-[13px] text-slate-800 font-semibold tabular-nums tracking-tight">{formatValue(dealValue)}</span>
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
                                    <span className="text-[13px] text-slate-600 truncate max-w-[80px]">{assignedName}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-[13px]">—</span>
                                )}
                              </td>
                            )}

                            {/* Tasks */}
                            {columnVisibility.tasks && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.tasks }}>
                                {taskCount > 0 ? (
                                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">
                                    {taskCount}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-[13px]">0</span>
                                )}
                              </td>
                            )}

                            {/* Stage */}
                            {columnVisibility.stage && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.stage }}>
                                {stageCfg ? (
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${stageCfg.bg} ${stageCfg.color}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${stageCfg.dot}`} />
                                    {stageCfg.label}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs">{lead.status}</span>
                                )}
                              </td>
                            )}

                            {/* Days in Stage */}
                            {columnVisibility.daysInStage && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.daysInStage }}>
                                {daysInStage !== null ? (
                                  <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${
                                    isLingering ? 'text-amber-600' : 'text-slate-500'
                                  }`}>
                                    {isLingering && <Flame className="h-3 w-3 text-amber-500 shrink-0" />}
                                    {daysInStage}d
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            )}

                            {/* Stage Updated */}
                            {columnVisibility.stageUpdated && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.stageUpdated }}>
                                <span className="text-[12px] text-slate-400 tabular-nums">{formatShortDate(lead.updated_at)}</span>
                              </td>
                            )}

                            {/* Last Contacted */}
                            {columnVisibility.lastContacted && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.lastContacted }}>
                                <span className="text-[12px] text-slate-400 tabular-nums">{formatShortDate(lead.last_activity_at)}</span>
                              </td>
                            )}

                            {/* Interactions */}
                            {columnVisibility.interactions && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.interactions }}>
                                {interactionCount > 0 ? (
                                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-md bg-violet-50 text-[11px] font-bold text-violet-600">
                                    {interactionCount}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 text-[13px]">0</span>
                                )}
                              </td>
                            )}

                            {/* Inactive Days */}
                            {columnVisibility.inactiveDays && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.inactiveDays }}>
                                {isStale ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-100">
                                    {inactiveDays}d
                                  </span>
                                ) : inactiveDays !== null ? (
                                  <span className="text-[12px] text-slate-500 tabular-nums">{inactiveDays}d</span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            )}

                            {/* Tags */}
                            {columnVisibility.tags && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.tags }}>
                                {lead.tags && lead.tags.length > 0 ? (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    {lead.tags.slice(0, 2).map((tag) => (
                                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200/60">
                                        {tag}
                                      </span>
                                    ))}
                                    {lead.tags.length > 2 && (
                                      <span className="text-[10px] text-slate-400 font-medium">+{lead.tags.length - 2}</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            )}

                            {/* Detail arrow */}
                            <td className="px-2 py-3 w-10">
                              <PanelRightOpen className={`h-4 w-4 transition-all duration-150 ${
                                isSelected
                                  ? 'text-violet-500'
                                  : 'text-transparent group-hover:text-slate-400'
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

          {/* ── Right Detail Panel ── */}
          {selectedLead && (
            <UnderwritingDetailPanel
              lead={selectedLead}
              stageConfig={stageConfig}
              teamMemberMap={teamMemberMap}
              teamMembers={teamMembers}
              formatValue={formatValue}
              fakeValue={fakeValue}
              onClose={() => setSelectedLead(null)}
              onExpand={() => navigate(`/admin/evan/pipeline/underwriting/lead/${selectedLead.id}`)}
              onStageChange={(leadId, newStatus) => {
                statusMutation.mutate({ leadId, newStatus });
                setSelectedLead({ ...selectedLead, status: newStatus });
              }}
              onLeadUpdate={(updatedLead) => setSelectedLead(updatedLead)}
            />
          )}
        </div>
      </div>



      {/* ── Add Opportunity Dialog ── */}
      <Dialog open={addOpportunityOpen} onOpenChange={setAddOpportunityOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          {/* Header with gradient */}
          <div className="px-6 pt-6 pb-4" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)' }}>
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
              {UNDERWRITING_STATUSES.map((status) => {
                const cfg = stageConfig[status];
                const isActive = addOpportunityStage === status;
                return (
                  <button
                    key={status}
                    onClick={() => setAddOpportunityStage(status)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white text-slate-800 shadow-md scale-105'
                        : 'bg-white/15 text-white/90 hover:bg-white/25'
                    }`}
                  >
                    <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${isActive ? cfg.dot : 'bg-white/60'}`} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form body */}
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="opp-name" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Opportunity Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="opp-name"
                placeholder="e.g. Riverside Plaza Acquisition"
                value={newOpp.name}
                onChange={(e) => setNewOpp(prev => ({ ...prev, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && newOpp.name.trim()) handleCreateOpportunity(); }}
                className="h-10 rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-slate-300"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="opp-company" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Company</Label>
              <Input
                id="opp-company"
                placeholder="Company name"
                value={newOpp.company_name}
                onChange={(e) => setNewOpp(prev => ({ ...prev, company_name: e.target.value }))}
                className="h-10 rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-slate-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="opp-email" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</Label>
                <Input
                  id="opp-email"
                  placeholder="email@example.com"
                  type="email"
                  value={newOpp.email}
                  onChange={(e) => setNewOpp(prev => ({ ...prev, email: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-slate-300"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="opp-phone" className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Phone</Label>
                <Input
                  id="opp-phone"
                  placeholder="(555) 123-4567"
                  type="tel"
                  value={newOpp.phone}
                  onChange={(e) => setNewOpp(prev => ({ ...prev, phone: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddOpportunityOpen(false)}
              className="h-9 px-4 rounded-xl text-slate-500 hover:text-slate-700"
            >
              Cancel
            </Button>
            <button
              onClick={handleCreateOpportunity}
              disabled={!newOpp.name.trim() || createOpportunityMutation.isPending}
              className="h-9 px-5 rounded-xl text-[13px] font-semibold text-white flex items-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)' }}
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
    </EvanLayout>
  );
};

export default EvansUnderwriting;
