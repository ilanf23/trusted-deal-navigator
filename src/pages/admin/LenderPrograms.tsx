import { useEffect, useState, useMemo, useRef } from 'react';
import { useAutoFitColumns } from '@/hooks/useAutoFitColumns';
import { useNavigate } from 'react-router-dom';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { usePageDatabases } from '@/hooks/usePageDatabases';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Loader2, Save, Trash2, Upload, Maximize2, ArrowLeft, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import LenderDetailPanel, { LenderProgram } from '@/components/admin/LenderDetailPanel';
import PipelineBulkToolbar from '@/components/admin/PipelineBulkToolbar';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { SavedFiltersSidebar, type SavedFilterOption } from '@/components/admin/SavedFiltersSidebar';
import LenderFilterPanel, { type LenderCustomFilterValues } from '@/components/admin/LenderFilterPanel';
import { CrmAvatar } from '@/components/admin/CrmAvatar';

// ── Types ──

interface LenderRow {
  id: string;
  lender_name: string;
  call_status: string;
  lender_type: string;
  loan_size_text: string;
  loan_types: string;
  states: string;
  location: string;
  contact_name: string;
  phone: string;
  email: string;
  looking_for: string;
  last_contact: string;
  next_call: string;
  program_name: string;
  program_type: string;
  description: string;
  interest_range: string;
  lender_specialty: string;
  term: string;
  created_at: string;
  updated_at: string;
  isNew?: boolean;
  isDirty?: boolean;
  [key: string]: string | number | boolean | undefined;
}

type SortField = 'lender_name' | 'call_status' | 'last_contact' | 'location' | 'looking_for' | 'contact_name' | 'phone' | 'email' | 'lender_type' | 'loan_types' | 'loan_size_text' | 'states';
type SortDir = 'asc' | 'desc';

type ColumnKey = 'lender_name' | 'call_status' | 'last_contact' | 'location' | 'looking_for' | 'contact_name' | 'phone' | 'email' | 'lender_type' | 'loan_types' | 'loan_size_text' | 'states';

const COLUMNS: { key: ColumnKey; label: string; editable: boolean }[] = [
  { key: 'lender_name', label: 'Institution', editable: true },
  { key: 'call_status', label: 'Call Y/N', editable: true },
  { key: 'last_contact', label: 'Last Contact', editable: true },
  { key: 'location', label: 'Location', editable: true },
  { key: 'looking_for', label: 'Looking For', editable: true },
  { key: 'contact_name', label: 'Name', editable: true },
  { key: 'phone', label: 'Phone', editable: true },
  { key: 'email', label: 'Email', editable: true },
  { key: 'lender_type', label: 'Type of Lender', editable: true },
  { key: 'loan_types', label: 'Types of Loans', editable: true },
  { key: 'loan_size_text', label: 'Loan Size', editable: true },
  { key: 'states', label: 'States', editable: true },
];

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  lender_name: 240,
  call_status: 80,
  last_contact: 110,
  location: 140,
  looking_for: 400,
  contact_name: 150,
  phone: 140,
  email: 200,
  lender_type: 150,
  loan_types: 180,
  loan_size_text: 140,
  states: 120,
};

const COLUMN_SORT_OPTIONS: Record<string, { label: string; field: SortField; dir: SortDir }[]> = {
  lender_name: [
    { label: 'Institution ascending', field: 'lender_name', dir: 'asc' },
    { label: 'Institution descending', field: 'lender_name', dir: 'desc' },
  ],
  call_status: [
    { label: 'Call status ascending', field: 'call_status', dir: 'asc' },
    { label: 'Call status descending', field: 'call_status', dir: 'desc' },
  ],
  last_contact: [
    { label: 'Last contact ascending', field: 'last_contact', dir: 'asc' },
    { label: 'Last contact descending', field: 'last_contact', dir: 'desc' },
  ],
  location: [
    { label: 'Location ascending', field: 'location', dir: 'asc' },
    { label: 'Location descending', field: 'location', dir: 'desc' },
  ],
  looking_for: [
    { label: 'Looking for ascending', field: 'looking_for', dir: 'asc' },
    { label: 'Looking for descending', field: 'looking_for', dir: 'desc' },
  ],
  contact_name: [
    { label: 'Contact name ascending', field: 'contact_name', dir: 'asc' },
    { label: 'Contact name descending', field: 'contact_name', dir: 'desc' },
  ],
  phone: [
    { label: 'Phone ascending', field: 'phone', dir: 'asc' },
    { label: 'Phone descending', field: 'phone', dir: 'desc' },
  ],
  email: [
    { label: 'Email ascending', field: 'email', dir: 'asc' },
    { label: 'Email descending', field: 'email', dir: 'desc' },
  ],
  lender_type: [
    { label: 'Lender type ascending', field: 'lender_type', dir: 'asc' },
    { label: 'Lender type descending', field: 'lender_type', dir: 'desc' },
  ],
  loan_types: [
    { label: 'Loan types ascending', field: 'loan_types', dir: 'asc' },
    { label: 'Loan types descending', field: 'loan_types', dir: 'desc' },
  ],
  loan_size_text: [
    { label: 'Loan size ascending', field: 'loan_size_text', dir: 'asc' },
    { label: 'Loan size descending', field: 'loan_size_text', dir: 'desc' },
  ],
  states: [
    { label: 'States ascending', field: 'states', dir: 'asc' },
    { label: 'States descending', field: 'states', dir: 'desc' },
  ],
};

const VALID_STATE_ABBREVS = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]);

