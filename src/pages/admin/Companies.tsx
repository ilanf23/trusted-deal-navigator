import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useUndo } from '@/contexts/UndoContext';
import { supabase } from '@/integrations/supabase/client';
import { useAllPipelineLeads, DerivedCompany } from '@/hooks/useAllPipelineLeads';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import EvanLayout from '@/components/evan/EvanLayout';
import CompanyDetailPanel, { contactTypeConfigDefault } from '@/components/admin/CompanyDetailPanel';
import CreateFilterDialog, { CustomFilterValues } from '@/components/admin/CreateFilterDialog';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import {
  ArrowLeft, PanelLeft, Filter, ChevronDown, ChevronUp, Plus,
  Building2, Tag, Check, X, LayoutGrid, FileSearch,
  PanelRightOpen, Sparkles, Loader2, Download, PlusCircle, Globe, Maximize2,
  Search, Bookmark, BarChart3, AtSign, User, CalendarDays,
  MessageSquare, Moon, Phone, DollarSign,
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
  const [publicFiltersOpen, setPublicFiltersOpen] = useState(true);
  const [draggedCompany, setDraggedCompany] = useState<Company | null>(null);
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
      <Input
        type="text"
        placeholder="Search by name, email, domain or phone number"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full h-9 px-4 text-sm rounded-full bg-[#f1f3f4] dark:bg-muted/50 border-transparent focus:border-[#d2d5d9] dark:focus:border-border focus:bg-white dark:focus:bg-background placeholder:text-[#5f6368]/70 dark:placeholder:text-muted-foreground/60"
      />
    );
  }, [searchTerm]);

  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    phone: true, contact: true, deals: true, website: true, contactType: true,
    emailDomain: true, lastActivity: true, interactions: true, inactiveDays: true, tags: true,
  });

  const DEFAULT_COLUMN_WIDTHS: Record<string, number> = useMemo(() => ({
    company: 200, phone: 130, contact: 140, deals: 80, website: 150,
    contactType: 120, emailDomain: 140, lastActivity: 120, interactions: 90, inactiveDays: 90, tags: 100,
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

  // ── DnD sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Contact type update mutation for Kanban drag ──
  const contactTypeMutation = useMutation({
    mutationFn: async ({ companyId, newType, oldType }: { companyId: string; newType: string; oldType: string }) => {
      // companyId is the first lead's ID; get company_name from it
      const company = companies.find(c => c.id === companyId);
      if (!company) throw new Error('Company not found');
      const { error } = await supabase
        .from('leads')
        .update({ contact_type: newType })
        .eq('company_name', company.company_name);
      if (error) throw error;
      return { companyName: company.company_name, oldType, newType };
    },
    onSuccess: ({ companyName, oldType, newType }) => {
      queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
      toast.success('Contact type updated');
      registerUndo({
        label: `Changed "${companyName}" type to "${newType}"`,
        execute: async () => {
          const { error } = await supabase.from('leads').update({ contact_type: oldType }).eq('company_name', companyName);
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

  // ── Add Company state ──
  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [addCompanyType, setAddCompanyType] = useState<string>('Prospect');
  const [newCompany, setNewCompany] = useState({ company_name: '', contact_name: '', phone: '', website: '', email_domain: '', contact_type: 'Prospect' });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: typeof newCompany) => {
      // Insert as a lead
      const { data: lead, error } = await supabase
        .from('leads')
        .insert({
          name: data.contact_name || data.company_name,
          company_name: data.company_name,
          phone: data.phone || null,
          website: data.website || null,
          email: data.email_domain ? `contact@${data.email_domain}` : null,
          contact_type: data.contact_type,
          status: 'initial_review',
        })
        .select()
        .single();
      if (error) throw error;

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

      return {
        id: lead.id,
        company_name: data.company_name,
        contact_name: data.contact_name || null,
        phone: data.phone || null,
        website: data.website || null,
        email_domain: data.email_domain || null,
        contact_type: data.contact_type,
        tags: null,
        assigned_to: null,
        notes: null,
        source: null,
        last_activity_at: null,
        known_as: null,
        clx_file_name: null,
        bank_relationships: null,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
        deals_count: 1,
      } as Company;
    },
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
      setAddCompanyOpen(false);
      setNewCompany({ company_name: '', contact_name: '', phone: '', website: '', email_domain: '', contact_type: 'Prospect' });
      toast.success(`"${company.company_name}" added as ${company.contact_type}`);
      setSelectedCompany(company);
      registerUndo({
        label: `Created "${company.company_name}"`,
        execute: async () => {
          const { error } = await supabase.from('leads').delete().eq('id', company.id);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
          toast.success('Company creation undone');
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
  const { companies: rawCompanies, isLoading } = useAllPipelineLeads();
  const companies = rawCompanies as Company[];

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
      const d = daysSince(c.last_activity_at);
      return d !== null && d <= 7;
    }).length;
    counts['inactive'] = companies.filter(c => {
      const d = daysSince(c.last_activity_at);
      return d !== null && d >= 30;
    }).length;
    return counts;
  }, [companies]);

  const filteredAndSorted = useMemo(() => {
    let result = companies;

    if (activeFilter !== 'all') {
      if (CONTACT_TYPES.includes(activeFilter)) {
        result = result.filter(c => c.contact_type === activeFilter);
      } else if (activeFilter === 'recently_contacted') {
        result = result.filter(c => {
          const d = daysSince(c.last_activity_at);
          return d !== null && d <= 7;
        });
      } else if (activeFilter === 'inactive') {
        result = result.filter(c => {
          const d = daysSince(c.last_activity_at);
          return d !== null && d >= 30;
        });
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
                    stageConfig={contactTypeConfig}
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
                {/* All Companies — top item */}
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

                {/* Public section (was "By Type") */}
                <button
                  onClick={() => setPublicFiltersOpen(v => !v)}
                  className="w-full px-6 pt-4 pb-1 flex items-center justify-between group"
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
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-[#5f6368] dark:text-muted-foreground">Custom</span>
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

          {/* ── Main Table Area ── */}
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
                  {FILTER_OPTIONS.find(o => o.id === activeFilter)?.label ?? customFilters.find(cf => cf.id === activeFilter)?.label ?? 'All Companies'}
                </h2>
                <Bookmark className="h-4 w-4 text-[#80868b] dark:text-muted-foreground shrink-0" />
                {!isLoading && (
                  <span className="text-[#5f6368] dark:text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                    # {filteredAndSorted.length.toLocaleString()} {filteredAndSorted.length === 1 ? 'company' : 'companies'}
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
                      <th className="w-12 pl-2 pr-4 py-1.5 text-center sticky top-0 left-0 z-30" style={{ backgroundColor: '#eee6f6', border: '1px solid #c8bdd6' }} />
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
                          <td className="pl-2 pr-4 py-1.5 w-12 text-center sticky left-0 z-[5] bg-white dark:bg-card" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-5 w-5 rounded" /></td>
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
                        const initial = company.company_name[0]?.toUpperCase() ?? '?';
                        const avatarColor = getAvatarColor(company.company_name);
                        const typeCfg = contactTypeConfig[company.contact_type ?? 'Other'];
                        const inactiveDaysVal = daysSince(company.last_activity_at) ?? 0;
                        const isStale = inactiveDaysVal > 7;
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
                                ? 'bg-[#eee6f6] dark:bg-purple-950/30 hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40 border-l-[3px] border-l-[#3b2778]'
                                : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                            }`}
                          >
                            {/* Checkbox */}
                            <td className={`pl-2 pr-4 py-1.5 w-12 text-center sticky left-0 z-[5] transition-colors ${stickyBg}`} style={{ border: '1px solid #c8bdd6' }}>
                              <Checkbox
                                checked={isSelected}
                                className="h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                              />
                            </td>

                            {/* Company (sticky) */}
                            <td className={`px-4 py-1.5 overflow-hidden sticky z-[5] transition-colors ${stickyBg}`} style={{ width: columnWidths.company, left: 48, border: '1px solid #c8bdd6', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                              <div className="flex items-center gap-2.5">
                                <div className={`h-7 w-7 rounded-md ${avatarColor} flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm`}>
                                  {initial}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-semibold text-[#202124] dark:text-foreground truncate text-[13px] leading-tight">
                                      {company.company_name}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); navigate(`/admin/contacts/companies/expanded-view/${company.id}`); }}
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
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.phone, border: '1px solid #c8bdd6' }}>
                                {company.phone ? (
                                  <span className="text-[13px] text-[#5f6368] dark:text-muted-foreground truncate block">{company.phone}</span>
                                ) : (
                                  <span className="text-[#5f6368]/40 dark:text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Contact */}
                            {columnVisibility.contact && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.contact, border: '1px solid #c8bdd6' }}>
                                {company.contact_name ? (
                                  <span className="text-[13px] text-[#5f6368] dark:text-muted-foreground truncate block">{company.contact_name}</span>
                                ) : (
                                  <span className="text-[#5f6368]/40 dark:text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Deals */}
                            {columnVisibility.deals && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.deals, border: '1px solid #c8bdd6' }}>
                                {company.deals_count > 0 ? (
                                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-md bg-muted text-[11px] font-bold text-foreground/70">
                                    {company.deals_count}
                                  </span>
                                ) : (
                                  <span className="text-[#5f6368]/40 dark:text-muted-foreground/40 text-[13px]">0</span>
                                )}
                              </td>
                            )}

                            {/* Website */}
                            {columnVisibility.website && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.website, border: '1px solid #c8bdd6' }}>
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
                                  <span className="text-[#5f6368]/40 dark:text-muted-foreground/40">—</span>
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
                                  <span className="text-[#5f6368] dark:text-muted-foreground text-xs">{company.contact_type}</span>
                                )}
                              </td>
                            )}

                            {/* Email Domain */}
                            {columnVisibility.emailDomain && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.emailDomain, border: '1px solid #c8bdd6' }}>
                                {company.email_domain ? (
                                  <span className="text-[13px] text-[#5f6368] dark:text-muted-foreground truncate block">{company.email_domain}</span>
                                ) : (
                                  <span className="text-[#5f6368]/40 dark:text-muted-foreground/40">—</span>
                                )}
                              </td>
                            )}

                            {/* Last Activity */}
                            {columnVisibility.lastActivity && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.lastActivity, border: '1px solid #c8bdd6' }}>
                                <span className="text-[12px] text-[#5f6368] dark:text-muted-foreground tabular-nums">{formatShortDate(company.last_activity_at)}</span>
                              </td>
                            )}

                            {/* Interactions (derived from deals_count) */}
                            {columnVisibility.interactions && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.interactions, border: '1px solid #c8bdd6' }}>
                                {company.deals_count > 0 ? (
                                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                    {company.deals_count}
                                  </span>
                                ) : (
                                  <span className="text-[#5f6368]/40 dark:text-muted-foreground/40 text-[13px]">0</span>
                                )}
                              </td>
                            )}

                            {/* Inactive Days */}
                            {columnVisibility.inactiveDays && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.inactiveDays, border: '1px solid #c8bdd6' }}>
                                {isStale ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">
                                    {inactiveDaysVal}d
                                  </span>
                                ) : (
                                  <span className="text-[12px] text-[#5f6368] dark:text-muted-foreground tabular-nums">{inactiveDaysVal}d</span>
                                )}
                              </td>
                            )}

                            {/* Tags */}
                            {columnVisibility.tags && (
                              <td className="px-4 py-1.5 overflow-hidden" style={{ width: columnWidths.tags, border: '1px solid #c8bdd6' }}>
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
                                  <span className="text-[#5f6368]/40 dark:text-muted-foreground/40">—</span>
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
                navigate(`/admin/contacts/companies/expanded-view/${selectedCompany.id}`);
              }}
              onContactTypeChange={(companyId, newType) => {
                contactTypeMutation.mutate({ companyId, newType, oldType: selectedCompany.contact_type ?? 'Other' });
                setSelectedCompany({ ...selectedCompany, contact_type: newType });
              }}
              onCompanyUpdate={(updatedCompany) => {
                setSelectedCompany(updatedCompany as any);
                queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
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
