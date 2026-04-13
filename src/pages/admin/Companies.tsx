import { useState, useMemo, useRef, useEffect } from 'react';
import { useAutoFitColumns } from '@/hooks/useAutoFitColumns';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useUndo } from '@/contexts/UndoContext';
import { supabase } from '@/integrations/supabase/client';
import { useCompanies } from '@/hooks/useAllPipelineLeads';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import CompanyDetailPanel, { contactTypeConfigDefault } from '@/components/admin/CompanyDetailPanel';
import CreateFilterDialog, { CustomFilterValues } from '@/components/admin/CreateFilterDialog';
import { SavedFiltersSidebar, type SavedFilterOption } from '@/components/admin/SavedFiltersSidebar';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import {
  ArrowLeft, PanelLeft, Filter, ChevronDown, Plus,
  Building2, Tag, Check, X, LayoutGrid, FileSearch,
  PanelRightOpen, Sparkles, Loader2, Download, PlusCircle, Globe, Maximize2,
  Search, BarChart3, AtSign, User, CalendarDays,
  MessageSquare, Moon, Phone, DollarSign, Table2, Columns3,
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
import { format, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface Company {
  id: string;
  company_name: string;
  phone: string | null;
  contact_name: string | null;
  website: string | null;
  contact_type: string | null;
  email_domain: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  notes: string | null;
  source: string | null;
  last_activity_at: string | null;
  known_as: string | null;
  clx_file_name: string | null;
  bank_relationships: string | null;
  created_at: string;
  updated_at: string;
  deals_count: number;
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

const FILTER_OPTIONS: SavedFilterOption[] = [
  { id: 'all', label: 'All Companies', group: 'top' },
  { id: 'following', label: "Companies I'm Following", group: 'public' },
  { id: 'current_customers', label: 'Current Customers', group: 'public' },
  { id: 'my_companies', label: 'My Companies', group: 'public' },
  { id: 'potential_customers', label: 'Potential Customers', group: 'public' },
];

type SortField = 'company_name' | 'contact_name' | 'contact_type' | 'last_activity_at' | 'updated_at';
type SortDir = 'asc' | 'desc';

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'last_activity_at', label: 'Last Activity' },
  { value: 'company_name', label: 'Company' },
  { value: 'contact_name', label: 'Contact' },
  { value: 'contact_type', label: 'Contact Type' },
  { value: 'updated_at', label: 'Updated' },
];

type ColumnKey = 'phone' | 'contact' | 'deals' | 'website' | 'contactType' | 'emailDomain' | 'lastActivity' | 'interactions' | 'inactiveDays' | 'tags';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  phone: 'Phone',
  contact: 'Contact',
  deals: 'Deals',
  website: 'Website',
  contactType: 'Contact Type',
  emailDomain: 'Email Domain',
  lastActivity: 'Last Activity',
  interactions: 'Interactions',
  inactiveDays: 'Inactive Days',
  tags: 'Tags',
};

// Column sort menu options per column (colKey or 'company')
const COLUMN_SORT_OPTIONS: Record<string, { label: string; field: SortField; dir: SortDir }[]> = {
  company: [
    { label: 'Company ascending', field: 'company_name', dir: 'asc' },
    { label: 'Company descending', field: 'company_name', dir: 'desc' },
  ],
  contact: [
    { label: 'Contact ascending', field: 'contact_name', dir: 'asc' },
    { label: 'Contact descending', field: 'contact_name', dir: 'desc' },
  ],
  contactType: [
    { label: 'Contact type ascending', field: 'contact_type', dir: 'asc' },
    { label: 'Contact type descending', field: 'contact_type', dir: 'desc' },
  ],
  lastActivity: [
    { label: 'Last activity ascending', field: 'last_activity_at', dir: 'asc' },
    { label: 'Last activity descending', field: 'last_activity_at', dir: 'desc' },
  ],
};

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try { return differenceInDays(new Date(), parseISO(dateStr)); } catch { return null; }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return '—'; }
}

