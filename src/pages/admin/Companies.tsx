import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EvanLayout from '@/components/evan/EvanLayout';
import CompanyDetailPanel, { contactTypeConfigDefault } from '@/components/admin/CompanyDetailPanel';
import PipelineSettingsPopover from '@/components/admin/PipelineSettingsDialog';
import CreateFilterDialog, { CustomFilterValues } from '@/components/admin/CreateFilterDialog';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import {
  ArrowUpDown, Search, AlignJustify, PanelLeft, Filter, Settings2, ChevronDown, Plus,
  Building2, Tag, Check, X, LayoutGrid, Table2, FileSearch,
  PanelRightOpen, Sparkles, Loader2, Download, PlusCircle, Globe, Maximize2,
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
import { format, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  company_name: string;
  phone: string | null;
  contact_name: string | null;
  tasks_count: number;
  website: string | null;
  contact_type: string | null;
  email_domain: string | null;
  last_contacted: string | null;
  interactions_count: number;
  inactive_days: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

type ContactType = string;

const CONTACT_TYPES: ContactType[] = [
  'Client', 'Prospect', 'Referral Partner', 'Lender', 'Vendor', 'Other',
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

const FILTER_OPTIONS = [
  { id: 'all', label: 'All Companies', group: 'top' },
  { id: 'Client', label: 'Clients', group: 'public' },
  { id: 'Prospect', label: 'Prospects', group: 'public' },
  { id: 'Referral Partner', label: 'Referral Partners', group: 'public' },
  { id: 'Lender', label: 'Lenders', group: 'public' },
  { id: 'Vendor', label: 'Vendors', group: 'public' },
  { id: 'recently_contacted', label: 'Recently Contacted', group: 'public' },
  { id: 'inactive', label: 'Inactive (30+ days)', group: 'public' },
];

type SortField = 'company_name' | 'contact_name' | 'contact_type' | 'last_contacted' | 'updated_at';
type SortDir = 'asc' | 'desc';

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'last_contacted', label: 'Last Contacted' },
  { value: 'company_name', label: 'Company' },
  { value: 'contact_name', label: 'Contact' },
  { value: 'contact_type', label: 'Contact Type' },
  { value: 'updated_at', label: 'Updated' },
];

type ColumnKey = 'phone' | 'contact' | 'tasks' | 'website' | 'contactType' | 'emailDomain' | 'lastContacted' | 'interactions' | 'inactiveDays' | 'tags';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  phone: 'Phone',
  contact: 'Contact',
  tasks: 'Tasks',
  website: 'Website',
  contactType: 'Contact Type',
  emailDomain: 'Email Domain',
  lastContacted: 'Last Contacted',
  interactions: 'Interactions',
  inactiveDays: 'Inactive Days',
  tags: 'Tags',
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
  'bg-pink-500', 'bg-violet-500',
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
  try { return differenceInDays(new Date(), parseISO(dateStr)); } catch { return null; }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return '—'; }
}

// ── Kanban sub-components ──

function KanbanCompanyCard({ company, isDragging, onClick }: {
  company: Company;
  isDragging?: boolean;
  onClick: () => void;
}) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: company.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const avatarColor = getAvatarColor(company.company_name);
  const initial = company.company_name[0]?.toUpperCase() ?? '?';

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="group/card p-3 cursor-grab active:cursor-grabbing shadow-sm border border-border/60 hover:shadow-md transition-shadow bg-card"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`h-6 w-6 rounded-md ${avatarColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
            {initial}
          </div>
          <p className="text-sm font-semibold text-foreground leading-tight truncate flex-1">{company.company_name}</p>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/companies/company/${company.id}`); }}
            className="shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity"
          >
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
        {company.contact_name && (
          <p className="text-[11px] text-muted-foreground mb-0.5 truncate">{company.contact_name}</p>
        )}
        {company.email_domain && (
          <p className="text-[11px] text-muted-foreground mb-1.5 truncate">{company.email_domain}</p>
        )}
        {company.phone && (
          <p className="text-[11px] text-muted-foreground truncate">{company.phone}</p>
        )}
      </Card>
    </div>
  );
}

