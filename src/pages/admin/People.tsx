import { useState, useMemo, useRef, useEffect } from 'react';
import { useAutoFitColumns } from '@/hooks/useAutoFitColumns';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { usePageDatabases } from '@/hooks/usePageDatabases';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addRecentlyViewed } from '@/lib/recentlyViewed';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import PeopleDetailPanel from '@/components/admin/PeopleDetailPanel';
import PipelineBulkToolbar from '@/components/admin/PipelineBulkToolbar';
import PipelineSettingsPopover from '@/components/admin/PipelineSettingsDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectAllHeader } from '@/components/admin/SelectAllHeader';
import { CustomFilterValues } from '@/components/admin/CreateFilterDialog';
import PeopleFilterPanel from '@/components/admin/PeopleFilterPanel';
import { SavedFiltersSidebar, type SavedFilterOption } from '@/components/admin/SavedFiltersSidebar';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import DraggableTh from '@/components/admin/DraggableTh';
import DraggableColumnsContext from '@/components/admin/DraggableColumnsContext';
import { makeColumnDragOverlay } from '@/components/admin/columnDragOverlay';
import { useColumnOrder } from '@/hooks/useColumnOrder';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import {
  ArrowUpDown,
  ArrowLeft,
  PanelLeft,
  Filter,
  Settings2,
  ChevronDown,
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
  Columns3,
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
  BarChart3,
  Equal,
  Landmark,
  AtSign,
  Search,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  GitMerge,
} from 'lucide-react';
import {
  KanbanBoard,
  KanbanColumn,
  KanbanCardShell,
  useKanbanDrag,
} from '@/components/admin/pipeline/kanban';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { useUndo } from '@/contexts/UndoContext';
import { useAllPipelineLeads } from '@/hooks/useAllPipelineLeads';
import BulkImportDialog from '@/components/admin/BulkImportDialog';
import MergePeopleDialog from '@/components/admin/MergePeopleDialog';
import { format, differenceInDays, parseISO } from 'date-fns';


// ── Person type (from people table) ──
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

const DEFAULT_FILTER_OPTIONS: SavedFilterOption[] = [
  { id: 'all', label: 'All Contacts', group: 'top', editable: false },
  { id: 'Current Customer', label: 'Current Customers', group: 'public', editable: true },
  { id: 'my_contacts', label: 'My People', group: 'public', editable: false },
  { id: 'following', label: 'People I\'m Following', group: 'public', editable: false },
  { id: 'Potential Customer', label: 'Potential Customers', group: 'public', editable: true },
  { id: 'CLX RateWatch', label: 'CLX RateWatch', group: 'public', editable: true },
  { id: 'CLX Referral Partner', label: 'CLX Referral Partners', group: 'public', editable: true },
  { id: 'Searching for Bus. Acq.', label: 'Searching for Bus. Acq.', group: 'public', editable: true },
  { id: 'Searching for RE Acq.', label: 'Searching for RE Acq.', group: 'public', editable: true },
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

// Order matters here: this is the default left-to-right column order.
// Reordering at runtime is persisted per-user via `useColumnOrder`.
const REORDERABLE_COLUMNS: ColumnKey[] = [
  'title', 'company', 'tasks', 'email', 'contactType',
  'pipeline', 'lastContacted', 'interactions', 'inactiveDays', 'tags',
];

const COLUMN_HEADERS: Record<ColumnKey, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  title: { icon: Equal, label: 'Title' },
  company: { icon: Landmark, label: 'Company' },
  tasks: { icon: CheckSquare, label: 'Tasks' },
  email: { icon: AtSign, label: 'Email' },
  contactType: { icon: Tag, label: 'Type' },
  pipeline: { icon: Workflow, label: 'Pipeline' },
  lastContacted: { icon: CalendarDays, label: 'Contacted' },
  interactions: { icon: MessageSquare, label: 'Activity' },
  inactiveDays: { icon: Moon, label: 'Dormant' },
  tags: { icon: Tag, label: 'Tags' },
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

// ── Kanban card (domain-specific body/footer; chrome lives in KanbanCardShell) ──
function PersonCard({ person, isDragging, onClick }: {
  person: Person;
  isDragging?: boolean;
  onClick: () => void;
}) {
  const navigate = useNavigate();
  return (
    <KanbanCardShell
      id={person.id}
      title={person.name}
      isDragging={isDragging}
      onClick={onClick}
      onExpand={() => navigate(`/admin/people/person/${person.id}`)}
      body={
        <>
          {person.company_name && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <Landmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{person.company_name}</span>
            </div>
          )}
          {person.title && (
            <div className="flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{person.title}</span>
            </div>
          )}
        </>
      }
      footer={
        <>
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            {person.email && (
              <div className="flex items-center gap-1">
                <AtSign className="h-3 w-3 shrink-0" />
                <span className="text-[11px] truncate max-w-[120px]">{person.email}</span>
              </div>
            )}
          </div>
          {person.contact_type && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{person.contact_type}</span>
          )}
        </>
      }
    />
  );
}