// ── Kanban card (domain-specific body/footer; chrome lives in KanbanCardShell) ──
function CompanyCard({ company, isDragging, onClick }: {
  company: Company;
  isDragging?: boolean;
  onClick: () => void;
}) {
  const navigate = useNavigate();
  return (
    <KanbanCardShell
      id={company.id}
      title={company.company_name}
      isDragging={isDragging}
      onClick={onClick}
      onExpand={() => navigate(`/admin/companies/company/${company.id}`)}
      body={
        <>
          {company.contact_name && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{company.contact_name}</span>
            </div>
          )}
          {company.website && (
            <div className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{company.website}</span>
            </div>
          )}
        </>
      }
      footer={
        <>
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            {company.phone && (
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="text-[11px] truncate">{company.phone}</span>
              </div>
            )}
          </div>
          {company.deals_count > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{company.deals_count} deals</span>
          )}
        </>
      }
    />
  );
}

const Companies = () => {
  const queryClient = useQueryClient();
  const { registerUndo } = useUndo();
  const navigate = useNavigate();

  // ── Core state ──
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_activity_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // ── Column sort menu state ──
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);

  // ── Toolbar state ──
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [rowDensity, setRowDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Custom filters
  const [customFilters, setCustomFilters] = useState<Array<{ id: string; label: string; values: CustomFilterValues }>>([]);

  // ── Top bar: inject title + search into AdminLayout header ──
  const { setPageTitle, setSearchComponent } = useAdminTopBar();

  useEffect(() => {
    setPageTitle('Companies');
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

  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    phone: true, contact: true, deals: true, website: true, contactType: true,
    emailDomain: true, lastActivity: true, interactions: true, inactiveDays: true, tags: true,
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
      if (e.key === 'Escape') {
        if (colMenuOpen) { setColMenuOpen(null); return; }
        if (selectedCompany) setSelectedCompany(null);
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [selectedCompany, colMenuOpen]);

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
    mutationFn: async ({ companyId, newType, oldType }: { companyId: string; newType: string; oldType: string }) => {
      const company = companies.find(c => c.id === companyId);
      if (!company) throw new Error('Company not found');
      const { error } = await supabase
        .from('companies')
        .update({ contact_type: newType })
        .eq('id', companyId);
      if (error) throw error;
      return { companyName: company.company_name, companyId, oldType, newType };
    },
    onSuccess: ({ companyName, companyId, oldType, newType }) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Contact type updated');
      registerUndo({
        label: `Changed "${companyName}" type to "${newType}"`,
        execute: async () => {
          const { error } = await supabase.from('companies').update({ contact_type: oldType }).eq('id', companyId);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['companies'] });
        },
      });
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
          website: data.website || null,
          contact_type: data.contact_type,
        })
        .select()
        .single();
      if (error) throw error;

      return {
        id: company.id,
        company_name: company.company_name,
        contact_name: data.contact_name || null,
        phone: data.phone || null,
        website: company.website,
        email_domain: data.email_domain || null,
        contact_type: company.contact_type,
        tags: company.tags,
        assigned_to: company.assigned_to,
        notes: company.notes,
        source: company.source,
        last_activity_at: company.last_activity_at,
        known_as: null,
        clx_file_name: null,
        bank_relationships: null,
        created_at: company.created_at,
        updated_at: company.updated_at,
        deals_count: 0,
      } as Company;
    },
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setAddCompanyOpen(false);
      setNewCompany({ company_name: '', contact_name: '', phone: '', website: '', email_domain: '', contact_type: 'Prospect' });
      toast.success(`"${company.company_name}" added as ${company.contact_type}`);
      setSelectedCompany(company);
      registerUndo({
        label: `Created "${company.company_name}"`,
        execute: async () => {
          const { error } = await supabase.from('companies').delete().eq('id', company.id);
          if (error) throw error;
          setSelectedCompany(null);
          queryClient.invalidateQueries({ queryKey: ['companies'] });
        },
      });
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

  // ── Queries ──
  const { data: rawCompanies = [], isLoading } = useCompanies();
  const companies = rawCompanies as unknown as Company[];

  const { data: teamMembers = [] } = useAssignableUsers();
  const { teamMember: currentTeamMember } = useTeamMember();

  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) map[m.id] = m.name;
    return map;
  }, [teamMembers]);

  const { data: followedCompanyIdsArray = [] } = useQuery({
    queryKey: ['followed-companies', currentTeamMember?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('entity_followers')
        .select('entity_id')
        .eq('entity_type', 'companies')
        .eq('team_member_id', currentTeamMember!.id);
      return (data ?? []).map((r) => r.entity_id);
    },
    enabled: !!currentTeamMember?.id,
  });
  const followedCompanyIds = useMemo(
    () => new Set(followedCompanyIdsArray),
    [followedCompanyIdsArray],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: companies.length };
    const myId = currentTeamMember?.id;
    counts['following'] = companies.filter((c) => followedCompanyIds.has(c.id)).length;
    counts['current_customers'] = companies.filter((c) => c.contact_type === 'Client').length;
    counts['my_companies'] = myId
      ? companies.filter((c) => c.assigned_to === myId).length
      : 0;
    counts['potential_customers'] = companies.filter((c) => c.contact_type === 'Prospect').length;
    return counts;
  }, [companies, currentTeamMember?.id, followedCompanyIds]);

  const filteredAndSorted = useMemo(() => {
    let result = companies;

    if (activeFilter !== 'all') {
      const myId = currentTeamMember?.id;
      if (activeFilter === 'following') {
        result = result.filter((c) => followedCompanyIds.has(c.id));
      } else if (activeFilter === 'current_customers') {
        result = result.filter((c) => c.contact_type === 'Client');
      } else if (activeFilter === 'my_companies') {
        result = myId ? result.filter((c) => c.assigned_to === myId) : [];
      } else if (activeFilter === 'potential_customers') {
        result = result.filter((c) => c.contact_type === 'Prospect');
      } else if (activeFilter.startsWith('custom_')) {
        const cf = customFilters.find((f) => f.id === activeFilter);
        if (cf) {
          const v = cf.values;
          result = result.filter((c) => {
            if (v.ownedBy.length > 0 && !v.ownedBy.includes(c.assigned_to ?? '')) return false;
            if (v.company.trim() && !c.company_name.toLowerCase().includes(v.company.toLowerCase())) return false;
            if (v.tags.trim()) {
              const filterTags = v.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
              const companyTags = (c.tags ?? []).map((t) => t.toLowerCase());
              if (!filterTags.some((ft) => companyTags.includes(ft))) return false;
            }
            if (v.source.length > 0 && !v.source.includes(c.source ?? '')) return false;
            if (v.followed && !followedCompanyIds.has(c.id)) return false;
            if (v.dateAddedFrom && new Date(c.created_at) < v.dateAddedFrom) return false;
            if (v.dateAddedTo && new Date(c.created_at) > v.dateAddedTo) return false;
            if (v.lastContactedMin.trim()) {
              const min = parseInt(v.lastContactedMin, 10);
              if (!Number.isNaN(min)) {
                const d = daysSince(c.last_activity_at);
                if (d === null || d < min) return false;
              }
            }
            if (v.lastContactedMax.trim()) {
              const max = parseInt(v.lastContactedMax, 10);
              if (!Number.isNaN(max)) {
                const d = daysSince(c.last_activity_at);
                if (d === null || d > max) return false;
              }
            }
            if (v.inactiveDaysMin.trim()) {
              const min = parseInt(v.inactiveDaysMin, 10);
              if (!Number.isNaN(min)) {
                const d = daysSince(c.last_activity_at);
                if (d === null || d < min) return false;
              }
            }
            if (v.inactiveDaysMax.trim()) {
              const max = parseInt(v.inactiveDaysMax, 10);
              if (!Number.isNaN(max)) {
                const d = daysSince(c.last_activity_at);
                if (d === null || d > max) return false;
              }
            }
            return true;
          });
        }
      }
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.company_name.toLowerCase().includes(q) ||
        (c.contact_name ?? '').toLowerCase().includes(q) ||
        (c.email_domain ?? '').toLowerCase().includes(q) ||
        (c.website ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.source ?? '').toLowerCase().includes(q) ||
        (c.contact_type ?? '').toLowerCase().includes(q) ||
        (c.notes ?? '').toLowerCase().includes(q) ||
        (c.tags ?? []).some(t => t.toLowerCase().includes(q))
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = ((a[sortField] ?? '') as string);
      const bVal = ((b[sortField] ?? '') as string);
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [companies, activeFilter, searchTerm, sortField, sortDir, customFilters, followedCompanyIds, currentTeamMember?.id]);

  const { dragged: draggedCompany, handleDragStart, handleDragEnd } = useKanbanDrag<Company>({
    items: filteredAndSorted,
    getGroupKey: (c) => c.contact_type,
    validGroupKeys: CONTACT_TYPES,
    onMove: (company, from, to) =>
      contactTypeMutation.mutate({ companyId: company.id, newType: to, oldType: from || 'Other' }),
  });

  const { columnWidths, handleColumnResize } = useAutoFitColumns({
    minWidths: {
      company: 200, phone: 130, contact: 140, deals: 80, website: 150,
      contactType: 120, emailDomain: 140, lastActivity: 120, interactions: 90, inactiveDays: 90, tags: 100,
    },
    autoFitConfig: {
      company: { getText: (c: any) => c.name, extraPx: 58 },
      phone: { getText: (c: any) => c.phone },
      contact: { getText: (c: any) => c.contact_name },
      website: { getText: (c: any) => c.website?.replace(/^https?:\/\//, '') },
      emailDomain: { getText: (c: any) => c.email_domain },
    },
    data: filteredAndSorted,
    storageKey: 'companies-col-widths-v2',
  });

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
    const widthKey = colKey ?? 'company';
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
          {/* Three-dot menu button — inline so it's never hidden */}
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
                stageConfig={contactTypeConfig}
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
                  {FILTER_OPTIONS.find(o => o.id === activeFilter)?.label ?? customFilters.find(cf => cf.id === activeFilter)?.label ?? 'All Companies'}
                </h2>
                {!isLoading && (
                  <span className="text-[#5f6368] dark:text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                    # {filteredAndSorted.length.toLocaleString()} {filteredAndSorted.length === 1 ? 'company' : 'companies'}
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

                {/* Add Company button (Copper dark indigo style) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="h-9 pl-4 pr-3 text-[13px] font-semibold rounded-md shrink-0 flex items-center gap-2 text-white bg-[#3b2778] hover:bg-[#4a3490] active:scale-[0.97] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2778] focus-visible:ring-offset-2 ml-2"
                    >
                      <span>Add Company</span>
                      <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-lg shadow-xl border border-[#dadce0] dark:border-border bg-white dark:bg-popover">
                    <DropdownMenuItem
                      onClick={() => openAddDialog()}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-[14px] font-medium text-[#1f1f1f] dark:text-foreground hover:bg-[#f1f3f4] dark:hover:bg-muted focus:bg-[#f1f3f4] dark:focus:bg-muted transition-colors"
                    >
                      <PlusCircle className="h-4 w-4 text-[#5f6368] dark:text-muted-foreground" />
                      Add Company
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer text-[14px] font-medium text-[#1f1f1f] dark:text-foreground hover:bg-[#f1f3f4] dark:hover:bg-muted focus:bg-[#f1f3f4] dark:focus:bg-muted transition-colors"
                    >
                      <Download className="h-4 w-4 text-[#5f6368] dark:text-muted-foreground" />
                      Import Companies
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* ── Content Area: Table or Kanban ── */}
            {viewMode === 'table' ? (
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#eee6f6' }}>
                      <th className="w-12 pl-2 pr-4 py-1.5 text-center sticky top-0 left-0 z-30" style={{ backgroundColor: '#eee6f6', border: '1px solid #c8bdd6', borderLeft: 'none', boxShadow: 'inset 1px 0 0 #c8bdd6' }} />
                      <ColHeader className="sticky top-0 z-30" style={{ left: 48, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }}>
                        <Building2 className="h-4 w-4" /> Company
                      </ColHeader>
                      <ColHeader colKey="phone" className="sticky top-0 z-10">
                        <Phone className="h-4 w-4" /> Phone
                      </ColHeader>
                      <ColHeader colKey="contact" className="sticky top-0 z-10">
                        <User className="h-4 w-4" /> Contact
                      </ColHeader>
                      <ColHeader colKey="deals" className="sticky top-0 z-10">
                        <DollarSign className="h-4 w-4" /> Deals
                      </ColHeader>
                      <ColHeader colKey="website" className="sticky top-0 z-10">
                        <Globe className="h-4 w-4" /> Website
                      </ColHeader>
                      <ColHeader colKey="contactType" className="sticky top-0 z-10">
                        <Tag className="h-4 w-4" /> Type
                      </ColHeader>
                      <ColHeader colKey="emailDomain" className="sticky top-0 z-10">
                        <AtSign className="h-4 w-4" /> Email Domain
                      </ColHeader>
                      <ColHeader colKey="lastActivity" className="sticky top-0 z-10">
                        <CalendarDays className="h-4 w-4" /> Last Activity
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
                          <td className="pl-2 pr-3 py-1.5 w-12 text-center sticky left-0 z-[5] bg-white dark:bg-card" style={{ border: '1px solid #c8bdd6', borderLeft: 'none', boxShadow: 'inset 1px 0 0 #c8bdd6' }}><Skeleton className="h-5 w-5 rounded" /></td>
                          <td className="px-4 py-1.5 sticky z-[5] bg-white dark:bg-card" style={{ width: columnWidths.company, left: 48, border: '1px solid #c8bdd6' }}>
                            <div className="flex items-center gap-2.5">
                              <Skeleton className="h-7 w-7 rounded-md shrink-0" />
                              <Skeleton className="h-3.5 w-36" />
                            </div>
                          </td>
                          {columnVisibility.phone && <td className="px-4 py-1.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-24 rounded" /></td>}
                          {columnVisibility.contact && <td className="px-4 py-1.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-24 rounded" /></td>}
                          {columnVisibility.deals && <td className="px-4 py-1.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-8 rounded" /></td>}
                          {columnVisibility.website && <td className="px-4 py-1.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-32 rounded" /></td>}
                          {columnVisibility.contactType && <td className="px-4 py-1.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-5 w-20 rounded-full" /></td>}
                          {columnVisibility.emailDomain && <td className="px-4 py-1.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-28 rounded" /></td>}
                          {columnVisibility.lastActivity && <td className="px-4 py-1.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                          {columnVisibility.interactions && <td className="px-4 py-1.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-8 rounded" /></td>}
                          {columnVisibility.inactiveDays && <td className="px-4 py-1.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-10 rounded" /></td>}
                          {columnVisibility.tags && <td className="px-4 py-1.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                        </tr>
                      ))
                    ) : filteredAndSorted.length === 0 ? (
                      <tr>
                        <td colSpan={13} style={{ border: '1px solid #c8bdd6' }}>
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
                      filteredAndSorted.map((company) => {
                        const typeCfg = contactTypeConfig[company.contact_type ?? 'Other'];
                        const inactiveDaysVal = daysSince(company.last_activity_at) ?? 0;
                        const isSelected = selectedCompany?.id === company.id;

                        const stickyBg = isSelected
                          ? 'bg-[#eee6f6] dark:bg-purple-950/30 group-hover:bg-[#e0d4f0] dark:group-hover:bg-purple-950/40'
                          : 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted';

                        return (
                          <tr
                            key={company.id}
                            onClick={() => handleRowClick(company)}
                            className={`cursor-pointer transition-colors duration-100 group ${
                              isSelected
                                ? 'bg-[#eee6f6] dark:bg-purple-950/30 hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40'
                                : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                            }`}
                          >
                            {/* Checkbox */}
                            <td className={`pl-2 pr-3 py-1.5 w-12 text-center sticky left-0 z-[5] transition-colors ${stickyBg} ${isSelected ? 'border-l-[3px] border-l-[#3b2778]' : ''}`} style={{ border: '1px solid #c8bdd6', borderLeft: 'none', boxShadow: 'inset 1px 0 0 #c8bdd6' }}>
                              <Checkbox
                                checked={isSelected}
                                className="h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                              />
                            </td>

                            {/* Company (sticky) */}
                            <td className={`pl-2 pr-1.5 py-1.5 overflow-hidden sticky z-[5] transition-colors ${stickyBg}`} style={{ width: columnWidths.company, left: 48, border: '1px solid #c8bdd6', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1 bg-[#f1f3f4] dark:bg-muted rounded-full pl-0.5 pr-3 py-0.5">
                                  <CrmAvatar name={company.company_name} />
                                  <span className="text-[16px] text-[#202124] dark:text-foreground truncate">
                                    {company.company_name}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/contacts/companies/expanded-view/${company.id}`); }}
                                  className="shrink-0 ml-auto -mr-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                                >
                                  <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
                                </button>
                              </div>
                            </td>

                            {/* Phone */}
                            {columnVisibility.phone && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.phone, border: '1px solid #c8bdd6' }}>
                                {company.phone ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{company.phone}</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Contact */}
                            {columnVisibility.contact && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.contact, border: '1px solid #c8bdd6' }}>
                                {company.contact_name ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{company.contact_name}</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Deals */}
                            {columnVisibility.deals && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.deals, border: '1px solid #c8bdd6' }}>
                                {company.deals_count > 0 ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">
                                    {company.deals_count}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">0</span>
                                )}
                              </td>
                            )}

                            {/* Website */}
                            {columnVisibility.website && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.website, border: '1px solid #c8bdd6' }}>
                                {company.website ? (
                                  <a
                                    href={company.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full hover:underline"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {company.website.replace(/^https?:\/\//, '')}
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Contact Type */}
                            {columnVisibility.contactType && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.contactType, border: '1px solid #c8bdd6' }}>
                                {typeCfg ? (
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${typeCfg.bg} ${typeCfg.color}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${typeCfg.dot}`} />
                                    {typeCfg.label}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">{company.contact_type}</span>
                                )}
                              </td>
                            )}

                            {/* Email Domain */}
                            {columnVisibility.emailDomain && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.emailDomain, border: '1px solid #c8bdd6' }}>
                                {company.email_domain ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{company.email_domain}</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Last Activity */}
                            {columnVisibility.lastActivity && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.lastActivity, border: '1px solid #c8bdd6' }}>
                                {formatShortDate(company.last_activity_at) ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground truncate max-w-full">{formatShortDate(company.last_activity_at)}</span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Interactions (derived from deals_count) */}
                            {columnVisibility.interactions && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.interactions, border: '1px solid #c8bdd6' }}>
                                {company.deals_count > 0 ? (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">
                                    {company.deals_count}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-muted-foreground/40">0</span>
                                )}
                              </td>
                            )}

                            {/* Inactive Days */}
                            {columnVisibility.inactiveDays && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.inactiveDays, border: '1px solid #c8bdd6' }}>
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-muted text-[16px] text-[#202124] dark:text-foreground">{inactiveDaysVal}d</span>
                              </td>
                            )}

                            {/* Tags */}
                            {columnVisibility.tags && (
                              <td className="px-3 py-1.5 overflow-hidden" style={{ width: columnWidths.tags, border: '1px solid #c8bdd6' }}>
                                {company.tags && company.tags.length > 0 ? (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    {company.tags.slice(0, 2).map((tag) => (
                                      <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted text-[11px] font-medium text-[#202124] dark:text-foreground">
                                        {tag}
                                      </span>
                                    ))}
                                    {company.tags.length > 2 && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#f1f3f4] dark:bg-muted text-[11px] font-medium text-[#202124] dark:text-foreground">+{company.tags.length - 2}</span>
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
                                isSelected
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
                  draggedCompany ? (
                    <Card className="p-3 shadow-lg border border-blue-300 rotate-2 cursor-grabbing w-56 bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <CrmAvatar name={draggedCompany.company_name} size="xs" />
                        <p className="text-sm font-semibold text-foreground truncate">{draggedCompany.company_name}</p>
                      </div>
                      {draggedCompany.contact_name && (
                        <p className="text-[11px] text-muted-foreground">{draggedCompany.contact_name}</p>
                      )}
                    </Card>
                  ) : null
                }
              >
                {CONTACT_TYPES.map((type) => {
                  const cfg = contactTypeConfig[type];
                  const columnCompanies = filteredAndSorted.filter(c => c.contact_type === type);
                  return (
                    <KanbanColumn
                      key={type}
                      id={type}
                      label={cfg?.label ?? type}
                      color={cfg?.dot ?? 'bg-muted-foreground'}
                      itemIds={columnCompanies.map(c => c.id)}
                      emptyMessage="Drop companies here"
                    >
                      {columnCompanies.map(company => (
                        <CompanyCard
                          key={company.id}
                          company={company}
                          isDragging={draggedCompany?.id === company.id}
                          onClick={() => handleRowClick(company)}
                        />
                      ))}
                    </KanbanColumn>
                  );
                })}
              </KanbanBoard>
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
                navigate(`/admin/contacts/companies/expanded-view/${selectedCompany.id}`);
              }}
              onContactTypeChange={(companyId, newType) => {
                contactTypeMutation.mutate({ companyId, newType, oldType: selectedCompany.contact_type ?? 'Other' });
                setSelectedCompany({ ...selectedCompany, contact_type: newType });
              }}
              onCompanyUpdate={(updatedCompany) => {
                setSelectedCompany(updatedCompany as any);
                queryClient.invalidateQueries({ queryKey: ['companies'] });
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
    </EmployeeLayout>
  );
};

export default Companies;