function KanbanDropColumn({ contactType, label, color, companies, draggedId, onCompanyClick }: {
  contactType: string;
  label: string;
  color: string;
  companies: Company[];
  draggedId: string | null;
  onCompanyClick: (company: Company) => void;
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
          {companies.length}
        </span>
      </div>
      <ScrollArea className="flex-1 px-2 pb-2">
        <SortableContext items={companies.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[100px]">
            {companies.map((company) => (
              <KanbanCompanyCard
                key={company.id}
                company={company}
                isDragging={draggedId === company.id}
                onClick={() => onCompanyClick(company)}
              />
            ))}
            {companies.length === 0 && (
              <div className="text-center text-muted-foreground text-xs py-10 border-2 border-dashed border-muted-foreground/20 rounded-lg">
                Drop companies here
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

const Companies = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ── Core state ──
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_contacted');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // ── Toolbar state ──
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [rowDensity, setRowDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [publicFiltersOpen, setPublicFiltersOpen] = useState(true);
  const [draggedCompany, setDraggedCompany] = useState<Company | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Custom filters
  const [customFilters, setCustomFilters] = useState<Array<{ id: string; label: string; values: CustomFilterValues }>>([]);

  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    phone: true, contact: true, tasks: true, website: true, contactType: true,
    emailDomain: true, lastContacted: true, interactions: true, inactiveDays: true, tags: true,
  });

  const DEFAULT_COLUMN_WIDTHS: Record<string, number> = useMemo(() => ({
    company: 200, phone: 130, contact: 140, tasks: 80, website: 150,
    contactType: 120, emailDomain: 140, lastContacted: 120, interactions: 90, inactiveDays: 90, tags: 100,
  }), []);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('companies-column-widths');
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, number>;
        // Enforce minimum widths so saved narrow values don't cause overlap
        const merged = { ...DEFAULT_COLUMN_WIDTHS };
        for (const key of Object.keys(parsed)) {
          merged[key] = Math.max(parsed[key], DEFAULT_COLUMN_WIDTHS[key] ?? 60);
        }
        return merged;
      }
    } catch {}
    return DEFAULT_COLUMN_WIDTHS;
  });

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [columnId]: newWidth };
      localStorage.setItem('companies-column-widths', JSON.stringify(next));
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

  // Close detail panel on Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedCompany) setSelectedCompany(null);
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [selectedCompany]);

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
  const isNonDefaultSort = sortField !== 'last_contacted' || sortDir !== 'desc';

  // ── DnD sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Contact type update mutation for Kanban drag ──
  const contactTypeMutation = useMutation({
    mutationFn: async ({ companyId, newType }: { companyId: string; newType: string; oldType: string }) => {
      const { error } = await supabase
        .from('companies')
        .update({ contact_type: newType })
        .eq('id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies-list'] });
      toast.success('Contact type updated');
    },
    onError: () => {
      toast.error('Failed to update contact type');
    },
  });

  // ── Add Company state ──
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [addCompanyType, setAddCompanyType] = useState<string>('Prospect');
  const [newCompany, setNewCompany] = useState({ company_name: '', contact_name: '', phone: '', website: '', email_domain: '', contact_type: 'Prospect' });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: typeof newCompany) => {
      const { data: company, error } = await supabase
        .from('companies')
        .insert({
          company_name: data.company_name,
          contact_name: data.contact_name || null,
          phone: data.phone || null,
          website: data.website || null,
          email_domain: data.email_domain || null,
          contact_type: data.contact_type,
        })
        .select()
        .single();
      if (error) throw error;
      return company as Company;
    },
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ['companies-list'] });
      setAddCompanyOpen(false);
      setNewCompany({ company_name: '', contact_name: '', phone: '', website: '', email_domain: '', contact_type: 'Prospect' });
      toast.success(`"${company.company_name}" added as ${company.contact_type}`);
      setSelectedCompany(company);
    },
    onError: () => {
      toast.error('Failed to create company');
    },
  });

  const handleCreateCompany = () => {
    if (!newCompany.company_name.trim()) {
      toast.error('Company name is required');
      return;
    }
    createCompanyMutation.mutate({ ...newCompany, contact_type: addCompanyType });
  };

  const openAddDialog = (type?: string) => {
    setAddCompanyType(type ?? 'Prospect');
    setNewCompany({ company_name: '', contact_name: '', phone: '', website: '', email_domain: '', contact_type: type ?? 'Prospect' });
    setAddCompanyOpen(true);
  };

  function handleDragStart(event: DragStartEvent) {
    const company = filteredAndSorted.find(c => c.id === event.active.id);
    setDraggedCompany(company ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedCompany(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const targetType = CONTACT_TYPES.find(t => t === over.id)
      ?? filteredAndSorted.find(c => c.id === over.id)?.contact_type;

    if (!targetType) return;

    const company = filteredAndSorted.find(c => c.id === active.id);
    if (!company || company.contact_type === targetType) return;

    contactTypeMutation.mutate({ companyId: company.id, newType: targetType, oldType: company.contact_type ?? 'Other' });
  }

  // ── Queries ──
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('last_contacted', { ascending: false });
      if (error) throw error;
      return (data || []) as Company[];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-companies'],
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

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: companies.length };
    for (const type of CONTACT_TYPES) {
      counts[type] = companies.filter(c => c.contact_type === type).length;
    }
    counts['recently_contacted'] = companies.filter(c => {
      const d = daysSince(c.last_contacted);
      return d !== null && d <= 7;
    }).length;
    counts['inactive'] = companies.filter(c => c.inactive_days >= 30).length;
    return counts;
  }, [companies]);

  const filteredAndSorted = useMemo(() => {
    let result = companies;

    if (activeFilter !== 'all') {
      if (CONTACT_TYPES.includes(activeFilter)) {
        result = result.filter(c => c.contact_type === activeFilter);
      } else if (activeFilter === 'recently_contacted') {
        result = result.filter(c => {
          const d = daysSince(c.last_contacted);
          return d !== null && d <= 7;
        });
      } else if (activeFilter === 'inactive') {
        result = result.filter(c => c.inactive_days >= 30);
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.company_name.toLowerCase().includes(q) ||
        (c.contact_name ?? '').toLowerCase().includes(q) ||
        (c.email_domain ?? '').toLowerCase().includes(q) ||
        (c.website ?? '').toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = ((a[sortField] ?? '') as string);
      const bVal = ((b[sortField] ?? '') as string);
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [companies, activeFilter, searchTerm, sortField, sortDir]);


  function handleColSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function handleRowClick(company: Company) {
    setSelectedCompany(company);
  }

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
    const widthKey = colKey ?? 'company';
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

        {/* ── CRM-Style Header ── */}
        <div className="shrink-0 border-b border-border bg-background px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-foreground whitespace-nowrap">Companies</h1>
          </div>

          {/* Connected toolbar — Table | Kanban | Sort */}
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
            <PipelineSettingsPopover open={settingsOpen} onOpenChange={setSettingsOpen} />
          </div>

          {/* Add Company button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="group relative h-9 pl-4 pr-3 text-[13px] font-semibold rounded-full shrink-0 flex items-center gap-2 text-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                style={{ background: 'linear-gradient(135deg, hsl(224, 76%, 48%) 0%, hsl(217, 91%, 60%) 50%, hsl(217, 91%, 65%) 100%)' }}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
                <span>Add Company</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-xl border border-border bg-popover">
              <DropdownMenuItem
                onClick={() => openAddDialog()}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-[14px] font-medium text-foreground hover:bg-muted focus:bg-muted transition-colors"
              >
                <PlusCircle className="h-4.5 w-4.5 text-muted-foreground" />
                Add Company
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-[14px] font-medium text-foreground hover:bg-muted focus:bg-muted transition-colors"
              >
                <Download className="h-4.5 w-4.5 text-muted-foreground" />
                Import Companies
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
                  stageConfig={contactTypeConfig}
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
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">By Type</span>
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
                    # {filteredAndSorted.length.toLocaleString()} {filteredAndSorted.length === 1 ? 'company' : 'companies'}
                  </span>
                )}

                {isNonDefaultSort && (
                  <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-md px-2 h-7">
                    <ArrowUpDown className="h-3 w-3 shrink-0" />
                    {sortFieldLabel} {sortDir === 'asc' ? '↑' : '↓'}
                    <button
                      onClick={() => { setSortField('last_contacted'); setSortDir('desc'); }}
                      className="ml-0.5 text-blue-400 hover:text-blue-700"
                      title="Reset sort"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-0.5">
                {/* Row density toggle */}
                <button
                  onClick={() => setRowDensity(d => d === 'comfortable' ? 'compact' : 'comfortable')}
                  title={`Row density: ${rowDensity}`}
                  className={iconBtn(rowDensity === 'compact')}
                >
                  <AlignJustify className={`h-3.5 w-3.5 ${rowDensity === 'compact' ? 'text-blue-600' : ''}`} />
                </button>

                {searchOpen && (
                  <Input
                    autoFocus
                    placeholder="Search companies, contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setSearchTerm(''); setSearchOpen(false); } }}
                    onBlur={() => { if (!searchTerm) setSearchOpen(false); }}
                    className="h-7 w-52 text-xs mr-1 border-border bg-card"
                  />
                )}

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

                <button
                  onClick={() => setSearchOpen(v => !v)}
                  title="Search companies"
                  className={iconBtn(searchOpen || !!searchTerm)}
                >
                  <Search className={`h-3.5 w-3.5 ${(searchOpen || searchTerm) ? 'text-blue-600' : ''}`} />
                </button>

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

            {/* ── Content Area: Table or Kanban ── */}
            {viewMode === 'table' ? (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                  <thead className="border-b border-border">
                    <tr>
                      <th className="w-10 px-4 py-3 sticky top-0 left-0 z-30 bg-gray-100 dark:bg-muted" />
                      <ColHeader className="sticky top-0 z-30 bg-gray-100 dark:bg-muted border-r border-border/50" style={{ left: 40 }}>
                        Company
                      </ColHeader>
                      <ColHeader colKey="phone" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Phone
                      </ColHeader>
                      <ColHeader colKey="contact" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Contact
                      </ColHeader>
                      <ColHeader colKey="tasks" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Tasks
                      </ColHeader>
                      <ColHeader colKey="website" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Website
                      </ColHeader>
                      <ColHeader colKey="contactType" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Type
                      </ColHeader>
                      <ColHeader colKey="emailDomain" className="sticky top-0 z-10 bg-white dark:bg-card">
                        Email Domain
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
                          <td className="px-4 py-3.5 sticky z-[5] border-r border-border/50 bg-white dark:bg-card" style={{ width: columnWidths.company, left: 40 }}>
                            <div className="flex items-center gap-2.5">
                              <Skeleton className="h-7 w-7 rounded-md shrink-0" />
                              <Skeleton className="h-3.5 w-36" />
                            </div>
                          </td>
                          {columnVisibility.phone && <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-24 rounded" /></td>}
                          {columnVisibility.contact && <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-24 rounded" /></td>}
                          {columnVisibility.tasks && <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-8 rounded" /></td>}
                          {columnVisibility.website && <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-32 rounded" /></td>}
                          {columnVisibility.contactType && <td className="px-4 py-3.5"><Skeleton className="h-5 w-20 rounded-full" /></td>}
                          {columnVisibility.emailDomain && <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-28 rounded" /></td>}
                          {columnVisibility.lastContacted && <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.interactions && <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-8 rounded" /></td>}
                          {columnVisibility.inactiveDays && <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-10 rounded" /></td>}
                          {columnVisibility.tags && <td className="px-4 py-3.5"><Skeleton className="h-3.5 w-16 rounded" /></td>}
                        </tr>
                      ))
                    ) : filteredAndSorted.length === 0 ? (
                      <tr>
                        <td colSpan={13}>
                          <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted">
                              <FileSearch className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-semibold text-foreground">No companies found</p>
                              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                                {searchTerm ? 'Try adjusting your search or filter criteria' : 'No companies have been added yet'}
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
                      filteredAndSorted.map((company, rowIdx) => {
                        const initial = company.company_name[0]?.toUpperCase() ?? '?';
                        const avatarColor = getAvatarColor(company.company_name);
                        const typeCfg = contactTypeConfig[company.contact_type ?? 'Other'];
                        const inactiveDaysVal = company.inactive_days;
                        const isStale = inactiveDaysVal > 7;
                        const isSelected = selectedCompany?.id === company.id;

                        const stickyBg = isSelected
                          ? 'bg-blue-50 dark:bg-blue-950 group-hover:bg-blue-100 dark:group-hover:bg-blue-900'
                          : 'bg-white dark:bg-card group-hover:bg-gray-50 dark:group-hover:bg-muted';

                        return (
                          <tr
                            key={company.id}
                            onClick={() => handleRowClick(company)}
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

                            {/* Company (sticky) */}
                            <td className={`px-4 py-3 overflow-hidden sticky z-[5] border-r border-border/50 transition-colors ${stickyBg}`} style={{ width: columnWidths.company, left: 40 }}>
                              <div className="flex items-center gap-2.5">
                                <div className={`h-7 w-7 rounded-md ${avatarColor} flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm`}>
                                  {initial}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-semibold text-foreground truncate text-[13px] leading-tight">
                                      {company.company_name}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/pipeline/contacts/companies/${company.id}`); }}
                                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                                    >
                                      <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Phone */}
                            {columnVisibility.phone && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.phone }}>
                                {company.phone ? (
                                  <span className="text-[13px] text-foreground/80 truncate block">{company.phone}</span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Contact */}
                            {columnVisibility.contact && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.contact }}>
                                {company.contact_name ? (
                                  <span className="text-[13px] text-foreground/80 truncate block">{company.contact_name}</span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Tasks */}
                            {columnVisibility.tasks && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.tasks }}>
                                {company.tasks_count > 0 ? (
                                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-md bg-muted text-[11px] font-bold text-foreground/70">
                                    {company.tasks_count}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40 text-[13px]">0</span>
                                )}
                              </td>
                            )}

                            {/* Website */}
                            {columnVisibility.website && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.website }}>
                                {company.website ? (
                                  <a
                                    href={company.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[13px] text-primary hover:underline truncate block"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {company.website.replace(/^https?:\/\//, '')}
                                  </a>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Contact Type */}
                            {columnVisibility.contactType && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.contactType }}>
                                {typeCfg ? (
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${typeCfg.bg} ${typeCfg.color}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${typeCfg.dot}`} />
                                    {typeCfg.label}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">{company.contact_type}</span>
                                )}
                              </td>
                            )}

                            {/* Email Domain */}
                            {columnVisibility.emailDomain && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.emailDomain }}>
                                {company.email_domain ? (
                                  <span className="text-[13px] text-foreground/80 truncate block">{company.email_domain}</span>
                                ) : (
                                  <span className="text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Last Contacted */}
                            {columnVisibility.lastContacted && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.lastContacted }}>
                                <span className="text-[12px] text-muted-foreground tabular-nums">{formatShortDate(company.last_contacted)}</span>
                              </td>
                            )}

                            {/* Interactions */}
                            {columnVisibility.interactions && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.interactions }}>
                                {company.interactions_count > 0 ? (
                                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                    {company.interactions_count}
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
                                    {inactiveDaysVal}d
                                  </span>
                                ) : (
                                  <span className="text-[12px] text-muted-foreground tabular-nums">{inactiveDaysVal}d</span>
                                )}
                              </td>
                            )}

                            {/* Tags */}
                            {columnVisibility.tags && (
                              <td className="px-4 py-3 overflow-hidden" style={{ width: columnWidths.tags }}>
                                {company.tags && company.tags.length > 0 ? (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    {company.tags.slice(0, 2).map((tag) => (
                                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60">
                                        {tag}
                                      </span>
                                    ))}
                                    {company.tags.length > 2 && (
                                      <span className="text-[10px] text-muted-foreground font-medium">+{company.tags.length - 2}</span>
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
                      const columnCompanies = filteredAndSorted.filter(c => c.contact_type === type);
                      return (
                        <KanbanDropColumn
                          key={type}
                          contactType={type}
                          label={cfg?.label ?? type}
                          color={cfg?.dot ?? 'bg-muted-foreground'}
                          companies={columnCompanies}
                          draggedId={draggedCompany?.id ?? null}
                          onCompanyClick={handleRowClick}
                        />
                      );
                    })}
                  </div>
                </div>
                <DragOverlay>
                  {draggedCompany ? (
                    <Card className="p-3 shadow-lg border border-blue-300 rotate-2 cursor-grabbing w-56 bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`h-5 w-5 rounded-md ${getAvatarColor(draggedCompany.company_name)} flex items-center justify-center text-white text-[10px] font-bold`}>
                          {draggedCompany.company_name[0]?.toUpperCase()}
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">{draggedCompany.company_name}</p>
                      </div>
                      {draggedCompany.contact_name && (
                        <p className="text-[11px] text-muted-foreground">{draggedCompany.contact_name}</p>
                      )}
                    </Card>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </main>

          {/* Right Detail Panel */}
          {selectedCompany && (
            <CompanyDetailPanel
              company={selectedCompany as any}
              contactTypeConfig={contactTypeConfig}
              teamMemberMap={teamMemberMap}
              teamMembers={teamMembers}
              onClose={() => setSelectedCompany(null)}
              onExpand={() => {
                navigate(`/admin/pipeline/contacts/companies/${selectedCompany.id}`);
              }}
              onContactTypeChange={(companyId, newType) => {
                contactTypeMutation.mutate({ companyId, newType, oldType: selectedCompany.contact_type ?? 'Other' });
                setSelectedCompany({ ...selectedCompany, contact_type: newType });
              }}
              onCompanyUpdate={(updatedCompany) => {
                setSelectedCompany(updatedCompany as any);
                queryClient.invalidateQueries({ queryKey: ['companies-list'] });
              }}
            />
          )}
        </div>
      </div>

      {/* ── Add Company Dialog ── */}
      <Dialog open={addCompanyOpen} onOpenChange={setAddCompanyOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          {/* Header with gradient */}
          <div className="px-6 pt-6 pb-4" style={{ background: 'linear-gradient(135deg, hsl(224, 76%, 48%) 0%, hsl(217, 91%, 60%) 50%, hsl(217, 91%, 65%) 100%)' }}>
            <DialogHeader>
              <DialogTitle className="text-white text-lg font-bold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                  <Plus className="h-4 w-4 text-white" />
                </div>
                New Company
              </DialogTitle>
            </DialogHeader>
            {/* Contact type selector pills */}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {CONTACT_TYPES.map((type) => {
                const cfg = contactTypeConfig[type];
                const isActive = addCompanyType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setAddCompanyType(type)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white text-slate-800 shadow-md scale-105 dark:bg-white/90 dark:text-slate-900'
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
              <Label htmlFor="company-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Company Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="company-name"
                placeholder="e.g. Apex Capital Group"
                value={newCompany.company_name}
                onChange={(e) => setNewCompany(prev => ({ ...prev, company_name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && newCompany.company_name.trim()) handleCreateCompany(); }}
                className="h-10 rounded-xl border-border focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-muted-foreground/50"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company-contact" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Name</Label>
              <Input
                id="company-contact"
                placeholder="e.g. John Smith"
                value={newCompany.contact_name}
                onChange={(e) => setNewCompany(prev => ({ ...prev, contact_name: e.target.value }))}
                className="h-10 rounded-xl border-border focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="company-phone" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone</Label>
                <Input
                  id="company-phone"
                  placeholder="(555) 123-4567"
                  type="tel"
                  value={newCompany.phone}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, phone: e.target.value }))}
                  className="h-10 rounded-xl border-border focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company-website" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Website</Label>
                <Input
                  id="company-website"
                  placeholder="https://example.com"
                  value={newCompany.website}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, website: e.target.value }))}
                  className="h-10 rounded-xl border-border focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company-domain" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Domain</Label>
              <Input
                id="company-domain"
                placeholder="e.g. company.com"
                value={newCompany.email_domain}
                onChange={(e) => setNewCompany(prev => ({ ...prev, email_domain: e.target.value }))}
                className="h-10 rounded-xl border-border focus:border-blue-400 focus:ring-blue-400/20 placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-muted/50 border-t border-border flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAddCompanyOpen(false)}
              className="h-9 px-4 rounded-xl text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <button
              onClick={handleCreateCompany}
              disabled={!newCompany.company_name.trim() || createCompanyMutation.isPending}
              className="h-9 px-5 rounded-xl text-[13px] font-semibold text-white flex items-center gap-2 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
              style={{ background: 'linear-gradient(135deg, hsl(224, 76%, 48%) 0%, hsl(217, 91%, 60%) 50%, hsl(217, 91%, 65%) 100%)' }}
            >
              {createCompanyMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Add Company
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </EvanLayout>
  );
};

export default Companies;
