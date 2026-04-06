import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Building2, Loader2, Save, Trash2, Upload, Filter, Sparkles, X, Search, Maximize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { LenderProgramAssistant } from '@/components/admin/LenderProgramAssistant';
import { SearchableSelect } from '@/components/ui/searchable-select';
import * as XLSX from 'xlsx';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';
import LenderDetailPanel, { LenderProgram } from '@/components/admin/LenderDetailPanel';
import PipelineBulkToolbar from '@/components/admin/PipelineBulkToolbar';

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
  lender_name: 200,
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

// Valid US state abbreviations
const VALID_STATE_ABBREVS = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]);

// Standardized loan size categories
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

// Parse loan size text to extract numeric values
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

// ── Component ──

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

const LenderPrograms = () => {
  const { setPageTitle } = useAdminTopBar();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    setPageTitle('Lender Programs');
    return () => { setPageTitle(null); };
  }, [setPageTitle]);

  // ── Data fetching via useQuery ──
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

  // Local rows state for inline editing + new rows
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
  const [panelMode, setPanelMode] = useState<'list' | 'filter' | 'advisor'>('list');
  const [sortField, setSortField] = useState<SortField>('lender_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [colMenuOpen, setColMenuOpen] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    institution: '',
    lookingFor: '',
    contact: '',
    loanSize: '',
    states: '',
    lenderType: '',
    loanTypes: '',
    callStatus: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Row selection ──
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

  // ── Column widths (localStorage-persisted) ──
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('lender-programs-column-widths');
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_COLUMN_WIDTHS, ...parsed };
      }
    } catch { /* ignore */ }
    return DEFAULT_COLUMN_WIDTHS;
  });

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [columnId]: newWidth };
      localStorage.setItem('lender-programs-column-widths', JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Close sort menu on outside click ──
  useEffect(() => {
    if (!colMenuOpen) return;
    function handleClick() { setColMenuOpen(null); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colMenuOpen]);

  // ── Close detail panel / sort menu on Escape ──
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (colMenuOpen) { setColMenuOpen(null); return; }
        if (selectedLender) setSelectedLender(null);
      }
    }
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [colMenuOpen, selectedLender]);

  // ── Close detail panel on outside click ──
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

  // ── Filtering ──
  const filteredAndSorted = useMemo(() => {
    let result = rows;

    // Text search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(row =>
        row.lender_name.toLowerCase().includes(query) ||
        row.loan_types?.toLowerCase().includes(query) ||
        row.states?.toLowerCase().includes(query) ||
        row.lender_type?.toLowerCase().includes(query) ||
        row.contact_name?.toLowerCase().includes(query) ||
        row.looking_for?.toLowerCase().includes(query)
      );
    }

    // Dropdown filters
    if (filters.institution) result = result.filter(row => row.lender_name === filters.institution);
    if (filters.lookingFor) result = result.filter(row => row.looking_for?.toLowerCase().includes(filters.lookingFor.toLowerCase()));
    if (filters.contact) result = result.filter(row => row.contact_name === filters.contact);
    if (filters.loanSize) result = result.filter(row => rowMatchesLoanCategory(row, filters.loanSize));
    if (filters.states) result = result.filter(row => row.states?.toLowerCase().includes(filters.states.toLowerCase()));
    if (filters.lenderType) result = result.filter(row => row.lender_type === filters.lenderType);
    if (filters.loanTypes) result = result.filter(row => row.loan_types?.toLowerCase().includes(filters.loanTypes.toLowerCase()));
    if (filters.callStatus) result = result.filter(row => row.call_status?.toLowerCase() === filters.callStatus.toLowerCase());

    // Sort
    result = [...result].sort((a, b) => {
      const aVal = ((a[sortField] ?? '') as string).toLowerCase();
      const bVal = ((b[sortField] ?? '') as string).toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [rows, searchQuery, filters, sortField, sortDir]);

  const isAllSelected = useMemo(() => {
    return filteredAndSorted.length > 0 && filteredAndSorted.every(r => selectedLenderIds.has(r.id));
  }, [filteredAndSorted, selectedLenderIds]);

  const selectAll = () => setSelectedLenderIds(new Set(filteredAndSorted.map(r => r.id)));
  const clearSelection = () => setSelectedLenderIds(new Set());

  const handleRowClick = (row: LenderRow) => {
    setSelectedLender(lenderRowToProgram(row));
    if (panelMode !== 'list') setPanelMode('list');
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedLenderIds);
    if (ids.length === 0) return;

    const confirmed = window.confirm(`Delete ${ids.length} selected lender program${ids.length > 1 ? 's' : ''}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('lender_programs').delete().in('id', ids);
      if (error) throw error;
      toast.success(`Deleted ${ids.length} lender${ids.length > 1 ? 's' : ''}`);
      clearSelection();
      setSelectedLender(null);
      queryClient.invalidateQueries({ queryKey: ['lender-programs'] });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      toast.error('Failed to delete selected lenders');
    }
  };

  // ── Filter options ──
  const filterOptions = useMemo(() => {
    const getUniqueValues = (key: keyof LenderRow) => {
      const values = rows
        .map(r => r[key])
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
        .map(v => v.trim());
      return [...new Set(values)].sort();
    };

    const getUniqueStates = () => {
      const states = rows
        .flatMap(r => (r.states || '').split(/[,\s]+/).map(s => s.trim().toUpperCase()))
        .filter(s => VALID_STATE_ABBREVS.has(s));
      return [...new Set(states)].sort();
    };

    const getUniqueLoanTypes = () => {
      const types = rows
        .flatMap(r => (r.loan_types || '').split(',').map(t => t.trim()))
        .filter(t => t !== '');
      return [...new Set(types)].sort();
    };

    return {
      institutions: getUniqueValues('lender_name'),
      contacts: getUniqueValues('contact_name'),
      loanSizes: LOAN_SIZE_CATEGORIES.map(c => c.label),
      states: getUniqueStates(),
      lenderTypes: getUniqueValues('lender_type'),
      loanTypes: getUniqueLoanTypes(),
    };
  }, [rows]);

  const clearFilters = () => {
    setFilters({
      institution: '',
      lookingFor: '',
      contact: '',
      loanSize: '',
      states: '',
      lenderType: '',
      loanTypes: '',
      callStatus: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some(v => v.trim() !== '');

  // ── Inline editing ──
  const handleCellClick = (rowId: string, colKey: string) => {
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col?.editable) return;

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
    const dirtyExisting = Object.entries(localEdits).map(([id, edits]) => {
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
      // Insert new rows
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

      // Update existing rows
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

  // ── File Upload handler (CSV and Excel) ──
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

    if (isExcel) {
      parseAndUploadExcel(file);
    } else {
      parseAndUploadCSV(file);
    }
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

  // ── ColHeader (CRM pattern from People.tsx) ──
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
      <div data-full-bleed className="space-y-4 p-6">
        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-end">
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
              onClick={handleAddRow}
            >
              + Add Row
            </Button>
            <Button
              variant={panelMode === 'filter' ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setPanelMode(panelMode === 'filter' ? 'list' : 'filter')}
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
              {hasActiveFilters && (
                <span className="ml-1 bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">
                  {Object.values(filters).filter(v => v.trim()).length}
                </span>
              )}
            </Button>
            <Button
              variant={panelMode === 'advisor' ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setPanelMode(panelMode === 'advisor' ? 'list' : 'advisor')}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Advisor
            </Button>
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
            {dirtyCount > 0 && (
              <Button onClick={handleSaveAll} disabled={saving} className="gap-1.5 bg-green-600 hover:bg-green-700">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save {dirtyCount}
              </Button>
            )}
          </div>

        {/* Main content grid - table + optional panel */}
        <div className="relative">
        <div className={`grid gap-4 ${panelMode !== 'list' ? 'grid-cols-1 xl:grid-cols-4' : 'grid-cols-1'}`}>
          {/* Table Section */}
          <div className={panelMode !== 'list' ? 'xl:col-span-3' : ''}>
            {/* Search */}
            <div className="relative max-w-md mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search lenders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background border-border rounded-full"
              />
            </div>

            {/* Bulk Selection Toolbar */}
            {selectedLenderIds.size > 0 && (
              <div className="sticky top-0 z-40 px-4 py-2 mb-2 bg-white dark:bg-background border-b border-border">
                <PipelineBulkToolbar
                  selectedCount={selectedLenderIds.size}
                  totalCount={filteredAndSorted.length}
                  onClearSelection={clearSelection}
                  onDeleteBoxes={handleBulkDelete}
                />
              </div>
            )}

            {/* CRM Table */}
            <div className="bg-white dark:bg-card rounded-md border border-[#c8bdd6] overflow-hidden">
              <ScrollArea className="h-[calc(100vh-320px)]">
                <table className="w-full text-[13px]" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {/* Checkbox column header */}
                      <th
                        className="w-12 pl-2 pr-4 py-3 text-center sticky top-0 left-0 z-30"
                        style={{ backgroundColor: '#eee6f6', border: '1px solid #c8bdd6' }}
                      >
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={(checked) => checked ? selectAll() : clearSelection()}
                          className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                        />
                      </th>
                      {COLUMNS.map((col) => {
                        const isSticky = col.key === 'lender_name';
                        return (
                          <ColHeader
                            key={col.key}
                            colKey={col.key}
                            className={isSticky ? 'sticky top-0 z-30 group/hdr' : 'sticky top-0 z-20'}
                            style={isSticky ? { left: 48, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' } : undefined}
                          >
                            {col.label}
                          </ColHeader>
                        );
                      })}
                      {/* Action column */}
                      <th
                        className="sticky top-0 z-20 w-12"
                        style={{ backgroundColor: '#eee6f6', border: '1px solid #c8bdd6' }}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSorted.length === 0 ? (
                      <tr>
                        <td colSpan={COLUMNS.length + 2} className="text-center py-16 text-muted-foreground">
                          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p>No lender programs found</p>
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
                            ? 'bg-[#eee6f6] dark:bg-purple-950/30 hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40 border-l-[3px] border-l-[#3b2778]'
                            : isBulkSelected
                              ? 'bg-[#eee6f6]/60 dark:bg-violet-950/20 hover:bg-[#eee6f6]/80'
                              : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30';

                        const checkboxBg = isDirty
                          ? 'bg-amber-50 dark:bg-amber-950/20 group-hover:bg-amber-100 dark:group-hover:bg-amber-950/30'
                          : isDetailSelected
                            ? 'bg-[#eee6f6] dark:bg-purple-950 group-hover:bg-[#e0d4f0] dark:group-hover:bg-purple-900'
                            : isBulkSelected
                              ? 'bg-[#eee6f6] dark:bg-violet-950/30 group-hover:bg-[#e0d4f0] dark:group-hover:bg-violet-900/40'
                              : 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted';

                        return (
                          <tr
                            key={row.id}
                            onClick={() => handleRowClick(row)}
                            className={`group cursor-pointer transition-colors duration-200 ${rowBg}`}
                          >
                            {/* Checkbox cell */}
                            <td
                              className={`w-12 pl-2 pr-4 py-2 text-center sticky left-0 z-[5] transition-colors ${checkboxBg}`}
                              style={{ border: '1px solid #c8bdd6' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={isBulkSelected}
                                onCheckedChange={() => toggleLenderSelection(row.id)}
                                className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                              />
                            </td>
                            {COLUMNS.map((col) => {
                              const isEditing = editingCell?.rowId === row.id && editingCell?.colKey === col.key;
                              const value = row[col.key] as string;
                              const isLookingFor = col.key === 'looking_for';
                              const isSticky = col.key === 'lender_name';
                              const isEmail = col.key === 'email';
                              const isPhone = col.key === 'phone';
                              const stickyBg = isDirty
                                ? 'bg-amber-50 dark:bg-amber-950/20 group-hover:bg-amber-100 dark:group-hover:bg-amber-950/30'
                                : isDetailSelected
                                  ? 'bg-[#eee6f6] dark:bg-purple-950 group-hover:bg-[#e0d4f0] dark:group-hover:bg-purple-900'
                                  : isBulkSelected
                                    ? 'bg-[#eee6f6] dark:bg-violet-950/30 group-hover:bg-[#e0d4f0] dark:group-hover:bg-violet-900/40'
                                    : 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted';

                              return (
                                <td
                                  key={col.key}
                                  className={`px-4 py-2 overflow-hidden ${
                                    isSticky ? `sticky z-[5] transition-colors ${stickyBg}` : ''
                                  }`}
                                  style={{
                                    width: columnWidths[col.key],
                                    border: '1px solid #c8bdd6',
                                    ...(isSticky ? { left: 48, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' } : {}),
                                  }}
                                  onClick={() => handleCellClick(row.id, col.key)}
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
                                        className="w-full h-20 text-[13px] px-2 py-1 border border-[#3b2778] rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-[#3b2778] resize-none"
                                      />
                                    ) : (
                                      <Input
                                        autoFocus
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={handleCellBlur}
                                        onKeyDown={handleKeyDown}
                                        className="h-8 text-[13px] px-2 border-[#3b2778] focus-visible:ring-1 focus-visible:ring-[#3b2778] bg-background"
                                      />
                                    )
                                  ) : isSticky ? (
                                    <div className="relative flex items-center">
                                      <span className="text-[13px] font-semibold text-foreground truncate flex-1 min-w-0">
                                        {value || ''}
                                      </span>
                                      <button
                                        type="button"
                                        title="Open expanded view"
                                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/lender-programs/expanded-view/${row.id}`); }}
                                        className="absolute right-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground"
                                      >
                                        <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
                                      </button>
                                    </div>
                                  ) : isEmail && value ? (
                                    <a
                                      href={`mailto:${value}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[13px] text-blue-600 hover:underline truncate block"
                                    >
                                      {value}
                                    </a>
                                  ) : isPhone && value ? (
                                    <a
                                      href={`tel:${value}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-[13px] text-blue-600 hover:underline truncate block"
                                    >
                                      {value}
                                    </a>
                                  ) : (
                                    <span className={`text-[13px] block w-full ${
                                      col.key === 'call_status' && value === 'Y' ? 'text-green-600 font-medium' : 'text-foreground'
                                    } ${isLookingFor ? 'whitespace-pre-wrap break-words line-clamp-3' : 'truncate'}`}>
                                      {value || ''}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            {/* Action column: delete + expand */}
                            <td
                              className="w-12 text-center"
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
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              Click any cell to edit. Changes are highlighted in yellow. {filteredAndSorted.length} lender{filteredAndSorted.length !== 1 ? 's' : ''} shown.
            </p>
          </div>

          {/* Filter Panel */}
          {panelMode === 'filter' && (
            <div className="xl:col-span-1">
              <Card className="h-full flex flex-col border-border">
                <CardHeader
                  className="pb-3 border-b flex-shrink-0 cursor-pointer hover:bg-muted/50 transition-colors bg-muted/30"
                  onClick={() => setPanelMode('list')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-slate-700 dark:bg-slate-600">
                        <Filter className="h-4 w-4 text-white" />
                      </div>
                      <CardTitle className="text-base">Filter Lenders</CardTitle>
                      {hasActiveFilters && (
                        <Badge variant="secondary" className="text-xs">
                          {Object.values(filters).filter(v => v.trim()).length} active
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasActiveFilters && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearFilters();
                          }}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Clear
                        </Button>
                      )}
                      <X className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-4 min-h-0 overflow-auto">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Institution</Label>
                      <SearchableSelect
                        options={filterOptions.institutions}
                        value={filters.institution}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, institution: value }))}
                        placeholder="All institutions"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Looking For</Label>
                      <Input
                        placeholder="Type to search..."
                        value={filters.lookingFor}
                        onChange={(e) => setFilters(prev => ({ ...prev, lookingFor: e.target.value }))}
                        className="h-8 text-sm pl-3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Contact Name</Label>
                      <SearchableSelect
                        options={filterOptions.contacts}
                        value={filters.contact}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, contact: value }))}
                        placeholder="All contacts"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Loan Size</Label>
                      <SearchableSelect
                        options={filterOptions.loanSizes}
                        value={filters.loanSize}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, loanSize: value }))}
                        placeholder="All loan sizes"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">States</Label>
                      <SearchableSelect
                        options={filterOptions.states}
                        value={filters.states}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, states: value }))}
                        placeholder="All states"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Lender Type</Label>
                      <SearchableSelect
                        options={filterOptions.lenderTypes}
                        value={filters.lenderType}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, lenderType: value }))}
                        placeholder="All lender types"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Loan Types</Label>
                      <SearchableSelect
                        options={filterOptions.loanTypes}
                        value={filters.loanTypes}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, loanTypes: value }))}
                        placeholder="All loan types"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Call Status</Label>
                      <SearchableSelect
                        options={['Y', 'N']}
                        value={filters.callStatus}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, callStatus: value }))}
                        placeholder="All"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* AI Advisor Panel */}
          {panelMode === 'advisor' && (
            <div className="xl:col-span-1">
              <Card className="h-full flex flex-col border-primary/20">
                <CardHeader
                  className="pb-3 border-b flex-shrink-0 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setPanelMode('list')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-gradient-to-br from-primary to-primary/80">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                      <CardTitle className="text-base">Program Advisor</CardTitle>
                    </div>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 min-h-0">
                  <LenderProgramAssistant />
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Detail Panel overlay */}
        {selectedLender && panelMode === 'list' && (
          <div ref={detailPanelRef} className="absolute right-0 top-0 z-50 h-[calc(100vh-200px)]">
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
        </div>
      </div>
    </AdminLayout>
  );
};

export default LenderPrograms;
