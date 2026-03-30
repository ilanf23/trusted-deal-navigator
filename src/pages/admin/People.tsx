import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EvanLayout from '@/components/evan/EvanLayout';
import PeopleDetailPanel from '@/components/admin/PeopleDetailPanel';
import PipelineBulkToolbar from '@/components/admin/PipelineBulkToolbar';
import PipelineSettingsPopover from '@/components/admin/PipelineSettingsDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectAllHeader } from '@/components/admin/SelectAllHeader';
import { CustomFilterValues } from '@/components/admin/CreateFilterDialog';
import PeopleFilterPanel from '@/components/admin/PeopleFilterPanel';
import { useTeamMember } from '@/hooks/useTeamMember';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import {
  ArrowUpDown,
  ArrowLeft,
  PanelLeft,
  Filter,
  Settings2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Plus,
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
  GripVertical,
  PanelRightOpen,
  Workflow,
  Loader2,
  Download,
  PlusCircle,
  Phone,
  Briefcase,
  Link2,
  Maximize2,
  Bookmark,
  BarChart3,
  Equal,
  Landmark,
  AtSign,
  Search,
  MoreVertical,
  ArrowUp,
  ArrowDown,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { useUndo } from '@/contexts/UndoContext';
import { useAllPipelineLeads } from '@/hooks/useAllPipelineLeads';
import { format, differenceInDays, parseISO } from 'date-fns';


// ── Person type (mapped from leads table via pipeline_leads) ──
interface Person {
  id: string;
  name: string;
  title: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  contact_type: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  notes: string | null;
  linkedin: string | null;
  source: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  website?: string | null;
  _pipelineName?: string;
  _stageName?: string;
  _stageId?: string;
  _pipelineId?: string;
  _pipelineLeadId?: string;
}

type ContactType = string;

const CONTACT_TYPES: ContactType[] = [
  'Client',
  'Prospect',
  'Referral Partner',
  'Lender',
  'Attorney',
  'CPA',
  'Vendor',
  'Other',
];

const contactTypeConfig: Record<string, { label: string; color: string; bg: string; dot: string; pill: string }> = {
  Client: {
    label: 'Client',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  },
  Prospect: {
    label: 'Prospect',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
    pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  },
  'Referral Partner': {
    label: 'Referral Partner',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  },
  Lender: {
    label: 'Lender',
    color: 'text-indigo-700 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
    dot: 'bg-indigo-500',
    pill: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300',
  },
  Attorney: {
    label: 'Attorney',
    color: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
    pill: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300',
  },
  CPA: {
    label: 'CPA',
    color: 'text-teal-700 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
    dot: 'bg-teal-500',
    pill: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300',
  },
  Vendor: {
    label: 'Vendor',
    color: 'text-orange-700 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800',
    dot: 'bg-orange-500',
    pill: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
  },
  Other: {
    label: 'Other',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    pill: 'bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300',
  },
};

const DEFAULT_FILTER_OPTIONS = [
  { id: 'all', label: 'All Contacts', group: 'top' as const, editable: false },
  { id: 'Current Customer', label: 'Current Customers', group: 'public' as const, editable: true },
  { id: 'my_contacts', label: 'My People', group: 'public' as const, editable: false },
  { id: 'following', label: 'People I\'m Following', group: 'public' as const, editable: false },
  { id: 'Potential Customer', label: 'Potential Customers', group: 'public' as const, editable: true },
  { id: 'CLX RateWatch', label: 'CLX RateWatch', group: 'public' as const, editable: true },
  { id: 'CLX Referral Partner', label: 'CLX Referral Partners', group: 'public' as const, editable: true },
  { id: 'Searching for Bus. Acq.', label: 'Searching for Bus. Acq.', group: 'public' as const, editable: true },
  { id: 'Searching for RE Acq.', label: 'Searching for RE Acq.', group: 'public' as const, editable: true },
];

type SortField = 'name' | 'company_name' | 'contact_type' | 'last_activity_at' | 'updated_at';
type SortDir = 'asc' | 'desc';

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'last_activity_at', label: 'Last Activity' },
  { value: 'name', label: 'Name' },
  { value: 'company_name', label: 'Company' },
  { value: 'contact_type', label: 'Contact Type' },
  { value: 'updated_at', label: 'Updated' },
];

type ColumnKey = 'title' | 'company' | 'tasks' | 'email' | 'contactType' | 'pipeline' | 'lastContacted' | 'interactions' | 'inactiveDays' | 'tags';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  title: 'Title',
  company: 'Company',
  tasks: 'Tasks',
  email: 'Email',
  contactType: 'Contact Type',
  pipeline: 'Pipeline',
  lastContacted: 'Last Contacted',
  interactions: 'Interactions',
  inactiveDays: 'Inactive Days',
  tags: 'Tags',
};

// Column sort menu options per column (colKey or 'person')
const COLUMN_SORT_OPTIONS: Record<string, { label: string; field: SortField; dir: SortDir }[]> = {
  person: [
    { label: 'First name ascending', field: 'name', dir: 'asc' },
    { label: 'First name descending', field: 'name', dir: 'desc' },
  ],
  title: [
    { label: 'Title ascending', field: 'name', dir: 'asc' },
    { label: 'Title descending', field: 'name', dir: 'desc' },
  ],
  company: [
    { label: 'Company ascending', field: 'company_name', dir: 'asc' },
    { label: 'Company descending', field: 'company_name', dir: 'desc' },
  ],
  contactType: [
    { label: 'Contact type ascending', field: 'contact_type', dir: 'asc' },
    { label: 'Contact type descending', field: 'contact_type', dir: 'desc' },
  ],
  lastContacted: [
    { label: 'Last contacted ascending', field: 'last_activity_at', dir: 'asc' },
    { label: 'Last contacted descending', field: 'last_activity_at', dir: 'desc' },
  ],
};

