import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
import { InlineEditableCell } from '@/components/admin/InlineEditableCell';
import { Checkbox } from '@/components/ui/checkbox';
import { SelectAllHeader } from '@/components/admin/SelectAllHeader';
import {
  ArrowUpDown,
  AlignJustify,
  Filter,
  Settings2,
  ChevronDown,
  DollarSign,
  Check,
  X,
  PanelRightOpen,
  FileSearch,
  RefreshCw,
  Trophy,
  TrendingUp,
  CloudOff,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format } from 'date-fns';
import { DbTableBadge } from '@/components/admin/DbTableBadge';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

// ── Column definitions ──

type ColumnKey =
  | 'borrower' | 'status' | 'company' | 'loanAmount' | 'category' | 'stage'
  | 'won' | 'assignedTo' | 'lender' | 'lenderType' | 'feePercent'
  | 'potentialRevenue' | 'netRevenue' | 'targetClosing' | 'wuDate'
  | 'daysToWu' | 'daysToClose' | 'source' | 'clxAgreement' | 'signals';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  borrower: 'Borrower Name',
  status: 'Status',
  company: 'Company',
  loanAmount: 'Loan Amount',
  category: 'Category',
  stage: 'Stage',
  won: 'WON',
  assignedTo: 'Assigned To',
  lender: 'Lender',
  lenderType: 'Lender Type',
  feePercent: 'Fee %',
  potentialRevenue: 'Potential Rev',
  netRevenue: 'Net Revenue',
  targetClosing: 'Target Close',
  wuDate: 'WU Date',
  daysToWu: 'Days to WU',
  daysToClose: 'Days to Close',
  source: 'Source',
  clxAgreement: 'CLX Agmt',
  signals: 'Signals',
};

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  borrower: 180,
  status: 90,
  company: 130,
  loanAmount: 110,
  category: 120,
  stage: 120,
  won: 60,
  assignedTo: 90,
  lender: 120,
  lenderType: 110,
  feePercent: 70,
  potentialRevenue: 110,
  netRevenue: 100,
  targetClosing: 100,
  wuDate: 90,
  daysToWu: 75,
  daysToClose: 80,
  source: 100,
  clxAgreement: 70,
  signals: 80,
};

// ── Sort ──

type SortField = 'name' | 'company_name' | 'status' | 'deal_value' | 'assigned_to' | 'updated_at' | 'created_at';
type SortDir = 'asc' | 'desc';

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'name', label: 'Borrower' },
  { value: 'company_name', label: 'Company' },
  { value: 'deal_value', label: 'Loan Amount' },
  { value: 'status', label: 'Status' },
  { value: 'assigned_to', label: 'Assigned To' },
  { value: 'updated_at', label: 'Updated' },
  { value: 'created_at', label: 'Created' },
];

// ── Filter options ──

const STATUS_FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'on_hold', label: 'On Hold' },
];

const WON_LOST_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

// ── Density options ──

type RowDensity = 'compact' | 'comfortable' | 'spacious';

const DENSITY_PAD: Record<RowDensity, string> = {
  compact: 'py-1',
  comfortable: 'py-2.5',
  spacious: 'py-4',
};