const LOAN_SIZE_CATEGORIES = [
  { label: 'Under $100K', min: 0, max: 100000 },
  { label: '$100K - $250K', min: 100000, max: 250000 },
  { label: '$250K - $500K', min: 250000, max: 500000 },
  { label: '$500K - $1M', min: 500000, max: 1000000 },
  { label: '$1M - $2.5M', min: 1000000, max: 2500000 },
  { label: '$2.5M - $5M', min: 2500000, max: 5000000 },
  { label: '$5M - $10M', min: 5000000, max: 10000000 },
  { label: '$10M - $25M', min: 10000000, max: 25000000 },
  { label: '$25M - $50M', min: 25000000, max: 50000000 },
  { label: '$50M+', min: 50000000, max: Infinity },
];

const parseLoanSizeText = (text: string | null): { min: number; max: number } | null => {
  if (!text) return null;
  const cleaned = text.replace(/[$,]/g, '').toLowerCase().trim();

  const parseNumber = (str: string): number => {
    const match = str.match(/([\d.]+)\s*(k|m|mm|b|million|mil)?/i);
    if (!match) return 0;
    let num = parseFloat(match[1]);
    const suffix = (match[2] || '').toLowerCase();
    if (suffix === 'k') num *= 1000;
    else if (suffix === 'm' || suffix === 'mm' || suffix === 'million' || suffix === 'mil') num *= 1000000;
    else if (suffix === 'b') num *= 1000000000;
    else if (num <= 100 && !suffix) {
      if (cleaned.includes('mm') || cleaned.includes('million') || cleaned.includes('mil')) {
        num *= 1000000;
      }
    }
    return num;
  };

  const rangeMatch = cleaned.match(/([\d.]+\s*(?:k|m|mm|b|million|mil)?)\s*[-–to]+\s*([\d.]+\s*(?:k|m|mm|b|million|mil)?)/i);
  if (rangeMatch) {
    const min = parseNumber(rangeMatch[1]);
    const max = parseNumber(rangeMatch[2]);
    if (min <= 100 && max <= 100 && min > 0) {
      return { min: min * 1000000, max: max * 1000000 };
    }
    return { min, max };
  }

  const upToMatch = cleaned.match(/up\s*to\s*([\d.]+\s*(?:k|m|mm|b|million|mil)?)/i);
  if (upToMatch) {
    return { min: 0, max: parseNumber(upToMatch[1]) };
  }

  const minMatch = cleaned.match(/(?:min(?:imum)?)\s*([\d.]+\s*(?:k|m|mm|b|million|mil)?)/i) ||
                   cleaned.match(/([\d.]+\s*(?:k|m|mm|b|million|mil)?)\s*(?:min(?:imum)?|\+)/i);
  if (minMatch) {
    return { min: parseNumber(minMatch[1]), max: Infinity };
  }

  const plusMatch = cleaned.match(/([\d.]+\s*(?:k|m|mm|b|million|mil)?)\s*\+/i);
  if (plusMatch) {
    return { min: parseNumber(plusMatch[1]), max: Infinity };
  }

  const singleMatch = cleaned.match(/([\d.]+\s*(?:k|m|mm|b|million|mil)?)/i);
  if (singleMatch) {
    const val = parseNumber(singleMatch[1]);
    return { min: val * 0.5, max: val * 2 };
  }

  return null;
};

const rowMatchesLoanCategory = (row: LenderRow, categoryLabel: string): boolean => {
  const category = LOAN_SIZE_CATEGORIES.find(c => c.label === categoryLabel);
  if (!category) return false;

  const rowRange = parseLoanSizeText(row.loan_size_text);
  if (!rowRange) return false;

  if (category.max === Infinity) {
    return rowRange.max >= category.min;
  }

  const lenderCanDoSmallEnough = rowRange.min <= category.max;
  const lenderCanDoLargeEnough = rowRange.max >= category.min;

  return lenderCanDoSmallEnough && lenderCanDoLargeEnough;
};

// ── Preset filter predicates ──

const parseDateSafe = (s: string): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const daysSince = (dateStr: string): number | null => {
  const d = parseDateSafe(dateStr);
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const presetPredicate = (id: string): ((row: LenderRow) => boolean) | null => {
  switch (id) {
    case 'needs_callback':
      return (r) => (r.call_status || '').toUpperCase() === 'N';
    case 'called_recently':
      return (r) => {
        const days = daysSince(r.last_contact);
        return days !== null && days <= 30;
      };
    case 'no_contact_info':
      return (r) => !r.email.trim() && !r.phone.trim();
    default:
      return null;
  }
};

const customPredicate = (values: LenderCustomFilterValues): ((row: LenderRow) => boolean) => {
  return (row) => {
    if (values.institutions.length > 0 && !values.institutions.includes(row.lender_name)) return false;
    if (values.lookingFor && !(row.looking_for || '').toLowerCase().includes(values.lookingFor.toLowerCase())) return false;
    if (values.contacts.length > 0 && !values.contacts.includes(row.contact_name)) return false;
    if (values.loanSizes.length > 0 && !values.loanSizes.some(ls => rowMatchesLoanCategory(row, ls))) return false;
    if (values.states.length > 0) {
      const rowStates = (row.states || '').split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      if (!values.states.some(s => rowStates.includes(s))) return false;
    }
    if (values.lenderTypes.length > 0 && !values.lenderTypes.includes(row.lender_type)) return false;
    if (values.loanTypes.length > 0) {
      const rowLoanTypes = (row.loan_types || '').split(',').map(t => t.trim()).filter(Boolean);
      if (!values.loanTypes.some(lt => rowLoanTypes.includes(lt))) return false;
    }
    if (values.callStatus.length > 0 && !values.callStatus.map(c => c.toUpperCase()).includes((row.call_status || '').toUpperCase())) return false;
    if (values.lastContactFrom || values.lastContactTo) {
      const d = parseDateSafe(row.last_contact);
      if (!d) return false;
      if (values.lastContactFrom) {
        const from = new Date(values.lastContactFrom);
        if (d < from) return false;
      }
      if (values.lastContactTo) {
        const to = new Date(values.lastContactTo);
        to.setHours(23, 59, 59, 999);
        if (d > to) return false;
      }
    }
    return true;
  };
};

const DEFAULT_LENDER_FILTER_OPTIONS: SavedFilterOption[] = [
  { id: 'all', label: 'All Lenders', group: 'top', editable: false },
  { id: 'needs_callback', label: 'Needs Call-back', group: 'public', editable: false },
  { id: 'called_recently', label: 'Called Recently (30d)', group: 'public', editable: false },
  { id: 'no_contact_info', label: 'Missing Contact', group: 'public', editable: false },
];

const createEmptyRow = (): LenderRow => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  lender_name: '',
  call_status: '',
  lender_type: '',
  loan_size_text: '',
  loan_types: '',
  states: '',
  location: '',
  contact_name: '',
  phone: '',
  email: '',
  looking_for: '',
  last_contact: '',
  next_call: '',
  program_name: '',
  program_type: '',
  description: '',
  interest_range: '',
  lender_specialty: '',
  term: '',
  created_at: '',
  updated_at: '',
  isNew: true,
  isDirty: false,
});