const AVATAR_COLORS = [
  'bg-[#5C9EAD]', 'bg-[#4CAF50]', 'bg-[#C62828]', 'bg-[#EF6C00]',
  'bg-[#546E7A]', 'bg-[#26A69A]', 'bg-[#6D8B74]', 'bg-[#3E7CB1]',
  'bg-[#8D6E63]', 'bg-[#78909C]',
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

// ── Kanban sub-components ──

function KanbanPersonCard({ person, isDragging, onClick }: {
  person: Person;
  isDragging?: boolean;
  onClick: () => void;
}) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: person.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const avatarColor = getAvatarColor(person.name);
  const initial = person.name[0]?.toUpperCase() ?? '?';

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
          <p className="text-sm font-semibold text-foreground leading-tight truncate flex-1">{person.name}</p>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/people/person/${person.id}`); }}
            className="shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity"
          >
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
        {person.email && (
          <p className="text-[11px] text-muted-foreground truncate">{person.email}</p>
        )}
      </Card>
    </div>
  );
}

function KanbanDropColumn({ contactType, label, color, people, draggedId, onPersonClick }: {
  contactType: string;
  label: string;
  color: string;
  people: Person[];
  draggedId: string | null;
  onPersonClick: (person: Person) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: contactType });

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
          {people.length}
        </span>
      </div>
      <ScrollArea className="flex-1 px-2 pb-2">
        <SortableContext items={people.map(p => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[100px]">
            {people.map((person) => (
              <KanbanPersonCard
                key={person.id}
                person={person}
                isDragging={draggedId === person.id}
                onClick={() => onPersonClick(person)}
              />
            ))}
            {people.length === 0 && (
              <div className="text-center text-muted-foreground text-xs py-10 border-2 border-dashed border-muted-foreground/20 rounded-lg">
                Drop contacts here
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

const People = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { registerUndo } = useUndo();
  const { teamMember } = useTeamMember();

  // ── Core state ──
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_activity_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());

  // ── Column sort menu state ──
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);

  // ── Toolbar state ──
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [rowDensity, setRowDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [publicFiltersOpen, setPublicFiltersOpen] = useState(true);
  const [draggedPerson, setDraggedPerson] = useState<Person | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Filter options (stateful so public filters can be renamed)
  const [filterOptions, setFilterOptions] = useState(DEFAULT_FILTER_OPTIONS);

  // Custom filters
  const [customFilters, setCustomFilters] = useState<Array<{ id: string; label: string; values: CustomFilterValues }>>([]);
  const [renamingFilterId, setRenamingFilterId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');

  // Rename public filter (contact type) — updates all leads in DB
  const renameContactTypeMutation = useMutation({
    mutationFn: async ({ oldType, newType }: { oldType: string; newType: string }) => {
      const { error } = await supabase
        .from('leads')
        .update({ contact_type: newType })
        .eq('contact_type', oldType);
      if (error) throw error;
      return { oldType, newType };
    },
    onSuccess: ({ oldType, newType }) => {
      queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
      registerUndo({
        label: `Renamed contact type "${oldType}" to "${newType}"`,
        execute: async () => {
          const { error } = await supabase.from('leads').update({ contact_type: oldType }).eq('contact_type', newType);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
          toast.success('Contact type rename undone');
        },
      });
    },
    onError: () => toast.error('Failed to rename contact type'),
  });

  const handleFilterRename = (filterId: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === filterId) {
      setRenamingFilterId(null);
      setRenamingValue('');
      return;
    }

    // Check if this is a public/editable filter (contact type)
    const publicFilter = filterOptions.find(o => o.id === filterId && o.editable);
    if (publicFilter) {
      // Update filter options state (both id and label)
      setFilterOptions(prev => prev.map(o =>
        o.id === filterId ? { ...o, id: trimmed, label: trimmed } : o
      ));
      // Update active filter if it was the one being renamed
      if (activeFilter === filterId) setActiveFilter(trimmed);
      // Update DB — rename contact_type on all leads
      renameContactTypeMutation.mutate({ oldType: filterId, newType: trimmed });
      toast.success(`Renamed "${publicFilter.label}" to "${trimmed}"`);
    } else {
      // Custom filter rename (local only)
      setCustomFilters(prev => prev.map(cf =>
        cf.id === filterId ? { ...cf, label: trimmed } : cf
      ));
    }
    setRenamingFilterId(null);
    setRenamingValue('');
  };

  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    title: true, company: true, tasks: true, email: true, contactType: true,
    pipeline: true, lastContacted: true, interactions: true, inactiveDays: true, tags: true,
  });

  // ── Top bar: inject title + search into AdminLayout header ──
  const { setPageTitle, setSearchComponent, setActionsComponent } = useAdminTopBar();

  useEffect(() => {
    setPageTitle('People');
    return () => {
      setPageTitle(null);
      setSearchComponent(null);
      setActionsComponent(null);
    };
  }, []);

  useEffect(() => {
    setSearchComponent(
      <Input
        type="text"
        placeholder="Search by name, email, domain or phone number"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full h-9 px-4 text-sm rounded-full bg-[#f1f3f4] dark:bg-muted/50 border border-[#dadce0] dark:border-border focus:border-[#d2d5d9] dark:focus:border-border focus:bg-white dark:focus:bg-background placeholder:text-[#5f6368]/70 dark:placeholder:text-muted-foreground/60"
      />
    );
  }, [searchTerm]);

  const DEFAULT_COLUMN_WIDTHS: Record<string, number> = useMemo(() => ({
    person: 260, title: 130, company: 130, tasks: 55, email: 170,
    contactType: 200, pipeline: 220, lastContacted: 90, interactions: 65, inactiveDays: 70, tags: 100,
  }), []);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('people-column-widths');
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
      localStorage.setItem('people-column-widths', JSON.stringify(next));
      return next;
    });
  }, []);

  const columnsMenuRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);

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
      if (e.key === 'Escape') {
        if (colMenuOpen) { setColMenuOpen(null); return; }
        if (selectedPerson) setSelectedPerson(null);
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [selectedPerson]);

  // Close detail panel on click outside
  useEffect(() => {
    if (!selectedPerson) return;
    function handleClickOutside(e: MouseEvent) {
      if (detailPanelRef.current && !detailPanelRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target.closest('tr')) return; // let row click handler handle it
        setSelectedPerson(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedPerson]);

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

  // ── Contact type update mutation for Kanban drag ──
  const contactTypeMutation = useMutation({
    mutationFn: async ({ personId, newType, oldType }: { personId: string; newType: string; oldType: string }) => {
      const { error } = await supabase
        .from('leads')
        .update({ contact_type: newType })
        .eq('id', personId);
      if (error) throw error;
      await supabase.from('lead_activities').insert({
        lead_id: personId,
        activity_type: 'type_change',
        title: `Changed from ${oldType} to ${newType}`,
        content: JSON.stringify({ from: oldType, to: newType }),
      });
      return { personId, oldType, newType };
    },
    onSuccess: ({ personId, oldType, newType }) => {
      queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
      toast.success('Contact type updated');
      registerUndo({
        label: `Changed contact type to "${newType}"`,
        execute: async () => {
          const { error } = await supabase.from('leads').update({ contact_type: oldType }).eq('id', personId);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
          toast.success('Contact type restored');
        },
      });
    },
    onError: () => {
      toast.error('Failed to update contact type');
    },
  });

  // ── Add Person state ──
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [addPersonType, setAddPersonType] = useState<string>('Prospect');
  const [newPerson, setNewPerson] = useState({ name: '', title: '', company_name: '', email: '', phone: '', contact_type: 'Prospect', known_as: '', clx_file_name: '', assigned_to: '', direct_phone: '', fax_phone: '' });

  const createPersonMutation = useMutation({
    mutationFn: async (data: { name: string; title: string; company_name: string; email: string; phone: string; contact_type: string; known_as: string; clx_file_name: string; assigned_to: string; direct_phone: string; fax_phone: string }) => {
      // Insert into leads
      const { data: lead, error } = await supabase
        .from('leads')
        .insert({
          name: data.name,
          title: data.title || null,
          company_name: data.company_name || null,
          email: data.email || null,
          phone: data.phone || null,
          contact_type: data.contact_type,
          known_as: data.known_as || null,
          clx_file_name: data.clx_file_name || null,
          assigned_to: data.assigned_to || null,
          status: 'initial_review',
        })
        .select()
        .single();
      if (error) throw error;

      // Insert extra phone numbers into lead_phones
      const phonesToInsert = [
        data.direct_phone ? { lead_id: lead.id, phone_number: data.direct_phone, phone_type: 'direct' } : null,
        data.fax_phone ? { lead_id: lead.id, phone_number: data.fax_phone, phone_type: 'fax' } : null,
      ].filter(Boolean);
      if (phonesToInsert.length > 0) {
        await supabase.from('lead_phones').insert(phonesToInsert);
      }

      // Add to default (Potential) pipeline
      const { data: pipeline } = await supabase
        .from('pipelines')
        .select('id')
        .eq('is_main', true)
        .maybeSingle();
      if (pipeline) {
        const { data: stage } = await supabase
          .from('pipeline_stages')
          .select('id')
          .eq('pipeline_id', pipeline.id)
          .order('position', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (stage) {
          await supabase.from('pipeline_leads').insert({
            lead_id: lead.id,
            pipeline_id: pipeline.id,
            stage_id: stage.id,
          });
        }
      }

      return lead as Person;
    },
    onSuccess: (person) => {
      queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
      setAddPersonOpen(false);
      setNewPerson({ name: '', title: '', company_name: '', email: '', phone: '', contact_type: 'Prospect', known_as: '', clx_file_name: '', assigned_to: '', direct_phone: '', fax_phone: '' });
      toast.success(`"${person.name}" added as ${person.contact_type}`);
      setSelectedPerson(person);
      registerUndo({
        label: `Created "${person.name}"`,
        execute: async () => {
          const { error } = await supabase.from('leads').delete().eq('id', person.id);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
          toast.success('Contact creation undone');
        },
      });
    },
    onError: () => {
      toast.error('Failed to create contact');
    },
  });

  const handleCreatePerson = () => {
    if (!newPerson.name.trim()) {
      toast.error('Name is required');
      return;
    }
    createPersonMutation.mutate({ ...newPerson, contact_type: addPersonType });
  };

  const openAddDialog = (type?: string) => {
    setAddPersonType(type ?? 'Prospect');
    setNewPerson({ name: '', title: '', company_name: '', email: '', phone: '', contact_type: type ?? 'Prospect' });
    setAddPersonOpen(true);
  };

  function handleDragStart(event: DragStartEvent) {
    const person = filteredAndSorted.find(p => p.id === event.active.id);
    setDraggedPerson(person ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedPerson(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const targetType = CONTACT_TYPES.find(t => t === over.id)
      ?? filteredAndSorted.find(p => p.id === over.id)?.contact_type;

    if (!targetType) return;

    const person = filteredAndSorted.find(p => p.id === active.id);
    if (!person || person.contact_type === targetType) return;

    contactTypeMutation.mutate({ personId: person.id, newType: targetType, oldType: person.contact_type ?? 'Other' });
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

  const { people, isLoading } = useAllPipelineLeads();

  const { data: taskCountMap = {} } = useQuery({
    queryKey: ['people-task-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('lead_id')
        .in('lead_id', people.map((p) => p.id));
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      for (const row of data) {
        counts[row.lead_id] = (counts[row.lead_id] || 0) + 1;
      }
      return counts;
    },
    enabled: people.length > 0,
  });

  const { data: interactionCountMap = {} } = useQuery({
    queryKey: ['people-interaction-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('lead_id')
        .in('lead_id', people.map((p) => p.id));
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      for (const row of data) {
        counts[row.lead_id] = (counts[row.lead_id] || 0) + 1;
      }
      return counts;
    },
    enabled: people.length > 0,
  });

  // Query followed leads for "People I'm Following" filter
  const { data: followedLeadIds = [] } = useQuery({
    queryKey: ['followed-leads', teamMember?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_followers')
        .select('lead_id')
        .eq('team_member_id', teamMember!.id);
      return (data ?? []).map(r => r.lead_id);
    },
    enabled: !!teamMember?.id,
  });

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: people.length };
    // Count by current filter option IDs (contact types may have been renamed)
    for (const opt of filterOptions.filter(o => o.editable)) {
      counts[opt.id] = people.filter((p) => p.contact_type === opt.id).length;
    }
    counts['my_contacts'] = people.filter(p => p.assigned_to === teamMember?.id).length;
    counts['following'] = people.filter(p => followedLeadIds.includes(p.id)).length;
    return counts;
  }, [people, teamMember?.id, followedLeadIds, filterOptions]);

  const filteredAndSorted = useMemo(() => {
    let result = people;

    if (activeFilter !== 'all') {
      if (activeFilter === 'my_contacts') {
        result = result.filter((p) => p.assigned_to === teamMember?.id);
      } else if (activeFilter === 'following') {
        result = result.filter((p) => followedLeadIds.includes(p.id));
      } else {
        // Check if it's a custom filter with saved person IDs
        const customFilter = customFilters.find(cf => cf.id === activeFilter);
        if (customFilter && (customFilter.values as any).personIds) {
          const ids = (customFilter.values as any).personIds as string[];
          result = result.filter((p) => ids.includes(p.id));
        } else {
          // Filter by contact_type
          result = result.filter((p) => p.contact_type === activeFilter);
        }
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.company_name ?? '').toLowerCase().includes(q) ||
          (p.email ?? '').toLowerCase().includes(q) ||
          (p.phone ?? '').toLowerCase().includes(q) ||
          (p.title ?? '').toLowerCase().includes(q) ||
          (p.source ?? '').toLowerCase().includes(q) ||
          (p.contact_type ?? '').toLowerCase().includes(q) ||
          (p.linkedin ?? '').toLowerCase().includes(q) ||
          (p.website ?? '').toLowerCase().includes(q) ||
          (p.tags ?? []).some(t => t.toLowerCase().includes(q))
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = ((a[sortField] ?? '') as string);
      const bVal = ((b[sortField] ?? '') as string);
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [people, activeFilter, searchTerm, sortField, sortDir, customFilters, followedLeadIds, teamMember?.id]);


  function handleColSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function handleRowClick(person: Person) {
    setSelectedPerson(person);
    setFilterPanelOpen(false);
  }

  const togglePersonSelection = (personId: string) => {
    setSelectedPersonIds(prev => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  const isAllSelected = useMemo(() => {
    return filteredAndSorted.length > 0 && filteredAndSorted.every(p => selectedPersonIds.has(p.id));
  }, [filteredAndSorted, selectedPersonIds]);

  const selectAll = () => setSelectedPersonIds(new Set(filteredAndSorted.map(p => p.id)));
  const clearSelection = () => setSelectedPersonIds(new Set());

  // ── Bulk Edit Contact Type ──
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkContactType, setBulkContactType] = useState('');

  const bulkContactTypeMutation = useMutation({
    mutationFn: async ({ personIds, newType }: { personIds: string[]; newType: string }) => {
      // Capture previous contact_types before update
      const { data: prevRecords } = await supabase
        .from('leads')
        .select('id, contact_type')
        .in('id', personIds);
      const { error } = await supabase
        .from('leads')
        .update({ contact_type: newType })
        .in('id', personIds);
      if (error) throw error;
      return { prevRecords: prevRecords ?? [], newType };
    },
    onSuccess: ({ prevRecords, newType }) => {
      queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
      clearSelection();
      setBulkEditOpen(false);
      setBulkContactType('');
      toast.success('Contact type updated for selected people');
      registerUndo({
        label: `Bulk changed ${prevRecords.length} contacts to "${newType}"`,
        execute: async () => {
          for (const rec of prevRecords) {
            await supabase.from('leads').update({ contact_type: rec.contact_type }).eq('id', rec.id);
          }
          queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
          toast.success('Bulk contact type change undone');
        },
      });
    },
    onError: () => toast.error('Failed to update contact type'),
  });

  // ── Export Selected as CSV ──
  const handleExportSelected = () => {
    const selected = filteredAndSorted.filter(p => selectedPersonIds.has(p.id));
    const headers = ['Name', 'Title', 'Company', 'Email', 'Phone', 'Contact Type', 'Tags'];
    const rows = selected.map(p => [
      p.name, p.title ?? '', p.company_name ?? '', p.email ?? '',
      p.phone ?? '', p.contact_type ?? '', (p.tags ?? []).join('; ')
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `people-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selected.length} contacts`);
  };

  // ── Create Filter from Selection ──
  const handleCreateFilterFromSelection = () => {
    const id = `custom_${Date.now()}`;
    const label = `Selected (${selectedPersonIds.size})`;
    const personIds = Array.from(selectedPersonIds);
    setCustomFilters(prev => [...prev, {
      id,
      label,
      values: { filterName: label, personIds } as CustomFilterValues & { personIds: string[] },
    }]);
    setActiveFilter(id);
    clearSelection();
    toast.success(`Filter "${label}" created`);
  };

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
    const widthKey = colKey ?? 'person';
    const width = columnWidths[widthKey] ?? 120;
    const sortOptions = COLUMN_SORT_OPTIONS[widthKey];
    const isMenuOpen = colMenuOpen === widthKey;
    return (
      <th
        className={`px-4 py-1.5 text-left whitespace-nowrap group/col transition-colors hover:z-20 ${extraClassName ?? ''}`}
        style={{ width: `${width}px`, minWidth: 60, maxWidth: 500, backgroundColor: '#eee6f6', border: '1px solid #c8bdd6', ...extraStyle }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d8cce8'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#eee6f6'; }}
      >
        <ResizableColumnHeader
          columnId={widthKey}
          currentWidth={`${width}px`}
          onResize={handleColumnResize}
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-[#3b2778] dark:text-muted-foreground">
            {children}
          </span>
          {/* Three-dot menu button — inline so it's never hidden */}
          {sortOptions && (
            <div className={`relative ml-auto shrink-0 transition-opacity ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover/col:opacity-100'}`} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <button
                onClick={() => setColMenuOpen(isMenuOpen ? null : widthKey)}
                title="Sort options"
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
      <div className="system-font flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-background -m-3 sm:-m-4 md:-m-6 lg:-m-8 xl:-m-10">



        {/* ── Body: Sidebar + Table ── */}
        <div className="relative flex flex-1 min-h-0 overflow-y-hidden overflow-x-clip">

          {/* ── Sidebar collapse button (straddles border) ── */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? 'Hide filters' : 'Show filters'}
            style={{ left: sidebarOpen ? 'calc(18rem - 1.3125rem)' : 'calc(72px - 21px)', borderRadius: '50%', transition: 'left 200ms ease' }}
            className="absolute top-[9px] z-20 h-[42px] w-[42px] border border-gray-300 dark:border-border bg-white dark:bg-card flex items-center justify-center text-black dark:text-foreground hover:bg-gray-50 dark:hover:bg-muted hover:border-gray-400 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} style={{ transform: `scale(2) ${sidebarOpen ? '' : 'rotate(180deg)'}`, transition: 'transform 200ms ease' }} />
          </button>

          {/* ── Left Sidebar (Copper style) ── */}
          <aside
            className={`shrink-0 border-r border-[#e8eaed] dark:border-border flex flex-col overflow-hidden transition-all duration-200 ${
              sidebarOpen ? 'w-72 bg-[#f8f9fa] dark:bg-muted/30' : 'w-[72px] bg-[#eef0f2] dark:bg-muted/50'
            }`}
          >
            {sidebarOpen && <div className="w-72 pl-4 flex-1 overflow-y-auto">
              <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                <span className="text-[20px] font-bold text-[#1f1f1f] dark:text-foreground tracking-tight">Saved Filters</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setFilterPanelOpen(true); setSelectedPerson(null); }}
                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-[#f1f3f4] dark:hover:bg-muted transition-colors text-[#5f6368] dark:text-muted-foreground"
                    title="New filter"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
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

              <nav className="flex-1 overflow-y-auto pb-4 px-3">
                {/* All Contacts — top item */}
                {filterOptions.filter(o => o.group === 'top').map((opt) => {
                  const isActive = activeFilter === opt.id;
                  const count = filterCounts[opt.id] ?? 0;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setActiveFilter(opt.id)}
                      className={`relative w-full flex items-center justify-between px-3 py-3 text-left transition-colors ${
                        isActive ? 'bg-[#e0d4f0] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400 rounded-lg font-medium' : 'text-[#3c4043] dark:text-muted-foreground hover:bg-[#f0eaf7] dark:hover:bg-purple-950/30 hover:text-[#3b2778] dark:hover:text-purple-300 rounded-lg'
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

                {/* Public section (was "By Type") */}
                <button
                  onClick={() => setPublicFiltersOpen(v => !v)}
                  className="w-full px-3 pt-4 pb-1 flex items-center justify-between group"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5f6368] dark:text-muted-foreground">Public</span>
                  <ChevronUp className={`h-3.5 w-3.5 text-[#80868b] dark:text-muted-foreground transition-transform duration-200 ${publicFiltersOpen ? '' : 'rotate-180'}`} />
                </button>

                {publicFiltersOpen && filterOptions.filter(o => o.group === 'public').map((opt) => {
                  const isActive = activeFilter === opt.id;
                  const count = filterCounts[opt.id] ?? 0;
                  const isRenaming = renamingFilterId === opt.id;

                  if (isRenaming) {
                    return (
                      <div key={opt.id} className="py-1.5">
                        <input
                          autoFocus
                          value={renamingValue}
                          onChange={(e) => setRenamingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleFilterRename(opt.id, renamingValue);
                            if (e.key === 'Escape') { setRenamingFilterId(null); setRenamingValue(''); }
                          }}
                          onBlur={() => handleFilterRename(opt.id, renamingValue)}
                          className="w-full h-8 px-2 text-[14px] rounded-md bg-white dark:bg-muted border border-[#1a73e8] dark:border-blue-500 text-[#1f1f1f] dark:text-foreground outline-none"
                        />
                      </div>
                    );
                  }

                  return (
                    <button
                      key={opt.id}
                      onClick={() => setActiveFilter(opt.id)}
                      onDoubleClick={opt.editable ? () => { setRenamingFilterId(opt.id); setRenamingValue(opt.label); } : undefined}
                      className={`relative w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                        isActive ? 'bg-[#e0d4f0] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400 rounded-lg font-medium' : 'text-[#3c4043] dark:text-muted-foreground hover:bg-[#f0eaf7] dark:hover:bg-purple-950/30 hover:text-[#3b2778] dark:hover:text-purple-300 rounded-lg'
                      }`}
                    >
                      <span className={`text-[14px] truncate ${isActive ? 'font-medium' : ''}`}>{opt.label}</span>
                      {count > 0 && (
                        <span className="ml-1 shrink-0 text-[11px] font-medium text-[#5f6368] dark:text-muted-foreground">
                          {count.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Custom Filters */}
                {customFilters.length > 0 && (
                  <>
                    <div className="pt-4 pb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5f6368] dark:text-muted-foreground">Custom</span>
                    </div>
                    {customFilters.map((cf) => {
                      const isActive = activeFilter === cf.id;
                      const isRenaming = renamingFilterId === cf.id;
                      return isRenaming ? (
                        <div key={cf.id} className="py-1.5">
                          <input
                            autoFocus
                            value={renamingValue}
                            onChange={(e) => setRenamingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleFilterRename(cf.id, renamingValue);
                              if (e.key === 'Escape') { setRenamingFilterId(null); setRenamingValue(''); }
                            }}
                            onBlur={() => handleFilterRename(cf.id, renamingValue)}
                            className="w-full h-8 px-2 text-[14px] rounded-md bg-white dark:bg-muted border border-[#1a73e8] dark:border-blue-500 text-[#1f1f1f] dark:text-foreground outline-none"
                          />
                        </div>
                      ) : (
                        <button
                          key={cf.id}
                          onClick={() => setActiveFilter(cf.id)}
                          onDoubleClick={() => { setRenamingFilterId(cf.id); setRenamingValue(cf.label); }}
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

          {/* ── Main Table Area ── */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* ── Copper-Style Content Title Bar ── */}
            <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 bg-white dark:bg-background">

              <div className="flex items-center gap-3 ml-24">
                <h2 className="text-[16px] font-bold text-[#1f1f1f] dark:text-foreground whitespace-nowrap">
                  {filterOptions.find(o => o.id === activeFilter)?.label ?? customFilters.find(cf => cf.id === activeFilter)?.label ?? 'All Contacts'}
                </h2>

                {!isLoading && (
                  <span className="text-[#5f6368] dark:text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                    # {filteredAndSorted.length.toLocaleString()} people
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
                        isNonDefaultSort ? 'bg-[#e0d4f0] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400 rounded-lg font-medium' : 'hover:bg-[#f1f3f4] dark:hover:bg-muted text-[#5f6368] dark:text-muted-foreground'
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
                    isFiltersActive ? 'bg-[#e0d4f0] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400 rounded-lg font-medium' : 'hover:bg-[#f1f3f4] dark:hover:bg-muted text-[#5f6368] dark:text-muted-foreground'
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
                      showColumnsMenu ? 'bg-[#e0d4f0] dark:bg-purple-950/50 text-[#3b2778] dark:text-purple-400 rounded-lg font-medium' : 'hover:bg-[#f1f3f4] dark:hover:bg-muted text-[#5f6368] dark:text-muted-foreground'
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

                {/* Add Person button (Copper dark indigo style) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="h-9 pl-4 pr-3 text-[13px] font-semibold rounded-md shrink-0 flex items-center gap-2 text-white bg-[#3b2778] hover:bg-[#4a3490] active:scale-[0.97] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2778] focus-visible:ring-offset-2 ml-2"
                    >
                      <span>Add Person</span>
                      <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-lg shadow-xl border border-[#dadce0] dark:border-border bg-white dark:bg-popover">
                    <DropdownMenuItem
                      onClick={() => openAddDialog()}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-[14px] font-medium text-[#1f1f1f] dark:text-foreground hover:bg-[#f1f3f4] dark:hover:bg-muted focus:bg-[#f1f3f4] dark:focus:bg-muted transition-colors"
                    >
                      <PlusCircle className="h-4 w-4 text-[#5f6368] dark:text-muted-foreground" />
                      Add Person
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-[14px] font-medium text-[#1f1f1f] dark:text-foreground hover:bg-[#f1f3f4] dark:hover:bg-muted focus:bg-[#f1f3f4] dark:focus:bg-muted transition-colors"
                    >
                      <Download className="h-4 w-4 text-[#5f6368] dark:text-muted-foreground" />
                      Import Contacts
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* ── Content Area: Table or Kanban ── */}
            {viewMode === 'table' ? (
              <div className="flex-1 overflow-auto">
                {/* ── Bulk Selection Toolbar — sticky overlay on table headers ── */}
                {selectedPersonIds.size > 0 && (
                  <div className="sticky top-0 z-40 px-4 py-2 bg-white dark:bg-background border-b border-border">
                    <PipelineBulkToolbar
                      selectedCount={selectedPersonIds.size}
                      totalCount={filteredAndSorted.length}
                      onClearSelection={clearSelection}
                      onEdit={() => setBulkEditOpen(true)}
                      onExport={handleExportSelected}
                      onCreateFilter={handleCreateFilterFromSelection}
                    />
                  </div>
                )}
                <table className="w-full text-sm" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <ColHeader className="sticky top-0 z-30 group/hdr" style={{ left: 0, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                        <div className="shrink-0" title="Select all">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={(checked) => checked ? selectAll() : clearSelection()}
                            className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                          />
                        </div>
                        <User className="h-4 w-4" /> Person
                      </ColHeader>
                      <ColHeader colKey="title" className="sticky top-0 z-10">
                        <Equal className="h-4 w-4" /> Title
                      </ColHeader>
                      <ColHeader colKey="company" className="sticky top-0 z-10">
                        <Landmark className="h-4 w-4" /> Company
                      </ColHeader>
                      <ColHeader colKey="tasks" className="sticky top-0 z-10">
                        <CheckSquare className="h-4 w-4" /> Tasks
                      </ColHeader>
                      <ColHeader colKey="email" className="sticky top-0 z-10">
                        <AtSign className="h-4 w-4" /> Email
                      </ColHeader>
                      <ColHeader colKey="contactType" className="sticky top-0 z-10">
                        <Tag className="h-4 w-4" /> Type
                      </ColHeader>
                      <ColHeader colKey="pipeline" className="sticky top-0 z-10">
                        <Workflow className="h-4 w-4" /> Pipeline
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
                      <th className="w-10 px-2 py-1.5 sticky top-0 z-10" style={{ backgroundColor: '#eee6f6', border: '1px solid #c8bdd6' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 7 }).map((_, i) => (
                        <tr key={i} className="bg-white dark:bg-card">
                          <td className="pl-4 pr-6 py-1.5 sticky left-0 z-[5] bg-white dark:bg-card" style={{ width: columnWidths.person, border: '1px solid #c8bdd6', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                            <div className="flex items-center gap-2.5">
                              <Skeleton className="h-4 w-4 rounded shrink-0" />
                              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3.5 w-36" />
                                <Skeleton className="h-2.5 w-24" />
                              </div>
                            </div>
                          </td>
                          {columnVisibility.title && <td className="px-4 py-1.5" style={{ width: columnWidths.title, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-24 rounded" /></td>}
                          {columnVisibility.company && <td className="px-4 py-1.5" style={{ width: columnWidths.company, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-24 rounded" /></td>}
                          {columnVisibility.tasks && <td className="px-4 py-1.5" style={{ width: columnWidths.tasks, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-8 rounded" /></td>}
                          {columnVisibility.email && <td className="px-4 py-1.5" style={{ width: columnWidths.email, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-32 rounded" /></td>}
                          {columnVisibility.contactType && <td className="px-4 py-1.5" style={{ width: columnWidths.contactType, border: '1px solid #c8bdd6' }}><Skeleton className="h-5 w-20 rounded-full" /></td>}
                          {columnVisibility.pipeline && <td className="px-4 py-1.5" style={{ width: columnWidths.pipeline, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-28 rounded" /></td>}
                          {columnVisibility.lastContacted && <td className="px-4 py-1.5" style={{ width: columnWidths.lastContacted, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.interactions && <td className="px-4 py-1.5" style={{ width: columnWidths.interactions, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-8 rounded" /></td>}
                          {columnVisibility.inactiveDays && <td className="px-4 py-1.5" style={{ width: columnWidths.inactiveDays, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-10 rounded" /></td>}
                          {columnVisibility.tags && <td className="px-4 py-1.5" style={{ width: columnWidths.tags, border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
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
                              <p className="text-sm font-semibold text-foreground">No contacts found</p>
                              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                                {searchTerm ? 'Try adjusting your search or filter criteria' : 'No people have been added yet'}
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
                      filteredAndSorted.map((person, rowIdx) => {
                        const initial = person.name[0]?.toUpperCase() ?? '?';
                        const avatarColor = getAvatarColor(person.name);
                        const typeCfg = contactTypeConfig[person.contact_type ?? 'Other'];
                        const taskCount = taskCountMap[person.id] ?? 0;
                        const interactionCount = interactionCountMap[person.id] ?? 0;
                        const inactiveDays = daysSince(person.last_activity_at);
                        const isStale = inactiveDays !== null && inactiveDays > 7;
                        const isDetailSelected = selectedPerson?.id === person.id;
                        const isBulkSelected = selectedPersonIds.has(person.id);

                        const stickyBg = isDetailSelected
                          ? 'bg-[#eee6f6] dark:bg-purple-950 group-hover:bg-[#e0d4f0] dark:group-hover:bg-purple-900'
                          : isBulkSelected
                            ? 'bg-[#eee6f6] dark:bg-violet-950/30 group-hover:bg-[#e0d4f0] dark:group-hover:bg-violet-900/40'
                            : 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted';

                        return (
                          <tr
                            key={person.id}
                            onClick={() => handleRowClick(person)}
                            className={`cursor-pointer transition-colors duration-200 group ${
                              isDetailSelected
                                ? 'bg-[#eee6f6] dark:bg-purple-950/30 hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40 border-l-[3px] border-l-[#3b2778]'
                                : isBulkSelected
                                  ? 'bg-[#eee6f6]/60 dark:bg-violet-950/20 hover:bg-[#eee6f6]/80'
                                  : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                            }`}
                          >
                            {/* Person + Checkbox (sticky) */}
                            <td className={`pl-4 pr-6 py-3 overflow-hidden sticky left-0 z-[5] transition-colors ${stickyBg}`} style={{ width: columnWidths.person, border: '1px solid #c8bdd6', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                              <div className="flex items-center gap-4">
                                <div className="shrink-0" title="Select" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isBulkSelected}
                                    onCheckedChange={() => togglePersonSelection(person.id)}
                                    className="h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                                  />
                                </div>
                                <div className="h-7 w-7 rounded-full shrink-0 shadow-sm overflow-hidden">
                                  {person.image_url ? (
                                    <img src={person.image_url} alt={person.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className={`h-full w-full ${avatarColor} flex items-center justify-center text-white text-[11px] font-bold`}>
                                      {initial}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="relative flex items-center">
                                    <p className="font-semibold text-[#202124] dark:text-foreground truncate text-[13px] leading-tight flex-1 min-w-0">
                                      {person.name}
                                    </p>
                                    <button
                                      type="button"
                                      title="Open expanded view"
                                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/contacts/people/expanded-view/${person.id}`); }}
                                      className="absolute right-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                                    >
                                      <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Title */}
                            {columnVisibility.title && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.title, border: '1px solid #c8bdd6' }}>
                                <span className="text-[13px] text-[#5f6368] dark:text-foreground/80 truncate block max-w-[120px]">{person.title ?? '—'}</span>
                              </td>
                            )}

                            {/* Company */}
                            {columnVisibility.company && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.company, border: '1px solid #c8bdd6' }}>
                                {person.company_name ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                                      <Building2 className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                    <span className="text-[13px] text-[#202124] dark:text-foreground/80 truncate max-w-[110px]">{person.company_name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Tasks */}
                            {columnVisibility.tasks && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.tasks, border: '1px solid #c8bdd6' }}>
                                {taskCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[12px] text-[#5f6368] dark:text-muted-foreground">
                                    <CheckSquare className="h-3.5 w-3.5 text-[#80868b] dark:text-muted-foreground" />
                                    {taskCount}
                                  </span>
                                ) : (
                                  <CheckSquare className="h-3.5 w-3.5 text-[#dadce0] dark:text-muted-foreground/30" />
                                )}
                              </td>
                            )}

                            {/* Email */}
                            {columnVisibility.email && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.email, border: '1px solid #c8bdd6' }}>
                                {person.email ? (
                                  <span className="text-[13px] text-[#202124] dark:text-foreground/80 truncate block max-w-[160px]">{person.email}</span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Contact Type */}
                            {columnVisibility.contactType && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.contactType, border: '1px solid #c8bdd6' }}>
                                {typeCfg ? (
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${typeCfg.bg} ${typeCfg.color}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${typeCfg.dot}`} />
                                    {typeCfg.label}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">{person.contact_type}</span>
                                )}
                              </td>
                            )}

                            {/* Pipeline / Stage */}
                            {columnVisibility.pipeline && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.pipeline, border: '1px solid #c8bdd6' }}>
                                {person._pipelineName ? (
                                  <span className="text-[12px] text-foreground whitespace-nowrap truncate">
                                    <span className="font-semibold">{person._pipelineName}</span>
                                    {person._stageName && (
                                      <span className="text-muted-foreground font-normal">{' > '}{person._stageName}</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">--</span>
                                )}
                              </td>
                            )}

                            {/* Last Contacted */}
                            {columnVisibility.lastContacted && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.lastContacted, border: '1px solid #c8bdd6' }}>
                                <span className="text-[12px] text-muted-foreground tabular-nums">{formatShortDate(person.last_activity_at)}</span>
                              </td>
                            )}

                            {/* Interactions */}
                            {columnVisibility.interactions && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.interactions, border: '1px solid #c8bdd6' }}>
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
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.inactiveDays, border: '1px solid #c8bdd6' }}>
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
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.tags, border: '1px solid #c8bdd6' }}>
                                {person.tags && person.tags.length > 0 ? (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    {person.tags.slice(0, 2).map((tag) => (
                                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60">
                                        {tag}
                                      </span>
                                    ))}
                                    {person.tags.length > 2 && (
                                      <span className="text-[10px] text-muted-foreground font-medium">+{person.tags.length - 2}</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Detail arrow */}
                            <td className="px-2 py-1.5 w-10" style={{ border: '1px solid #c8bdd6' }} title="Open detail panel">
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
                    {CONTACT_TYPES.map((type) => {
                      const cfg = contactTypeConfig[type];
                      const columnPeople = filteredAndSorted.filter(p => p.contact_type === type);
                      return (
                        <KanbanDropColumn
                          key={type}
                          contactType={type}
                          label={cfg?.label ?? type}
                          color={cfg?.dot ?? 'bg-muted-foreground'}
                          people={columnPeople}
                          draggedId={draggedPerson?.id ?? null}
                          onPersonClick={handleRowClick}
                        />
                      );
                    })}
                  </div>
                </div>
                <DragOverlay>
                  {draggedPerson ? (
                    <Card className="p-3 shadow-lg border border-blue-300 rotate-2 cursor-grabbing w-56 bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`h-5 w-5 rounded-full ${getAvatarColor(draggedPerson.name)} flex items-center justify-center text-white text-[10px] font-bold`}>
                          {draggedPerson.name[0]?.toUpperCase()}
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{draggedPerson.name}</p>
                      </div>
                    </Card>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </main>

          {/* ── Right Detail Panel (overlay) ── */}
          {selectedPerson && !filterPanelOpen && (
            <div ref={detailPanelRef} className="absolute right-0 top-0 z-50">
              <PeopleDetailPanel
                person={selectedPerson}
                contactTypeConfig={contactTypeConfig}
                teamMemberMap={teamMemberMap}
                teamMembers={teamMembers}
                onClose={() => setSelectedPerson(null)}
                onExpand={() => {
                  navigate(`/admin/contacts/people/expanded-view/${selectedPerson.id}`);
                }}
                onContactTypeChange={(personId, newType) => {
                  contactTypeMutation.mutate({ personId, newType, oldType: selectedPerson.contact_type ?? 'Other' });
                  setSelectedPerson({ ...selectedPerson, contact_type: newType });
                }}
                onPersonUpdate={(updatedPerson) => setSelectedPerson(updatedPerson)}
              />
            </div>
          )}

          {/* ── Right Filter Panel ── */}
          {filterPanelOpen && (
            <PeopleFilterPanel
              teamMemberMap={teamMemberMap}
              contactTypes={filterOptions.filter(o => o.editable).map(o => o.id)}
              onClose={() => setFilterPanelOpen(false)}
              onSave={(filter) => {
                const id = `custom_${Date.now()}`;
                setCustomFilters(prev => [...prev, { id, label: filter.filterName, values: filter }]);
                setActiveFilter(id);
                setFilterPanelOpen(false);
                toast.success(`Filter "${filter.filterName}" created`);
              }}
            />
          )}
        </div>
      </div>

      {/* ── Add Person Dialog ── */}
      {/* ── Bulk Edit Contact Type Dialog ── */}
      <Dialog open={bulkEditOpen} onOpenChange={(open) => { setBulkEditOpen(open); if (!open) setBulkContactType(''); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Contact Type</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Update contact type for {selectedPersonIds.size} selected {selectedPersonIds.size === 1 ? 'person' : 'people'}.
          </p>
          <Select value={bulkContactType} onValueChange={setBulkContactType}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select contact type" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(contactTypeConfig).map((type) => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setBulkEditOpen(false); setBulkContactType(''); }}>Cancel</Button>
            <Button
              disabled={!bulkContactType || bulkContactTypeMutation.isPending}
              onClick={() => bulkContactTypeMutation.mutate({ personIds: Array.from(selectedPersonIds), newType: bulkContactType })}
              className="bg-[#3b2778] hover:bg-[#2d1d5e] text-white"
            >
              {bulkContactTypeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addPersonOpen} onOpenChange={setAddPersonOpen}>
        <DialogContent className="sm:max-w-[560px] p-0 max-h-[90vh] flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="text-xl font-bold text-foreground">Add a New Person</DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-5 overflow-y-auto flex-1 min-h-0">
            {/* Name with avatar */}
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 mt-1">
                <User className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="flex-1">
                <label className="text-sm font-semibold text-foreground block mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  autoFocus
                  placeholder="Full Name"
                  value={newPerson.name}
                  onChange={(e) => setNewPerson(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-base text-foreground bg-transparent border-b border-border pb-2 outline-none focus:border-blue-500 placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {/* Company */}
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Company</label>
              <input
                placeholder="Add Company"
                value={newPerson.company_name}
                onChange={(e) => setNewPerson(prev => ({ ...prev, company_name: e.target.value }))}
                className="w-full text-base text-foreground bg-transparent border-b border-border pb-2 outline-none focus:border-blue-500 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Known As (Nick Name) */}
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Known As (Nick Name)</label>
              <input
                placeholder="Add Known As (Nick Name)"
                value={newPerson.known_as}
                onChange={(e) => setNewPerson(prev => ({ ...prev, known_as: e.target.value }))}
                className="w-full text-base text-foreground bg-transparent border-b border-border pb-2 outline-none focus:border-blue-500 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* CLX - File Name */}
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">CLX - File Name</label>
              <input
                placeholder="Add CLX - File Name"
                value={newPerson.clx_file_name}
                onChange={(e) => setNewPerson(prev => ({ ...prev, clx_file_name: e.target.value }))}
                className="w-full text-base text-foreground bg-transparent border-b border-border pb-2 outline-none focus:border-blue-500 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Title */}
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Title</label>
              <input
                placeholder="Add Title"
                value={newPerson.title}
                onChange={(e) => setNewPerson(prev => ({ ...prev, title: e.target.value }))}
                className="w-full text-base text-foreground bg-transparent border-b border-border pb-2 outline-none focus:border-blue-500 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Contact Type + Owner row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground block mb-1">Contact Type</label>
                <Select value={addPersonType} onValueChange={setAddPersonType}>
                  <SelectTrigger className="w-full text-base border-0 border-b border-border rounded-none shadow-none px-0 h-auto pb-2 focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{contactTypeConfig[type].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground block mb-1">Owner</label>
                <Select value={newPerson.assigned_to} onValueChange={(v) => setNewPerson(prev => ({ ...prev, assigned_to: v }))}>
                  <SelectTrigger className="w-full text-base border-0 border-b border-border rounded-none shadow-none px-0 h-auto pb-2 focus:ring-0">
                    <SelectValue placeholder="Select Owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Work Email + Work Phone row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground block mb-1">Work Email</label>
                <input
                  placeholder="Add Email"
                  type="email"
                  value={newPerson.email}
                  onChange={(e) => setNewPerson(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full text-base text-foreground bg-transparent border-b border-border pb-2 outline-none focus:border-blue-500 placeholder:text-muted-foreground/50"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-foreground block mb-1">Work Phone</label>
                <input
                  placeholder="Add Phone"
                  type="tel"
                  value={newPerson.phone}
                  onChange={(e) => setNewPerson(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full text-base text-foreground bg-transparent border-b border-border pb-2 outline-none focus:border-blue-500 placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {/* Direct Phone */}
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Direct Phone</label>
              <input
                placeholder="Add Direct Phone"
                type="tel"
                value={newPerson.direct_phone}
                onChange={(e) => setNewPerson(prev => ({ ...prev, direct_phone: e.target.value }))}
                className="w-full text-base text-foreground bg-transparent border-b border-border pb-2 outline-none focus:border-blue-500 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Fax Phone */}
            <div>
              <label className="text-sm font-semibold text-foreground block mb-1">Fax Phone</label>
              <input
                placeholder="Add Fax Phone"
                type="tel"
                value={newPerson.fax_phone}
                onChange={(e) => setNewPerson(prev => ({ ...prev, fax_phone: e.target.value }))}
                className="w-full text-base text-foreground bg-transparent border-b border-border pb-2 outline-none focus:border-blue-500 placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center gap-3 shrink-0">
            <button
              onClick={() => setAddPersonOpen(false)}
              className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 uppercase tracking-wide px-4 py-2"
            >
              Cancel
            </button>
            <Button
              onClick={handleCreatePerson}
              disabled={!newPerson.name.trim() || createPersonMutation.isPending}
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold uppercase tracking-wide rounded-full px-6"
            >
              {createPersonMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </EvanLayout>
  );
};

export default People;