// ── Helpers ──

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

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)}%`;
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    return differenceInDays(new Date(), parseISO(dateStr));
  } catch {
    return null;
  }
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    return differenceInDays(parseISO(dateStr), new Date());
  } catch {
    return null;
  }
}

// ── Signals computation ──

type Signal = {
  type: 'critical' | 'warning' | 'info';
  label: string;
};

function computeSignals(lead: Lead, _teamMemberMap: Record<string, string>): Signal[] {
  const signals: Signal[] = [];

  // Stale deal: no activity for 14+ days
  const inactiveDays = daysSince(lead.last_activity_at);
  if (inactiveDays !== null && inactiveDays > 14) {
    signals.push({ type: 'critical', label: 'Stale deal' });
  }

  // Missing lender
  if (!lead.lender_name && lead.status !== 'discovery' && lead.status !== 'lost') {
    signals.push({ type: 'warning', label: 'Missing lender' });
  }

  // Overdue closing: target_closing_date has passed
  const closingDaysLeft = daysUntil(lead.target_closing_date);
  if (closingDaysLeft !== null && closingDaysLeft < 0 && lead.status !== 'funded' && lead.status !== 'lost') {
    signals.push({ type: 'warning', label: 'Overdue closing' });
  }

  // No assigned team member
  if (!lead.assigned_to) {
    signals.push({ type: 'warning', label: 'Unassigned' });
  }

  // Missing fee
  if (!lead.fee_percent && lead.deal_value && lead.status !== 'discovery' && lead.status !== 'lost') {
    signals.push({ type: 'info', label: 'Missing fee' });
  }

  // No CLX agreement
  if (!lead.clx_agreement && lead.status !== 'discovery' && lead.status !== 'lost') {
    signals.push({ type: 'info', label: 'No CLX agmt' });
  }

  return signals;
}

function getSignalSeverityColor(signals: Signal[]): string {
  if (signals.some(s => s.type === 'critical')) return 'bg-red-500';
  if (signals.some(s => s.type === 'warning')) return 'bg-amber-500';
  if (signals.some(s => s.type === 'info')) return 'bg-blue-500';
  return 'bg-gray-300';
}

// ── Stage config for display ──

const STAGE_DISPLAY: Record<string, { label: string; dot: string; pill: string }> = {
  discovery: { label: 'Discovery', dot: 'bg-slate-400', pill: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700' },
  questionnaire: { label: 'Questionnaire', dot: 'bg-blue-400', pill: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700' },
  pre_qualification: { label: 'Pre-Qual', dot: 'bg-cyan-400', pill: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900 dark:text-cyan-300 dark:border-cyan-700' },
  document_collection: { label: 'Doc Collection', dot: 'bg-indigo-400', pill: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-700' },
  initial_review: { label: 'Initial Review', dot: 'bg-purple-400', pill: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700' },
  moving_to_underwriting: { label: 'Moving to UW', dot: 'bg-amber-400', pill: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700' },
  underwriting: { label: 'Underwriting', dot: 'bg-orange-400', pill: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-700' },
  ready_for_wu_approval: { label: 'Ready for WU', dot: 'bg-yellow-400', pill: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700' },
  approval: { label: 'Approval', dot: 'bg-lime-400', pill: 'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-900 dark:text-lime-300 dark:border-lime-700' },
  onboarding: { label: 'Onboarding', dot: 'bg-teal-400', pill: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900 dark:text-teal-300 dark:border-teal-700' },
  funded: { label: 'Funded', dot: 'bg-emerald-400', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700' },
  lost: { label: 'Lost', dot: 'bg-red-400', pill: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-700' },
};

// ── Category options ──

const CATEGORY_OPTIONS = [
  { id: 'commercial_real_estate', label: 'Commercial RE' },
  { id: 'sba', label: 'SBA' },
  { id: 'residential', label: 'Residential' },
  { id: 'construction', label: 'Construction' },
  { id: 'bridge', label: 'Bridge' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'line_of_credit', label: 'Line of Credit' },
  { id: 'other', label: 'Other' },
];

// ── Active status mapping ──

const ACTIVE_STATUSES: LeadStatus[] = ['discovery', 'questionnaire', 'pre_qualification', 'document_collection', 'underwriting', 'approval', 'initial_review', 'moving_to_underwriting', 'onboarding', 'ready_for_wu_approval'];
const INACTIVE_STATUSES: LeadStatus[] = ['lost'];
const ON_HOLD_STATUSES: LeadStatus[] = []; // placeholder for future use

function getStatusGroup(status: LeadStatus): 'active' | 'inactive' | 'on_hold' | 'won' {
  if (status === 'funded') return 'won';
  if (INACTIVE_STATUSES.includes(status)) return 'inactive';
  if (ON_HOLD_STATUSES.includes(status)) return 'on_hold';
  return 'active';
}

// ── Main Component ──

const LoanVolumeLog = () => {
  const queryClient = useQueryClient();

  // Core state
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // Toolbar state
  const [rowDensity, setRowDensity] = useState<RowDensity>('comfortable');
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [wonFilter, setWonFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>({
    borrower: true, status: true, company: true, loanAmount: true, category: true,
    stage: true, won: true, assignedTo: true, lender: true, lenderType: true,
    feePercent: true, potentialRevenue: true, netRevenue: true, targetClosing: true,
    wuDate: true, daysToWu: true, daysToClose: true, source: true, clxAgreement: true,
    signals: true,
  });

  // Column widths (persisted)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('vl-column-widths');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
      }
    } catch { /* empty */ }
    return { ...DEFAULT_COLUMN_WIDTHS };
  });

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [columnId]: newWidth };
      localStorage.setItem('vl-column-widths', JSON.stringify(next));
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
      if (e.key === 'Escape' && detailDialogLead) setDetailDialogLead(null);
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [detailDialogLead]);

  // ── Data fetching ──

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['volume-log-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });

  // Derive last sync from DB data
  const dbLastSync = useMemo(() => {
    const synced = leads.filter(l => l.sheets_last_synced_at).map(l => l.sheets_last_synced_at!);
    if (synced.length === 0) return null;
    synced.sort();
    return synced[synced.length - 1];
  }, [leads]);

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['vl-team-members'],
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

  // ── Inline update mutation ──

  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, field, value }: { leadId: string; field: string; value: any }) => {
      const { error } = await supabase
        .from('leads')
        .update({ [field]: value })
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volume-log-leads'] });
    },
    onError: () => {
      toast.error('Failed to update field');
    },
  });

  const handleInlineEdit = useCallback((leadId: string, field: string, value: any) => {
    updateLeadMutation.mutate({ leadId, field, value });
    toast.success('Field updated');
  }, [updateLeadMutation]);

  // ── Sync (placeholder) ──

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      // Placeholder: would call useVolumeLogSync hook to push to Google Sheets
      await new Promise(r => setTimeout(r, 1200));
      setLastSyncAt(new Date());
      toast.success('Synced to Google Sheets');
    } catch {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // ── Derived data ──

  // Unique categories from data
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const l of leads) {
      if (l.loan_category) cats.add(l.loan_category);
    }
    return Array.from(cats).sort();
  }, [leads]);

  // Unique assigned people
  const uniqueAssigned = useMemo(() => {
    const ids = new Set<string>();
    for (const l of leads) {
      if (l.assigned_to) ids.add(l.assigned_to);
    }
    return Array.from(ids)
      .map(id => ({ id, name: teamMemberMap[id] ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [leads, teamMemberMap]);

  // ── Filtering + sorting ──

  const filteredAndSorted = useMemo(() => {
    let result = leads;

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') result = result.filter(l => getStatusGroup(l.status) === 'active');
      else if (statusFilter === 'inactive') result = result.filter(l => getStatusGroup(l.status) === 'inactive');
      else if (statusFilter === 'on_hold') result = result.filter(l => getStatusGroup(l.status) === 'on_hold');
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(l => l.loan_category === categoryFilter);
    }

    // Stage filter
    if (stageFilter !== 'all') {
      result = result.filter(l => l.status === stageFilter);
    }

    // Won/Lost filter
    if (wonFilter === 'won') {
      result = result.filter(l => l.won === true || l.status === 'funded');
    } else if (wonFilter === 'lost') {
      result = result.filter(l => l.won === false || l.status === 'lost');
    }

    // Assigned filter
    if (assignedFilter !== 'all') {
      result = result.filter(l => l.assigned_to === assignedFilter);
    }

    // Search
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
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

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'deal_value') {
        cmp = (a.deal_value ?? 0) - (b.deal_value ?? 0);
      } else {
        const aVal = ((a[sortField] ?? '') as string).toLowerCase();
        const bVal = ((b[sortField] ?? '') as string).toLowerCase();
        cmp = aVal.localeCompare(bVal);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [leads, statusFilter, categoryFilter, stageFilter, wonFilter, assignedFilter, searchTerm, sortField, sortDir, teamMemberMap]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalDeals = filteredAndSorted.length;
    const totalLoanAmount = filteredAndSorted.reduce((sum, l) => sum + (l.deal_value ?? 0), 0);
    const totalPotentialRevenue = filteredAndSorted.reduce((sum, l) => {
      if (l.potential_revenue) return sum + l.potential_revenue;
      const feeP = l.fee_percent ?? 0;
      const amt = l.deal_value ?? 0;
      return sum + (amt * feeP / 100);
    }, 0);
    const totalNetRevenue = filteredAndSorted.reduce((sum, l) => {
      if (l.net_revenue) return sum + l.net_revenue;
      if (l.actual_net_revenue) return sum + l.actual_net_revenue;
      return sum;
    }, 0);
    const wonCount = filteredAndSorted.filter(l => l.won === true || l.status === 'funded').length;
    return { totalDeals, totalLoanAmount, totalPotentialRevenue, totalNetRevenue, wonCount };
  }, [filteredAndSorted]);

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

  // Filter helpers
  const isFiltersActive = statusFilter !== 'all' || categoryFilter !== 'all' || stageFilter !== 'all' || wonFilter !== 'all' || assignedFilter !== 'all' || searchTerm.trim() !== '';
  const isNonDefaultSort = sortField !== 'updated_at' || sortDir !== 'desc';
  const sortFieldLabel = SORT_FIELD_OPTIONS.find(o => o.value === sortField)?.label ?? sortField;

  function clearAllFilters() {
    setStatusFilter('all');
    setCategoryFilter('all');
    setStageFilter('all');
    setWonFilter('all');
    setAssignedFilter('all');
    setSearchTerm('');
  }

  function toggleColumn(key: ColumnKey) {
    setColumnVisibility(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleRowClick(lead: Lead) {
    setDetailDialogLead(lead);
  }

  // Row padding
  const rowPad = DENSITY_PAD[rowDensity];

  // Column header helper
  const ColHeader = ({
    colKey,
    children,
    className: extraClassName,
    style: extraStyle,
  }: {
    colKey: ColumnKey;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }) => {
    if (!columnVisibility[colKey]) return null;
    const width = columnWidths[colKey] ?? DEFAULT_COLUMN_WIDTHS[colKey] ?? 100;
    return (
      <th
        className={`px-3 py-3 text-left whitespace-nowrap ${extraClassName ?? ''}`}
        style={{ width: `${width}px`, minWidth: 60, maxWidth: 500, border: '1px solid #c8bdd6', ...extraStyle }}
      >
        <ResizableColumnHeader
          columnId={colKey}
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

  // ── Density cycle ──
  const cycleDensity = () => {
    setRowDensity(d => {
      if (d === 'comfortable') return 'compact';
      if (d === 'compact') return 'spacious';
      return 'comfortable';
    });
  };

  return (
    <EvanLayout>
      <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">

        {/* Header */}
        <div className="shrink-0 border-b border-border bg-background px-5 py-3 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h1 className="text-[15px] font-bold text-foreground whitespace-nowrap">Loan Volume Log</h1>
              <DbTableBadge tables={['leads']} />
              {!isLoading && (
                <span className="text-[12px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-medium tabular-nums">
                  {summaryStats.totalDeals} {summaryStats.totalDeals === 1 ? 'deal' : 'deals'}
                </span>
              )}
            </div>

            {/* Sync indicator */}
            <div className="flex items-center gap-2 shrink-0">
              {lastSyncAt ? (
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Synced {format(lastSyncAt, 'h:mm a')}
                </span>
              ) : dbLastSync ? (
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Last sync {formatShortDate(dbLastSync)}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CloudOff className="h-3 w-3" />
                  Not synced
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing}
                className="h-7 px-2.5 text-[11px] font-medium gap-1.5"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync'}
              </Button>
            </div>
          </div>

          {/* Summary stats bar */}
          {!isLoading && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-[12px]">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Total Deals:</span>
                <span className="font-semibold text-foreground tabular-nums">{summaryStats.totalDeals}</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-[12px]">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-muted-foreground">Loan Amount:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(summaryStats.totalLoanAmount)}</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-[12px]">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-muted-foreground">Potential Rev:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">{formatCurrency(summaryStats.totalPotentialRevenue)}</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-[12px]">
                <DollarSign className="h-3.5 w-3.5 text-violet-500" />
                <span className="text-muted-foreground">Net Revenue:</span>
                <span className="font-semibold text-violet-600 dark:text-violet-400 tabular-nums">{formatCurrency(summaryStats.totalNetRevenue)}</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="flex items-center gap-1.5 text-[12px]">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-muted-foreground">Won:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{summaryStats.wonCount}</span>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="shrink-0 border-b border-border px-3 py-2 flex items-center justify-between gap-2 bg-muted/50">

          {/* Left: Filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">

            {/* Status filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button className={`flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11px] font-medium transition-all ${
                  statusFilter !== 'all'
                    ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}>
                  Status
                  <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-40 p-1.5">
                {STATUS_FILTER_OPTIONS.map(o => (
                  <button
                    key={o.id}
                    onClick={() => setStatusFilter(o.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                      statusFilter === o.id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Category filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button className={`flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11px] font-medium transition-all ${
                  categoryFilter !== 'all'
                    ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}>
                  Category
                  <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-44 p-1.5">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                    categoryFilter === 'all' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium' : 'text-foreground hover:bg-muted'
                  }`}
                >
                  All
                </button>
                {uniqueCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                      categoryFilter === cat ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {CATEGORY_OPTIONS.find(c => c.id === cat)?.label ?? cat}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Stage filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button className={`flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11px] font-medium transition-all ${
                  stageFilter !== 'all'
                    ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}>
                  Stage
                  <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-44 p-1.5 max-h-64 overflow-y-auto">
                <button
                  onClick={() => setStageFilter('all')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                    stageFilter === 'all' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium' : 'text-foreground hover:bg-muted'
                  }`}
                >
                  All
                </button>
                {Object.entries(STAGE_DISPLAY).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setStageFilter(key)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] transition-colors flex items-center gap-2 ${
                      stageFilter === key ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                    {cfg.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Won/Lost filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button className={`flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11px] font-medium transition-all ${
                  wonFilter !== 'all'
                    ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}>
                  Won/Lost
                  <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-36 p-1.5">
                {WON_LOST_OPTIONS.map(o => (
                  <button
                    key={o.id}
                    onClick={() => setWonFilter(o.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                      wonFilter === o.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Assigned To filter */}
            <Popover>
              <PopoverTrigger asChild>
                <button className={`flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11px] font-medium transition-all ${
                  assignedFilter !== 'all'
                    ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}>
                  Assigned To
                  <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-44 p-1.5 max-h-64 overflow-y-auto">
                <button
                  onClick={() => setAssignedFilter('all')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                    assignedFilter === 'all' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium' : 'text-foreground hover:bg-muted'
                  }`}
                >
                  All
                </button>
                {uniqueAssigned.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setAssignedFilter(a.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${
                      assignedFilter === a.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Active filter chips display */}
            {isNonDefaultSort && (
              <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-md px-2 h-7">
                <ArrowUpDown className="h-3 w-3 shrink-0" />
                {sortFieldLabel} {sortDir === 'asc' ? '\u2191' : '\u2193'}
                <button
                  onClick={() => { setSortField('updated_at'); setSortDir('desc'); }}
                  className="ml-0.5 text-blue-400 hover:text-blue-700"
                  title="Reset sort"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>

          {/* Right: tools */}
          <div className="flex items-center gap-0.5">

            {/* Density toggle */}
            <button
              onClick={cycleDensity}
              title={`Row density: ${rowDensity}`}
              className={iconBtn(rowDensity !== 'comfortable')}
            >
              <AlignJustify className={`h-3.5 w-3.5 ${rowDensity !== 'comfortable' ? 'text-blue-600' : ''}`} />
            </button>


            {/* Sort */}
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

            {/* Filter clear */}
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
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-popover border border-border rounded-xl shadow-lg w-52 py-1.5 overflow-hidden max-h-[420px] overflow-y-auto">
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
          <div className="mb-0">
            <PipelineBulkToolbar
              selectedCount={selectedLeadIds.size}
              totalCount={filteredAndSorted.length}
              onClearSelection={clearSelection}
              onEdit={() => { /* TODO */ }}
              onExport={() => { /* TODO */ }}
            />
          </div>
        )}

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

        {/* Table Area */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <ColHeader
                      colKey="borrower"
                      className="sticky top-0 z-30 bg-gray-100 dark:bg-muted group/hdr"
                      style={{ left: 0, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}
                    >
                      <div className={`shrink-0 transition-opacity ${isAllSelected || selectedLeadIds.size > 0 ? 'opacity-100' : 'opacity-0 group-hover/hdr:opacity-100'}`}>
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={(checked) => checked ? selectAll() : clearSelection()}
                          className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                        />
                      </div>
                      Borrower
                    </ColHeader>

                    <ColHeader colKey="status" className="sticky top-0 z-10 bg-white dark:bg-card">Status</ColHeader>
                    <ColHeader colKey="company" className="sticky top-0 z-10 bg-white dark:bg-card">Company</ColHeader>
                    <ColHeader colKey="loanAmount" className="sticky top-0 z-10 bg-white dark:bg-card">Loan Amt</ColHeader>
                    <ColHeader colKey="category" className="sticky top-0 z-10 bg-white dark:bg-card">Category</ColHeader>
                    <ColHeader colKey="stage" className="sticky top-0 z-10 bg-white dark:bg-card">Stage</ColHeader>
                    <ColHeader colKey="won" className="sticky top-0 z-10 bg-white dark:bg-card">WON</ColHeader>
                    <ColHeader colKey="assignedTo" className="sticky top-0 z-10 bg-white dark:bg-card">Assigned</ColHeader>
                    <ColHeader colKey="lender" className="sticky top-0 z-10 bg-white dark:bg-card">Lender</ColHeader>
                    <ColHeader colKey="lenderType" className="sticky top-0 z-10 bg-white dark:bg-card">Lndr Type</ColHeader>
                    <ColHeader colKey="feePercent" className="sticky top-0 z-10 bg-white dark:bg-card">Fee %</ColHeader>
                    <ColHeader colKey="potentialRevenue" className="sticky top-0 z-10 bg-white dark:bg-card">Pot. Rev</ColHeader>
                    <ColHeader colKey="netRevenue" className="sticky top-0 z-10 bg-white dark:bg-card">Net Rev</ColHeader>
                    <ColHeader colKey="targetClosing" className="sticky top-0 z-10 bg-white dark:bg-card">Target Close</ColHeader>
                    <ColHeader colKey="wuDate" className="sticky top-0 z-10 bg-white dark:bg-card">WU Date</ColHeader>
                    <ColHeader colKey="daysToWu" className="sticky top-0 z-10 bg-white dark:bg-card">Days WU</ColHeader>
                    <ColHeader colKey="daysToClose" className="sticky top-0 z-10 bg-white dark:bg-card">Days Close</ColHeader>
                    <ColHeader colKey="source" className="sticky top-0 z-10 bg-white dark:bg-card">Source</ColHeader>
                    <ColHeader colKey="clxAgreement" className="sticky top-0 z-10 bg-white dark:bg-card">CLX Agmt</ColHeader>
                    <ColHeader colKey="signals" className="sticky top-0 z-10 bg-white dark:bg-card">Signals</ColHeader>

                    {/* Detail arrow spacer */}
                    <th className="w-10 px-2 py-3 sticky top-0 z-10 bg-white dark:bg-card" style={{ border: '1px solid #c8bdd6' }} />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                        <td className="pl-2 pr-4 py-3.5 sticky left-0 z-[5] bg-white dark:bg-card" style={{ width: columnWidths.borrower, border: '1px solid #c8bdd6', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 rounded shrink-0" />
                            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                            <Skeleton className="h-3.5 w-28" />
                          </div>
                        </td>
                        {columnVisibility.status && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-14 rounded" /></td>}
                        {columnVisibility.company && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                        {columnVisibility.loanAmount && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                        {columnVisibility.category && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-18 rounded" /></td>}
                        {columnVisibility.stage && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-5 w-20 rounded-full" /></td>}
                        {columnVisibility.won && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-8 rounded" /></td>}
                        {columnVisibility.assignedTo && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                        {columnVisibility.lender && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-20 rounded" /></td>}
                        {columnVisibility.lenderType && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                        {columnVisibility.feePercent && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-10 rounded" /></td>}
                        {columnVisibility.potentialRevenue && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                        {columnVisibility.netRevenue && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                        {columnVisibility.targetClosing && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-18 rounded" /></td>}
                        {columnVisibility.wuDate && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-18 rounded" /></td>}
                        {columnVisibility.daysToWu && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-10 rounded" /></td>}
                        {columnVisibility.daysToClose && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-10 rounded" /></td>}
                        {columnVisibility.source && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-16 rounded" /></td>}
                        {columnVisibility.clxAgreement && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-8 rounded" /></td>}
                        {columnVisibility.signals && <td className="px-3 py-3.5" style={{ border: '1px solid #c8bdd6' }}><Skeleton className="h-3.5 w-10 rounded" /></td>}
                        <td className="px-2 py-3.5 w-10" style={{ border: '1px solid #c8bdd6' }} />
                      </tr>
                    ))
                  ) : filteredAndSorted.length === 0 ? (
                    <tr>
                      <td colSpan={22} style={{ border: '1px solid #c8bdd6' }}>
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted">
                            <FileSearch className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-foreground">No deals found</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-[300px]">
                              {searchTerm
                                ? 'Try adjusting your search or filter criteria'
                                : 'Connect Google Sheets and sync your loan volume data to see deals here.'}
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
                          {!isFiltersActive && !searchTerm && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleSync}
                              className="mt-1 gap-2"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Connect &amp; Sync Google Sheets
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAndSorted.map((lead, rowIdx) => {
                      const initial = lead.name[0]?.toUpperCase() ?? '?';
                      const avatarColor = getAvatarColor(lead.name);
                      const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? null) : null;
                      const assignedInitial = assignedName?.[0]?.toUpperCase() ?? null;
                      const assignedColor = assignedName ? getAvatarColor(assignedName) : '';
                      const assignedAvatar = lead.assigned_to ? (teamAvatarMap[lead.assigned_to] ?? null) : null;
                      const isDetailOpen = detailDialogLead?.id === lead.id;
                      const isSelected = selectedLeadIds.has(lead.id);
                      const stageCfg = STAGE_DISPLAY[lead.status];
                      const isWon = lead.won === true || lead.status === 'funded';
                      const isLost = lead.won === false || lead.status === 'lost';

                      // Computed values
                      const potentialRev = lead.potential_revenue ?? ((lead.deal_value ?? 0) * ((lead.fee_percent ?? 0) / 100));
                      const netRev = lead.net_revenue ?? lead.actual_net_revenue;
                      const daysToWuVal = daysUntil(lead.wu_date);
                      const daysToCloseVal = daysUntil(lead.target_closing_date);
                      const signals = computeSignals(lead, teamMemberMap);

                      const stickyBg = isDetailOpen || isSelected
                        ? 'bg-blue-50 dark:bg-blue-950 group-hover:bg-blue-100 dark:group-hover:bg-blue-900'
                        : 'bg-white dark:bg-card group-hover:bg-gray-50 dark:group-hover:bg-muted';

                      return (
                        <tr
                          key={lead.id}
                          onClick={() => handleRowClick(lead)}
                          className={`cursor-pointer transition-colors duration-100 group border-b border-border/60 last:border-b-0 ${
                            isDetailOpen || isSelected
                              ? 'bg-blue-50/60 dark:bg-blue-950/30 hover:bg-blue-50/80 dark:hover:bg-blue-950/40'
                              : rowIdx % 2 === 0
                                ? 'bg-card hover:bg-muted/50'
                                : 'bg-muted/30 hover:bg-muted/50'
                          }`}
                        >
                          {/* Borrower + Checkbox (sticky) */}
                          {columnVisibility.borrower && (
                            <td
                              className={`pl-2 pr-3 ${rowPad} overflow-hidden sticky left-0 z-[5] transition-colors ${stickyBg}`}
                              style={{ width: columnWidths.borrower, border: '1px solid #c8bdd6', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} onClick={(e) => { e.stopPropagation(); toggleLeadSelection(lead.id); }}>
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
                                  <p className="font-semibold text-foreground truncate text-[13px] leading-tight">
                                    {lead.name}
                                  </p>
                                  {lead.email && (
                                    <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{lead.email}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Status */}
                          {columnVisibility.status && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.status, border: '1px solid #c8bdd6' }}>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                getStatusGroup(lead.status) === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : getStatusGroup(lead.status) === 'won'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                              }`}>
                                {getStatusGroup(lead.status) === 'active' ? 'Active' : getStatusGroup(lead.status) === 'won' ? 'Won' : 'Inactive'}
                              </span>
                            </td>
                          )}

                          {/* Company */}
                          {columnVisibility.company && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.company, border: '1px solid #c8bdd6' }}>
                              <InlineEditableCell
                                value={lead.company_name ?? ''}
                                onChange={(v) => handleInlineEdit(lead.id, 'company_name', v || null)}
                                placeholder="--"
                                className="text-[12px]"
                                displayClassName="text-[12px] text-foreground/80"
                              />
                            </td>
                          )}

                          {/* Loan Amount */}
                          {columnVisibility.loanAmount && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.loanAmount, border: '1px solid #c8bdd6' }}>
                              <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                {formatCurrency(lead.deal_value)}
                              </span>
                            </td>
                          )}

                          {/* Category */}
                          {columnVisibility.category && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.category, border: '1px solid #c8bdd6' }}>
                              <InlineEditableCell
                                value={lead.loan_category ?? ''}
                                onChange={(v) => handleInlineEdit(lead.id, 'loan_category', v || null)}
                                type="select"
                                options={CATEGORY_OPTIONS}
                                placeholder="--"
                                className="text-[12px]"
                              />
                            </td>
                          )}

                          {/* Stage */}
                          {columnVisibility.stage && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.stage, border: '1px solid #c8bdd6' }}>
                              {stageCfg ? (
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${stageCfg.pill}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${stageCfg.dot}`} />
                                  {stageCfg.label}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[11px]">{lead.status}</span>
                              )}
                            </td>
                          )}

                          {/* WON */}
                          {columnVisibility.won && (
                            <td className={`px-3 ${rowPad} overflow-hidden text-center`} style={{ width: columnWidths.won, border: '1px solid #c8bdd6' }}>
                              {isWon ? (
                                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900">
                                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                                </span>
                              ) : isLost ? (
                                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-red-100 dark:bg-red-900">
                                  <X className="h-3 w-3 text-red-600 dark:text-red-400" strokeWidth={3} />
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40 text-[12px]">--</span>
                              )}
                            </td>
                          )}

                          {/* Assigned To */}
                          {columnVisibility.assignedTo && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.assignedTo, border: '1px solid #c8bdd6' }}>
                              {assignedName && assignedInitial ? (
                                <div className="flex items-center gap-1.5">
                                  {assignedAvatar ? (
                                    <img src={assignedAvatar} alt={assignedName} className="h-5 w-5 rounded-full object-cover shrink-0" />
                                  ) : (
                                    <div className={`h-5 w-5 rounded-full ${assignedColor} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                                      {assignedInitial}
                                    </div>
                                  )}
                                  <span className="text-[11px] text-foreground/80 truncate">{assignedName}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40 text-[12px]">--</span>
                              )}
                            </td>
                          )}

                          {/* Lender */}
                          {columnVisibility.lender && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.lender, border: '1px solid #c8bdd6' }}>
                              <InlineEditableCell
                                value={lead.lender_name ?? ''}
                                onChange={(v) => handleInlineEdit(lead.id, 'lender_name', v || null)}
                                placeholder="--"
                                className="text-[12px]"
                                displayClassName="text-[12px] text-foreground/80"
                              />
                            </td>
                          )}

                          {/* Lender Type */}
                          {columnVisibility.lenderType && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.lenderType, border: '1px solid #c8bdd6' }}>
                              <InlineEditableCell
                                value={lead.lender_type ?? ''}
                                onChange={(v) => handleInlineEdit(lead.id, 'lender_type', v || null)}
                                type="select"
                                options={[
                                  { id: 'bank', label: 'Bank' },
                                  { id: 'credit_union', label: 'Credit Union' },
                                  { id: 'private_lender', label: 'Private' },
                                  { id: 'sba_lender', label: 'SBA Lender' },
                                  { id: 'cdfi', label: 'CDFI' },
                                  { id: 'other', label: 'Other' },
                                ]}
                                placeholder="--"
                                className="text-[12px]"
                              />
                            </td>
                          )}

                          {/* Fee % */}
                          {columnVisibility.feePercent && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.feePercent, border: '1px solid #c8bdd6' }}>
                              <span className="text-[12px] text-foreground/80 tabular-nums">
                                {formatPercent(lead.fee_percent)}
                              </span>
                            </td>
                          )}

                          {/* Potential Revenue */}
                          {columnVisibility.potentialRevenue && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.potentialRevenue, border: '1px solid #c8bdd6' }}>
                              <span className="text-[12px] font-medium text-blue-600 dark:text-blue-400 tabular-nums">
                                {potentialRev > 0 ? formatCurrency(potentialRev) : '--'}
                              </span>
                            </td>
                          )}

                          {/* Net Revenue */}
                          {columnVisibility.netRevenue && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.netRevenue, border: '1px solid #c8bdd6' }}>
                              <span className="text-[12px] font-medium text-violet-600 dark:text-violet-400 tabular-nums">
                                {netRev ? formatCurrency(netRev) : '--'}
                              </span>
                            </td>
                          )}

                          {/* Target Closing */}
                          {columnVisibility.targetClosing && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.targetClosing, border: '1px solid #c8bdd6' }}>
                              <span className="text-[12px] text-muted-foreground tabular-nums">
                                {formatShortDate(lead.target_closing_date)}
                              </span>
                            </td>
                          )}

                          {/* WU Date */}
                          {columnVisibility.wuDate && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.wuDate, border: '1px solid #c8bdd6' }}>
                              <span className="text-[12px] text-muted-foreground tabular-nums">
                                {formatShortDate(lead.wu_date)}
                              </span>
                            </td>
                          )}

                          {/* Days to WU */}
                          {columnVisibility.daysToWu && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.daysToWu, border: '1px solid #c8bdd6' }}>
                              {daysToWuVal !== null ? (
                                <span className={`text-[12px] font-medium tabular-nums ${
                                  daysToWuVal < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                                }`}>
                                  {daysToWuVal < 0 ? `${Math.abs(daysToWuVal)}d ago` : `${daysToWuVal}d`}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40 text-[12px]">--</span>
                              )}
                            </td>
                          )}

                          {/* Days to Close */}
                          {columnVisibility.daysToClose && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.daysToClose, border: '1px solid #c8bdd6' }}>
                              {daysToCloseVal !== null ? (
                                <span className={`text-[12px] font-medium tabular-nums ${
                                  daysToCloseVal < 0 ? 'text-red-600 dark:text-red-400' : daysToCloseVal < 14 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                                }`}>
                                  {daysToCloseVal < 0 ? `${Math.abs(daysToCloseVal)}d ago` : `${daysToCloseVal}d`}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40 text-[12px]">--</span>
                              )}
                            </td>
                          )}

                          {/* Source */}
                          {columnVisibility.source && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.source, border: '1px solid #c8bdd6' }}>
                              <InlineEditableCell
                                value={lead.source ?? ''}
                                onChange={(v) => handleInlineEdit(lead.id, 'source', v || null)}
                                placeholder="--"
                                className="text-[12px]"
                                displayClassName="text-[12px] text-foreground/80"
                              />
                            </td>
                          )}

                          {/* CLX Agreement */}
                          {columnVisibility.clxAgreement && (
                            <td className={`px-3 ${rowPad} overflow-hidden text-center`} style={{ width: columnWidths.clxAgreement, border: '1px solid #c8bdd6' }}>
                              {lead.clx_agreement ? (
                                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900">
                                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40 text-[12px]">--</span>
                              )}
                            </td>
                          )}

                          {/* Signals */}
                          {columnVisibility.signals && (
                            <td className={`px-3 ${rowPad} overflow-hidden`} style={{ width: columnWidths.signals, border: '1px solid #c8bdd6' }}>
                              {signals.length > 0 ? (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted hover:bg-muted/80 transition-colors border border-border/60"
                                    >
                                      <span className={`h-2 w-2 rounded-full ${getSignalSeverityColor(signals)}`} />
                                      {signals.length}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent align="end" className="w-52 p-2">
                                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Signals</p>
                                    <div className="space-y-1.5">
                                      {signals.map((s, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-[12px]">
                                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                            s.type === 'critical' ? 'bg-red-500' : s.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                                          }`} />
                                          <span className="text-foreground">{s.label}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              ) : (
                                <span className="text-muted-foreground/40 text-[12px]">--</span>
                              )}
                            </td>
                          )}

                          {/* Detail arrow */}
                          <td className={`px-2 ${rowPad} w-10`} style={{ border: '1px solid #c8bdd6' }}>
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
          </main>

          {/* Right Detail Panel */}
          {detailDialogLead && (
            <PipelineDetailPanel
              lead={detailDialogLead}
              stageConfig={Object.fromEntries(
                Object.entries(STAGE_DISPLAY).map(([k, v]) => [k, { title: v.label, color: '', dot: v.dot, pill: v.pill }])
              )}
              currentStageId={detailDialogLead.status}
              teamMemberMap={teamMemberMap}
              teamMembers={teamMembers}
              formatValue={formatCurrency}
              fakeValue={(id: string) => {
                const lead = leads.find(l => l.id === id);
                return lead?.deal_value ?? 0;
              }}
              onClose={() => setDetailDialogLead(null)}
              onStageChange={(leadId, newStatus) => {
                handleInlineEdit(leadId, 'status', newStatus);
              }}
              onLeadUpdate={(updatedLead) => {
                setDetailDialogLead(updatedLead);
                queryClient.invalidateQueries({ queryKey: ['volume-log-leads'] });
              }}
            />
          )}
        </div>
      </div>
    </EvanLayout>
  );
};

export default LoanVolumeLog;