const People = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { registerUndo } = useUndo();
  const { teamMember } = useTeamMember();
  usePageDatabases([
    { table: 'people', access: 'readwrite', usage: 'CRM people records — listed, inline-edited, bulk-deleted from this page.', via: 'src/hooks/useAllPipelineLeads.ts + direct supabase.from in People.tsx' },
    { table: 'pipeline_leads', access: 'read', usage: 'Deal/company associations shown per person row.', via: 'src/hooks/useAllPipelineLeads.ts' },
    { table: 'users', access: 'read', usage: 'Assignable owners + team-member avatars on each person.', via: 'src/hooks/useAssignableUsers.ts, src/hooks/useTeamMember.ts' },
    { table: 'companies', access: 'read', usage: 'Company names shown alongside each person.', via: 'src/hooks/useAllPipelineLeads.ts' },
  ]);

  // ── Core state ──
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_activity_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

  // ── Column sort menu state ──
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);

  // ── Toolbar state ──
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [rowDensity, setRowDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Filter options (stateful so public filters can be renamed)
  const [filterOptions, setFilterOptions] = useState(DEFAULT_FILTER_OPTIONS);

  // Custom filters
  const [customFilters, setCustomFilters] = useState<Array<{ id: string; label: string; values: CustomFilterValues }>>([]);

  // Rename public filter (contact type) — updates all leads in DB
  const renameContactTypeMutation = useMutation({
    mutationFn: async ({ oldType, newType }: { oldType: string; newType: string }) => {
      // Capture affected person IDs before the rename so undo is scoped to only these records
      const { data: affectedPeople } = await supabase
        .from('people')
        .select('id')
        .eq('contact_type', oldType);
      const affectedIds = (affectedPeople ?? []).map(l => l.id);
      const { error } = await supabase
        .from('people')
        .update({ contact_type: newType })
        .eq('contact_type', oldType);
      if (error) throw error;
      return { oldType, newType, affectedIds };
    },
    onSuccess: ({ oldType, newType, affectedIds }) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      registerUndo({
        label: `Renamed contact type "${oldType}" to "${newType}"`,
        execute: async () => {
          if (affectedIds.length === 0) return;
          const { error } = await supabase.from('people').update({ contact_type: oldType }).in('id', affectedIds);
          if (error) throw error;
          // Revert sidebar filter UI state to match reverted DB values
          setFilterOptions(prev => prev.map(o =>
            o.id === newType ? { ...o, id: oldType, label: oldType } : o
          ));
          setActiveFilter(prev => prev === newType ? oldType : prev);
          queryClient.invalidateQueries({ queryKey: ['people'] });
        },
      });
    },
    onError: () => toast.error('Failed to rename contact type'),
  });

  const handleFilterRename = (
    filter: { id: string; kind: 'public' | 'custom'; currentLabel: string },
    newLabel: string,
  ) => {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === filter.id) return;

    if (filter.kind === 'public') {
      // Update filter options state (both id and label)
      setFilterOptions(prev => prev.map(o =>
        o.id === filter.id ? { ...o, id: trimmed, label: trimmed } : o
      ));
      // Update active filter if it was the one being renamed
      if (activeFilter === filter.id) setActiveFilter(trimmed);
      // Update DB — rename contact_type on all leads
      renameContactTypeMutation.mutate({ oldType: filter.id, newType: trimmed });
      toast.success(`Renamed "${filter.currentLabel}" to "${trimmed}"`);
    } else {
      // Custom filter rename (local only)
      setCustomFilters(prev => prev.map(cf =>
        cf.id === filter.id ? { ...cf, label: trimmed } : cf
      ));
    }
  };

  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    title: true, company: true, tasks: true, email: true, contactType: true,
    pipeline: true, lastContacted: true, interactions: true, inactiveDays: true, tags: true,
  });

  // ── Top bar: inject title + search into AdminLayout header ──
  const { setPageTitle, setSearchComponent } = useAdminTopBar();

  useEffect(() => {
    setPageTitle('People');
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

  // ── Contact type update mutation for Kanban drag ──
  const contactTypeMutation = useMutation({
    mutationFn: async ({ personId, newType, oldType }: { personId: string; newType: string; oldType: string }) => {
      const { error } = await supabase
        .from('people')
        .update({ contact_type: newType })
        .eq('id', personId);
      if (error) throw error;
      try {
        const { error: activityError } = await supabase.from('activities').insert({
          entity_id: personId,
          entity_type: 'people',
          activity_type: 'type_change',
          title: `Changed from ${oldType} to ${newType}`,
          content: JSON.stringify({ from: oldType, to: newType }),
        });
        if (activityError) throw activityError;
      } catch (e) {
        console.warn('[People] activity log failed (non-fatal):', e);
      }
      return { personId, oldType, newType };
    },
    onMutate: async ({ personId, newType }) => {
      await queryClient.cancelQueries({ queryKey: ['people'] });
      const previous = queryClient.getQueryData<any[]>(['people']);
      if (previous) {
        queryClient.setQueryData<any[]>(
          ['people'],
          previous.map((p) => (p.id === personId ? { ...p, contact_type: newType } : p)),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['people'], ctx.previous);
      toast.error('Failed to update contact type');
    },
    onSuccess: ({ personId, oldType, newType }) => {
      toast.success('Contact type updated');
      registerUndo({
        label: `Changed contact type to "${newType}"`,
        execute: async () => {
          const { error } = await supabase.from('people').update({ contact_type: oldType }).eq('id', personId);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['people'] });
        },
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
    },
  });

  // ── Bulk Import state ──
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  // ── Add Person state ──
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [addPersonType, setAddPersonType] = useState<string>('Prospect');
  const [newPerson, setNewPerson] = useState({ name: '', title: '', company_name: '', email: '', phone: '', contact_type: 'Prospect', known_as: '', clx_file_name: '', assigned_to: '', direct_phone: '', fax_phone: '' });

  const createPersonMutation = useMutation({
    mutationFn: async (data: { name: string; title: string; company_name: string; email: string; phone: string; contact_type: string; known_as: string; clx_file_name: string; assigned_to: string; direct_phone: string; fax_phone: string }) => {
      // Insert into people
      const { data: person, error } = await supabase
        .from('people')
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

      // Insert extra phone numbers into entity_phones
      const phonesToInsert = [
        data.direct_phone ? { entity_id: person.id, entity_type: 'people', phone_number: data.direct_phone, phone_type: 'direct' } : null,
        data.fax_phone ? { entity_id: person.id, entity_type: 'people', phone_number: data.fax_phone, phone_type: 'fax' } : null,
      ].filter(Boolean);
      if (phonesToInsert.length > 0) {
        await supabase.from('entity_phones').insert(phonesToInsert);
      }

      return person as Person;
    },
    onSuccess: (person) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setAddPersonOpen(false);
      setNewPerson({ name: '', title: '', company_name: '', email: '', phone: '', contact_type: 'Prospect', known_as: '', clx_file_name: '', assigned_to: '', direct_phone: '', fax_phone: '' });
      toast.success(`"${person.name}" added as ${person.contact_type}`);
      setSelectedPerson(person);
      registerUndo({
        label: `Created "${person.name}"`,
        execute: async () => {
          const { error } = await supabase.from('people').delete().eq('id', person.id);
          if (error) throw error;
          setSelectedPerson(null);
          queryClient.invalidateQueries({ queryKey: ['people'] });
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

  // ── Queries ──
  const { data: teamMembers = [] } = useAssignableUsers();

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
        .from('activities')
        .select('entity_id')
        .eq('entity_type', 'people')
        .in('entity_id', people.map((p) => p.id));
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      for (const row of data) {
        counts[row.entity_id] = (counts[row.entity_id] || 0) + 1;
      }
      return counts;
    },
    enabled: people.length > 0,
  });

  const { data: interactionCountMap = {} } = useQuery({
    queryKey: ['people-interaction-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('entity_id')
        .eq('entity_type', 'people')
        .in('entity_id', people.map((p) => p.id));
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      for (const row of data) {
        counts[row.entity_id] = (counts[row.entity_id] || 0) + 1;
      }
      return counts;
    },
    enabled: people.length > 0,
  });

  // Query followed people for "People I'm Following" filter
  const { data: followedLeadIds = [] } = useQuery({
    queryKey: ['followed-people', teamMember?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('entity_followers')
        .select('entity_id')
        .eq('entity_type', 'people')
        .eq('user_id', teamMember!.id);
      return (data ?? []).map(r => r.entity_id);
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

  const { dragged: draggedPerson, handleDragStart, handleDragEnd } = useKanbanDrag<Person>({
    items: filteredAndSorted,
    getGroupKey: (p) => p.contact_type,
    validGroupKeys: CONTACT_TYPES,
    onMove: (person, from, to) =>
      contactTypeMutation.mutate({ personId: person.id, newType: to, oldType: from || 'Other' }),
  });

  const { columnWidths, handleColumnResize } = useAutoFitColumns({
    minWidths: {
      person: 260, title: 130, company: 130, tasks: 55, email: 170,
      contactType: 200, pipeline: 220, lastContacted: 180, interactions: 130, inactiveDays: 140, tags: 200,
    },
    autoFitConfig: {
      person: { getText: (p: any) => p.name, extraPx: 58 },
      title: { getText: (p: any) => p.title },
      company: { getText: (p: any) => p.company_name, extraPx: 32 },
      email: { getText: (p: any) => p.email },
      pipeline: { getText: (p: any) => (p._pipelineName ?? '') + (p._stageName ? ' > ' + p._stageName : '') },
    },
    data: filteredAndSorted,
    storageKey: 'people-col-widths-v2',
  });

  const { orderedKeys, reorderableKeys, handleDragEnd: handleColumnReorder } = useColumnOrder({
    tableId: 'people',
    defaultOrder: REORDERABLE_COLUMNS,
  });
  const visibleOrderedKeys = useMemo(
    () => (orderedKeys as ColumnKey[]).filter(k => columnVisibility[k]),
    [orderedKeys, columnVisibility],
  );

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
    addRecentlyViewed({ id: person.id, name: person.name, title: person.title, company: person.company_name });
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
        .from('people')
        .select('id, contact_type')
        .in('id', personIds);
      const { error } = await supabase
        .from('people')
        .update({ contact_type: newType })
        .in('id', personIds);
      if (error) throw error;
      return { prevRecords: prevRecords ?? [], newType };
    },
    onSuccess: ({ prevRecords, newType }) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      clearSelection();
      setBulkEditOpen(false);
      setBulkContactType('');
      toast.success('Contact type updated for selected people');
      registerUndo({
        label: `Bulk changed ${prevRecords.length} contacts to "${newType}"`,
        execute: async () => {
          for (const rec of prevRecords) {
            const { error: e } = await supabase.from('people').update({ contact_type: rec.contact_type }).eq('id', rec.id);
            if (e) throw e;
          }
          queryClient.invalidateQueries({ queryKey: ['people'] });
        },
      });
    },
    onError: () => toast.error('Failed to update contact type'),
  });

  // ── Merge two people ──
  const mergeMutation = useMutation({
    mutationFn: async (args: {
      winnerId: string;
      loserId: string;
      resolvedFields: Record<string, unknown>;
    }) => {
      const { error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>)('merge_people', {
        p_winner_id: args.winnerId,
        p_loser_id: args.loserId,
        p_resolved_fields: args.resolvedFields,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['allPipelineLeads'] });
      clearSelection();
      setMergeDialogOpen(false);
      toast.success('People merged successfully');
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error(`Merge failed: ${msg}`);
    },
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

  // IMPORTANT: this is a regular helper function, NOT a React component.
  // Defining it as a component (e.g. `const ColHeader = (...) => ...`) inside
  // the parent body would create a new component reference on every render of
  // `People`, causing React to unmount + remount each `<th>` whenever any
  // state changes. With `DndContext` tracking pointer movement, that
  // remount-thrashing manifests as the column flashing white→purple on hover.
  // Calling it as `{renderColHeader({...})}` keeps the th part of the
  // parent's JSX and avoids the remount entirely.
  const renderColHeader = ({
    reactKey,
    colKey,
    children,
    className: extraClassName,
    style: extraStyle,
  }: {
    reactKey?: string;
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
    const sortMenu = sortOptions ? (
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
    ) : null;
    return (
      <DraggableTh
        key={reactKey}
        columnId={widthKey}
        width={width}
        onResize={handleColumnResize}
        draggable={!!colKey}
        className={extraClassName}
        style={extraStyle}
        trailing={sortMenu}
      >
        {children}
      </DraggableTh>
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
            filterOptions={filterOptions}
            customFilters={customFilters}
            filterCounts={filterCounts}
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            onRenameFilter={handleFilterRename}
            createFilterAction={
              <button
                onClick={() => { setFilterPanelOpen(true); setSelectedPerson(null); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#3b2778] bg-[#eee6f6] hover:bg-[#e0d4f0] dark:text-purple-300 dark:bg-purple-950/40 dark:hover:bg-purple-950/60 transition-colors"
                title="Create new filter"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </button>
            }
          />

          {/* ── Main Table Area ── */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* ── Copper-Style Content Title Bar ── */}
            <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 bg-[#f8f9fa] dark:bg-muted/30">

              <div className="flex items-center gap-3 ml-24">
                <h2 className="text-[16px] font-bold text-[#1f1f1f] dark:text-foreground whitespace-nowrap">
                  {filterOptions.find(o => o.id === activeFilter)?.label ?? customFilters.find(cf => cf.id === activeFilter)?.label ?? 'All Contacts'}
                </h2>
                {!isLoading && (
                  <span className="text-[#5f6368] dark:text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                    # {filteredAndSorted.length.toLocaleString()} {filteredAndSorted.length === 1 ? 'person' : 'people'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Sort control (Kanban only — table view uses column-header clicks) */}
                {viewMode === 'kanban' && (
                  <div className="flex items-center gap-1 mr-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 px-2.5 flex items-center gap-1.5 text-[12px] font-medium rounded-lg text-[#3b2778] dark:text-purple-400 bg-[#f0ebf5] dark:bg-purple-950/40 hover:bg-[#e4dbef] dark:hover:bg-purple-900/60 transition-colors">
                          <ArrowUpDown className="h-3.5 w-3.5" />
                          <span className="text-[11px] text-[#8c7bab] dark:text-purple-600">Sort:</span>
                          <span>{sortFieldLabel}</span>
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-lg shadow-xl border border-[#dadce0] dark:border-border bg-white dark:bg-popover">
                        {SORT_FIELD_OPTIONS.map((opt) => (
                          <DropdownMenuItem
                            key={opt.value}
                            onClick={() => setSortField(opt.value)}
                            className="flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-[13px] font-medium text-[#1f1f1f] dark:text-foreground hover:bg-[#f1f3f4] dark:hover:bg-muted focus:bg-[#f1f3f4] dark:focus:bg-muted transition-colors"
                          >
                            <span>{opt.label}</span>
                            {sortField === opt.value && <Check className="h-3.5 w-3.5 text-[#3b2778] dark:text-purple-400" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-[#3b2778] dark:text-purple-400 bg-[#f0ebf5] dark:bg-purple-950/40 hover:bg-[#e4dbef] dark:hover:bg-purple-900/60 transition-colors"
                        >
                          {sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {sortDir === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending'}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}

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

                {/* Merge button — enabled only when exactly 2 people are selected */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-2">
                      <button
                        type="button"
                        disabled={selectedPersonIds.size !== 2}
                        onClick={() => setMergeDialogOpen(true)}
                        className="h-9 px-3 text-[13px] font-semibold rounded-md flex items-center gap-2 border border-[#dadce0] dark:border-border bg-white dark:bg-card text-[#3b2778] dark:text-purple-300 hover:bg-[#f0ebf5] dark:hover:bg-purple-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <GitMerge className="h-4 w-4" />
                        Merge
                      </button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {selectedPersonIds.size === 2
                      ? 'Merge the two selected people'
                      : 'Select exactly 2 people to merge'}
                  </TooltipContent>
                </Tooltip>

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
                      onClick={() => setBulkImportOpen(true)}
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
                    <DraggableColumnsContext
                      items={reorderableKeys.filter(k => columnVisibility[k as ColumnKey])}
                      onDragEnd={handleColumnReorder}
                      renderOverlay={makeColumnDragOverlay(COLUMN_HEADERS, k => columnWidths[k])}
                    >
                      <tr style={{ backgroundColor: '#eee6f6' }}>
                        {renderColHeader({
                          reactKey: 'person',
                          className: 'sticky top-0 z-30 group/hdr',
                          style: { left: 0, borderLeft: 'none', boxShadow: 'inset 1px 0 0 #c8bdd6, 2px 0 4px -2px rgba(0,0,0,0.15)' },
                          children: (
                            <>
                              <div className="shrink-0" title="Select all">
                                <Checkbox
                                  checked={isAllSelected}
                                  onCheckedChange={(checked) => checked ? selectAll() : clearSelection()}
                                  className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                                />
                              </div>
                              <User className="h-4 w-4" /> Person
                            </>
                          ),
                        })}
                        {visibleOrderedKeys.map((key) => {
                          const def = COLUMN_HEADERS[key];
                          const Icon = def.icon;
                          return renderColHeader({
                            reactKey: key,
                            colKey: key,
                            className: 'sticky top-0 z-10',
                            children: (<><Icon className="h-4 w-4" /> {def.label}</>),
                          });
                        })}
                        <th className="w-10 px-2 py-1.5 sticky top-0 z-10" style={{ backgroundColor: '#eee6f6', border: '1px solid #c8bdd6' }} />
                      </tr>
                    </DraggableColumnsContext>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      Array.from({ length: 7 }).map((_, i) => (
                        <tr key={i} className="bg-white dark:bg-card">
                          <td className="pl-4 pr-5 py-1.5 sticky left-0 z-[5] bg-white dark:bg-card" style={{ width: columnWidths.person, border: '1px solid #c8bdd6', borderLeft: 'none', boxShadow: 'inset 1px 0 0 #c8bdd6, 2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                            <div className="flex items-center gap-2.5">
                              <Skeleton className="h-4 w-4 rounded shrink-0" />
                              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                              <div className="space-y-1.5">
                                <Skeleton className="h-3.5 w-36" />
                                <Skeleton className="h-2.5 w-24" />
                              </div>
                            </div>
                          </td>
                          {visibleOrderedKeys.map((key) => {
                            const skeletonW: Record<ColumnKey, string> = {
                              title: 'h-3.5 w-24 rounded', company: 'h-3.5 w-24 rounded', tasks: 'h-3.5 w-8 rounded',
                              email: 'h-3.5 w-32 rounded', contactType: 'h-5 w-20 rounded-full', pipeline: 'h-3.5 w-28 rounded',
                              lastContacted: 'h-3.5 w-20 rounded', interactions: 'h-3.5 w-8 rounded',
                              inactiveDays: 'h-3.5 w-10 rounded', tags: 'h-3.5 w-16 rounded',
                            };
                            return (
                              <td key={key} className="px-4 py-1.5" style={{ width: columnWidths[key], border: '1px solid #c8bdd6' }}>
                                <Skeleton className={skeletonW[key]} />
                              </td>
                            );
                          })}
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
                        const typeCfg = contactTypeConfig[person.contact_type ?? 'Other'];
                        const taskCount = taskCountMap[person.id] ?? 0;
                        const interactionCount = interactionCountMap[person.id] ?? 0;
                        const inactiveDays = daysSince(person.last_activity_at);
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
                                ? 'bg-[#eee6f6] dark:bg-purple-950/30 hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40'
                                : isBulkSelected
                                  ? 'bg-[#eee6f6]/60 dark:bg-violet-950/20 hover:bg-[#eee6f6]/80'
                                  : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                            }`}
                          >
                            {/* Person + Checkbox (sticky) */}
                            <td className={`pl-2 pr-1.5 py-1.5 overflow-hidden sticky left-0 z-[5] transition-colors ${stickyBg} ${isDetailSelected ? 'border-l-[3px] border-l-[#3b2778]' : ''}`} style={{ width: columnWidths.person, border: '1px solid #c8bdd6', borderLeft: 'none', boxShadow: 'inset 1px 0 0 #c8bdd6, 2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                              <div className="flex items-center gap-2">
                                <div className="shrink-0" title="Select" onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isBulkSelected}
                                    onCheckedChange={() => togglePersonSelection(person.id)}
                                    className="h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                                  />
                                </div>
                                <div className="flex items-center gap-2 min-w-0 flex-1 bg-[#f1f3f4] dark:bg-muted rounded-full pl-0.5 pr-3 py-0.5">
                                  <CrmAvatar name={person.name} imageUrl={person.image_url} />
                                  <span className="text-[16px] text-[#202124] dark:text-foreground truncate">{person.name}</span>
                                </div>
                                <button
                                  type="button"
                                  title="Open expanded view"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/contacts/people/expanded-view/${person.id}`); }}
                                  className="shrink-0 ml-auto -mr-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                                >
                                  <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
                                </button>
                              </div>
                            </td>

                            {visibleOrderedKeys.map((key) => {
                              const cellStyle: React.CSSProperties = { width: columnWidths[key], border: '1px solid #c8bdd6' };
                              const cellClass = 'px-3 py-1.5 overflow-hidden';
                              const dashPill = (
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                              );
                              switch (key) {
                                case 'title':
                                  return (
                                    <td key={key} className={cellClass} style={cellStyle}>
                                      {person.title ? (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{person.title}</span>
                                      ) : dashPill}
                                    </td>
                                  );
                                case 'company':
                                  return (
                                    <td key={key} className={cellClass} style={cellStyle}>
                                      {person.company_name ? (
                                        <span className="inline-flex items-center gap-2 pl-0.5 pr-3 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted max-w-full">
                                          <div className="h-6 w-6 rounded-full bg-white dark:bg-card flex items-center justify-center shrink-0">
                                            <Building2 className="h-3 w-3 text-muted-foreground" />
                                          </div>
                                          <span className="text-[16px] text-[#202124] dark:text-foreground truncate">{person.company_name}</span>
                                        </span>
                                      ) : dashPill}
                                    </td>
                                  );
                                case 'tasks':
                                  return (
                                    <td key={key} className={cellClass} style={cellStyle}>
                                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">{taskCount}</span>
                                    </td>
                                  );
                                case 'email':
                                  return (
                                    <td key={key} className={cellClass} style={cellStyle}>
                                      {person.email ? (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{person.email}</span>
                                      ) : dashPill}
                                    </td>
                                  );
                                case 'contactType':
                                  return (
                                    <td key={key} className={cellClass} style={cellStyle}>
                                      {typeCfg ? (
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${typeCfg.bg} ${typeCfg.color}`}>
                                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${typeCfg.dot}`} />
                                          {typeCfg.label}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">{person.contact_type}</span>
                                      )}
                                    </td>
                                  );
                                case 'pipeline':
                                  return (
                                    <td key={key} className={cellClass} style={cellStyle}>
                                      {person._pipelineName ? (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full whitespace-nowrap">
                                          {person._pipelineName}
                                          {person._stageName && (
                                            <span className="text-muted-foreground">{' > '}{person._stageName}</span>
                                          )}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">--</span>
                                      )}
                                    </td>
                                  );
                                case 'lastContacted':
                                  return (
                                    <td key={key} className={cellClass} style={cellStyle}>
                                      {person.last_activity_at ? (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground tabular-nums">{formatShortDate(person.last_activity_at)}</span>
                                      ) : dashPill}
                                    </td>
                                  );
                                case 'interactions':
                                  return (
                                    <td key={key} className={cellClass} style={cellStyle}>
                                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">{interactionCount}</span>
                                    </td>
                                  );
                                case 'inactiveDays':
                                  return (
                                    <td key={key} className={cellClass} style={cellStyle}>
                                      {inactiveDays !== null ? (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">{inactiveDays}d</span>
                                      ) : dashPill}
                                    </td>
                                  );
                                case 'tags':
                                  return (
                                    <td key={key} className={cellClass} style={cellStyle}>
                                      {person.tags && person.tags.length > 0 ? (
                                        <span className="flex items-center gap-1 flex-wrap">
                                          {person.tags.slice(0, 2).map((tag) => (
                                            <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted text-[11px] font-medium text-[#202124] dark:text-foreground">
                                              {tag}
                                            </span>
                                          ))}
                                          {person.tags.length > 2 && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted text-[11px] font-medium text-muted-foreground">+{person.tags.length - 2}</span>
                                          )}
                                        </span>
                                      ) : dashPill}
                                    </td>
                                  );
                                default:
                                  return null;
                              }
                            })}

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
              <KanbanBoard
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                overlay={
                  draggedPerson ? (
                    <Card className="p-3 shadow-lg border border-blue-300 rotate-2 cursor-grabbing w-56 bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <CrmAvatar name={draggedPerson?.name || ''} size="xs" />
                        <p className="text-sm font-semibold text-foreground truncate">{draggedPerson.name}</p>
                      </div>
                    </Card>
                  ) : null
                }
              >
                {CONTACT_TYPES.map((type) => {
                  const cfg = contactTypeConfig[type];
                  const columnPeople = filteredAndSorted.filter(p => p.contact_type === type);
                  return (
                    <KanbanColumn
                      key={type}
                      id={type}
                      label={cfg?.label ?? type}
                      color={cfg?.dot ?? 'bg-muted-foreground'}
                      itemIds={columnPeople.map(p => p.id)}
                      emptyMessage="Drop contacts here"
                    >
                      {columnPeople.map(person => (
                        <PersonCard
                          key={person.id}
                          person={person}
                          isDragging={draggedPerson?.id === person.id}
                          onClick={() => handleRowClick(person)}
                        />
                      ))}
                    </KanbanColumn>
                  );
                })}
              </KanbanBoard>
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

      {/* ── Bulk Import Dialog ── */}
      <BulkImportDialog open={bulkImportOpen} onOpenChange={setBulkImportOpen} />

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

      <MergePeopleDialog
        open={mergeDialogOpen}
        onOpenChange={(o) => { if (!mergeMutation.isPending) setMergeDialogOpen(o); }}
        personAId={selectedPersonIds.size === 2 ? Array.from(selectedPersonIds)[0] : null}
        personBId={selectedPersonIds.size === 2 ? Array.from(selectedPersonIds)[1] : null}
        isPending={mergeMutation.isPending}
        onConfirm={(args) => mergeMutation.mutate(args)}
      />

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
    </EmployeeLayout>
  );
};

export default People;