const lenderRowToProgram = (row: LenderRow): LenderProgram => ({
  id: row.id,
  lender_name: row.lender_name,
  call_status: row.call_status || null,
  lender_type: row.lender_type || null,
  loan_size_text: row.loan_size_text || null,
  loan_types: row.loan_types || null,
  states: row.states || null,
  location: row.location || null,
  contact_name: row.contact_name || null,
  phone: row.phone || null,
  email: row.email || null,
  looking_for: row.looking_for || null,
  last_contact: row.last_contact || null,
  next_call: row.next_call || null,
  program_name: row.program_name || 'General',
  program_type: row.program_type || 'Other',
  description: row.description || null,
  interest_range: row.interest_range || null,
  lender_specialty: row.lender_specialty || null,
  term: row.term || null,
  created_at: row.created_at || '',
  updated_at: row.updated_at || '',
});

// ── Component ──

const LenderPrograms = () => {
  const { setPageTitle, setSearchComponent } = useAdminTopBar();
  usePageDatabases([
    { table: 'lender_programs', access: 'readwrite', usage: 'Lender-program records — listed, inline-edited, bulk-imported, deleted from this page.', via: 'useQuery + direct supabase.from in LenderPrograms.tsx' },
  ]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    setPageTitle('Lender Programs');
    return () => {
      setPageTitle(null);
      setSearchComponent(null);
    };
  }, [setPageTitle, setSearchComponent]);

  // ── Data fetching ──
  const { data: dbRows = [], isLoading } = useQuery({
    queryKey: ['lender-programs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lender_programs')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((item): LenderRow => ({
        id: item.id,
        lender_name: item.lender_name || '',
        call_status: item.call_status || '',
        lender_type: item.lender_type || '',
        loan_size_text: item.loan_size_text || '',
        loan_types: item.loan_types || '',
        states: item.states || '',
        location: item.location || '',
        contact_name: item.contact_name || '',
        phone: item.phone || '',
        email: item.email || '',
        looking_for: item.looking_for || '',
        last_contact: item.last_contact ? new Date(item.last_contact).toLocaleDateString() : '',
        next_call: item.next_call ? new Date(item.next_call).toLocaleDateString() : '',
        program_name: item.program_name || '',
        program_type: item.program_type || '',
        description: item.description || '',
        interest_range: item.interest_range || '',
        lender_specialty: item.lender_specialty || '',
        term: item.term || '',
        created_at: item.created_at || '',
        updated_at: item.updated_at || '',
        isNew: false,
        isDirty: false,
      }));
    },
  });

  // Local edits + new rows
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<LenderRow>>>({});
  const [newRows, setNewRows] = useState<LenderRow[]>([]);

  const rows = useMemo(() => {
    const edited = dbRows.map(row => {
      const edits = localEdits[row.id];
      if (!edits) return row;
      return { ...row, ...edits, isDirty: true };
    });
    return [...edited, ...newRows];
  }, [dbRows, localEdits, newRows]);

  // ── State ──
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<{ rowId: string; colKey: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [sortField, setSortField] = useState<SortField>('lender_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);

  // Filter + sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [customFilters, setCustomFilters] = useState<Array<{ id: string; label: string; values: LenderCustomFilterValues }>>([]);
  const filterOptions = DEFAULT_LENDER_FILTER_OPTIONS;

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Row selection
  const [selectedLenderIds, setSelectedLenderIds] = useState<Set<string>>(new Set());
  const [selectedLender, setSelectedLender] = useState<LenderProgram | null>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  const toggleLenderSelection = (lenderId: string) => {
    setSelectedLenderIds(prev => {
      const next = new Set(prev);
      if (next.has(lenderId)) next.delete(lenderId);
      else next.add(lenderId);
      return next;
    });
  };

  // Inject page-specific search into top bar
  useEffect(() => {
    setSearchComponent(
      <AdminTopBarSearch
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search lenders..."
      />
    );
  }, [searchQuery, setSearchComponent]);

  // Close sort menu on outside click
  useEffect(() => {
    if (!colMenuOpen) return;
    function handleClick() { setColMenuOpen(null); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colMenuOpen]);

  // Escape key handling
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (colMenuOpen) { setColMenuOpen(null); return; }
      if (selectedLender) { setSelectedLender(null); return; }
      if (filterPanelOpen) setFilterPanelOpen(false);
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [colMenuOpen, selectedLender, filterPanelOpen]);

  // Close detail panel on outside click
  useEffect(() => {
    if (!selectedLender) return;
    function handleClickOutside(e: MouseEvent) {
      if (detailPanelRef.current && !detailPanelRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target.closest('tr')) return;
        setSelectedLender(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedLender]);

  // ── Filtering + sort ──
  const activePredicate = useMemo(() => {
    if (activeFilter === 'all') return null;
    const preset = presetPredicate(activeFilter);
    if (preset) return preset;
    const custom = customFilters.find(cf => cf.id === activeFilter);
    if (custom) return customPredicate(custom.values);
    return null;
  }, [activeFilter, customFilters]);

  const filteredAndSorted = useMemo(() => {
    let result = rows;

    if (activePredicate) {
      result = result.filter(activePredicate);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(row =>
        row.lender_name.toLowerCase().includes(q) ||
        row.loan_types?.toLowerCase().includes(q) ||
        row.states?.toLowerCase().includes(q) ||
        row.lender_type?.toLowerCase().includes(q) ||
        row.contact_name?.toLowerCase().includes(q) ||
        row.looking_for?.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      const aVal = ((a[sortField] ?? '') as string).toLowerCase();
      const bVal = ((b[sortField] ?? '') as string).toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [rows, activePredicate, searchQuery, sortField, sortDir]);

  // Sidebar filter counts
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length };
    for (const opt of filterOptions) {
      if (opt.id === 'all') continue;
      const pred = presetPredicate(opt.id);
      counts[opt.id] = pred ? rows.filter(pred).length : 0;
    }
    for (const cf of customFilters) {
      counts[cf.id] = rows.filter(customPredicate(cf.values)).length;
    }
    return counts;
  }, [rows, filterOptions, customFilters]);

  const { columnWidths, handleColumnResize } = useAutoFitColumns({
    minWidths: DEFAULT_COLUMN_WIDTHS,
    autoFitConfig: {
      lender_name: { getText: (r: LenderRow) => r.lender_name, extraPx: 58 },
      contact_name: { getText: (r: LenderRow) => r.contact_name },
      email: { getText: (r: LenderRow) => r.email },
      phone: { getText: (r: LenderRow) => r.phone },
      location: { getText: (r: LenderRow) => r.location },
      looking_for: { getText: (r: LenderRow) => r.looking_for },
      loan_types: { getText: (r: LenderRow) => r.loan_types },
      loan_size_text: { getText: (r: LenderRow) => r.loan_size_text },
      states: { getText: (r: LenderRow) => r.states },
    },
    data: filteredAndSorted,
    storageKey: 'lender-col-widths-v3',
    maxAutoWidth: 400,
  });

  const isAllSelected = useMemo(() => {
    return filteredAndSorted.length > 0 && filteredAndSorted.every(r => selectedLenderIds.has(r.id));
  }, [filteredAndSorted, selectedLenderIds]);

  const selectAll = () => setSelectedLenderIds(new Set(filteredAndSorted.map(r => r.id)));
  const clearSelection = () => setSelectedLenderIds(new Set());

  const handleRowClick = (row: LenderRow) => {
    setSelectedLender(lenderRowToProgram(row));
    if (filterPanelOpen) setFilterPanelOpen(false);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedLenderIds);
    if (ids.length === 0) return;

    const confirmed = window.confirm(`Delete ${ids.length} selected lender program${ids.length > 1 ? 's' : ''}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const newIds = ids.filter(id => id.startsWith('new-'));
      const dbIds = ids.filter(id => !id.startsWith('new-'));

      if (newIds.length > 0) {
        setNewRows(prev => prev.filter(r => !newIds.includes(r.id)));
      }

      if (dbIds.length > 0) {
        const { error } = await supabase.from('lender_programs').delete().in('id', dbIds);
        if (error) throw error;
      }

      toast.success(`Deleted ${ids.length} lender${ids.length > 1 ? 's' : ''}`);
      clearSelection();
      setSelectedLender(null);
      if (dbIds.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['lender-programs'] });
      }
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast.error('Failed to delete selected lenders');
    }
  };

  // ── Filter panel option sources ──
  const filterPanelOptions = useMemo(() => {
    const uniq = (key: keyof LenderRow) => {
      const vals = rows
        .map(r => r[key])
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
        .map(v => v.trim());
      return [...new Set(vals)].sort();
    };

    const getUniqueStates = () => {
      const s = rows
        .flatMap(r => (r.states || '').split(/[,\s]+/).map(v => v.trim().toUpperCase()))
        .filter(v => VALID_STATE_ABBREVS.has(v));
      return [...new Set(s)].sort();
    };

    const getUniqueLoanTypes = () => {
      const t = rows
        .flatMap(r => (r.loan_types || '').split(',').map(v => v.trim()))
        .filter(Boolean);
      return [...new Set(t)].sort();
    };

    return {
      institutions: uniq('lender_name'),
      contacts: uniq('contact_name'),
      loanSizes: LOAN_SIZE_CATEGORIES.map(c => c.label),
      states: getUniqueStates(),
      lenderTypes: uniq('lender_type'),
      loanTypes: getUniqueLoanTypes(),
    };
  }, [rows]);

  const handleSaveCustomFilter = (values: LenderCustomFilterValues) => {
    const id = `custom_${Date.now()}`;
    const label = values.filterName.trim() || 'Custom Filter';
    const entry = { id, label, values: { ...values, filterName: label } };
    setCustomFilters(prev => [...prev, entry]);
    setActiveFilter(id);
    setFilterPanelOpen(false);
  };

  // ── Inline editing ──
  const handleCellClick = (e: React.MouseEvent, rowId: string, colKey: string) => {
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col?.editable) return;
    e.stopPropagation();
    const row = rows.find(r => r.id === rowId);
    if (!row) return;
    setEditingCell({ rowId, colKey });
    setEditValue(row[colKey] as string || '');
  };

  const handleCellBlur = () => {
    if (!editingCell) return;
    const { rowId, colKey } = editingCell;
    const row = rows.find(r => r.id === rowId);
    if (!row) { setEditingCell(null); return; }

    const currentValue = row[colKey] as string || '';
    if (currentValue !== editValue) {
      if (row.isNew) {
        setNewRows(prev => prev.map(r =>
          r.id === rowId ? { ...r, [colKey]: editValue, isDirty: true } : r
        ));
      } else {
        setLocalEdits(prev => ({
          ...prev,
          [rowId]: { ...prev[rowId], [colKey]: editValue },
        }));
      }
    }

    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  // ── Save ──
  const handleSaveAll = async () => {
    const dirtyExisting = Object.entries(localEdits).map(([id, edits]): LenderRow | null => {
      const original = dbRows.find(r => r.id === id);
      if (!original) return null;
      return { ...original, ...edits, isDirty: true };
    }).filter((r): r is LenderRow => r !== null && r.lender_name.trim() !== '');

    const dirtyNew = newRows.filter(r => r.isDirty && r.lender_name.trim());

    if (dirtyExisting.length === 0 && dirtyNew.length === 0) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    try {
      if (dirtyNew.length > 0) {
        const insertData = dirtyNew.map(r => ({
          lender_name: r.lender_name,
          call_status: r.call_status || 'N',
          lender_type: r.lender_type || null,
          loan_size_text: r.loan_size_text || null,
          loan_types: r.loan_types || null,
          states: r.states || null,
          location: r.location || null,
          contact_name: r.contact_name || null,
          phone: r.phone || null,
          email: r.email || null,
          looking_for: r.looking_for || null,
          last_contact: r.last_contact ? (() => {
            const d = new Date(r.last_contact);
            return isNaN(d.getTime()) ? null : d.toISOString();
          })() : null,
          next_call: r.next_call ? (() => {
            const d = new Date(r.next_call);
            return isNaN(d.getTime()) ? null : d.toISOString();
          })() : null,
          program_name: r.loan_types || 'General',
          program_type: r.lender_type || 'Other',
        }));

        const { error } = await supabase.from('lender_programs').insert(insertData);
        if (error) throw error;
      }

      for (const row of dirtyExisting) {
        const { error } = await supabase
          .from('lender_programs')
          .update({
            lender_name: row.lender_name,
            call_status: row.call_status || 'N',
            lender_type: row.lender_type || null,
            loan_size_text: row.loan_size_text || null,
            loan_types: row.loan_types || null,
            states: row.states || null,
            location: row.location || null,
            contact_name: row.contact_name || null,
            phone: row.phone || null,
            email: row.email || null,
            looking_for: row.looking_for || null,
            last_contact: row.last_contact ? (() => {
              const d = new Date(row.last_contact);
              return isNaN(d.getTime()) ? null : d.toISOString();
            })() : null,
            next_call: row.next_call ? (() => {
              const d = new Date(row.next_call);
              return isNaN(d.getTime()) ? null : d.toISOString();
            })() : null,
          })
          .eq('id', row.id);

        if (error) throw error;
      }

      toast.success(`Saved ${dirtyExisting.length + dirtyNew.length} row${(dirtyExisting.length + dirtyNew.length) > 1 ? 's' : ''}`);
      setLocalEdits({});
      setNewRows([]);
      queryClient.invalidateQueries({ queryKey: ['lender-programs'] });
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async (row: LenderRow) => {
    if (row.isNew) {
      setNewRows(prev => prev.filter(r => r.id !== row.id));
      return;
    }

    const confirmed = window.confirm(`Delete "${row.lender_name || 'this lender'}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('lender_programs').delete().eq('id', row.id);
      if (error) throw error;
      toast.success('Row deleted');
      queryClient.invalidateQueries({ queryKey: ['lender-programs'] });
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete row');
    }
  };

  const handleAddRow = () => {
    setNewRows(prev => [...prev, createEmptyRow()]);
  };

  // ── File Upload ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isCSV = file.name.endsWith('.csv') || file.type === 'text/csv';
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ||
                    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.type === 'application/vnd.ms-excel';

    if (!isCSV && !isExcel) {
      toast.error('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }

    if (isExcel) parseAndUploadExcel(file);
    else parseAndUploadCSV(file);
  };

  const parseRowsToPrograms = (headers: string[], rows: string[][]) => {
    const programs: Array<{
      lender_name: string;
      call_status: string | null;
      last_contact: string | null;
      next_call: string | null;
      location: string | null;
      looking_for: string | null;
      contact_name: string | null;
      phone: string | null;
      email: string | null;
      lender_type: string | null;
      loan_types: string | null;
      loan_size_text: string | null;
      states: string | null;
      program_name: string;
      program_type: string;
    }> = [];

    for (const row of rows) {
      let lender_name = '';
      let call_status = '';
      let last_contact = '';
      let next_call = '';
      let location = '';
      let looking_for = '';
      let contact_name = '';
      let phone = '';
      let email = '';
      let lender_type = '';
      let loan_types = '';
      let loan_size_text = '';
      let states = '';

      headers.forEach((header, idx) => {
        const value = (row[idx] || '').toString().trim();
        const h = header.toLowerCase();

        if (h === 'institution' || (h.includes('lender') && h.includes('name'))) lender_name = value;
        else if (h === 'call y/n' || h === 'call' || h.includes('call')) call_status = value || 'N';
        else if (h === 'last contact' || (h.includes('last') && h.includes('contact'))) last_contact = value;
        else if (h === 'next call' || (h.includes('next') && h.includes('call'))) next_call = value;
        else if (h === 'location') location = value;
        else if (h === 'looking for' || h.includes('looking')) looking_for = value;
        else if (h === 'name' || h === 'contact name' || h === 'contact') contact_name = value;
        else if (h === 'phone' || h.includes('phone')) phone = value;
        else if (h === 'email' || h.includes('email')) email = value;
        else if (h === 'type of lender' || h === 'lender type' || h.includes('type of lender') || h.includes('lender type')) lender_type = value;
        else if (h === 'types of loans' || h === 'loan types' || h.includes('types of loan') || h.includes('loan type')) loan_types = value;
        else if (h === 'loan size' || h.includes('loan size') || h.includes('loansize') || h === 'size') loan_size_text = value;
        else if (h === 'states' || h.includes('state')) states = value;
      });

      if (lender_name) {
        programs.push({
          lender_name,
          call_status: call_status || 'N',
          last_contact: last_contact ? (() => {
            const d = new Date(last_contact);
            return isNaN(d.getTime()) ? null : d.toISOString();
          })() : null,
          next_call: next_call ? (() => {
            const d = new Date(next_call);
            return isNaN(d.getTime()) ? null : d.toISOString();
          })() : null,
          location: location || null,
          looking_for: looking_for || null,
          contact_name: contact_name || null,
          phone: phone || null,
          email: email || null,
          lender_type: lender_type || null,
          loan_types: loan_types || null,
          loan_size_text: loan_size_text || null,
          states: states || null,
          program_name: loan_types || 'General',
          program_type: lender_type || 'Other',
        });
      }
    }

    return programs;
  };

  const parseAndUploadExcel = async (file: File) => {
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          toast.error('Excel file must have a header row and at least one data row');
          setUploading(false);
          return;
        }

        const headers = (jsonData[0] || []).map(h => (h || '').toString().trim().toLowerCase());
        const programs = parseRowsToPrograms(headers, jsonData.slice(1));

        if (programs.length === 0) {
          toast.error('No valid lender data found in Excel file');
          setUploading(false);
          return;
        }

        const { error } = await supabase.from('lender_programs').insert(programs);
        if (error) throw error;

        toast.success(`Imported ${programs.length} lenders from Excel`);
        queryClient.invalidateQueries({ queryKey: ['lender-programs'] });
      } catch (error) {
        console.error('Error parsing/uploading Excel:', error);
        toast.error('Failed to import Excel file');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const detectDelimiter = (text: string): string => {
    const firstLine = text.split('\n')[0] || '';
    const delimiters = [',', '\t', ';', '|'];
    let bestDelimiter = ',';
    let maxCount = 0;
    for (const d of delimiters) {
      const count = (firstLine.match(new RegExp(d === '|' ? '\\|' : d, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = d;
      }
    }
    return bestDelimiter;
  };

  const parseAndUploadCSV = async (file: File) => {
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const delimiter = detectDelimiter(text);
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          toast.error('CSV file must have a header row and at least one data row');
          setUploading(false);
          return;
        }

        const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        const csvRows: string[][] = [];
        for (let i = 1; i < lines.length; i++) {
          csvRows.push(lines[i].split(delimiter).map(v => v.trim().replace(/['"]/g, '')));
        }

        const programs = parseRowsToPrograms(headers, csvRows);
        if (programs.length === 0) {
          toast.error('No valid lender data found in CSV');
          setUploading(false);
          return;
        }

        const { error } = await supabase.from('lender_programs').insert(programs);
        if (error) throw error;

        toast.success(`Imported ${programs.length} lenders from CSV`);
        queryClient.invalidateQueries({ queryKey: ['lender-programs'] });
      } catch (error) {
        console.error('Error parsing/uploading CSV:', error);
        toast.error('Failed to import CSV');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const dirtyCount = rows.filter(r => r.isDirty && r.lender_name.trim()).length;

  const activeFilterLabel =
    filterOptions.find(o => o.id === activeFilter)?.label
    ?? customFilters.find(cf => cf.id === activeFilter)?.label
    ?? 'All Lenders';

  // ── ColHeader (CRM pattern) ──
  const ColHeader = ({
    colKey,
    children,
    className: extraClassName,
    style: extraStyle,
  }: {
    colKey: string;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }) => {
    const width = columnWidths[colKey] ?? 120;
    const sortOptions = COLUMN_SORT_OPTIONS[colKey];
    const isMenuOpen = colMenuOpen === colKey;
    return (
      <th
        className={`px-4 py-1.5 text-left whitespace-nowrap group/col transition-colors hover:z-20 ${extraClassName ?? ''}`}
        style={{ width: `${width}px`, minWidth: 60, maxWidth: 500, backgroundColor: '#eee6f6', border: '1px solid #c8bdd6', ...extraStyle }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d8cce8'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#eee6f6'; }}
      >
        <ResizableColumnHeader
          columnId={colKey}
          currentWidth={`${width}px`}
          onResize={handleColumnResize}
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-[#3b2778] dark:text-muted-foreground">
            {children}
          </span>
          {sortOptions && (
            <div className={`relative ml-auto shrink-0 transition-opacity ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover/col:opacity-100'}`} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <button
                onClick={() => setColMenuOpen(isMenuOpen ? null : colKey)}
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

  // ── Render ──

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="system-font flex flex-col h-full min-h-0 overflow-hidden bg-white dark:bg-background -m-3 sm:-m-4 md:-m-6 lg:-m-8 xl:-m-10">
        <div className="relative flex flex-1 min-h-0 overflow-y-hidden overflow-x-clip">

          {/* Sidebar collapse button */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? 'Hide filters' : 'Show filters'}
            style={{ left: sidebarOpen ? 'calc(18rem - 1.3125rem + 19px)' : 'calc(72px - 21px + 19px)', borderRadius: '50%', transition: 'left 200ms ease' }}
            className="absolute top-[9px] z-20 h-[42px] w-[42px] border border-gray-300 dark:border-border bg-white dark:bg-card flex items-center justify-center text-black dark:text-foreground hover:bg-gray-50 dark:hover:bg-muted hover:border-gray-400 transition-colors shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} style={{ transform: `scale(2) ${sidebarOpen ? '' : 'rotate(180deg)'}`, transition: 'transform 200ms ease' }} />
          </button>

          {/* Left saved-filters sidebar */}
          <SavedFiltersSidebar
            sidebarOpen={sidebarOpen}
            filterOptions={filterOptions}
            customFilters={customFilters.map(cf => ({ id: cf.id, label: cf.label }))}
            filterCounts={filterCounts}
            activeFilter={activeFilter}
            onSelectFilter={(id) => { setActiveFilter(id); setSelectedLender(null); }}
            createFilterAction={
              <button
                onClick={() => { setFilterPanelOpen(true); setSelectedLender(null); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-[#3b2778] bg-[#eee6f6] hover:bg-[#e0d4f0] dark:text-purple-300 dark:bg-purple-950/40 dark:hover:bg-purple-950/60 transition-colors"
                title="Create new filter"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </button>
            }
          />

          {/* Main area */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Content title bar */}
            <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 bg-[#f8f9fa] dark:bg-muted/30">
              <div className="flex items-center gap-3 ml-24">
                <h2 className="text-[16px] font-bold text-[#1f1f1f] dark:text-foreground whitespace-nowrap">
                  {activeFilterLabel}
                </h2>
                <span className="text-[#5f6368] dark:text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                  # {filteredAndSorted.length.toLocaleString()} lender{filteredAndSorted.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleAddRow}
                >
                  + Add Row
                </Button>
                {dirtyCount > 0 && (
                  <Button onClick={handleSaveAll} disabled={saving} className="gap-1.5 bg-green-600 hover:bg-green-700">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save {dirtyCount}
                  </Button>
                )}
              </div>
            </div>

            {/* Table scroll container */}
            <div className="flex-1 overflow-auto">
              {selectedLenderIds.size > 0 && (
                <div className="sticky top-0 z-40 px-4 py-2 bg-white dark:bg-background border-b border-border">
                  <PipelineBulkToolbar
                    selectedCount={selectedLenderIds.size}
                    totalCount={filteredAndSorted.length}
                    onClearSelection={clearSelection}
                    onDeleteBoxes={handleBulkDelete}
                  />
                </div>
              )}

              <table className="w-full text-sm" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <ColHeader
                      colKey="lender_name"
                      className="sticky top-0 z-30 group/hdr"
                      style={{ left: 0, borderLeft: 'none', boxShadow: 'inset 1px 0 0 #c8bdd6, 2px 0 4px -2px rgba(0,0,0,0.15)' }}
                    >
                      <div className="shrink-0 mr-1" title="Select all" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={(checked) => checked ? selectAll() : clearSelection()}
                          className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                        />
                      </div>
                      <Building2 className="h-4 w-4" /> Institution
                    </ColHeader>
                    {COLUMNS.filter(c => c.key !== 'lender_name').map((col) => (
                      <ColHeader key={col.key} colKey={col.key} className="sticky top-0 z-10">
                        {col.label}
                      </ColHeader>
                    ))}
                    <th className="w-10 px-2 py-1.5 sticky top-0 z-10" style={{ backgroundColor: '#eee6f6', border: '1px solid #c8bdd6' }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length + 1}>
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-muted">
                            <Building2 className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-foreground">No lenders found</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
                              {searchQuery || activeFilter !== 'all'
                                ? 'Try adjusting your search or filter criteria'
                                : 'No lender programs have been added yet'}
                            </p>
                          </div>
                          {(searchQuery || activeFilter !== 'all') && (
                            <button
                              onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold mt-1 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors"
                            >
                              Clear all filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAndSorted.map((row) => {
                      const isDirty = row.isDirty;
                      const isDetailSelected = selectedLender?.id === row.id;
                      const isBulkSelected = selectedLenderIds.has(row.id);

                      const rowBg = isDirty
                        ? 'bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/30'
                        : isDetailSelected
                          ? 'bg-[#eee6f6] dark:bg-purple-950/30 hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40'
                          : isBulkSelected
                            ? 'bg-[#eee6f6]/60 dark:bg-violet-950/20 hover:bg-[#eee6f6]/80'
                            : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30';

                      const stickyBg = isDirty
                        ? 'bg-amber-50 dark:bg-amber-950/20 group-hover:bg-amber-100 dark:group-hover:bg-amber-950/30'
                        : isDetailSelected
                          ? 'bg-[#eee6f6] dark:bg-purple-950 group-hover:bg-[#e0d4f0] dark:group-hover:bg-purple-900'
                          : isBulkSelected
                            ? 'bg-[#eee6f6] dark:bg-violet-950/30 group-hover:bg-[#e0d4f0] dark:group-hover:bg-violet-900/40'
                            : 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted';

                      const isEditingSticky = editingCell?.rowId === row.id && editingCell?.colKey === 'lender_name';

                      return (
                        <tr
                          key={row.id}
                          onClick={() => handleRowClick(row)}
                          className={`group cursor-pointer transition-colors duration-200 ${rowBg} ${isDetailSelected ? 'border-l-[3px] border-l-[#3b2778]' : ''}`}
                        >
                          {/* Sticky first column: checkbox + avatar + name pill */}
                          <td
                            className={`pl-2 pr-1.5 py-1.5 overflow-hidden sticky left-0 z-[5] transition-colors ${stickyBg}`}
                            style={{
                              width: columnWidths.lender_name,
                              border: '1px solid #c8bdd6',
                              borderLeft: 'none',
                              boxShadow: 'inset 1px 0 0 #c8bdd6, 2px 0 4px -2px rgba(0,0,0,0.15)',
                            }}
                            onClick={(e) => handleCellClick(e, row.id, 'lender_name')}
                          >
                            {isEditingSticky ? (
                              <Input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleCellBlur}
                                onKeyDown={handleKeyDown}
                                onClick={(e) => e.stopPropagation()}
                                className="h-8 text-[14px] px-2 border-[#3b2778] focus-visible:ring-1 focus-visible:ring-[#3b2778] bg-background"
                              />
                            ) : (
                              <div className="flex items-center gap-2">
                                <div
                                  className="shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLenderSelection(row.id);
                                  }}
                                >
                                  <Checkbox
                                    checked={isBulkSelected}
                                    onCheckedChange={() => toggleLenderSelection(row.id)}
                                    className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                                  />
                                </div>
                                <div className="flex items-center gap-2 min-w-0 flex-1 bg-[#f1f3f4] dark:bg-muted rounded-full pl-0.5 pr-3 py-0.5">
                                  <CrmAvatar name={row.lender_name || '?'} size="md" />
                                  <span className="text-[14px] text-[#202124] dark:text-foreground truncate">
                                    {row.lender_name || <span className="text-muted-foreground/60">Untitled</span>}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  title="Open expanded view"
                                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/lender-programs/expanded-view/${row.id}`); }}
                                  className="shrink-0 ml-auto -mr-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                                >
                                  <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Other columns */}
                          {COLUMNS.filter(c => c.key !== 'lender_name').map((col) => {
                            const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                            const value = (row[col.key] as string) || '';
                            const isLookingFor = col.key === 'looking_for';
                            const isEmail = col.key === 'email';
                            const isPhone = col.key === 'phone';
                            const isCallStatus = col.key === 'call_status';

                            return (
                              <td
                                key={col.key}
                                className="px-3 py-1.5 overflow-hidden"
                                style={{
                                  width: columnWidths[col.key],
                                  border: '1px solid #c8bdd6',
                                }}
                                onClick={(e) => handleCellClick(e, row.id, col.key)}
                              >
                                {isEditing ? (
                                  isLookingFor ? (
                                    <textarea
                                      autoFocus
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={handleCellBlur}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                          setEditingCell(null);
                                          setEditValue('');
                                        }
                                      }}
                                      className="w-full h-20 text-[14px] px-2 py-1 border border-[#3b2778] rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#3b2778] resize-none"
                                    />
                                  ) : (
                                    <Input
                                      autoFocus
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onBlur={handleCellBlur}
                                      onKeyDown={handleKeyDown}
                                      className="h-8 text-[14px] px-2 border-[#3b2778] focus-visible:ring-1 focus-visible:ring-[#3b2778] bg-background"
                                    />
                                  )
                                ) : value ? (
                                  isEmail ? (
                                    <a
                                      href={`mailto:${value}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center rounded-full bg-[#f1f3f4] dark:bg-muted px-3 py-0.5 text-[14px] text-blue-600 hover:underline truncate max-w-full"
                                    >
                                      <span className="truncate">{value}</span>
                                    </a>
                                  ) : isPhone ? (
                                    <a
                                      href={`tel:${value}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center rounded-full bg-[#f1f3f4] dark:bg-muted px-3 py-0.5 text-[14px] text-blue-600 hover:underline truncate max-w-full"
                                    >
                                      <span className="truncate">{value}</span>
                                    </a>
                                  ) : isCallStatus ? (
                                    <span
                                      className={`inline-flex items-center rounded-full px-3 py-0.5 text-[13px] font-medium ${
                                        value.toUpperCase() === 'Y'
                                          ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
                                          : 'bg-[#f1f3f4] text-[#5f6368] dark:bg-muted dark:text-muted-foreground'
                                      }`}
                                    >
                                      {value}
                                    </span>
                                  ) : isLookingFor ? (
                                    <span className="text-[14px] text-[#202124] dark:text-foreground whitespace-pre-wrap break-words line-clamp-3 block">
                                      {value}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-[#f1f3f4] dark:bg-muted px-3 py-0.5 text-[14px] text-[#202124] dark:text-foreground truncate max-w-full">
                                      <span className="truncate">{value}</span>
                                    </span>
                                  )
                                ) : (
                                  <span className="text-muted-foreground/40 text-[14px]">—</span>
                                )}
                              </td>
                            );
                          })}

                          {/* Action column */}
                          <td
                            className="w-10 text-center"
                            style={{ border: '1px solid #c8bdd6' }}
                          >
                            {(row.lender_name.trim() || !row.isNew) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteRow(row); }}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </main>

          {/* Right-side overlays — mutually exclusive */}
          {selectedLender && !filterPanelOpen && (
            <div ref={detailPanelRef} className="shrink-0">
              <LenderDetailPanel
                lender={selectedLender}
                onClose={() => setSelectedLender(null)}
                onExpand={() => {
                  navigate(`/admin/lender-programs/expanded-view/${selectedLender.id}`);
                  setSelectedLender(null);
                }}
                onLenderUpdate={(updated) => {
                  setSelectedLender(updated);
                  queryClient.invalidateQueries({ queryKey: ['lender-programs'] });
                }}
              />
            </div>
          )}

          {filterPanelOpen && !selectedLender && (
            <LenderFilterPanel
              institutions={filterPanelOptions.institutions}
              contacts={filterPanelOptions.contacts}
              lenderTypes={filterPanelOptions.lenderTypes}
              loanTypes={filterPanelOptions.loanTypes}
              states={filterPanelOptions.states}
              loanSizes={filterPanelOptions.loanSizes}
              onSave={handleSaveCustomFilter}
              onClose={() => setFilterPanelOpen(false)}
            />
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default LenderPrograms;
